import { createClient } from '@/lib/supabase/server'

export interface Aprovacao {
  id: string
  tipo: string
  referencia_id: string | null
  status: string
  criado_em: string
}

export interface ConteudoAprovado {
  id: string
  copy_principal: string | null
  imagem_composta_url: string | null
  criado_em: string
}

export interface ConteudoAgendado {
  id: string
  copy_principal: string | null
  agendado_para: string | null
  zernio_post_id: string | null
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

/**
 * Returns conteudos with status='aprovado' from the last 7 days — ready for download.
 * RLS (RESTRICTIVE) scopes rows to the authenticated tenant.
 * Never throws; returns [] on error.
 */
export async function getConteudosAprovados(): Promise<ConteudoAprovado[]> {
  const supabase = await createClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('conteudos')
    .select('id, copy_principal, imagem_composta_url, criado_em')
    .eq('status', 'aprovado')
    .gte('criado_em', sevenDaysAgo)
    .order('criado_em', { ascending: false })
    .limit(10)

  if (error) {
    console.error('[getConteudosAprovados] error:', error.message)
    return []
  }

  return (data ?? []) as ConteudoAprovado[]
}

/**
 * Returns conteudos with status='agendado' from the last 30 days.
 * RLS (RESTRICTIVE) scopes rows to the authenticated tenant.
 * Never throws; returns [] on error.
 */
export async function getConteudosAgendados(): Promise<ConteudoAgendado[]> {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('conteudos')
    .select('id, copy_principal, agendado_para, zernio_post_id, criado_em')
    .eq('status', 'agendado')
    .gte('criado_em', thirtyDaysAgo)
    .order('agendado_para', { ascending: true })
    .limit(10)

  if (error) {
    console.error('[getConteudosAgendados] error:', error.message)
    return []
  }

  return (data ?? []) as ConteudoAgendado[]
}
