/**
 * TDD RED: Evolution webhook route tests
 * 9 behaviors for POST /api/webhooks/evolution
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'

// Mock server-only
vi.mock('server-only', () => ({}))

// Mock Supabase admin
const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockUpdate = vi.fn()

function makeChainMock(finalResult: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResult),
    update: vi.fn().mockReturnThis(),
  }
  return chain
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}))

// Mock rate limiters (always pass in tests)
vi.mock('@/lib/rate-limit/upstash', () => ({
  rateLimitByIP: vi.fn().mockResolvedValue({ success: true, remaining: 100 }),
  rateLimitByTenant: vi.fn().mockResolvedValue({ success: true, remaining: 100 }),
}))

// Mock OpenAI client
const mockCallOpenAI = vi.fn()
vi.mock('@/lib/openai/client', () => ({
  callOpenAIWithTools: mockCallOpenAI,
  FALLBACK_OPENAI_ERROR: 'Um momento, vou verificar isso com a equipe',
}))

// Mock guardrails
const mockApplyGuardrails = vi.fn()
vi.mock('@/lib/agents/cmo/guardrails', () => ({
  applyGuardrails: mockApplyGuardrails,
  FALLBACK_DESCONTO: 'Entendo que está buscando a melhor condição. Vou conectar você a um especialista.',
}))

// Mock system prompt
vi.mock('@/lib/agents/cmo/system-prompt', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('MOCKED_SYSTEM_PROMPT'),
}))

// Mock tools
vi.mock('@/lib/agents/cmo/tools', () => ({
  cmoTools: [],
  dispatchTool: vi.fn(),
}))

// Mock global fetch (Evolution API send)
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import the handler AFTER mocks are set up
import { POST } from '../route'

// ============================================================
// Test helpers
// ============================================================

const TEST_SECRET = 'test-webhook-secret-32-chars-long-abc'
const INSTANCE_NAME = 'test_instance'
const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const CONVERSA_ID = '00000000-0000-0000-0000-000000000002'
const LEAD_ID = '00000000-0000-0000-0000-000000000003'

function buildSignature(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

function buildEvolutionPayload(overrides: Record<string, unknown> = {}) {
  return {
    instance: INSTANCE_NAME,
    data: {
      key: {
        remoteJid: '5567999990000@s.whatsapp.net',
        id: 'MSG_ID_001',
        fromMe: false,
      },
      messageType: 'conversation',
      message: {
        conversation: 'Olá, quero saber sobre planos!',
      },
      pushName: 'João Teste',
    },
    ...overrides,
  }
}

function makeRequest(body: string, signature: string) {
  return new NextRequest('http://localhost:3000/api/webhooks/evolution', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': signature,
      'x-forwarded-for': '192.168.1.1',
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default env
  vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', TEST_SECRET)
  vi.stubEnv('EVOLUTION_API_URL', 'https://evolution.example.com')

  // Default mock chain for from().select().eq().single()
  mockFrom.mockImplementation((table: string) => {
    if (table === 'tenants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                ia_habilitada: true,
                ia_limite_diario_usd: 5.00,
                iara_tenant_id: null,
              },
              error: null,
            }),
          }),
        }),
      }
    }
    if (table === 'academia_config') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                nome_academia: 'Academia Teste',
                horarios: { text: 'Seg-Sex 6h-22h' },
                planos: { text: 'Mensal R$90' },
                palavras_proibidas: [],
                persona_cmo: null,
              },
              error: null,
            }),
          }),
        }),
      }
    }
    if (table === 'chat_messages') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }
    }
    if (table === 'evolution_instances') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                api_key_encrypted: 'test-api-key',
              },
              error: null,
            }),
          }),
        }),
      }
    }
    // Default fallback
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }
  })

  // Default mockRpc behavior
  mockRpc.mockImplementation((name: string) => {
    if (name === 'fn_tenant_id_by_evolution_instance') {
      return Promise.resolve({ data: TENANT_ID, error: null })
    }
    if (name === 'rpc_persistir_mensagem_entrada') {
      return Promise.resolve({
        data: { ok: true, idempotente: false, conversa_id: CONVERSA_ID, lead_id: LEAD_ID, ia_ativa: true },
        error: null,
      })
    }
    if (name === 'rpc_persistir_resposta_bot') {
      return Promise.resolve({ data: { ok: true, message_id: 'bot-msg-001' }, error: null })
    }
    return Promise.resolve({ data: { ok: true }, error: null })
  })

  // Default callOpenAI behavior
  mockCallOpenAI.mockResolvedValue({
    texto: 'Olá! Posso ajudar você a conhecer nossos planos.',
    handoff_solicitado: false,
    usage: { tokens_entrada: 100, tokens_saida: 50, custo_usd: 0.001, duracao_ms: 500 },
  })

  // Default guardrails behavior
  mockApplyGuardrails.mockReturnValue({
    texto: 'Olá! Posso ajudar você a conhecer nossos planos.',
    handoff_solicitado: false,
  })

  // Default Evolution API send
  mockFetch.mockResolvedValue({ ok: true, status: 200 })
})

// ============================================================
// Tests (9 behaviors)
// ============================================================

describe('POST /api/webhooks/evolution', () => {
  it('should return 401 and NOT call supabase.rpc when HMAC is invalid', async () => {
    const body = JSON.stringify(buildEvolutionPayload())
    const request = makeRequest(body, 'sha256=invalid_signature_here')

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe('invalid_signature')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('should return 500 with { error: "webhook_misconfigured" } when EVOLUTION_WEBHOOK_SECRET is missing', async () => {
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', '')

    const body = JSON.stringify(buildEvolutionPayload())
    const request = makeRequest(body, 'sha256=anything')

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('webhook_misconfigured')
  })

  it('should return 200 silently for unknown instance_name (idempotency)', async () => {
    // fn_tenant_id_by_evolution_instance returns null for unknown instance
    mockRpc.mockImplementationOnce(() =>
      Promise.resolve({ data: null, error: null })
    )

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe('unknown_instance')
    // Should NOT have called rpc_persistir_mensagem_entrada
    const rpcCalls = mockRpc.mock.calls.map((c) => c[0])
    expect(rpcCalls).not.toContain('rpc_persistir_mensagem_entrada')
  })

  it('should return 200 and call rpc_persistir_mensagem_entrada for valid HMAC + known instance + new message', async () => {
    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)

    expect(response.status).toBe(200)
    const rpcCalls = mockRpc.mock.calls.map((c) => c[0])
    expect(rpcCalls).toContain('rpc_persistir_mensagem_entrada')
  })

  it('should return 200 without calling callOpenAIWithTools when rpc_persistir_mensagem_entrada returns ia_ativa=false', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'fn_tenant_id_by_evolution_instance') {
        return Promise.resolve({ data: TENANT_ID, error: null })
      }
      if (name === 'rpc_persistir_mensagem_entrada') {
        return Promise.resolve({
          data: { ok: true, idempotente: false, conversa_id: CONVERSA_ID, lead_id: LEAD_ID, ia_ativa: false },
          error: null,
        })
      }
      return Promise.resolve({ data: { ok: true }, error: null })
    })

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockCallOpenAI).not.toHaveBeenCalled()
  })

  it('should return 200, send fallback via Evolution, and NOT call OpenAI when ia_habilitada=false', async () => {
    // tenant row returns ia_habilitada=false
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  ia_habilitada: false,
                  ia_limite_diario_usd: 5.00,
                  iara_tenant_id: null,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'evolution_instances') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { api_key_encrypted: 'test-api-key' },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
      }
    })

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockCallOpenAI).not.toHaveBeenCalled()
    // Should have called fetch (Evolution API send) for fallback message
    expect(mockFetch).toHaveBeenCalled()
  })

  it('happy path: should call callOpenAIWithTools, applyGuardrails, rpc_persistir_resposta_bot BEFORE Evolution send, in correct order', async () => {
    const callOrder: string[] = []

    mockCallOpenAI.mockImplementationOnce(() => {
      callOrder.push('callOpenAIWithTools')
      return Promise.resolve({
        texto: 'Temos ótimos planos!',
        handoff_solicitado: false,
        usage: { tokens_entrada: 100, tokens_saida: 50, custo_usd: 0.001, duracao_ms: 500 },
      })
    })

    mockApplyGuardrails.mockImplementationOnce(() => {
      callOrder.push('applyGuardrails')
      return { texto: 'Temos ótimos planos!', handoff_solicitado: false }
    })

    mockRpc.mockImplementation((name: string) => {
      if (name === 'fn_tenant_id_by_evolution_instance') return Promise.resolve({ data: TENANT_ID, error: null })
      if (name === 'rpc_persistir_mensagem_entrada') {
        return Promise.resolve({
          data: { ok: true, idempotente: false, conversa_id: CONVERSA_ID, lead_id: LEAD_ID, ia_ativa: true },
          error: null,
        })
      }
      if (name === 'rpc_persistir_resposta_bot') {
        callOrder.push('rpc_persistir_resposta_bot')
        return Promise.resolve({ data: { ok: true, message_id: 'bot-msg-001' }, error: null })
      }
      return Promise.resolve({ data: { ok: true }, error: null })
    })

    mockFetch.mockImplementationOnce(() => {
      callOrder.push('evolution_send')
      return Promise.resolve({ ok: true, status: 200 })
    })

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)

    expect(response.status).toBe(200)

    // Verify call order
    expect(callOrder.indexOf('callOpenAIWithTools')).toBeLessThan(callOrder.indexOf('applyGuardrails'))
    expect(callOrder.indexOf('applyGuardrails')).toBeLessThan(callOrder.indexOf('rpc_persistir_resposta_bot'))
    expect(callOrder.indexOf('rpc_persistir_resposta_bot')).toBeLessThan(callOrder.indexOf('evolution_send'))
  })

  it('idempotency: same evolution_message_id 3 times produces exactly 1 OpenAI call', async () => {
    // On second and third redelivery, rpc_persistir_mensagem_entrada returns idempotente=true
    let callCount = 0
    mockRpc.mockImplementation((name: string) => {
      if (name === 'fn_tenant_id_by_evolution_instance') return Promise.resolve({ data: TENANT_ID, error: null })
      if (name === 'rpc_persistir_mensagem_entrada') {
        callCount++
        const isFirst = callCount === 1
        return Promise.resolve({
          data: {
            ok: true,
            idempotente: !isFirst,
            conversa_id: CONVERSA_ID,
            lead_id: LEAD_ID,
            ia_ativa: true,
          },
          error: null,
        })
      }
      if (name === 'rpc_persistir_resposta_bot') {
        return Promise.resolve({ data: { ok: true, message_id: 'bot-msg-001' }, error: null })
      }
      return Promise.resolve({ data: { ok: true }, error: null })
    })

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)

    // Send 3 times with same payload
    await POST(makeRequest(body, signature))
    await POST(makeRequest(body, signature))
    await POST(makeRequest(body, signature))

    // OpenAI should only have been called once (idempotent redeliveries skip LLM)
    expect(mockCallOpenAI).toHaveBeenCalledTimes(1)
  })

  it('should return 500 with { error: "internal" } on thrown exception, never echoing exception.message', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'fn_tenant_id_by_evolution_instance') return Promise.resolve({ data: TENANT_ID, error: null })
      if (name === 'rpc_persistir_mensagem_entrada') {
        throw new Error('Database connection lost — very sensitive internal error')
      }
      return Promise.resolve({ data: { ok: true }, error: null })
    })

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('internal')
    // Must NOT echo the exception message
    expect(JSON.stringify(json)).not.toContain('Database connection lost')
    expect(JSON.stringify(json)).not.toContain('sensitive')
  })
})
