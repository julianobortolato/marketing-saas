/**
 * TDD RED: OpenAI client + rate limiter tests
 * 6 behaviors for callOpenAIWithTools
 * 1 behavior for rateLimitByIP (rate-limiter test only verifies basic contract here)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// These imports will fail until the modules are created (RED phase)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let callOpenAIWithTools: typeof import('../client').callOpenAIWithTools
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let rateLimitByIP: typeof import('../../rate-limit/upstash').rateLimitByIP

beforeEach(async () => {
  vi.resetAllMocks()
  vi.resetModules()
  const clientModule = await import('../client')
  callOpenAIWithTools = clientModule.callOpenAIWithTools
  const upstashModule = await import('../../rate-limit/upstash')
  rateLimitByIP = upstashModule.rateLimitByIP
})

// ============================================================
// Mock helpers
// ============================================================

function makeSupabaseMock(rpcResult: { data: unknown; error: null } = { data: { ok: true, ia_habilitada: true }, error: null }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  } as unknown as ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>
}

// ============================================================
// callOpenAIWithTools tests (6 behaviors)
// ============================================================

describe('callOpenAIWithTools', () => {
  const baseParams = {
    systemPrompt: 'Você é o CMO.',
    userMessage: 'Olá, quero saber sobre planos.',
    tools: [],
    tenantId: '00000000-0000-0000-0000-000000000001',
    conversaId: '00000000-0000-0000-0000-000000000002',
    leadId: '00000000-0000-0000-0000-000000000003',
  }

  it('should return { texto, handoff_solicitado: false, usage } when LLM returns final text in iteration 1', async () => {
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
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
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
            },
          }),
        },
      },
    }

    vi.doMock('openai', () => ({
      default: vi.fn().mockImplementation(() => mockOpenAI),
      OpenAI: vi.fn().mockImplementation(() => mockOpenAI),
    }))

    const { callOpenAIWithTools: callFn } = await import('../client')
    const supabase = makeSupabaseMock()

    const result = await callFn({ ...baseParams, supabase })

    expect(result.handoff_solicitado).toBe(false)
    expect(result.texto).toContain('ótimos planos')
    expect(result.usage.tokens_entrada).toBeGreaterThan(0)
    expect(result.usage.tokens_saida).toBeGreaterThan(0)
    expect(result.usage.custo_usd).toBeGreaterThan(0)
    expect(result.usage.duracao_ms).toBeGreaterThan(0)
  })

  it('should return handoff_solicitado=true when LLM calls handoff_humano tool', async () => {
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
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
            // Second call: LLM returns goodbye message
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
            }),
        },
      },
    }

    vi.doMock('openai', () => ({
      default: vi.fn().mockImplementation(() => mockOpenAI),
      OpenAI: vi.fn().mockImplementation(() => mockOpenAI),
    }))

    const { callOpenAIWithTools: callFn } = await import('../client')
    const supabase = makeSupabaseMock()

    const result = await callFn({ ...baseParams, supabase })

    expect(result.handoff_solicitado).toBe(true)
  })

  it('should return hard fallback after 5 tool-use iterations without final text', async () => {
    // Always returns a tool call, never final text
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

    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(toolCallResponse),
        },
      },
    }

    vi.doMock('openai', () => ({
      default: vi.fn().mockImplementation(() => mockOpenAI),
      OpenAI: vi.fn().mockImplementation(() => mockOpenAI),
    }))

    const { callOpenAIWithTools: callFn } = await import('../client')
    const supabase = makeSupabaseMock()

    const result = await callFn({ ...baseParams, supabase })

    expect(result.texto).toBe('Um momento, vou verificar isso com a equipe')
    expect(result.handoff_solicitado).toBe(true)
    expect(result.motivo).toBe('loop_tool_use')
  })

  it('should call rpc_registrar_uso_ia exactly once per invocation with sucesso=true on success', async () => {
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
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
          }),
        },
      },
    }

    vi.doMock('openai', () => ({
      default: vi.fn().mockImplementation(() => mockOpenAI),
      OpenAI: vi.fn().mockImplementation(() => mockOpenAI),
    }))

    const { callOpenAIWithTools: callFn } = await import('../client')
    const supabase = makeSupabaseMock()

    await callFn({ ...baseParams, supabase })

    // rpc should have been called once
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    const rpcCallArgs = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(rpcCallArgs[0]).toBe('rpc_registrar_uso_ia')
    expect(rpcCallArgs[1]).toMatchObject({
      p_tenant_id: baseParams.tenantId,
      p_modelo: 'gpt-4o',
      p_sucesso: true,
    })
  })

  it('should never throw — returns fallback on OpenAI SDK rejection', async () => {
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValueOnce(
            Object.assign(new Error('rate_limit_exceeded'), { code: 'rate_limit_exceeded' }),
          ),
        },
      },
    }

    vi.doMock('openai', () => ({
      default: vi.fn().mockImplementation(() => mockOpenAI),
      OpenAI: vi.fn().mockImplementation(() => mockOpenAI),
    }))

    const { callOpenAIWithTools: callFn } = await import('../client')
    const supabase = makeSupabaseMock()

    const result = await callFn({ ...baseParams, supabase })

    expect(result.texto).toBe('Um momento, vou verificar isso com a equipe')
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
    // Env vars not set in test env — should fall back gracefully
    const { rateLimitByIP: limitFn } = await import('../../rate-limit/upstash')
    const result = await limitFn('127.0.0.1')
    // In test environment without Upstash env vars, should return { success: true, remaining: 999 }
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(999)
  })
})
