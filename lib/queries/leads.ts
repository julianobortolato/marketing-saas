import { createClient } from '@/lib/supabase/server'

export interface Lead {
  id: string
  nome: string | null
  telefone: string | null
  origem: string
  status: string
  remotejid: string | null
  criado_em: string
}

const VALID_STATUSES = ['novo', 'contatado', 'agendado', 'convertido', 'perdido']
const VALID_ORIGENS = ['meta_form', 'whatsapp', 'google', 'manual']

/**
 * Returns the current tenant's leads filtered by optional criteria.
 * RLS (RESTRICTIVE) scopes rows to the authenticated tenant — no filter arg needed.
 * Never throws; returns [] on error.
 */
export async function getLeads(filters?: {
  status?: string
  origem?: string
  from?: string
  to?: string
}): Promise<Lead[]> {
  const supabase = await createClient()

  let q = supabase
    .from('leads')
    .select('id,nome,telefone,origem,status,remotejid,criado_em')
    .order('criado_em', { ascending: false })

  if (filters?.status && VALID_STATUSES.includes(filters.status)) {
    q = q.eq('status', filters.status)
  }
  if (filters?.origem && VALID_ORIGENS.includes(filters.origem)) {
    q = q.eq('origem', filters.origem)
  }
  if (filters?.from && !isNaN(Date.parse(filters.from))) {
    q = q.gte('criado_em', filters.from)
  }
  if (filters?.to && !isNaN(Date.parse(filters.to))) {
    q = q.lte('criado_em', filters.to)
  }

  const { data, error } = await q

  if (error) {
    console.error('[getLeads] error:', error.message)
    return []
  }

  return (data ?? []) as Lead[]
}
