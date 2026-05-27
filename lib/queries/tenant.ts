import { createClient } from '@/lib/supabase/server'

export interface TenantRow {
  id: string
  nome: string
  slug: string
  cidade: string | null
  whatsapp_owner: string | null
  onboarding_passo: number
  plano: string
  ativo: boolean
}

export async function getTenant(): Promise<TenantRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, nome, slug, cidade, whatsapp_owner, onboarding_passo, plano, ativo')
    .maybeSingle()
  if (error) {
    console.error('[getTenant]', error.message)
    return null
  }
  return data as TenantRow | null
}

export async function updateTenantFields(
  tenantId: string,
  fields: Partial<Pick<TenantRow, 'nome' | 'cidade' | 'whatsapp_owner' | 'onboarding_passo'>>
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tenants')
    .update(fields)
    .eq('id', tenantId)
  return { error: error?.message ?? null }
}

export async function advanceOnboardingPasso(
  tenantId: string,
  nextPasso: number
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('tenants')
    .update({ onboarding_passo: nextPasso })
    .eq('id', tenantId)
    // Only advance, never regress (user might re-submit an earlier step)
    .gte('onboarding_passo', nextPasso - 1)
}
