import { createClient } from '@/lib/supabase/server'

export interface VisualConfig {
  cor_primaria: string
  cor_secundaria: string
  palette: string[]
  fonte_titulo: string
  fonte_corpo: string
  logo_url: string | null
}

export interface TomDeVozConfig {
  descricao: string
  tom: string
  temas_recorrentes: string[]
  frequencia: string
  palavras_preferidas: string[]
  palavras_a_evitar: string[]
}

export interface PublicoAlvoConfig {
  descricao: string
  diferencial: string
}

export interface BrandManual {
  vertical?: string
  identidade?: { nome_empresa: string; logo_url: string | null }
  visual?: Partial<VisualConfig>
  tom_de_voz?: Partial<TomDeVozConfig>
  publico_alvo?: Partial<PublicoAlvoConfig>
}

export async function getBrandManual(): Promise<BrandManual> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_config')
    .select('brand_manual')
    .maybeSingle()
  return (data?.brand_manual ?? {}) as BrandManual
}

export async function patchBrandManual(
  tenantId: string,
  patch: Partial<BrandManual>
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: current, error: readErr } = await supabase
    .from('tenant_config')
    .select('id, brand_manual')
    .maybeSingle()

  if (readErr) return { error: readErr.message }

  const merged = { ...(current?.brand_manual ?? {}), ...patch }

  if (current) {
    const { error } = await supabase
      .from('tenant_config')
      .update({ brand_manual: merged })
      .eq('id', current.id)
    return { error: error?.message ?? null }
  }

  // First access — create tenant_config row
  const { error } = await supabase
    .from('tenant_config')
    .insert({ tenant_id: tenantId, nome_academia: '', brand_manual: merged })
  return { error: error?.message ?? null }
}

export async function ensureTenantConfig(
  tenantId: string,
  nomeAcademia: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tenant_config')
    .upsert({ tenant_id: tenantId, nome_academia: nomeAcademia }, { onConflict: 'tenant_id' })
  return { error: error?.message ?? null }
}
