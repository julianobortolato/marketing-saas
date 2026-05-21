import 'dotenv/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SMOKE_SUPABASE_URL = process.env.SMOKE_SUPABASE_URL!
const SMOKE_SERVICE_ROLE_KEY = process.env.SMOKE_SERVICE_ROLE_KEY!
const SMOKE_SUPABASE_ANON_KEY = process.env.SMOKE_SUPABASE_ANON_KEY!
const SMOKE_EVOLUTION_WEBHOOK_SECRET = process.env.SMOKE_EVOLUTION_WEBHOOK_SECRET!

// Guard: if any required env is missing, fail early with a clear message
const requiredEnv = [
  'SMOKE_SUPABASE_URL',
  'SMOKE_SERVICE_ROLE_KEY',
  'SMOKE_SUPABASE_ANON_KEY',
  'SMOKE_EVOLUTION_WEBHOOK_SECRET',
] as const
for (const key of requiredEnv) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key} — check .env.smoke`)
}

export const adminClient = createClient(SMOKE_SUPABASE_URL, SMOKE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Denylist: cleanupTestTenant refuses to delete these production tenant IDs.
// Populated from SMOKE_PRODUCTION_TENANT_IDS (comma-separated) if set in .env.smoke.
const PRODUCTION_TENANT_DENYLIST = new Set<string>(
  (process.env.SMOKE_PRODUCTION_TENANT_IDS ?? '').split(',').filter(Boolean),
)

const TEST_USER_PASSWORD = 'SmokeTest!2026#'

export interface SeedResult {
  tenantId: string
  instanceName: string
  userEmail: string
  userPassword: string
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

// Creates a full isolated test tenant: auth user (handle_new_user trigger creates tenants +
// usuarios automatically), then updates the auto-created tenant + inserts academia_config +
// evolution_instances. Returns credentials for user-authenticated RLS tests.
export async function seedTestTenant(): Promise<SeedResult> {
  const suffix = randomSuffix()
  const instanceName = `smoke_test_${suffix}`
  const userEmail = `smoke-test-${suffix}@smoke.internal`

  // Step 1: create auth user — handle_new_user trigger creates tenants + usuarios rows
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: userEmail,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { nome: `Smoke Owner ${suffix}`, nome_academia: `Smoke Academia ${suffix}` },
  })
  if (authErr ?? !authData.user) {
    throw new Error(`seedTestTenant: auth user creation failed: ${authErr?.message}`)
  }

  // Step 2: retrieve the tenant_id the trigger created
  const { data: usuarioRow, error: usuarioFetchErr } = await adminClient
    .from('usuarios')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .single()
  if (usuarioFetchErr ?? !usuarioRow) {
    throw new Error(`seedTestTenant: could not fetch auto-created tenant_id: ${usuarioFetchErr?.message}`)
  }
  const tenantId = (usuarioRow as { tenant_id: string }).tenant_id

  // Step 3: update the auto-created tenant with smoke test values
  const { error: tenantUpdateErr } = await adminClient
    .from('tenants')
    .update({
      nome: `Smoke Academia ${suffix}`,
      iara_tenant_id: null,
      ia_habilitada: true,
      ia_limite_diario_usd: 0.10,
      plano: 'starter',
    })
    .eq('id', tenantId)
  if (tenantUpdateErr) throw new Error(`seedTestTenant: tenant update failed: ${tenantUpdateErr.message}`)

  // Step 4: insert academia_config
  const { error: configErr } = await adminClient.from('academia_config').insert({
    tenant_id: tenantId,
    nome_academia: `Smoke Academia ${suffix}`,
    bairro: 'Smoke Bairro',
    cidade: 'Smoke City',
    tom_de_voz: 'coloquial',
    diferenciais: ['Musculação', 'Cardio'],
    horarios: { text: 'Seg-Sex 06h-22h / Sab 08h-14h' },
    planos: [{ nome: 'Mensal', valor: 120, modalidades: ['Musculação'] }],
    caderno_editorial_escopo: 'Captação e qualificação de leads via WhatsApp.',
    caderno_editorial_tom: 'Amigável e motivador. Use você. Emojis moderados 💪.',
    caderno_editorial_restricoes: 'Não prometer descontos. Não dar preços por escrito sem contexto.',
    caderno_editorial_objetivos: ['Agendar aula experimental', 'Qualificar interesse do lead'],
    caderno_editorial_exemplos: 'Olá! Que ótimo te ver por aqui 💪 Posso te ajudar a conhecer nossa academia?',
    palavras_proibidas: ['idiota', 'burro'],
    gatilhos_handoff: { desconto: true, pagamento: true },
  })
  if (configErr) throw new Error(`seedTestTenant: academia_config insert failed: ${configErr.message}`)

  // Step 5: insert evolution_instances
  const { error: instanceErr } = await adminClient.from('evolution_instances').insert({
    tenant_id: tenantId,
    instance_name: instanceName,
    numero_whatsapp: `+5567900${suffix}`,
    api_key_encrypted: 'smoke-placeholder-key',
    webhook_secret: SMOKE_EVOLUTION_WEBHOOK_SECRET,
    ativo: true,
  })
  if (instanceErr) throw new Error(`seedTestTenant: evolution_instances insert failed: ${instanceErr.message}`)

  return { tenantId, instanceName, userEmail, userPassword: TEST_USER_PASSWORD }
}

// Inserts a fictitious tenant "Academia Premium Vértice" for the anti-leak gate test.
// Config is formal/navy/senhor-senhora treatment — zero references to Fitness UNIC.
// Same trigger-aware pattern as seedTestTenant: create auth user first, then configure.
export async function seedFictitiousTenant(): Promise<SeedResult> {
  const suffix = randomSuffix()
  const instanceName = `smoke_vertice_${suffix}`
  const userEmail = `smoke-vertice-${suffix}@smoke.internal`

  // Step 1: create auth user — handle_new_user trigger creates tenants + usuarios rows
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: userEmail,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { nome: `Smoke Vértice Owner ${suffix}`, nome_academia: 'Smoke Academia Premium Vértice' },
  })
  if (authErr ?? !authData.user) {
    throw new Error(`seedFictitiousTenant: auth user creation failed: ${authErr?.message}`)
  }

  // Step 2: retrieve the tenant_id the trigger created
  const { data: usuarioRow, error: usuarioFetchErr } = await adminClient
    .from('usuarios')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .single()
  if (usuarioFetchErr ?? !usuarioRow) {
    throw new Error(`seedFictitiousTenant: could not fetch auto-created tenant_id: ${usuarioFetchErr?.message}`)
  }
  const tenantId = (usuarioRow as { tenant_id: string }).tenant_id

  // Step 3: update the auto-created tenant with Vértice values
  const { error: tenantUpdateErr } = await adminClient
    .from('tenants')
    .update({
      nome: 'Smoke Academia Premium Vértice',
      iara_tenant_id: null,
      ia_habilitada: true,
      ia_limite_diario_usd: 0.50,
      plano: 'pro',
    })
    .eq('id', tenantId)
  if (tenantUpdateErr) throw new Error(`seedFictitiousTenant: tenant update failed: ${tenantUpdateErr.message}`)

  // Step 4: insert academia_config (formal Vértice profile — zero UNIC references)
  const { error: configErr } = await adminClient.from('academia_config').insert({
    tenant_id: tenantId,
    nome_academia: 'Academia Premium Vértice',
    bairro: 'Centro',
    cidade: 'São Paulo',
    tom_de_voz: 'formal',
    diferenciais: [
      'Equipamentos premium importados',
      'Avaliação física com biomédico',
      'Personal trainer pós-graduado',
      'Sala climatizada com controle de temperatura',
    ],
    horarios: { text: 'Segunda a sexta: 06h às 22h | Sábado: 08h às 14h' },
    planos: [{ nome: 'Premium', valor: 599, modalidades: ['Musculação', 'Pilates', 'Avaliação Física'] }],
    caderno_editorial_escopo: 'Comunicação técnico-consultiva. Foco em saúde, longevidade e performance.',
    caderno_editorial_tom: 'Formal. Trate sempre por senhor ou senhora. Evite gírias, emojis e exclamações. Use vocabulário sofisticado.',
    caderno_editorial_restricoes: 'Nunca usar: bora, beleza, top, sensacional, massa, demais, vibe, rolê. Nunca usar emojis. Não confraternizar.',
    caderno_editorial_objetivos: [
      'Qualificar lead premium',
      'Agendar avaliação física presencial',
      'Demonstrar credibilidade técnica',
    ],
    caderno_editorial_exemplos: 'Bem recebido. Posso compreender melhor seus objetivos? Em que posso auxiliá-lo(a)?',
    palavras_proibidas: ['bora', 'beleza', 'top', 'sensacional', 'massa', 'demais', 'vibe', 'rolê'],
    gatilhos_handoff: { desconto: true, pagamento: true },
  })
  if (configErr) throw new Error(`seedFictitiousTenant: academia_config insert failed: ${configErr.message}`)

  // Step 5: insert evolution_instances
  const { error: instanceErr } = await adminClient.from('evolution_instances').insert({
    tenant_id: tenantId,
    instance_name: instanceName,
    numero_whatsapp: `+5511800${suffix}`,
    api_key_encrypted: 'smoke-vertice-placeholder-key',
    webhook_secret: SMOKE_EVOLUTION_WEBHOOK_SECRET,
    ativo: true,
  })
  if (instanceErr) throw new Error(`seedFictitiousTenant: evolution_instances insert failed: ${instanceErr.message}`)

  return { tenantId, instanceName, userEmail, userPassword: TEST_USER_PASSWORD }
}

export async function cleanupTestTenant(tenantId: string): Promise<void> {
  if (PRODUCTION_TENANT_DENYLIST.has(tenantId)) {
    throw new Error(`cleanupTestTenant: refused — ${tenantId} is in PRODUCTION_TENANT_DENYLIST`)
  }

  // Defense-in-depth: tenant nome must start with 'Smoke'
  const { data: tenant } = await adminClient
    .from('tenants')
    .select('nome')
    .eq('id', tenantId)
    .single()

  if (tenant && !(tenant as { nome: string }).nome.startsWith('Smoke')) {
    throw new Error(
      `cleanupTestTenant: refused — tenant nome "${(tenant as { nome: string }).nome}" does not start with "Smoke"`,
    )
  }

  // Collect auth user IDs before deleting usuarios rows
  const { data: usuariosRows } = await adminClient
    .from('usuarios')
    .select('id')
    .eq('tenant_id', tenantId)
  const authUserIds = (usuariosRows as Array<{ id: string }> | null)?.map((u) => u.id) ?? []

  // Delete in FK-safe order
  await adminClient.from('chat_messages').delete().eq('tenant_id', tenantId)
  await adminClient.from('ai_usage_log').delete().eq('tenant_id', tenantId)
  await adminClient.from('ai_usage_diario').delete().eq('tenant_id', tenantId)
  await adminClient.from('conversas').delete().eq('tenant_id', tenantId)
  await adminClient.from('evolution_instances').delete().eq('tenant_id', tenantId)
  await adminClient.from('academia_config').delete().eq('tenant_id', tenantId)
  await adminClient.from('leads').delete().eq('tenant_id', tenantId)
  await adminClient.from('usuarios').delete().eq('tenant_id', tenantId)
  await adminClient.from('tenants').delete().eq('id', tenantId)

  for (const userId of authUserIds) {
    await adminClient.auth.admin.deleteUser(userId)
  }
}

export async function resetDailyUsage(tenantId: string): Promise<void> {
  await adminClient.from('ai_usage_diario').delete().eq('tenant_id', tenantId)
  await adminClient.from('tenants').update({
    ia_habilitada: true,
    ia_desabilitada_em: null,
    ia_desabilitada_motivo: null,
  }).eq('id', tenantId)
}

export async function forceKillSwitchBudget(tenantId: string, limitUsd: number): Promise<void> {
  await adminClient
    .from('tenants')
    .update({ ia_limite_diario_usd: limitUsd })
    .eq('id', tenantId)
}

// Inserts a large cost into ai_usage_log — the fn_acumular_uso_ia trigger fires
// synchronously and sets ia_habilitada=false. Reliable alternative to waiting for
// a real OpenAI call to exceed the budget (which depends on model pricing).
export async function forceKillSwitchViaUsage(tenantId: string): Promise<void> {
  const { error } = await adminClient.from('ai_usage_log').insert({
    tenant_id: tenantId,
    conversa_id: null,
    modelo: 'gpt-4o',
    tokens_entrada: 100000,
    tokens_saida: 50000,
    custo_usd: 100.0,
    duracao_ms: 1000,
    sucesso: true,
    erro: null,
  })
  if (error) throw new Error(`forceKillSwitchViaUsage failed: ${error.message}`)
}

export async function getConversaIaAtiva(remotejid: string, tenantId: string): Promise<boolean | null> {
  const { data } = await adminClient
    .from('conversas')
    .select('ia_ativa')
    .eq('tenant_id', tenantId)
    .eq('remotejid', remotejid)
    .single()
  return (data as { ia_ativa: boolean } | null)?.ia_ativa ?? null
}

export async function countChatMessages(tenantId: string, evolutionMessageId: string): Promise<number> {
  const { count } = await adminClient
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('evolution_message_id', evolutionMessageId)
  return count ?? 0
}

// Returns a Supabase client authenticated as the given user.
// Used in RLS inverse tests to simulate a tenant-scoped session.
export async function getUserClient(userEmail: string, userPassword: string): Promise<SupabaseClient> {
  const client = createClient(SMOKE_SUPABASE_URL, SMOKE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email: userEmail, password: userPassword })
  if (error) throw new Error(`getUserClient: sign in failed for ${userEmail}: ${error.message}`)
  return client
}

// Waits for a saida chat_message to appear for the given conversa, polling up to timeoutMs.
// Returns the message content or throws on timeout.
export async function waitForBotReply(
  tenantId: string,
  remotejid: string,
  afterTimestamp: Date,
  timeoutMs = 30_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { data } = await adminClient
      .from('chat_messages')
      .select('conteudo')
      .eq('tenant_id', tenantId)
      .eq('direcao', 'saida')
      .gte('enviada_em', afterTimestamp.toISOString())
      .order('enviada_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) return (data as { conteudo: string }).conteudo

    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`waitForBotReply: no saida message found for remotejid ${remotejid} within ${timeoutMs}ms`)
}
