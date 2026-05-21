import 'dotenv/config'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { seedFictitiousTenant, cleanupTestTenant, adminClient, waitForBotReply } from './helpers/seed'
import { buildEvolutionWebhookPayload } from './helpers/webhook-payload'
import { signHmac } from './helpers/sign'

const SMOKE_BASE_URL = process.env.SMOKE_BASE_URL!
const SMOKE_EVOLUTION_WEBHOOK_SECRET = process.env.SMOKE_EVOLUTION_WEBHOOK_SECRET!

// 10 distinct lead first-message scenarios — vary intent and formality
const LEAD_SCRIPT = [
  'Olá! Vi sobre vocês e gostaria de saber mais.',
  'Boa tarde. Quero começar a treinar. Quais são os planos disponíveis?',
  'Bom dia. Um amigo me indicou. Tem como me passar o horário de funcionamento?',
  'Oi, preciso perder peso. Vocês têm acompanhamento personalizado?',
  'Olá. Tenho 60 anos. Vocês atendem pessoas da minha faixa etária?',
  'Boa noite. Quero fazer musculação. Como funciona a avaliação física?',
  'Olá. Já treinei antes mas parei. É difícil retomar?',
  'Bom dia. Gostaria de saber se vocês têm aula experimental gratuita.',
  'Oi, minha filha quer fazer pilates. Vocês oferecem essa modalidade?',
  'Boa tarde. Estou procurando uma academia próxima ao centro. Vocês ficam onde?',
]

// Hard regex: words that belong to coloquial/informal tone and must NEVER appear
// in responses for this formal "Academia Premium Vértice" tenant.
const BANNED_COLOQUIAL = /\b(bora|beleza|top|sensacional|massa|demais|vibe|rolê|incrível|massa|perfeito)\b/i

interface LeakReportEntry {
  scenario_index: number
  lead_message: string
  agent_response: string
  hard_gate_pass: boolean
  note?: string
}

let verticeTenantId: string
let verticeInstanceName: string
const leakReport: LeakReportEntry[] = []

beforeAll(async () => {
  const seed = await seedFictitiousTenant()
  verticeTenantId = seed.tenantId
  verticeInstanceName = seed.instanceName
})

afterAll(async () => {
  // Write report before cleanup so it's available even if cleanup fails
  const reportPath = join(process.cwd(), 'tests/smoke/.identity-leak-report.json')
  writeFileSync(reportPath, JSON.stringify(leakReport, null, 2), 'utf-8')

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('MANUAL REVIEW REQUIRED')
  console.log(`Open ${reportPath} and for each of the 10 entries verify:`)
  console.log('  a) Formal Portuguese (senhor/senhora treatment or neutral you without slang)')
  console.log('  b) No emojis sprayed (conservative formal use only)')
  console.log('  c) No UNIC-specific bairros, modalities, or vocabulary leak')
  console.log('  d) Offer/proposal matches Vértice planos (R$599, avaliação física)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  await cleanupTestTenant(verticeTenantId)
})

describe('anti-leak gate — Academia Premium Vértice tenant isolation', () => {
  for (let i = 0; i < LEAD_SCRIPT.length; i++) {
    const leadMessage = LEAD_SCRIPT[i]

    it(`scenario ${i + 1}: response for "${leadMessage.slice(0, 40)}..." passes hard regex gate`, async () => {
      const messageId = `vertice-${i}-${Date.now()}`
      const remotejid = `5511800vertice${i}${Date.now().toString().slice(-4)}@s.whatsapp.net`
      const before = new Date()

      const payload = buildEvolutionWebhookPayload({
        instanceName: verticeInstanceName,
        remotejid,
        messageId,
        text: leadMessage,
        pushName: `Smoke Lead Vértice ${i + 1}`,
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

      expect(res.status, `scenario ${i + 1}: webhook must return 200`).toBe(200)

      // Collect bot response — webhook is synchronous so it should be immediate
      let agentResponse = ''
      try {
        agentResponse = await waitForBotReply(verticeTenantId, remotejid, before, 30_000)
      } catch {
        agentResponse = '[NO REPLY CAPTURED]'
      }

      const hardGatePass = !BANNED_COLOQUIAL.test(agentResponse)

      leakReport.push({
        scenario_index: i + 1,
        lead_message: leadMessage,
        agent_response: agentResponse,
        hard_gate_pass: hardGatePass,
      })

      // Hard gate: banned coloquial vocabulary must NOT appear
      // Do NOT log agentResponse or leadMessage to stdout — CLAUDE.md: no lead data in logs
      expect(
        hardGatePass,
        `scenario ${i + 1}: response contains banned coloquial vocabulary — identity leak detected`,
      ).toBe(true)
    })
  }
})
