/**
 * OpenAI GPT-4o client with synchronous tool-use loop (ADR-MKT-001 §7, §8.2).
 *
 * callOpenAIWithTools:
 *  - Uses GPT-4o with function calling
 *  - Tool-use loop: max 5 iterations
 *  - After handoff_humano: one more iteration for goodbye message
 *  - Calls rpc_registrar_uso_ia after EVERY invocation (success or failure)
 *  - Never throws — returns hard fallback on any error
 *
 * Pricing constants (verify against current OpenAI pricing on refresh — 2026-05):
 *  COST_INPUT_PER_1K: $0.0025 / 1k input tokens (GPT-4o)
 *  COST_OUTPUT_PER_1K: $0.01 / 1k output tokens (GPT-4o)
 */
import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UsageStats } from '@/lib/openai/types'
import { dispatchTool } from '@/lib/agents/cmo/tools'

// verify against current OpenAI pricing on refresh (openai.com/pricing)
const COST_INPUT_PER_1K = 0.0025   // USD per 1k input tokens — GPT-4o, 2026-05
const COST_OUTPUT_PER_1K = 0.01    // USD per 1k output tokens — GPT-4o, 2026-05

export const FALLBACK_OPENAI_ERROR = 'Um momento, vou verificar isso com a equipe'
const MAX_TOOL_ITERATIONS = 5

let _openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openaiClient
}

/**
 * Test-only: inject a mock OpenAI client.
 * Not for production use.
 */
export function __setOpenAIClient(client: OpenAI | null): void {
  _openaiClient = client
}

function computeCost(tokensInput: number, tokensOutput: number): number {
  return (tokensInput / 1000) * COST_INPUT_PER_1K +
    (tokensOutput / 1000) * COST_OUTPUT_PER_1K
}

/**
 * Logs usage to rpc_registrar_uso_ia.
 * Called after EVERY invocation — success or failure.
 * Never throws.
 */
async function logUsage(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    tenantId: string
    conversaId: string
    tokensEntrada: number
    tokensSaida: number
    custoUsd: number
    duracaoMs: number
    sucesso: boolean
    erro?: string
  },
): Promise<void> {
  try {
    await supabase.rpc('rpc_registrar_uso_ia', {
      p_tenant_id: params.tenantId,        // explicitly passed — webhook has no session
      p_conversa_id: params.conversaId,
      p_modelo: 'gpt-4o',
      p_tokens_entrada: params.tokensEntrada,
      p_tokens_saida: params.tokensSaida,
      p_custo_usd: params.custoUsd,
      p_duracao_ms: params.duracaoMs,
      p_sucesso: params.sucesso,
      p_erro: params.erro ?? null,
    })
  } catch {
    // Usage logging failure must never propagate — silently swallow
  }
}

export interface CallOpenAIParams {
  systemPrompt: string
  userMessage: string
  tools: ChatCompletionTool[]
  tenantId: string
  conversaId: string
  leadId: string
  supabase: ReturnType<typeof createAdminClient>
}

export interface CallOpenAIResult {
  texto: string
  handoff_solicitado: boolean
  motivo?: string
  usage: UsageStats
}

/**
 * Calls OpenAI GPT-4o with a synchronous tool-use loop (max 5 iterations).
 *
 * Behavior:
 * - Loops while the LLM returns tool_calls (up to MAX_TOOL_ITERATIONS)
 * - Dispatches each tool call via dispatchTool
 * - After handoff_humano: continues for ONE more iteration to get goodbye message
 * - On any OpenAI error: returns hard fallback string + logs usage with sucesso=false
 * - After loop: calls rpc_registrar_uso_ia with cumulative usage stats
 *
 * Never throws.
 */
