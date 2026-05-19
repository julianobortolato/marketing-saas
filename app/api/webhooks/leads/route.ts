import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature } from '@/lib/webhooks/verify-signature'
import { parseLeadPayload } from '@/lib/webhooks/parse-lead'

// node:crypto requires the Node.js runtime (not Edge).
export const runtime = 'nodejs'

/**
 * POST /api/webhooks/leads
 *
 * Ingests leads from Meta Lead Form or WhatsApp webhooks (LEAD-01).
 *
 * Security order (CLAUDE.md inegociável):
 *   1. Read raw body
 *   2. Verify HMAC-SHA256 signature BEFORE parsing payload
 *   3. Resolve tenant from token header/query (NEVER from body)
 *   4. Parse payload, insert lead via service-role admin client
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()

    // Gate 1: signature verification — FIRST action after reading body
    const secret = process.env.LEADS_WEBHOOK_SECRET
    if (!secret) {
      console.error('[webhook/leads] LEADS_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'webhook_misconfigured' }, { status: 500 })
    }

    if (!verifyWebhookSignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }

    // Gate 2: tenant resolution from token — NEVER from body
    const token =
      request.headers.get('x-webhook-token') ??
      request.nextUrl.searchParams.get('token')

    const tenantMap: Record<string, string> = JSON.parse(
      process.env.WEBHOOK_TENANT_MAP ?? '{}'
    )
    const tenantId = token ? tenantMap[token] : undefined

    if (!tenantId) {
      return NextResponse.json({ error: 'unknown_tenant' }, { status: 401 })
    }

    // Gate 3: payload normalization
    const parsed = parseLeadPayload(raw)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 422 })
    }

    // Insert via service-role client (external caller is unauthenticated; RLS bypassed)
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('leads')
      .insert({
        tenant_id: tenantId, // from WEBHOOK_TENANT_MAP, never from body
        nome: parsed.nome,
        telefone: parsed.telefone,
        remotejid: parsed.remotejid,
        origem: parsed.origem,
        status: 'novo',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[webhook/leads] insert failed:', error.message)
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch {
    // Catch unexpected errors — never echo exception message (may contain env values)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
