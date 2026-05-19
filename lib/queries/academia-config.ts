import { createClient } from '@/lib/supabase/server'

export interface AcademiaConfig {
  tenant_id: string
  nome_academia: string | null
  bairro: string | null
  cidade: string | null
  raio_km: number | null
  tom_de_voz: string | null
  diferenciais: string[] | null
  horarios: { text: string } | null
  planos: { text: string } | null
}

/**
 * Returns the current tenant's academia_config row, or null if not configured yet.
 * RLS scopes the query — no client-supplied tenant_id needed.
 */
export async function getAcademiaConfig(): Promise<AcademiaConfig | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('academia_config')
    .select('*')
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as AcademiaConfig
}
