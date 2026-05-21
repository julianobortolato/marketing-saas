import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server')
vi.mock('@/lib/queries/usuario')
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { saveEditorialConfig } from '../actions'
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

const VALID_INPUT = {
  caderno_editorial_escopo: 'Foco em emagrecimento',
  caderno_editorial_tom: 'Consultivo',
  palavras_proibidas: ['desconto'],
}

function makeUpdateMock(updateResult: { error: unknown }) {
  const eqMock = vi.fn().mockResolvedValue(updateResult)
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
  const fromMock = vi.fn().mockReturnValue({ update: updateMock })
  return { from: fromMock, updateMock, eqMock }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('saveEditorialConfig', () => {
  it('updates academia_config filtered by tenant_id from fn_tenant_id and returns { success: true }', async () => {
    mockGetCurrentUsuario.mockResolvedValue(OWNER)
    const { from, updateMock, eqMock } = makeUpdateMock({ error: null })
    const rpcMock = vi.fn().mockResolvedValue({ data: 'tenant-1', error: null })
    mockCreateClient.mockResolvedValue({ from, rpc: rpcMock } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await saveEditorialConfig(VALID_INPUT)

    expect(result).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledWith('fn_tenant_id')
    expect(updateMock).toHaveBeenCalledWith(expect.not.objectContaining({ tenant_id: expect.anything() }))
    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-1')
  })

  it('returns { error } without DB write when fn_tenant_id returns null', async () => {
    mockGetCurrentUsuario.mockResolvedValue(OWNER)
    const { from } = makeUpdateMock({ error: null })
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })
    mockCreateClient.mockResolvedValue({ from, rpc: rpcMock } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await saveEditorialConfig(VALID_INPUT)

    expect(result).toHaveProperty('error')
    expect(from).not.toHaveBeenCalled()
  })

  it('returns { error: "Acesso negado." } for role=viewer without any DB call', async () => {
    mockGetCurrentUsuario.mockResolvedValue(VIEWER)
    const rpcMock = vi.fn()
    const { from: fromMock } = makeUpdateMock({ error: null })
    mockCreateClient.mockResolvedValue({ from: fromMock, rpc: rpcMock } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await saveEditorialConfig(VALID_INPUT)

    expect(result).toEqual({ error: 'Acesso negado.' })
    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns { error } when update fails', async () => {
    mockGetCurrentUsuario.mockResolvedValue(OWNER)
    const { from } = makeUpdateMock({ error: { message: 'connection error' } })
    const rpcMock = vi.fn().mockResolvedValue({ data: 'tenant-1', error: null })
    mockCreateClient.mockResolvedValue({ from, rpc: rpcMock } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await saveEditorialConfig(VALID_INPUT)

    expect(result).toHaveProperty('error')
    expect(result).not.toHaveProperty('success')
  })
})
