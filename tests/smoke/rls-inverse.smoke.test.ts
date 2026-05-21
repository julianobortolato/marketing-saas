import 'dotenv/config'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { seedTestTenant, cleanupTestTenant, adminClient, getUserClient } from './helpers/seed'
import { buildEvolutionWebhookPayload } from './helpers/webhook-payload'
import { signHmac } from './helpers/sign'
import type { SupabaseClient } from '@supabase/supabase-js'

const SMOKE_BASE_URL = process.env.SMOKE_BASE_URL!
const SMOKE_EVOLUTION_WEBHOOK_SECRET = process.env.SMOKE_EVOLUTION_WEBHOOK_SECRET!

let tenantAId: string
let tenantAInstanceName: string
let tenantAUserEmail: string
let tenantAUserPassword: string
let tenantBId: string
let userAClient: SupabaseClient

beforeAll(async () => {
  // Seed two isolated tenants
  const seedA = await seedTestTenant()
  tenantAId = seedA.tenantId
  tenantAInstanceName = seedA.instanceName
  tenantAUserEmail = seedA.userEmail
  tenantAUserPassword = seedA.userPassword

  const seedB = await seedTestTenant()
  tenantBId = seedB.tenantId

  // Seed some data in tenantB by sending a webhook so conversas + chat_messages exist
  const payload = buildEvolutionWebhookPayload({
    instanceName: seedB.instanceName,
    remotejid: `55679rlsb${Date.now().toString().slice(-5)}@s.whatsapp.net`,
    messageId: `rls-seed-b-${Date.now()}`,
    text: 'Mensagem do tenant B para seed do RLS test',
  })
  const body = JSON.stringify(payload)
  await fetch(`${SMOKE_BASE_URL}/api/webhooks/evolution`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': signHmac(body, SMOKE_EVOLUTION_WEBHOOK_SECRET),
    },
    body,
  })

  // Create user-authenticated client for tenantA
  userAClient = await getUserClient(tenantAUserEmail, tenantAUserPassword)
})

afterAll(async () => {
  await cleanupTestTenant(tenantAId)
  await cleanupTestTenant(tenantBId)
})

describe('RLS inverse suite — cross-tenant access blocked', () => {
  it('SELECT conversas: tenantA session cannot read tenantB rows', async () => {
    const { data, error } = await userAClient
      .from('conversas')
      .select('id, tenant_id')
      .eq('tenant_id', tenantBId)

    expect(error).toBeNull()
    expect(data?.length ?? 0, 'tenantA session must see 0 tenantB conversas rows').toBe(0)
  })

  it('SELECT chat_messages: tenantA session cannot read tenantB rows', async () => {
    const { data, error } = await userAClient
      .from('chat_messages')
      .select('id, tenant_id')
      .eq('tenant_id', tenantBId)

    expect(error).toBeNull()
    expect(data?.length ?? 0, 'tenantA session must see 0 tenantB chat_messages rows').toBe(0)
  })

  it('SELECT evolution_instances: tenantA session cannot read tenantB rows', async () => {
    const { data, error } = await userAClient
      .from('evolution_instances')
      .select('id, tenant_id')
      .eq('tenant_id', tenantBId)

    expect(error).toBeNull()
    expect(data?.length ?? 0, 'tenantA session must see 0 tenantB evolution_instances rows').toBe(0)
  })

  it('SELECT ai_usage_log: tenantA session cannot read tenantB rows', async () => {
    const { data, error } = await userAClient
      .from('ai_usage_log')
      .select('id, tenant_id')
      .eq('tenant_id', tenantBId)

    expect(error).toBeNull()
    expect(data?.length ?? 0, 'tenantA session must see 0 tenantB ai_usage_log rows').toBe(0)
  })

  it('SELECT ai_usage_diario: tenantA session cannot read tenantB rows', async () => {
    const { data, error } = await userAClient
      .from('ai_usage_diario')
      .select('tenant_id, custo_total_usd')
      .eq('tenant_id', tenantBId)

    expect(error).toBeNull()
    expect(data?.length ?? 0, 'tenantA session must see 0 tenantB ai_usage_diario rows').toBe(0)
  })

  it('INSERT into evolution_instances with tenantB id is blocked by RESTRICTIVE policy', async () => {
    const { error } = await userAClient.from('evolution_instances').insert({
      tenant_id: tenantBId,
      instance_name: `rls-cross-attempt-${Date.now()}`,
      numero_whatsapp: `+5599888777${Date.now().toString().slice(-3)}`,
      api_key_encrypted: 'rls-test',
      webhook_secret: 'rls-test',
      ativo: false,
    })

    expect(error, 'INSERT with tenantB id must be blocked by RLS').not.toBeNull()
  })

  it('UPDATE conversas: tenantA session cannot update tenantB rows (0 rows affected)', async () => {
    // After the UPDATE, select tenantB conversas as userA to verify none were modified.
    // The RESTRICTIVE policy makes tenantB rows invisible to userA, so 0 rows are updated.
    const { error } = await userAClient
      .from('conversas')
      .update({ ia_ativa: false })
      .eq('tenant_id', tenantBId)

    // No error expected — RLS silently returns 0 rows updated (not an exception for UPDATE)
    expect(error).toBeNull()

    // Verify tenantB conversas still have their original ia_ativa value (service_role can see them)
    const { data: tenantBConversas } = await adminClient
      .from('conversas')
      .select('ia_ativa')
      .eq('tenant_id', tenantBId)

    // All tenantB conversas must still have ia_ativa=true (the UPDATE from userA had no effect)
    const anyModified = (tenantBConversas as Array<{ ia_ativa: boolean }> | null)?.some((c) => !c.ia_ativa) ?? false
    expect(anyModified, 'tenantB conversas ia_ativa must be unchanged after cross-tenant UPDATE').toBe(false)
  })

  it('DELETE from evolution_instances: tenantA session cannot delete tenantB rows', async () => {
    // Count tenantB instances before (service_role bypasses RLS — sees everything)
    const { data: beforeData } = await adminClient
      .from('evolution_instances')
      .select('id')
      .eq('tenant_id', tenantBId)
    const before = beforeData?.length ?? 0

    // Attempt DELETE as tenantA user — RESTRICTIVE policy blocks it (sees 0 matching rows)
    await userAClient.from('evolution_instances').delete().eq('tenant_id', tenantBId)

    // TenantB instances must still exist — RLS blocked the delete
    const { data: afterData } = await adminClient
      .from('evolution_instances')
      .select('id')
      .eq('tenant_id', tenantBId)
    const after = afterData?.length ?? 0

    expect(after, 'tenantB evolution_instances must survive tenantA delete attempt').toBe(before)
  })
})
