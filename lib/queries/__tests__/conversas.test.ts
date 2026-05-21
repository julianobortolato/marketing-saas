import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server')

import { getConversas, getConversaWithMessages } from '../conversas'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

function makeConversasMock(resolvedValue: { data: unknown; error: unknown }) {
  const orderMock = vi.fn().mockResolvedValue(resolvedValue)
  const selectMock = vi.fn().mockReturnValue({ order: orderMock })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock })
  return { from: fromMock, select: selectMock, order: orderMock }
}

function makeConversaWithMessagesMock(
  conversaResult: { data: unknown; error: unknown },
  messagesResult: { data: unknown; error: unknown }
) {
  const singleMock = vi.fn().mockResolvedValue(conversaResult)
  const convEqMock = vi.fn().mockReturnValue({ single: singleMock })
  const convSelectMock = vi.fn().mockReturnValue({ eq: convEqMock })

  const msgOrderMock = vi.fn().mockResolvedValue(messagesResult)
  const msgEqMock = vi.fn().mockReturnValue({ order: msgOrderMock })
  const msgSelectMock = vi.fn().mockReturnValue({ eq: msgEqMock })

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'conversas') return { select: convSelectMock }
    if (table === 'chat_messages') return { select: msgSelectMock }
    return { select: convSelectMock }
  })

  return { from: fromMock, msgOrderMock, singleMock }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getConversas', () => {
  it('returns rows ordered by ultima_mensagem_em DESC (tenant scoped implicitly by RLS)', async () => {
    const mockData = [
      {
        id: 'conv-1',
        ia_ativa: true,
        ultima_mensagem_em: '2026-05-21T10:00:00Z',
        remotejid: '5567999990001@s.whatsapp.net',
        leads: { nome: 'João', telefone: '67999990001' },
      },
    ]
    const { from, order } = makeConversasMock({ data: mockData, error: null })
    mockCreateClient.mockResolvedValue({ from } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await getConversas()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('conv-1')
    expect(order).toHaveBeenCalledWith('ultima_mensagem_em', {
      ascending: false,
      nullsFirst: false,
    })
  })

  it('returns empty array on DB error', async () => {
    const { from } = makeConversasMock({
      data: null,
      error: { message: 'DB error' },
    })
    mockCreateClient.mockResolvedValue({ from } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await getConversas()

    expect(result).toEqual([])
  })
})

describe('getConversaWithMessages', () => {
  it('returns { conversa, messages } with messages ordered by enviada_em ASC', async () => {
    const mockConversa = {
      id: 'conv-1',
      ia_ativa: true,
      leads: { nome: 'Ana', telefone: '67999990002' },
    }
    const mockMessages = [
      {
        id: 'msg-1',
        direcao: 'entrada',
        conteudo: 'Olá',
        enviada_em: '2026-05-21T10:00:00Z',
        status_envio: null,
      },
      {
        id: 'msg-2',
        direcao: 'saida',
        conteudo: 'Oi! Em que posso ajudar?',
        enviada_em: '2026-05-21T10:01:00Z',
        status_envio: 'enviada',
      },
    ]

    const { from, msgOrderMock, singleMock } = makeConversaWithMessagesMock(
      { data: mockConversa, error: null },
      { data: mockMessages, error: null }
    )
    mockCreateClient.mockResolvedValue({ from } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await getConversaWithMessages('conv-1')

    expect(result).not.toBeNull()
    expect(result!.conversa.id).toBe('conv-1')
    expect(result!.messages).toHaveLength(2)
    expect(singleMock).toHaveBeenCalled()
    expect(msgOrderMock).toHaveBeenCalledWith('enviada_em', { ascending: true })
  })

  it('returns null when conversa is not found', async () => {
    const { from } = makeConversaWithMessagesMock(
      { data: null, error: { message: 'not found' } },
      { data: [], error: null }
    )
    mockCreateClient.mockResolvedValue({ from } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await getConversaWithMessages('nonexistent-id')

    expect(result).toBeNull()
  })

  it('returns { conversa, messages: [] } when messages query errors', async () => {
    const mockConversa = { id: 'conv-1', ia_ativa: false, leads: null }

    const { from } = makeConversaWithMessagesMock(
      { data: mockConversa, error: null },
      { data: null, error: { message: 'msg error' } }
    )
    mockCreateClient.mockResolvedValue({ from } as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never)

    const result = await getConversaWithMessages('conv-1')

    expect(result).not.toBeNull()
    expect(result!.messages).toEqual([])
  })
})
