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
  // Editorial columns (migration 0011)
  caderno_editorial_escopo: string | null
  caderno_editorial_tom: string | null
  caderno_editorial_restricoes: string | null
  caderno_editorial_objetivos: string[] | null
  caderno_editorial_exemplos: string | null
  palavras_proibidas: string[] | null
  gatilhos_handoff: Record<string, boolean> | null
  persona_cmo: string | null
}

export interface EditorialConfigRow {
  caderno_editorial_escopo: string | null
  caderno_editorial_tom: string | null
  caderno_editorial_restricoes: string | null
  caderno_editorial_objetivos: string[] | null
  caderno_editorial_exemplos: string | null
  palavras_proibidas: string[] | null
  gatilhos_handoff: Record<string, boolean> | null
  persona_cmo: string | null
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
    console.error('[getAcademiaConfig] error:', error.message)
    return null
  }

  return data as AcademiaConfigRow | null
}

export async function getEditorialConfig(): Promise<EditorialConfigRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('academia_config')
    .select(
      'caderno_editorial_escopo, caderno_editorial_tom, caderno_editorial_restricoes, caderno_editorial_objetivos, caderno_editorial_exemplos, palavras_proibidas, gatilhos_handoff, persona_cmo'
    )
    .maybeSingle()

  if (error) {
    console.error('[getEditorialConfig] error:', error.message)
    return null
  }

  return data as EditorialConfigRow | null
}
