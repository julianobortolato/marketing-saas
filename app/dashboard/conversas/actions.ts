'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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
