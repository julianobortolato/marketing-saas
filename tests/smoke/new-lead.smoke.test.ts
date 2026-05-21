import 'dotenv/config'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { seedTestTenant, cleanupTestTenant, adminClient } from './helpers/seed'
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

describe('new lead creation on first contact', () => {
  it('first message from unknown remotejid creates leads + conversas + chat_messages rows', async () => {
    const messageId = `new-lead-${Date.now()}`
    const remotejid = `556790newlead${Date.now().toString().slice(-5)}@s.whatsapp.net`

    const payload = buildEvolutionWebhookPayload({
      instanceName,
      remotejid,
      messageId,
      text: 'Oi, vi o anúncio de vocês e quero saber mais!',
      pushName: 'Smoke New Lead',
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

    // leads row created with origem='whatsapp'
    const { data: leads } = await adminClient
      .from('leads')
      .select('id, tenant_id, remotejid, origem, status')
      .eq('tenant_id', tenantId)
      .eq('remotejid', remotejid)

    expect(leads?.length, 'one lead row must exist').toBe(1)
    const lead = (leads as Array<{ origem: string; status: string }>)[0]
    expect(lead.origem).toBe('whatsapp')
    expect(lead.status).toBe('novo')

    // conversas row created
    const { data: conversas } = await adminClient
      .from('conversas')
      .select('id, ia_ativa')
      .eq('tenant_id', tenantId)
      .eq('remotejid', remotejid)

    expect(conversas?.length, 'one conversa row must exist').toBe(1)
    expect((conversas as Array<{ ia_ativa: boolean }>)[0].ia_ativa).toBe(true)

    // chat_messages entrada row created
    const { data: messages } = await adminClient
      .from('chat_messages')
      .select('direcao, evolution_message_id')
      .eq('tenant_id', tenantId)
      .eq('evolution_message_id', messageId)

    expect(messages?.length, 'one entrada chat_message must exist').toBe(1)
    expect((messages as Array<{ direcao: string }>)[0].direcao).toBe('entrada')
  })
})
