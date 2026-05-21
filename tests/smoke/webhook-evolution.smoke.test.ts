import 'dotenv/config'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { seedTestTenant, cleanupTestTenant, countChatMessages, waitForBotReply } from './helpers/seed'
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

describe('end-to-end webhook pipeline', () => {
  it('valid payload → 200 + entrada message persisted + saida reply within 30s', async () => {
    const messageId = `e2e-${Date.now()}`
    const remotejid = `55679e2e${Date.now().toString().slice(-6)}@s.whatsapp.net`
    const before = new Date()

    const payload = buildEvolutionWebhookPayload({
      instanceName,
      remotejid,
      messageId,
      text: 'Olá! Gostaria de saber mais sobre a academia.',
      pushName: 'Smoke Lead E2E',
    })
    const body = JSON.stringify(payload)

    const res = await fetch(`${SMOKE_BASE_URL}/api/webhooks/evolution`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signHmac(body, SMOKE_EVOLUTION_WEBHOOK_SECRET),
      },
      body,
    })

    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json.ok).toBeTruthy()

    // entrada message must be persisted immediately (webhook is synchronous)
    const entradaCount = await countChatMessages(tenantId, messageId)
    expect(entradaCount, 'entrada message must be persisted').toBe(1)

    // saida reply from LLM — webhook pipeline is synchronous, so it should exist immediately.
    // waitForBotReply polls up to 30s as a safety net for any transient delay.
    const replyText = await waitForBotReply(tenantId, remotejid, before)
    expect(replyText.length, 'bot reply should not be empty').toBeGreaterThan(0)
  })
})
