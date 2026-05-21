/**
 * POST /api/webhooks/evolution
 *
 * 14-step synchronous pipeline (ADR-MKT-001 §6).
 * Accepts Evolution API V2 webhook deliveries, validates HMAC, resolves tenant,
 * persists inbound message, calls GPT-4o with tool use, applies guardrails,
 * persists outbound, sends via Evolution API, and logs usage with kill switch.
 *
 * Security order (CLAUDE.md inegociável):
 *   1. Read raw body (needed for HMAC)
 *   2. Verify HMAC-SHA256 FIRST — before any DB or LLM call
 *   3. Rate limit by IP
 *   4. Parse JSON payload
 *   5. Resolve tenant via fn_tenant_id_by_evolution_instance
 *   6. Rate limit by tenant
 *   7. Persist inbound (ATOMIC ANCHOR — return 200 always after this)
 *   8. Check ia_ativa
 *   9. Skip if fromMe=true (outbound echo)
 *  10. Read tenant row (iara_tenant_id check + ia_habilitada check)
 *  11. ia_habilitada=false → send fallback, return 200
 *  12. Load academia_config + chat history
 *  13. Build system prompt
 *  14. OpenAI tool-use loop
 *  15. Guardrails
 *  16. Handoff (if triggered)
 *  17. Persist outbound BEFORE Evolution send (persist-before-send)
 *  18. Evolution API send
 *  19. Return 200
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature } from '@/lib/webhooks/verify-signature'
import { rateLimitByIP, rateLimitByTenant } from '@/lib/rate-limit/upstash'
import { callOpenAIWithTools } from '@/lib/openai/client'
import { buildSystemPrompt } from '@/lib/agents/cmo/system-prompt'
import { cmoTools } from '@/lib/agents/cmo/tools'
import { applyGuardrails } from '@/lib/agents/cmo/guardrails'

// node:crypto requires the Node.js runtime (not Edge)
export const runtime = 'nodejs'

const FALLBACK_IA_DESABILITADA =
  'Recebi sua mensagem. Em breve um atendente vai te responder.'

export async function POST(request: NextRequest) {
  try {
    // ── Step 1: Read raw body FIRST (needed for HMAC) ──────────────────────────
    const raw = await request.text()

    // ── Step 2: HMAC-SHA256 — FIRST gate before any DB access ──────────────────
    const secret = process.env.EVOLUTION_WEBHOOK_SECRET
    if (!secret) {
      console.error('[webhook/evolution] EVOLUTION_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'webhook_misconfigured' }, { status: 500 })
    }
    if (!verifyWebhookSignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }

    // ── Step 3: Rate limit by IP (before tenant resolution) ───────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    const ipLimit = await rateLimitByIP(ip)
    if (!ipLimit.success) {
      return NextResponse.json({ error: 'rate_limit_ip' }, { status: 429 })
    }

    // ── Step 4: Parse JSON payload (Evolution V2 shape) ────────────────────────
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const instance_name = (payload.instance as string) ?? ''
    const data = (payload.data as Record<string, unknown>) ?? {}
    const key = (data.key as Record<string, unknown>) ?? {}
    const messageData = (data.message as Record<string, unknown>) ?? {}
    const extendedText = (messageData.extendedTextMessage as Record<string, unknown>) ?? {}

    const remotejid = (key.remoteJid as string) ?? ''
    const evolution_message_id = (key.id as string) ?? ''
    const fromMe = Boolean(key.fromMe)
    const conteudo =
      (messageData.conversation as string) ??
      (extendedText.text as string) ??
      ''

    // ── Step 5: Resolve tenant ─────────────────────────────────────────────────
    const admin = createAdminClient()
    const { data: tenantId } = await admin.rpc('fn_tenant_id_by_evolution_instance', {
      p_instance_name: instance_name,
    })

    if (!tenantId) {
      // Unknown instance — absorb silently to prevent Evolution API retries
      return NextResponse.json({ ok: 'unknown_instance' }, { status: 200 })
    }

    // ── Step 6: Rate limit by tenant ──────────────────────────────────────────
    const tenantLimit = await rateLimitByTenant(tenantId as string)
    if (!tenantLimit.success) {
      return NextResponse.json({ error: 'rate_limit_tenant' }, { status: 429 })
    }

    // ── Step 7: Persist inbound — ATOMIC ANCHOR ───────────────────────────────
    // After this RPC succeeds, return 200 always (Manifesto P5 + ADR §6 philosophy)
    const { data: persist } = await admin.rpc('rpc_persistir_mensagem_entrada', {
      p_instance_name: instance_name,
      p_remotejid: remotejid,
      p_evolution_message_id: evolution_message_id,
      p_conteudo: conteudo,
      p_tipo: 'texto',
    })

    if (!persist || !(persist as Record<string, unknown>).ok) {
      // If RPC returned an error shape, we cannot proceed but we've already accepted the webhook
      return NextResponse.json({ ok: false, erro: 'persist_failed' }, { status: 200 })
    }

    const persistData = persist as {
      ok: boolean
      idempotente: boolean
      conversa_id: string
      lead_id: string
      ia_ativa: boolean
    }

    const conversaId = persistData.conversa_id
    const leadId = persistData.lead_id

    // Idempotency: if this message was already processed, skip LLM to avoid double billing
    // rpc_persistir_mensagem_entrada returns idempotente=true on redelivered messages
    if (persistData.idempotente) {
      return NextResponse.json({ ok: 'idempotent_redelivery' }, { status: 200 })
    }

    // ── Step 8: Check ia_ativa (handoff active) ────────────────────────────────
    if (!persistData.ia_ativa) {
      return NextResponse.json({ ok: 'handoff_active' }, { status: 200 })
    }

    // ── Step 9: Skip outbound echo (fromMe=true = bot's own reply) ────────────
    // Loop guardrail handled upstream in callOpenAIWithTools — toolUseIterations always 0 here
    if (fromMe) {
      return NextResponse.json({ ok: 'outbound_echo_skipped' }, { status: 200 })
    }

    // ── Step 10: Read tenant row ───────────────────────────────────────────────
    const { data: tenant } = await admin
      .from('tenants')
      .select('ia_habilitada, ia_limite_diario_usd, iara_tenant_id')
      .eq('id', tenantId as string)
      .single()

    // iara_tenant_id IS NOT NULL → bridge tenant, skip agent (ADR scope fence + WHATS-01)
    if (tenant && (tenant as Record<string, unknown>).iara_tenant_id !== null) {
      return NextResponse.json({ ok: 'bridge_tenant_skipped' }, { status: 200 })
    }

    // ── Step 11: ia_habilitada=false → send fallback, return 200 ──────────────
    if (!tenant || !(tenant as Record<string, unknown>).ia_habilitada) {
      // Load instance api_key for fallback send
      const { data: instanceRow } = await admin
        .from('evolution_instances')
        .select('api_key_encrypted')
        .eq('instance_name', instance_name)
        .single()

      // TODO: replace plaintext read with Supabase Vault decryption (api_key_encrypted column)
      const apiKey =
        (instanceRow as Record<string, unknown> | null)?.api_key_encrypted as string | undefined

      // Persist fallback outbound BEFORE sending
      await admin.rpc('rpc_persistir_resposta_bot', {
        p_tenant_id: tenantId as string,
        p_conversa_id: conversaId,
        p_conteudo: FALLBACK_IA_DESABILITADA,
      })

      if (process.env.EVOLUTION_API_URL && apiKey) {
        await fetch(
          `${process.env.EVOLUTION_API_URL}/message/sendText/${instance_name}`,
          {
            method: 'POST',
            headers: { apikey: apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({ number: remotejid, text: FALLBACK_IA_DESABILITADA }),
          },
        )
      }

      return NextResponse.json({ ok: true, fallback: 'ia_desabilitada' }, { status: 200 })
    }

    // ── Step 12: Load academia_config + last 20 chat_messages ─────────────────
    const { data: academiaConfig } = await admin
      .from('academia_config')
      .select(
        'nome_academia, bairro, cidade, tom_de_voz, diferenciais, horarios, planos,' +
          'caderno_editorial_escopo, caderno_editorial_tom, caderno_editorial_restricoes,' +
          'caderno_editorial_objetivos, caderno_editorial_exemplos,' +
          'argumentos_venda, objecoes_comuns, palavras_proibidas, gatilhos_handoff, persona_cmo',
      )
      .eq('tenant_id', tenantId as string) // defense-in-depth on top of RLS
      .single()

    const { data: chatHistoryRaw } = await admin
      .from('chat_messages')
      .select('id, tenant_id, conversa_id, evolution_message_id, direcao, tipo, conteudo, enviada_em, status_envio')
      .eq('conversa_id', conversaId)
      .eq('tenant_id', tenantId as string) // defense-in-depth on top of RLS
      .order('enviada_em', { ascending: false })
      .limit(20)

    const chatHistory = ((chatHistoryRaw as unknown[]) ?? []).reverse()

    // ── Step 13: Build system prompt ──────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      academiaConfig: (academiaConfig as any) ?? {
        tenant_id: tenantId as string,
        nome_academia: 'Academia',
      },
      chatHistory: chatHistory as Parameters<typeof buildSystemPrompt>[0]['chatHistory'],
    })

    // ── Step 14: OpenAI tool-use loop ──────────────────────────────────────────
    const result = await callOpenAIWithTools({
      systemPrompt,
      userMessage: conteudo,
      tools: cmoTools,
      tenantId: tenantId as string,
      conversaId,
      leadId,
      supabase: admin,
    })

    // ── Step 15: Guardrails ────────────────────────────────────────────────────
    // Loop guardrail handled upstream in callOpenAIWithTools — toolUseIterations always 0 here
    const guarded = applyGuardrails(result.texto, {
      palavrasProibidas:
        (academiaConfig as Record<string, unknown> | null)?.palavras_proibidas as string[] ?? [],
      horarios: (academiaConfig as Record<string, unknown> | null)?.horarios,
      planos: (academiaConfig as Record<string, unknown> | null)?.planos,
      toolUseIterations: 0, // Loop guardrail handled upstream in callOpenAIWithTools — toolUseIterations always 0 here
    })

    const finalHandoff = result.handoff_solicitado || guarded.handoff_solicitado
    const finalTexto = guarded.texto

    // ── Step 16: Handoff (if triggered by guardrails) ─────────────────────────
    if (finalHandoff && guarded.handoff_solicitado && !result.handoff_solicitado) {
      // Guardrails triggered handoff (not already handled by tool)
      await admin.rpc('rpc_handoff_humano', {
        p_tenant_id: tenantId as string,
        p_conversa_id: conversaId,
        p_motivo: guarded.motivo ?? 'guardrail',
      })
    }

    // ── Step 17: Persist outbound BEFORE Evolution send (persist-before-send) ──
    const { data: botPersist } = await admin.rpc('rpc_persistir_resposta_bot', {
      p_tenant_id: tenantId as string,
      p_conversa_id: conversaId,
      p_conteudo: finalTexto,
    })

    const botMessageId = (botPersist as Record<string, unknown> | null)?.message_id as string | undefined

    // ── Step 18: Evolution API send ───────────────────────────────────────────
    // Load api_key for this instance (v1: plaintext read)
    const { data: instanceRow } = await admin
      .from('evolution_instances')
      .select('api_key_encrypted')
      .eq('instance_name', instance_name)
      .single()

    // TODO: replace plaintext read with Supabase Vault decryption (api_key_encrypted column)
    const apiKey =
      (instanceRow as Record<string, unknown> | null)?.api_key_encrypted as string | undefined

    let sendOk = false
    if (process.env.EVOLUTION_API_URL && apiKey) {
      try {
        const sendResponse = await fetch(
          `${process.env.EVOLUTION_API_URL}/message/sendText/${instance_name}`,
          {
            method: 'POST',
            headers: { apikey: apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({ number: remotejid, text: finalTexto }),
          },
        )
        sendOk = sendResponse.ok
      } catch {
        sendOk = false
      }
    }

    // Update chat_messages status_envio after send
    if (botMessageId) {
      await admin
        .from('chat_messages')
        .update({ status_envio: sendOk ? 'enviada' : 'falhou' })
        .eq('id', botMessageId)
        .eq('tenant_id', tenantId as string) // defense-in-depth on top of RLS
    }

    // ── Step 19: Return 200 ────────────────────────────────────────────────────
    return NextResponse.json(
      { ok: true, conversa_id: conversaId },
      { status: 200 },
    )
  } catch (err) {
    // NEVER echo err.message or payload — may contain lead PII or env values
    // Log only tenantId (if resolved) + errCode — nothing else
    const errCode = (err as { code?: string })?.code
    console.error('[webhook/evolution] unhandled error', { errCode })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
