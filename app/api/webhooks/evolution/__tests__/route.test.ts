/**
 * TDD: Evolution webhook route tests
 * 9 behaviors for POST /api/webhooks/evolution
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'

// Mock server-only
vi.mock('server-only', () => ({}))

// Mock Supabase admin — factory uses only inline vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

// Mock rate limiters
vi.mock('@/lib/rate-limit/upstash', () => ({
  rateLimitByIP: vi.fn(),
  rateLimitByTenant: vi.fn(),
}))

// Mock OpenAI client
vi.mock('@/lib/openai/client', () => ({
  callOpenAIWithTools: vi.fn(),
  FALLBACK_OPENAI_ERROR: 'Um momento, vou verificar isso com a equipe',
}))

// Mock guardrails
vi.mock('@/lib/agents/cmo/guardrails', () => ({
  applyGuardrails: vi.fn(),
  FALLBACK_DESCONTO: 'Entendo que está buscando a melhor condição.',
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
vi.stubGlobal('fetch', vi.fn())

// Import modules AFTER mocks are registered
import { POST } from '../route'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitByIP, rateLimitByTenant } from '@/lib/rate-limit/upstash'
import { callOpenAIWithTools } from '@/lib/openai/client'
import { applyGuardrails } from '@/lib/agents/cmo/guardrails'

// ============================================================
// Test constants
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

// ============================================================
// Admin client mock setup helper
// ============================================================

type AdminMock = {
  rpc: ReturnType<typeof vi.fn>
  from: ReturnType<typeof vi.fn>
}

function makeAdminMock(): AdminMock {
  const rpc = vi.fn()
  const from = vi.fn()

  ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({ rpc, from })

  return { rpc, from }
}

function setupDefaultFrom(from: ReturnType<typeof vi.fn>) {
  from.mockImplementation((table: string) => {
    const singleChain = (data: unknown) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
    })

    if (table === 'tenants') {
      return singleChain({
        ia_habilitada: true,
        ia_limite_diario_usd: 5.0,
        iara_tenant_id: null,
      })
    }
    if (table === 'academia_config') {
      return singleChain({
        nome_academia: 'Academia Teste',
        horarios: { text: 'Seg-Sex 6h-22h' },
        planos: { text: 'Mensal R$90' },
        palavras_proibidas: [],
        persona_cmo: null,
      })
    }
    if (table === 'evolution_instances') {
      return singleChain({ api_key_encrypted: 'test-api-key' })
    }
    if (table === 'chat_messages') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }
  })
}

function setupDefaultRpc(rpc: ReturnType<typeof vi.fn>, overrides: Record<string, unknown> = {}) {
  rpc.mockImplementation((name: string) => {
    if (name === 'fn_tenant_id_by_evolution_instance') {
      return Promise.resolve({ data: TENANT_ID, error: null })
    }
    if (name === 'rpc_persistir_mensagem_entrada') {
      return Promise.resolve({
        data: overrides.persistData ?? {
          ok: true,
          idempotente: false,
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
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', TEST_SECRET)
  vi.stubEnv('EVOLUTION_API_URL', 'https://evolution.example.com')

  // Default rate limit mocks
  ;(rateLimitByIP as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, remaining: 100 })
  ;(rateLimitByTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, remaining: 100 })

  // Default OpenAI mock
  ;(callOpenAIWithTools as ReturnType<typeof vi.fn>).mockResolvedValue({
    texto: 'Olá! Posso ajudar você a conhecer nossos planos.',
    handoff_solicitado: false,
    usage: { tokens_entrada: 100, tokens_saida: 50, custo_usd: 0.001, duracao_ms: 500 },
  })

  // Default guardrails mock
  ;(applyGuardrails as ReturnType<typeof vi.fn>).mockReturnValue({
    texto: 'Olá! Posso ajudar você a conhecer nossos planos.',
    handoff_solicitado: false,
  })

  // Default fetch mock
  ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 })
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
    // Admin client should NOT have been called at all
    expect(createAdminClient).not.toHaveBeenCalled()
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
    const { rpc, from } = makeAdminMock()
    setupDefaultFrom(from)
    rpc.mockImplementation((name: string) => {
      if (name === 'fn_tenant_id_by_evolution_instance') {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe('unknown_instance')
    const rpcCalls = rpc.mock.calls.map((c: unknown[]) => c[0])
    expect(rpcCalls).not.toContain('rpc_persistir_mensagem_entrada')
  })

  it('should return 200 and call rpc_persistir_mensagem_entrada for valid HMAC + known instance + new message', async () => {
    const { rpc, from } = makeAdminMock()
    setupDefaultFrom(from)
    setupDefaultRpc(rpc)

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)

    expect(response.status).toBe(200)
    const rpcCalls = rpc.mock.calls.map((c: unknown[]) => c[0])
    expect(rpcCalls).toContain('rpc_persistir_mensagem_entrada')
  })

  it('should return 200 without calling callOpenAIWithTools when rpc_persistir_mensagem_entrada returns ia_ativa=false', async () => {
    const { rpc, from } = makeAdminMock()
    setupDefaultFrom(from)
    setupDefaultRpc(rpc, {
      persistData: {
        ok: true,
        idempotente: false,
        conversa_id: CONVERSA_ID,
        lead_id: LEAD_ID,
        ia_ativa: false,
      },
    })

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(callOpenAIWithTools).not.toHaveBeenCalled()
  })

  it('should return 200, call fetch (Evolution send), and NOT call OpenAI when ia_habilitada=false', async () => {
    const { rpc, from } = makeAdminMock()

    from.mockImplementation((table: string) => {
      if (table === 'tenants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ia_habilitada: false, ia_limite_diario_usd: 5.0, iara_tenant_id: null },
            error: null,
          }),
        }
      }
      if (table === 'evolution_instances') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { api_key_encrypted: 'test-key' }, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
      }
    })
    setupDefaultRpc(rpc)

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(callOpenAIWithTools).not.toHaveBeenCalled()
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('happy path: callOpenAIWithTools, applyGuardrails, rpc_persistir_resposta_bot BEFORE fetch (Evolution send)', async () => {
    const callOrder: string[] = []
    const { rpc, from } = makeAdminMock()
    setupDefaultFrom(from)

    rpc.mockImplementation((name: string) => {
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

    ;(callOpenAIWithTools as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      callOrder.push('callOpenAIWithTools')
      return Promise.resolve({
        texto: 'Temos ótimos planos!',
        handoff_solicitado: false,
        usage: { tokens_entrada: 100, tokens_saida: 50, custo_usd: 0.001, duracao_ms: 500 },
      })
    })

    ;(applyGuardrails as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      callOrder.push('applyGuardrails')
      return { texto: 'Temos ótimos planos!', handoff_solicitado: false }
    })

    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      callOrder.push('evolution_send')
      return Promise.resolve({ ok: true, status: 200 })
    })

    const body = JSON.stringify(buildEvolutionPayload())
    const signature = buildSignature(body, TEST_SECRET)
    const request = makeRequest(body, signature)

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(callOrder.indexOf('callOpenAIWithTools')).toBeLessThan(callOrder.indexOf('applyGuardrails'))
    expect(callOrder.indexOf('applyGuardrails')).toBeLessThan(callOrder.indexOf('rpc_persistir_resposta_bot'))
    expect(callOrder.indexOf('rpc_persistir_resposta_bot')).toBeLessThan(callOrder.indexOf('evolution_send'))
  })

  it('idempotency: same evolution_message_id 3 times produces exactly 1 OpenAI call', async () => {
    let persistCallCount = 0
    const { rpc, from } = makeAdminMock()
    setupDefaultFrom(from)

    rpc.mockImplementation((name: string) => {
      if (name === 'fn_tenant_id_by_evolution_instance') return Promise.resolve({ data: TENANT_ID, error: null })
      if (name === 'rpc_persistir_mensagem_entrada') {
        persistCallCount++
        return Promise.resolve({
          data: {
            ok: true,
            idempotente: persistCallCount > 1, // first call is new, rest are idempotent
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

    await POST(makeRequest(body, signature))
    await POST(makeRequest(body, signature))
    await POST(makeRequest(body, signature))

    // OpenAI should only have been called once (idempotent redeliveries skip LLM)
    expect(callOpenAIWithTools).toHaveBeenCalledTimes(1)
  })

  it('should return 500 with { error: "internal" } on thrown exception, never echoing exception.message', async () => {
    const { rpc, from } = makeAdminMock()
    setupDefaultFrom(from)

    rpc.mockImplementation((name: string) => {
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
    expect(JSON.stringify(json)).not.toContain('Database connection lost')
    expect(JSON.stringify(json)).not.toContain('sensitive')
  })
})
