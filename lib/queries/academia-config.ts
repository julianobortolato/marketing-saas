import { createClient } from '@/lib/supabase/server'

export interface AcademiaConfigRow {
  id: string
  tenant_id: string
  nome_academia: string
  bairro: string | null
  cidade: string | null
  raio_km: number
  tom_de_voz: string | null
  diferenciais: string[] | null
  horarios: { text: string } | null
  planos: { text: string } | null
  criado_em: string
}

/**
 * Returns the current tenant's academia_config row or null.
 * RLS scopes the query to the authenticated user's tenant — no tenant_id
 * is passed from app code (CLAUDE.md: tenant_id never trusted from client).
 */
export async function getAcademiaConfig(): Promise<AcademiaConfigRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('academia_config')
    .select('*')
    .maybeSingle()

  if (error) {
    // Surface errors to Server Component — do not swallow
    console.error('[getAcademiaConfig] error:', error.message)
    return null
  }

  return data as AcademiaConfigRow | null
}
