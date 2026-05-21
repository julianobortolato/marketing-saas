/**
 * TDD: OpenAI client + rate limiter tests
 * 6 behaviors for callOpenAIWithTools + 1 for rateLimitByIP
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock server-only (not available in node test env)
vi.mock('server-only', () => ({}))

// Import modules under test
import { callOpenAIWithTools, FALLBACK_OPENAI_ERROR, __setOpenAIClient } from '../client'
import { rateLimitByIP } from '../../rate-limit/upstash'

// ============================================================
// Supabase mock factory
// ============================================================

function makeSupabaseMock() {
  const rpcMock = vi.fn().mockResolvedValue({ data: { ok: true, ia_habilitada: true }, error: null })
  return {
    rpc: rpcMock,
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  } as unknown as ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>
}

import type { CallOpenAIParams } from '../client'
import type OpenAI from 'openai'

const baseParams: Omit<CallOpenAIParams, 'supabase'> = {
  systemPrompt: 'Você é o CMO.',
  userMessage: 'Olá, quero saber sobre planos.',
  tools: [],
  tenantId: '00000000-0000-0000-0000-000000000001',
  conversaId: '00000000-0000-0000-0000-000000000002',
  leadId: '00000000-0000-0000-0000-000000000003',
}

// ============================================================
// Mock OpenAI factory helper
// ============================================================

function makeMockOpenAI(createFn: ReturnType<typeof vi.fn>) {
  return {
    chat: {
      completions: {
        create: createFn,
      },
    },
  } as unknown as OpenAI
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  // Reset singleton to null so each test gets a fresh instance
  __setOpenAIClient(null)
})

// ============================================================
// callOpenAIWithTools tests (6 behaviors)
// ============================================================

describe('callOpenAIWithTools', () => {
  it('should return { texto, handoff_solicitado: false, usage } when LLM returns final text in iteration 1', async () => {
    const createFn = vi.fn().mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Temos ótimos planos! Posso te ajudar a agendar uma aula experimental.',
            tool_calls: null,
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    })

    __setOpenAIClient(makeMockOpenAI(createFn))
    const supabase = makeSupabaseMock()
    const result = await callOpenAIWithTools({ ...baseParams, supabase })

    expect(result.handoff_solicitado).toBe(false)
    expect(result.texto).toContain('ótimos planos')
    expect(result.usage.tokens_entrada).toBeGreaterThan(0)
    expect(result.usage.tokens_saida).toBeGreaterThan(0)
    expect(result.usage.custo_usd).toBeGreaterThan(0)
    expect(result.usage.duracao_ms).toBeGreaterThanOrEqual(0)
  })

  it('should return handoff_solicitado=true when LLM calls handoff_humano tool', async () => {
    const createFn = vi.fn()
      // First call: LLM calls handoff_humano tool
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'handoff_humano',
                    arguments: JSON.stringify({
                      conversa_id: '00000000-0000-0000-0000-000000000002',
                      motivo: 'desconto',
                      observacao_para_atendente: 'Lead pediu desconto',
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 80, completion_tokens: 30 },
      })
      // Second call: goodbye message
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Entendido! Vou conectar você a um atendente.',
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      })

    __setOpenAIClient(makeMockOpenAI(createFn))
    const supabase = makeSupabaseMock()
    const result = await callOpenAIWithTools({ ...baseParams, supabase })

    expect(result.handoff_solicitado).toBe(true)
  })

  it('should return hard fallback after 5 tool-use iterations without final text', async () => {
    // Always returns a tool call — never final text
    const toolCallResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_loop',
                type: 'function',
                function: {
                  name: 'consultar_disponibilidade_ae',
                  arguments: JSON.stringify({ data_iso: '2026-06-20' }),
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 50, completion_tokens: 20 },
    }

    const createFn = vi.fn().mockResolvedValue(toolCallResponse)
    __setOpenAIClient(makeMockOpenAI(createFn))

    const supabase = makeSupabaseMock()
    const result = await callOpenAIWithTools({ ...baseParams, supabase })

    expect(result.texto).toBe(FALLBACK_OPENAI_ERROR)
    expect(result.handoff_solicitado).toBe(true)
    expect(result.motivo).toBe('loop_tool_use')
  })

  it('should call rpc_registrar_uso_ia exactly once per invocation with sucesso=true on success', async () => {
    const createFn = vi.fn().mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Posso te ajudar!',
            tool_calls: null,
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 40 },
    })

    __setOpenAIClient(makeMockOpenAI(createFn))
    const supabase = makeSupabaseMock()
    await callOpenAIWithTools({ ...baseParams, supabase })

    // rpc should have been called once with rpc_registrar_uso_ia
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    const rpcCallArgs = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(rpcCallArgs[0]).toBe('rpc_registrar_uso_ia')
    expect(rpcCallArgs[1]).toMatchObject({
      p_tenant_id: baseParams.tenantId,
      p_modelo: 'gpt-4o',
      p_sucesso: true,
    })
  })

  it('should never throw — returns fallback on OpenAI SDK rejection and logs usage with sucesso=false', async () => {
    const error = new Error('rate_limit_exceeded')
    Object.assign(error, { code: 'rate_limit_exceeded' })
    const createFn = vi.fn().mockRejectedValueOnce(error)

    __setOpenAIClient(makeMockOpenAI(createFn))
    const supabase = makeSupabaseMock()
    const result = await callOpenAIWithTools({ ...baseParams, supabase })

    expect(result.texto).toBe(FALLBACK_OPENAI_ERROR)
    expect(result.handoff_solicitado).toBe(true)
    expect(result.motivo).toBe('openai_error')
    // Should still call rpc_registrar_uso_ia with sucesso=false
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    const rpcArgs = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(rpcArgs[1]).toMatchObject({ p_sucesso: false })
  })
})

// ============================================================
// rateLimitByIP test (basic contract)
// ============================================================

describe('rateLimitByIP', () => {
  it('should return { success: true, remaining: 999 } when UPSTASH env vars are absent', async () => {
    // In test environment without Upstash env vars, should return dev fallback
    const result = await rateLimitByIP('127.0.0.1')
    // UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN are not set in test env
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(999)
  })
})
