import { createClient } from '@/lib/supabase/server'

export interface Conversa {
  id: string
  lead_id: string
  ia_ativa: boolean
  motivo_handoff: string | null
  ultima_mensagem_em: string | null
  remotejid: string
  criado_em: string
  leads: { nome: string | null; telefone: string | null } | null
}

export interface ChatMessage {
  id: string
  direcao: 'entrada' | 'saida'
  tipo: string
  conteudo: string
  enviada_em: string
  status_envio: string | null
}

export async function getConversas(): Promise<Conversa[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('conversas')
    .select(`
      id,
      lead_id,
      ia_ativa,
      motivo_handoff,
      ultima_mensagem_em,
      remotejid,
      criado_em,
      leads (
        nome,
        telefone
      )
    `)
    .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('[getConversas] error:', error.message)
    return []
  }

  return (data as unknown as Conversa[]) ?? []
}

export async function getConversaWithMessages(
  conversaId: string
): Promise<{ conversa: Conversa; messages: ChatMessage[] } | null> {
  const supabase = await createClient()

  const { data: conversa, error: convError } = await supabase
    .from('conversas')
    .select(`
      id,
      lead_id,
      ia_ativa,
      motivo_handoff,
      ultima_mensagem_em,
      remotejid,
      criado_em,
      leads (
        nome,
        telefone
      )
    `)
    .eq('id', conversaId)
    .single()

  if (convError || !conversa) {
    return null
  }

  const { data: messages, error: msgError } = await supabase
    .from('chat_messages')
    .select('id, direcao, tipo, conteudo, enviada_em, status_envio')
    .eq('conversa_id', conversaId)
    .order('enviada_em', { ascending: true })

  if (msgError) {
    console.error('[getConversaWithMessages] messages error:', msgError.message)
    return { conversa: conversa as unknown as Conversa, messages: [] }
  }

  return {
    conversa: conversa as unknown as Conversa,
    messages: (messages as unknown as ChatMessage[]) ?? [],
  }
}
