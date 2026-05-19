import { createClient } from '@/lib/supabase/server'

export interface Aprovacao {
  id: string
  tipo: string
  referencia_id: string | null
  status: string
  criado_em: string
}

/**
 * Returns the current tenant's pending organic-content approvals from the last 7 days,
 * capped at 10 (the weekly batch limit, APROV-01).
 * RLS (RESTRICTIVE) scopes rows to the authenticated tenant.
 * Never throws; returns [] on error.
 */
export async function getWeeklyOrganicBatch(): Promise<Aprovacao[]> {
  const supabase = await createClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('aprovacoes')
    .select('id,tipo,referencia_id,status,criado_em')
    .eq('tipo','conteudo')
    .eq('status','pendente')
    .gte('criado_em', sevenDaysAgo)
    .order('criado_em', { ascending: true })
    .limit(10)

  if (error) {
    console.error('[getWeeklyOrganicBatch] error:', error.message)
    return []
  }

  return (data ?? []) as Aprovacao[]
}
