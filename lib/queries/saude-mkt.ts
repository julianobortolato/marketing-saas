import { createAdminClient } from '@/lib/supabase/admin'

export interface SaudeMktPayload {
  status_ia: {
    habilitada: boolean
    desabilitada_em: string | null
    motivo: string | null
  }
  usage_diario: {
    custo_usd: number
    chamadas_count: number
    limite_usd: number
    percentual: number
  }
  conversas: {
    total: number
    em_handoff: number
    ia_ativa: number
  }
  mensagens: {
    entrada_24h: number
    saida_24h: number
    falhas_24h: number
  }
  latencia_24h: {
    p50_ms: number | null
    p95_ms: number | null
  }
}

function computePercentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

export async function buildSaudeMktPayload(
  tenantId: string
): Promise<SaudeMktPayload> {
  const admin = createAdminClient()

  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().slice(0, 10)

  const [tenantResult, usageResult, conversasResult, messagesResult, latenciaResult] =
    await Promise.all([
      admin
        .from('tenants')
        .select('ia_habilitada, ia_desabilitada_em, ia_desabilitada_motivo, ia_limite_diario_usd')
        .eq('id', tenantId) // defense-in-depth on top of service_role
        .single(),

      admin
        .from('ai_usage_diario')
        .select('custo_total_usd, chamadas_count')
        .eq('tenant_id', tenantId) // defense-in-depth
        .eq('data', today)
        .maybeSingle(),

      admin
        .from('conversas')
        .select('ia_ativa')
        .eq('tenant_id', tenantId), // defense-in-depth

      admin
        .from('chat_messages')
        .select('direcao, status_envio')
        .eq('tenant_id', tenantId) // defense-in-depth
        .gte('enviada_em', cutoff24h),

      admin
        .from('ai_usage_log')
        .select('duracao_ms')
        .eq('tenant_id', tenantId) // defense-in-depth
        .eq('sucesso', true)
        .gte('criado_em', cutoff24h),
    ])

  const tenant = tenantResult.data
  const usage = usageResult.data

  const statusIa = {
    habilitada: tenant?.ia_habilitada ?? true,
    desabilitada_em: tenant?.ia_desabilitada_em ?? null,
    motivo: tenant?.ia_desabilitada_motivo ?? null,
  }

  const limiteUsd = Number(tenant?.ia_limite_diario_usd ?? 5)
  const custoUsd = Number(usage?.custo_total_usd ?? 0)
  const chamadasCount = Number(usage?.chamadas_count ?? 0)
  const percentual =
    limiteUsd > 0 ? Math.round((custoUsd / limiteUsd) * 100) : 0

  const usageDiario = {
    custo_usd: custoUsd,
    chamadas_count: chamadasCount,
    limite_usd: limiteUsd,
    percentual,
  }

  const conversasRows = conversasResult.data ?? []
  const total = conversasRows.length
  const emHandoff = conversasRows.filter((c) => !c.ia_ativa).length
  const iaAtiva = conversasRows.filter((c) => c.ia_ativa).length

  const mensagensRows = messagesResult.data ?? []
  const entrada24h = mensagensRows.filter((m) => m.direcao === 'entrada').length
  const saida24h = mensagensRows.filter((m) => m.direcao === 'saida').length
  const falhas24h = mensagensRows.filter((m) => m.status_envio === 'falhou').length

  const duracoes = (latenciaResult.data ?? [])
    .map((r) => Number(r.duracao_ms))
    .filter((v) => !isNaN(v))
    .sort((a, b) => a - b)

  const p50 = computePercentile(duracoes, 50)
  const p95 = computePercentile(duracoes, 95)

  return {
    status_ia: statusIa,
    usage_diario: usageDiario,
    conversas: { total, em_handoff: emHandoff, ia_ativa: iaAtiva },
    mensagens: { entrada_24h: entrada24h, saida_24h: saida24h, falhas_24h: falhas24h },
    latencia_24h: { p50_ms: p50, p95_ms: p95 },
  }
}
