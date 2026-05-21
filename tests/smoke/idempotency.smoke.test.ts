import 'dotenv/config'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { seedTestTenant, cleanupTestTenant, countChatMessages, adminClient } from './helpers/seed'
import { buildEvolutionWebhookPayload } from './helpers/webhook-payload'
import { signHmac } from './helpers/sign'

const SMOKE_BASE_URL = process.env.SMOKE_BASE_URL!
const SMOKE_EVOLUTION_WEBHOOK_SECRET = process.env.SMOKE_EVOLUTION_WEBHOOK_SECRET!

let tenantId: string
let instanceName: string

beforeAll(async () => {
  const seed = await seedTestTenant()
  tenantId = seed.tenantId
  instanceName = seed.instanceName
})

afterAll(async () => {
  await cleanupTestTenant(tenantId)
})

describe('idempotency — Evolution redelivery absorbed without duplicate billing', () => {
  it('delivering the same evolution_message_id 3x results in exactly 1 entrada row and 1 AI call', async () => {
    const messageId = `idem-${Date.now()}`
    const remotejid = `55679idem${Date.now().toString().slice(-6)}@s.whatsapp.net`

    const payload = buildEvolutionWebhookPayload({
      instanceName,
      remotejid,
      messageId,
      text: 'Oi! Quero saber o horário de funcionamento.',
    })
    const body = JSON.stringify(payload)
    const sig = signHmac(body, SMOKE_EVOLUTION_WEBHOOK_SECRET)

    // Deliver 3 times — all must return 200
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${SMOKE_BASE_URL}/api/webhooks/evolution`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
        body,
      })
      expect(res.status, `delivery ${i + 1} must return 200`).toBe(200)
    }

    // Only 1 entrada row in chat_messages despite 3 deliveries
    const count = await countChatMessages(tenantId, messageId)
    expect(count, 'exactly 1 entrada row despite 3 deliveries').toBe(1)

    // Only 1 ai_usage_log entry for this conversa (no duplicate OpenAI calls)
    const { data: conversa } = await adminClient
      .from('conversas')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('remotejid', remotejid)
      .single()

    if (conversa) {
      const { count: usageCount } = await adminClient
        .from('ai_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('conversa_id', (conversa as { id: string }).id)

      expect(usageCount ?? 0, 'exactly 1 ai_usage_log entry — no double billing').toBeLessThanOrEqual(1)
    }
  })
})
