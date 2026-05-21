import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server')
vi.mock('@/lib/queries/usuario')
vi.mock('@/lib/queries/saude-mkt')
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { buildSaudeMktPayload } from '@/lib/queries/saude-mkt'

const mockCreateClient = vi.mocked(createClient)
const mockGetCurrentUsuario = vi.mocked(getCurrentUsuario)
const mockBuildPayload = vi.mocked(buildSaudeMktPayload)

const OWNER = {
  id: 'user-1',
  tenant_id: 'tenant-1',
  role: 'owner' as const,
  nome: 'Dono',
}

const MANAGER = {
  id: 'user-2',
  tenant_id: 'tenant-1',
  role: 'manager' as const,
  nome: 'Manager',
}

const VIEWER = {
  id: 'user-3',
  tenant_id: 'tenant-1',
  role: 'viewer' as const,
  nome: 'Viewer',
}

const MOCK_PAYLOAD = {
  status_ia: { habilitada: true, desabilitada_em: null, motivo: null },
  usage_diario: { custo_usd: 1.5, chamadas_count: 30, limite_usd: 5, percentual: 30 },
  conversas: { total: 10, em_handoff: 2, ia_ativa: 8 },
  mensagens: { entrada_24h: 50, saida_24h: 48, falhas_24h: 2 },
  latencia_24h: { p50_ms: 800, p95_ms: 2100 },
}

function makeAuthMock(user: { id: string } | null, error: unknown = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error }),
    },
  }
}

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/admin/saude-mkt')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/saude-mkt', () => {
  it('returns 401 when no session (auth error)', async () => {
    mockCreateClient.mockResolvedValue(
      makeAuthMock(null, { message: 'not authenticated' }) as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never
    )

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Não autenticado.')
  })

  it('returns 401 when user exists in auth but no usuarios row', async () => {
    mockCreateClient.mockResolvedValue(
      makeAuthMock({ id: 'auth-user-1' }) as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never
    )
    mockGetCurrentUsuario.mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Usuário não encontrado.')
  })

  it('returns 403 for role=viewer', async () => {
    mockCreateClient.mockResolvedValue(
      makeAuthMock({ id: 'user-3' }) as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never
    )
    mockGetCurrentUsuario.mockResolvedValue(VIEWER)

    const res = await GET(makeRequest())

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Acesso negado.')
  })

  it('returns 403 for role=manager (diagnostics is owner-only)', async () => {
    mockCreateClient.mockResolvedValue(
      makeAuthMock({ id: 'user-2' }) as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never
    )
    mockGetCurrentUsuario.mockResolvedValue(MANAGER)

    const res = await GET(makeRequest())

    expect(res.status).toBe(403)
  })

  it('returns 200 with full JSON shape for role=owner', async () => {
    mockCreateClient.mockResolvedValue(
      makeAuthMock({ id: 'user-1' }) as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never
    )
    mockGetCurrentUsuario.mockResolvedValue(OWNER)
    mockBuildPayload.mockResolvedValue(MOCK_PAYLOAD)

    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      status_ia: expect.objectContaining({ habilitada: expect.any(Boolean) }),
      usage_diario: expect.objectContaining({ custo_usd: expect.any(Number) }),
      conversas: expect.objectContaining({ total: expect.any(Number) }),
      mensagens: expect.objectContaining({ entrada_24h: expect.any(Number) }),
      latencia_24h: expect.objectContaining({ p50_ms: expect.anything() }),
    })
  })

  it('response JSON does not contain any PII field names (telefone, remotejid, nome, email)', async () => {
    mockCreateClient.mockResolvedValue(
      makeAuthMock({ id: 'user-1' }) as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never
    )
    mockGetCurrentUsuario.mockResolvedValue(OWNER)
    mockBuildPayload.mockResolvedValue(MOCK_PAYLOAD)

    const res = await GET(makeRequest())
    const body = await res.json()
    const bodyStr = JSON.stringify(body)

    expect(bodyStr).not.toMatch(/"telefone"/)
    expect(bodyStr).not.toMatch(/"remotejid"/)
    expect(bodyStr).not.toMatch(/"nome"/)
    expect(bodyStr).not.toMatch(/"email"/)
  })

  it('calls buildSaudeMktPayload with tenantId from DB usuario (never from request)', async () => {
    mockCreateClient.mockResolvedValue(
      makeAuthMock({ id: 'user-1' }) as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never
    )
    mockGetCurrentUsuario.mockResolvedValue(OWNER)
    mockBuildPayload.mockResolvedValue(MOCK_PAYLOAD)

    await GET(makeRequest())

    expect(mockBuildPayload).toHaveBeenCalledWith(OWNER.tenant_id)
  })

  it('returns 500 when buildSaudeMktPayload throws', async () => {
    mockCreateClient.mockResolvedValue(
      makeAuthMock({ id: 'user-1' }) as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never
    )
    mockGetCurrentUsuario.mockResolvedValue(OWNER)
    mockBuildPayload.mockRejectedValue(new Error('DB connection lost'))

    const res = await GET(makeRequest())

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('internal')
  })
})
