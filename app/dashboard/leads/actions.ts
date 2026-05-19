'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { leadCreateSchema, leadStatusUpdateSchema } from '@/lib/validators/lead'

export async function createLead(input: unknown) {
  const parsed = leadCreateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const supabase = await createClient()

  const { data: tenantId } = await supabase.rpc('fn_tenant_id')
  if (!tenantId) {
    return {
      error: 'Não foi possível identificar a academia. Recarregue e tente novamente.',
    }
  }

  const { error } = await supabase.from('leads').insert({
    nome: parsed.data.nome,
    telefone: parsed.data.telefone,
    origem: parsed.data.origem,
    status: 'novo',
    tenant_id: tenantId, // set ONLY from fn_tenant_id() — never from client input
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/leads')
  return { success: true }
}

export async function updateLeadStatus(input: unknown) {
  const parsed = leadStatusUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const supabase = await createClient()

  const { data: tenantId } = await supabase.rpc('fn_tenant_id')
  if (!tenantId) {
    return {
      error: 'Não foi possível identificar a academia. Recarregue e tente novamente.',
    }
  }

  const { error } = await supabase
    .from('leads')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId) // defense-in-depth on top of RLS

  if (error) return { error: error.message }

  revalidatePath('/dashboard/leads')
  return { success: true }
}
