'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUsuario } from '@/lib/queries/usuario'

export async function assumirConversa(conversaId: string) {
  const usuario = await getCurrentUsuario()

  if (!usuario) {
    return { error: 'Não autenticado.' }
  }

  if (usuario.role !== 'owner' && usuario.role !== 'manager') {
    return { error: 'Acesso negado.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('rpc_handoff_humano', {
    p_tenant_id: usuario.tenant_id,
    p_conversa_id: conversaId,
    p_motivo: 'pedido_explicito',
  })

  if (error) {
    return { error: error.message }
  }

  if (data && typeof data === 'object' && 'ok' in data && !data.ok) {
    return { error: (data as { erro?: string }).erro ?? 'Erro ao assumir conversa.' }
  }

  revalidatePath('/dashboard/conversas')
  revalidatePath('/dashboard/conversas/' + conversaId)

  return { success: true }
}

export async function reativarAgente(conversaId: string) {
  const usuario = await getCurrentUsuario()

  if (!usuario) {
    return { error: 'Não autenticado.' }
  }

  if (usuario.role !== 'owner' && usuario.role !== 'manager') {
    return { error: 'Acesso negado.' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('conversas')
    .update({ ia_ativa: true, motivo_handoff: null })
    .eq('id', conversaId)
    .eq('tenant_id', usuario.tenant_id) // defense-in-depth on top of RLS

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/conversas')
  revalidatePath('/dashboard/conversas/' + conversaId)

  return { success: true }
}

export async function enviarMensagemManual(conversaId: string, conteudo: string) {
  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'Não autenticado.' }
  if (usuario.role !== 'owner' && usuario.role !== 'manager') return { error: 'Acesso negado.' }

  const texto = conteudo.trim()
  if (!texto || texto.length > 4096) return { error: 'Mensagem inválida.' }

  // Verify conversa belongs to tenant and is in handoff (ia_ativa=false)
  const supabase = await createClient()
  const { data: conversa } = await supabase
    .from('conversas')
    .select('id, remotejid, ia_ativa')
    .eq('id', conversaId)
    .eq('tenant_id', usuario.tenant_id)
    .single()

  if (!conversa) return { error: 'Conversa não encontrada.' }
  if (conversa.ia_ativa) return { error: 'IA está ativa. Assuma a conversa antes de enviar.' }

  const admin = createAdminClient()

  const { data: instance } = await admin
    .from('evolution_instances')
    .select('instance_name, api_key_encrypted')
    .eq('tenant_id', usuario.tenant_id)
    .eq('ativo', true)
    .limit(1)
    .single()

  if (!instance) return { error: 'Instância Evolution não configurada.' }

  // Persist BEFORE sending (persist-before-send, Manifesto P5)
  const { data: persistData } = await admin.rpc('rpc_persistir_resposta_bot', {
    p_tenant_id: usuario.tenant_id,
    p_conversa_id: conversaId,
    p_conteudo: texto,
  })

  const messageId = (persistData as Record<string, unknown> | null)?.message_id as string | undefined

  let sendOk = false
  if (process.env.EVOLUTION_API_URL && instance.api_key_encrypted) {
    try {
      const resp = await fetch(
        `${process.env.EVOLUTION_API_URL}/message/sendText/${instance.instance_name}`,
        {
          method: 'POST',
          headers: { apikey: instance.api_key_encrypted, 'content-type': 'application/json' },
          body: JSON.stringify({ number: conversa.remotejid, text: texto }),
        },
      )
      sendOk = resp.ok
    } catch {
      sendOk = false
    }
  }

  if (messageId) {
    await admin
      .from('chat_messages')
      .update({ status_envio: sendOk ? 'enviada' : 'falhou' })
      .eq('id', messageId)
      .eq('tenant_id', usuario.tenant_id)
  }

  revalidatePath('/dashboard/conversas/' + conversaId)
  return { success: true, sendOk }
}
