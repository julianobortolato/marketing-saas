import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server')
vi.mock('@/lib/queries/usuario')
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { assumirConversa, reativarAgente } from '../actions'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUsuario } from '@/lib/queries/usuario'

const mockCreateClient = vi.mocked(createClient)
const mockGetCurrentUsuario = vi.mocked(getCurrentUsuario)

const OWNER = {
  id: 'user-1',
  tenant_id: 'tenant-1',
  role: 'owner' as const,
  nome: 'Dono',
}

const VIEWER = {
  id: 'user-2',
  tenant_id: 'tenant-1',
  role: 'viewer' as const,
  nome: 'Viewer',
}

function makeUpdateMock(resolvedValue: { error: unknown }) {
  const eqMock2 = vi.fn().mockResolvedValue(resolvedValue)
  const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 })
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock1 })
  const fromMock = vi.fn().mockReturnValue({ update: updateMock })
  return { from: fromMock }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('assumirConversa', () => {
  it('calls rpc_handoff_humano with motivo=pedido_explicito and returns { success: true }', async () => {
    mockGetCurrentUsuario.mockResolvedValue(OWNER)
    const rpcMock = vi.fn().mockResolvedValue({ data: { ok: true }, error: null })
    mockCreateClient.mockResolvedValue({ rpc: rpcMock } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await assumirConversa('conv-abc')

    expect(result).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledWith('rpc_handoff_humano', {
      p_tenant_id: OWNER.tenant_id,
      p_conversa_id: 'conv-abc',
      p_motivo: 'pedido_explicito',
    })
  })

  it('returns { error } when RPC returns an error', async () => {
    mockGetCurrentUsuario.mockResolvedValue(OWNER)
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'conversa_not_found_or_wrong_tenant' },
    })
    mockCreateClient.mockResolvedValue({ rpc: rpcMock } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await assumirConversa('conv-abc')

    expect(result).toHaveProperty('error')
  })

  it('returns { error: "Acesso negado." } for role=viewer without calling RPC', async () => {
    mockGetCurrentUsuario.mockResolvedValue(VIEWER)
    const rpcMock = vi.fn()
    mockCreateClient.mockResolvedValue({ rpc: rpcMock } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await assumirConversa('conv-abc')

    expect(result).toEqual({ error: 'Acesso negado.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('reativarAgente', () => {
  it('returns { error: "Acesso negado." } for role=viewer without DB write', async () => {
    mockGetCurrentUsuario.mockResolvedValue(VIEWER)
    const fromMock = vi.fn()
    mockCreateClient.mockResolvedValue({ from: fromMock } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await reativarAgente('conv-abc')

    expect(result).toEqual({ error: 'Acesso negado.' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('updates ia_ativa=true with defense-in-depth tenant_id filter and returns { success: true }', async () => {
    mockGetCurrentUsuario.mockResolvedValue(OWNER)
    const { from } = makeUpdateMock({ error: null })
    mockCreateClient.mockResolvedValue({ from } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await reativarAgente('conv-abc')

    expect(result).toEqual({ success: true })
    expect(from).toHaveBeenCalledWith('conversas')
    const updateArg = from.mock.results[0].value
    expect(updateArg.update).toHaveBeenCalledWith({
      ia_ativa: true,
      motivo_handoff: null,
    })
  })
})
