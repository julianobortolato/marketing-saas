/**
 * POST /api/webhooks/zernio
 *
 * Recebe callbacks do Zernio para eventos de publicação.
 * Eventos suportados: post.published, post.failed
 *
 * Segurança:
 *   1. Validar HMAC-SHA256 via X-Zernio-Signature (CLAUDE.md §2.8)
 *   2. Persistir resultado no banco ANTES de qualquer ação (CLAUDE.md §2.6)
 *   3. Notificar owner via Evolution em caso de falha
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature } from '@/lib/webhooks/verify-signature'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()

    const secret = process.env.ZERNIO_WEBHOOK_SECRET
    if (!secret) {
      console.error('[webhook/zernio] ZERNIO_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'webhook_misconfigured' }, { status: 500 })
    }

    const signature = request.headers.get('x-zernio-signature')
    const valid = await verifyWebhookSignature(raw, signature, secret)
    if (!valid) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const event = payload.event as string
    const post = payload.post as Record<string, unknown>
    const zernioPostId = post?.id as string

    if (!zernioPostId) {
      return NextResponse.json({ error: 'missing_postId' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Localizar conteúdo pelo zernio_post_id
    const { data: conteudo, error: fetchError } = await admin
      .from('conteudos')
      .select('id, tenant_id, status')
      .eq('zernio_post_id', zernioPostId)
      .single()

    if (fetchError || !conteudo) {
      // Post desconhecido — absorver silenciosamente para evitar retentativas do Zernio
      return NextResponse.json({ ok: 'unknown_post' }, { status: 200 })
    }

    const conteudoId = conteudo.id as string
    const tenantId = conteudo.tenant_id as string

    if (event === 'post.published') {
      // Persistir publicado
      const { error: updateError } = await admin
        .from('conteudos')
        .update({
          status: 'publicado',
          publicado_em: (payload.publishedAt as string) ?? new Date().toISOString(),
        })
        .eq('id', conteudoId)
        .eq('tenant_id', tenantId)

      if (updateError) {
        console.error('[webhook/zernio] update publicado error:', updateError.message)
      }

      await admin
        .from('audit_log')
        .insert({
          tenant_id: tenantId,
          acao: 'post_publicado',
          referencia_id: conteudoId,
          metadata: { zernio_post_id: zernioPostId },
        })
        .then(({ error }) => {
          if (error) console.error('[webhook/zernio] audit_log publicado error:', error.message)
        })

      return NextResponse.json({ ok: true }, { status: 200 })
    }

    if (event === 'post.failed') {
      // Persistir falha
      const { error: updateError } = await admin
        .from('conteudos')
        .update({ status: 'falhou_publicacao' })
        .eq('id', conteudoId)
        .eq('tenant_id', tenantId)

      if (updateError) {
        console.error('[webhook/zernio] update falha error:', updateError.message)
      }

      const platforms = post?.platforms as Array<Record<string, unknown>> ?? []
      const reason = platforms.map(p => p.error).filter(Boolean).join('; ') || undefined

      await admin
        .from('audit_log')
        .insert({
          tenant_id: tenantId,
          acao: 'post_falhou_publicacao',
          referencia_id: conteudoId,
          metadata: { zernio_post_id: zernioPostId, reason },
        })
        .then(({ error }) => {
          if (error) console.error('[webhook/zernio] audit_log falha error:', error.message)
        })

      // Notificar owner via Evolution (best-effort)
      await notificarOwnerFalha(admin, tenantId, conteudoId).catch((err) => {
        console.error('[webhook/zernio] notificar owner error:', (err as Error).message)
      })

      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // Evento desconhecido — absorver
    return NextResponse.json({ ok: 'unknown_event' }, { status: 200 })
  } catch (err) {
    const errCode = (err as { code?: string })?.code
    console.error('[webhook/zernio] unhandled error', { errCode })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

async function notificarOwnerFalha(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  tenantId: string,
  conteudoId: string,
): Promise<void> {
  if (!process.env.EVOLUTION_API_URL) return

  // Buscar instância Evolution do tenant
  const { data: instance } = await admin
    .from('evolution_instances')
    .select('instance_name, api_key_encrypted')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single()

  if (!instance) return

  // Buscar remotejid do owner em brand_manual (campo owner_whatsapp, se configurado)
  const { data: config } = await admin
    .from('tenant_config')
    .select('brand_manual')
    .eq('tenant_id', tenantId)
    .single()

  const ownerRemotejid = (config?.brand_manual as Record<string, unknown>)?.owner_whatsapp as string | undefined
  if (!ownerRemotejid) {
    console.error('[notificarOwnerFalha] owner_whatsapp não configurado em brand_manual para tenant', tenantId)
    return
  }

  const shortId = (conteudoId as string).slice(0, 8)
  const mensagem = `⚠️ Publicação falhou para o post ${shortId}. Acesse o painel para reagendar ou fazer download manual.`

  await fetch(
    `${process.env.EVOLUTION_API_URL}/message/sendText/${instance.instance_name}`,
    {
      method: 'POST',
      headers: {
        apikey: instance.api_key_encrypted as string,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ number: ownerRemotejid, text: mensagem }),
    },
  )
}
