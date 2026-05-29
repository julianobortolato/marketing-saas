import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { zernioCreatePost } from './client'

interface AgendamentoResult {
  agendado_para: Date
  zernio_post_id: string
}

/**
 * Retorna o próximo slot de publicação em UTC dado dias, horário e timezone do tenant.
 * Começa a procurar a partir de amanhã para garantir pelo menos 1 dia de antecedência.
 */
function calcularProximoSlot(dias: string[], horario: string, timezone: string): Date {
  const daysIncluded = new Set(dias.map(d => d.toLowerCase()))
  const [hh, mm] = horario.split(':').map(Number)

  const now = new Date()

  for (let daysAhead = 1; daysAhead <= 14; daysAhead++) {
    const candidate = new Date(now)
    candidate.setDate(candidate.getDate() + daysAhead)

    const weekday = candidate.toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'long',
    }).toLowerCase()

    if (!daysIncluded.has(weekday)) continue

    // Data local no timezone do tenant (formato YYYY-MM-DD)
    const localDateStr = candidate.toLocaleDateString('en-CA', { timeZone: timezone })

    // Montar slot como string UTC e calcular offset real do timezone
    const slotAsUTCStr = `${localDateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`
    const slotAsUTC = new Date(slotAsUTCStr)

    // Descobrir o offset: comparar o que slotAsUTC representa no timezone do tenant
    const localRepresentation = slotAsUTC.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const parts = localRepresentation.match(/(\d+)\/(\d+)\/(\d+),\s+(\d+):(\d+):(\d+)/)
    if (!parts) continue

    const localAsDate = new Date(Date.UTC(
      parseInt(parts[3]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2]),
      parseInt(parts[4]),
      parseInt(parts[5]),
      parseInt(parts[6]),
    ))

    // offset: diferença entre UTC interpretado e local real
    const offsetMs = slotAsUTC.getTime() - localAsDate.getTime()

    // Slot correto em UTC = local slot + offset
    const slotUTC = new Date(slotAsUTC.getTime() + offsetMs)

    return slotUTC
  }

  throw new Error('Nenhum slot de publicação disponível nos próximos 14 dias')
}

/**
 * Agenda um conteúdo no Zernio após aprovação.
 * Persiste status='agendado' ANTES de chamar API externa (CLAUDE.md §2.6).
 * Reverte para 'aprovado' em caso de falha na API.
 */
export async function agendarPublicacao(
  conteudoId: string,
  tenantId: string,
): Promise<AgendamentoResult> {
  const admin = createAdminClient()

  // 1. Carregar tenant_config com campos de publicação
  const { data: config, error: configError } = await admin
    .from('tenant_config')
    .select('zernio_account_id, publicacao_dias, publicacao_horario, publicacao_timezone')
    .eq('tenant_id', tenantId)
    .single()

  if (configError) {
    console.error('[agendarPublicacao] tenant_config error:', configError.message)
    throw new Error('Falha ao carregar configuração do tenant')
  }

  if (!config?.zernio_account_id) {
    throw new Error('zernio_account_id não configurado para este tenant')
  }

  // 2. Carregar conteúdo com imagem composta
  const { data: conteudo, error: conteudoError } = await admin
    .from('conteudos')
    .select('id, imagem_composta_url, copy_principal, hashtags')
    .eq('id', conteudoId)
    .eq('tenant_id', tenantId)
    .single()

  if (conteudoError || !conteudo) {
    console.error('[agendarPublicacao] conteudo error:', conteudoError?.message)
    throw new Error('Conteúdo não encontrado')
  }

  if (!conteudo.imagem_composta_url) {
    throw new Error('Conteúdo sem imagem composta — não pode ser agendado')
  }

  // 3. Calcular próximo slot disponível
  const agendado_para = calcularProximoSlot(
    config.publicacao_dias as string[],
    config.publicacao_horario as string,
    config.publicacao_timezone as string,
  )

  // 4. Persistir status='agendado' ANTES de chamar Zernio (CLAUDE.md §2.6)
  const { error: updateError } = await admin
    .from('conteudos')
    .update({ status: 'agendado', agendado_para: agendado_para.toISOString() })
    .eq('id', conteudoId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    console.error('[agendarPublicacao] update status error:', updateError.message)
    throw new Error('Falha ao persistir status de agendamento')
  }

  // 5. Chamar API Zernio
  const hashtags = ((conteudo.hashtags as string[]) ?? []).join(' ')
  const caption = [conteudo.copy_principal, hashtags].filter(Boolean).join('\n\n')

  let zernioPost
  try {
    zernioPost = await zernioCreatePost({
      accountId: config.zernio_account_id,
      scheduledFor: agendado_para.toISOString(),
      mediaItems: [{ url: conteudo.imagem_composta_url as string }],
      caption,
    })
  } catch (err) {
    // Zernio falhou: reverter para 'aprovado' para não bloquear o conteúdo
    await admin
      .from('conteudos')
      .update({ status: 'aprovado', agendado_para: null })
      .eq('id', conteudoId)
      .eq('tenant_id', tenantId)

    console.error('[agendarPublicacao] Zernio API error:', (err as Error).message)
    throw err
  }

  // 6. Persistir zernio_post_id + confirmar agendado_para
  const { error: persistError } = await admin
    .from('conteudos')
    .update({ zernio_post_id: zernioPost.id })
    .eq('id', conteudoId)
    .eq('tenant_id', tenantId)

  if (persistError) {
    console.error('[agendarPublicacao] persist zernio_post_id error:', persistError.message)
  }

  // 7. Audit log
  await admin
    .from('audit_log')
    .insert({
      tenant_id: tenantId,
      acao: 'post_agendado',
      referencia_id: conteudoId,
      metadata: { zernio_post_id: zernioPost.id, agendado_para: agendado_para.toISOString() },
    })
    .then(({ error }) => {
      if (error) console.error('[agendarPublicacao] audit_log error:', error.message)
    })

  return { agendado_para, zernio_post_id: zernioPost.id }
}
