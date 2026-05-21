'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { editorialConfigSchema } from '@/lib/validators/editorial-config'

export async function saveEditorialConfig(formData: unknown) {
  const usuario = await getCurrentUsuario()

  if (!usuario) {
    return { error: 'Não autenticado.' }
  }

  if (usuario.role !== 'owner' && usuario.role !== 'manager') {
    return { error: 'Acesso negado.' }
  }

  const parsed = editorialConfigSchema.safeParse(formData)
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

  // defense-in-depth: tenant_id set from fn_tenant_id() — never from client payload
  const { error } = await supabase
    .from('academia_config')
    .upsert(
      { ...parsed.data, tenant_id: tenantId },
      { onConflict: 'tenant_id' }
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/configuracoes/editorial')
  return { success: true }
}
