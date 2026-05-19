import { createClient } from '@/lib/supabase/server'

export class CampaignNotApprovedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CampaignNotApprovedError'
  }
}

/**
 * APROV-02 enforcement point.
 * Phase 5 (Campanhas) MUST call assertCampaignApproved(campaignId) before any
 * paid-campaign publish/activation. This is a real enforced gate, not a placeholder.
 *
 * Fails closed: throws CampaignNotApprovedError on:
 *   - Missing/null tenant (tenant_unresolved)
 *   - Query error (never proceeds on DB failure)
 *   - No aprovado row found for the campaignId
 *
 * Returns void only when a tipo='campanha', status='aprovado', referencia_id=campaignId
 * row exists for the current tenant.
 */
export async function assertCampaignApproved(campaignId: string): Promise<void> {
  const supabase = await createClient()

  const { data: tenantId } = await supabase.rpc('fn_tenant_id')
  if (!tenantId) {
    throw new CampaignNotApprovedError('tenant_unresolved')
  }

  const { data, error } = await supabase
    .from('aprovacoes')
    .select('id')
    .eq('tipo','campanha')
    .eq('referencia_id', campaignId)
    .eq('status','aprovado')
    .eq('tenant_id', tenantId) // defense-in-depth on top of RLS
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new CampaignNotApprovedError(error.message)
  }

  if (!data) {
    throw new CampaignNotApprovedError(
      'Campanha sem aprovação registrada — publicação bloqueada (APROV-02).'
    )
  }
}
