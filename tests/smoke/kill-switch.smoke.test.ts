import 'dotenv/config'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import {
  seedTestTenant,
  cleanupTestTenant,
  resetDailyUsage,
  forceKillSwitchBudget,
  forceKillSwitchViaUsage,
  adminClient,
} from './helpers/seed'
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
  // Restore usable state before cleanup
  await resetDailyUsage(tenantId)
  await forceKillSwitchBudget(tenantId, 0.10)
  await cleanupTestTenant(tenantId)
})

describe('kill switch — budget exhaustion disables IA for tenant', () => {
  it('ia_habilitada=false → webhook returns ia_desabilitada fallback', async () => {
    // Reset any prior daily usage and set a minimal budget
    await resetDailyUsage(tenantId)
    await forceKillSwitchBudget(tenantId, 0.01)

    // Exhaust the budget by inserting a large cost directly into ai_usage_log.
    // The fn_acumular_uso_ia trigger fires synchronously and sets ia_habilitada=false.
    // This is more reliable than waiting for a real OpenAI call to exceed a $0.01 budget,
    // since GPT-4o call costs vary and ai_usage_diario uses NUMERIC(10,2) rounding.
    await forceKillSwitchViaUsage(tenantId)

    // Verify kill switch is active in DB
    const { data: tenantRow } = await adminClient
      .from('tenants')
      .select('ia_habilitada, ia_desabilitada_motivo')
      .eq('id', tenantId)
      .single()

    expect((tenantRow as { ia_habilitada: boolean }).ia_habilitada, 'ia_habilitada must be false').toBe(false)
    expect(
      (tenantRow as { ia_desabilitada_motivo: string }).ia_desabilitada_motivo,
      'motivo must be budget_diario_excedido',
    ).toBe('budget_diario_excedido')

    // Now POST a webhook — the pipeline must return the fallback response (not call OpenAI)
    const messageId = `kill-switch-${Date.now()}`
    const remotejid = `55679ks${Date.now().toString().slice(-6)}@s.whatsapp.net`

    const payload = buildEvolutionWebhookPayload({
      instanceName,
      remotejid,
      messageId,
      text: 'Olá, boa tarde!',
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
    expect(json.fallback, 'response must indicate ia_desabilitada fallback').toBe('ia_desabilitada')
  })
})