export async function callOpenAIWithTools(params: CallOpenAIParams): Promise<CallOpenAIResult> {
  const { systemPrompt, userMessage, tools, tenantId, conversaId, leadId, supabase } = params

  const startMs = Date.now()
  let cumulativeInputTokens = 0
  let cumulativeOutputTokens = 0

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  let iterations = 0
  let handoffSolicitado = false
  let handoffMotivo: string | undefined
  let handoffOccurred = false
  let finalText: string | null = null

  try {
    const openai = getOpenAI()

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        messages,
      })

      const usage = response.usage
      if (usage) {
        cumulativeInputTokens += usage.prompt_tokens ?? 0
        cumulativeOutputTokens += usage.completion_tokens ?? 0
      }

      const choice = response.choices[0]
      const assistantMessage = choice?.message

      if (!assistantMessage) break

      // Append assistant turn to messages for multi-turn context
      messages.push({
        role: 'assistant',
        content: assistantMessage.content ?? null,
        tool_calls: assistantMessage.tool_calls ?? undefined,
      })

      // Case A: LLM returned final text (no tool_calls or stop reason)
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        if (assistantMessage.content) {
          finalText = assistantMessage.content
        }
        break
      }

      // Case B: LLM called tools — dispatch each and append results
      for (const toolCall of assistantMessage.tool_calls) {
        // Narrow to function tool calls only — skip custom tool call variants
        if (toolCall.type !== 'function') continue
        // After type narrowing, toolCall is ChatCompletionMessageFunctionToolCall
        const fnToolCall = toolCall as { id: string; type: 'function'; function: { name: string; arguments: string } }
        const toolName = fnToolCall.function.name
        let toolArgs: unknown
        try {
          toolArgs = JSON.parse(fnToolCall.function.arguments)
        } catch {
          toolArgs = {}
        }

        const toolResult = await dispatchTool(toolName, toolArgs, {
          supabase,
          tenantId,
          conversaId,
          leadId,
        })

        // Detect handoff_humano tool call
        if (toolName === 'handoff_humano') {
          handoffSolicitado = true
          handoffMotivo = 'desconto' // will be refined by guardrails
          handoffOccurred = true
        }

        messages.push({
          role: 'tool',
          tool_call_id: fnToolCall.id,
          content: JSON.stringify(toolResult),
        })
      }

      // After handoff: allow ONE more iteration for goodbye message, then break
      if (handoffOccurred) {
        // One more LLM call to generate the goodbye message
        iterations++ // count the final goodbye call against the budget
        if (iterations <= MAX_TOOL_ITERATIONS) {
          const goodbyeResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? 'none' : undefined, // force text-only on goodbye
            messages,
          })

          const goodbyeUsage = goodbyeResponse.usage
          if (goodbyeUsage) {
            cumulativeInputTokens += goodbyeUsage.prompt_tokens ?? 0
            cumulativeOutputTokens += goodbyeUsage.completion_tokens ?? 0
          }

          const goodbyeText = goodbyeResponse.choices[0]?.message?.content
          if (goodbyeText) {
            finalText = goodbyeText
          }
        }
        break
      }
    }

    // Max iterations reached without final text
    if (!finalText && !handoffSolicitado) {
      const duracaoMs = Date.now() - startMs
      const custoUsd = computeCost(cumulativeInputTokens, cumulativeOutputTokens)

      await logUsage(supabase, {
        tenantId,
        conversaId,
        tokensEntrada: cumulativeInputTokens,
        tokensSaida: cumulativeOutputTokens,
        custoUsd,
        duracaoMs,
        sucesso: false,
        erro: 'loop_exceeded',
      })

      return {
        texto: FALLBACK_OPENAI_ERROR,
        handoff_solicitado: true,
        motivo: 'loop_tool_use',
        usage: {
          tokens_entrada: cumulativeInputTokens,
          tokens_saida: cumulativeOutputTokens,
          custo_usd: custoUsd,
          duracao_ms: duracaoMs,
        },
      }
    }

    const duracaoMs = Date.now() - startMs
    const custoUsd = computeCost(cumulativeInputTokens, cumulativeOutputTokens)

    await logUsage(supabase, {
      tenantId,
      conversaId,
      tokensEntrada: cumulativeInputTokens,
      tokensSaida: cumulativeOutputTokens,
      custoUsd,
      duracaoMs,
      sucesso: true,
    })

    return {
      texto: finalText ?? FALLBACK_OPENAI_ERROR,
      handoff_solicitado: handoffSolicitado,
      motivo: handoffMotivo,
      usage: {
        tokens_entrada: cumulativeInputTokens,
        tokens_saida: cumulativeOutputTokens,
        custo_usd: custoUsd,
        duracao_ms: duracaoMs,
      },
    }
  } catch (err) {
    // Never throw — return fallback
    const duracaoMs = Date.now() - startMs
    const custoUsd = computeCost(cumulativeInputTokens, cumulativeOutputTokens)
    const errCode = (err as { code?: string })?.code ?? 'unknown'

    // Log only tenantId + error.code — never log PII or full message
    console.error('[callOpenAIWithTools] error', { tenantId, errCode })

    await logUsage(supabase, {
      tenantId,
      conversaId,
      tokensEntrada: cumulativeInputTokens,
      tokensSaida: cumulativeOutputTokens,
      custoUsd,
      duracaoMs,
      sucesso: false,
      erro: err instanceof Error ? err.message.slice(0, 200) : 'unknown_error',
    })

    return {
      texto: FALLBACK_OPENAI_ERROR,
      handoff_solicitado: true,
      motivo: 'openai_error',
      usage: {
        tokens_entrada: cumulativeInputTokens,
        tokens_saida: cumulativeOutputTokens,
        custo_usd: custoUsd,
        duracao_ms: duracaoMs,
      },
    }
  }
}
