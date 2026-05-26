'use server'

import { createClient } from '@/lib/supabase/server'
import { academiaConfigSchema } from '@/lib/validators/academia-config'
import { revalidatePath } from 'next/cache'

export async function saveAcademiaConfig(formData: unknown) {
  const parsed = academiaConfigSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const supabase = await createClient()

  // Resolve tenant_id server-side.
  // RLS WITH CHECK only validates — it does NOT inject tenant_id.
  // tenant_config.tenant_id is NOT NULL, so it must be supplied explicitly.
  // (CLAUDE.md inegociável: tenant_id NEVER from client payload)
  const { data: tenantId } = await supabase.rpc('fn_tenant_id')
  if (!tenantId) {
    // RESEARCH Pitfall 7: fn_tenant_id() may return NULL right after signup.
    // Return an informative error — never a silent failure.
    return {
      error:
        'Não foi possível identificar a academia. Recarregue e tente novamente.',
    }
  }

  // Wrap horarios/planos textarea strings as JSONB objects (RESEARCH Assumption A5)
  const horarios = parsed.data.horarios
    ? { text: parsed.data.horarios }
    : null
  const planos = parsed.data.planos
    ? { text: parsed.data.planos }
    : null

  const { error } = await supabase.from('tenant_config').upsert(
    {
      ...parsed.data,
      tenant_id: tenantId, // set ONLY from fn_tenant_id() — never from the client payload
      horarios,
      planos,
    },
    { onConflict: 'tenant_id' }
  )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}
