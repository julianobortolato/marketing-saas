import 'dotenv/config'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { seedTestTenant, cleanupTestTenant, getConversaIaAtiva } from './helpers/seed'
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

describe('handoff trigger on discount request', () => {
  it('message with "desconto" → ia_ativa=false within 30s', async () => {
    const messageId = `handoff-${Date.now()}`
    const remotejid = `55679handoff${Date.now().toString().slice(-5)}@s.whatsapp.net`

    const payload = buildEvolutionWebhookPayload({
      instanceName,
      remotejid,
      messageId,
      text: 'Oi, vocês têm desconto para estudantes?',
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

    // The webhook pipeline is synchronous — handoff RPC is called before returning 200.
    // Poll up to 15s in case of any transient DB propagation delay.
    const deadline = Date.now() + 15_000
    let iaAtiva: boolean | null = null
    while (Date.now() < deadline) {
      iaAtiva = await getConversaIaAtiva(remotejid, tenantId)
      if (iaAtiva === false) break
      await new Promise((r) => setTimeout(r, 1000))
    }

    expect(iaAtiva, 'ia_ativa must be false after desconto trigger').toBe(false)
  })
})
