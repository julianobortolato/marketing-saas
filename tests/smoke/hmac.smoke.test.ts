import 'dotenv/config'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { seedTestTenant, cleanupTestTenant, countChatMessages } from './helpers/seed'
import { buildEvolutionWebhookPayload } from './helpers/webhook-payload'

const SMOKE_BASE_URL = process.env.SMOKE_BASE_URL!
if (!SMOKE_BASE_URL) throw new Error('Missing SMOKE_BASE_URL — check .env.smoke')

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

describe('HMAC validation gate', () => {
  it('rejects an invalid HMAC with 401 and persists nothing', async () => {
    const messageId = `hmac-invalid-${Date.now()}`
    const payload = buildEvolutionWebhookPayload({
      instanceName,
      remotejid: `5567900001@s.whatsapp.net`,
      messageId,
      text: 'Oi!',
    })
    const body = JSON.stringify(payload)

    const res = await fetch(`${SMOKE_BASE_URL}/api/webhooks/evolution`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      },
      body,
    })

    expect(res.status).toBe(401)
    const json = await res.json() as Record<string, unknown>
    expect(json.error).toBe('invalid_signature')

    const persisted = await countChatMessages(tenantId, messageId)
    expect(persisted, 'no rows should be persisted on invalid HMAC').toBe(0)
  })

  it('rejects a missing HMAC header with 401', async () => {
    const payload = buildEvolutionWebhookPayload({
      instanceName,
      remotejid: `5567900002@s.whatsapp.net`,
      messageId: `hmac-missing-${Date.now()}`,
      text: 'Sem header',
    })

    const res = await fetch(`${SMOKE_BASE_URL}/api/webhooks/evolution`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(401)
  })
})
