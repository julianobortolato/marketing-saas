# Phase 3: Agente WhatsApp — Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 8 new files (Sprint 2: 5, Sprint 3: 3)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/api/webhooks/evolution/route.ts` | middleware/controller | request-response | `app/api/webhooks/leads/route.ts` | exact |
| `lib/openai/client.ts` | service | request-response | `lib/aprovacoes/campaign-gate.ts` (RPC call pattern) + RESEARCH | role-match |
| `lib/agents/cmo/system-prompt.ts` | service | transform | `lib/queries/academia-config.ts` (DB read + shape transform) | role-match |
| `lib/agents/cmo/tools.ts` | service | request-response | `lib/aprovacoes/campaign-gate.ts` (RPC call + error throw) | role-match |
| `lib/agents/cmo/guardrails.ts` | utility | transform | `lib/webhooks/parse-lead.ts` (pure transform, Zod shapes, never throws) | role-match |
| `app/api/admin/saude-mkt/route.ts` | controller | request-response | `app/api/invite/route.ts` (auth check + adminClient + JSON response) | role-match |
| `app/(dashboard)/[tenant_slug]/conversas/page.tsx` | component | CRUD | `app/dashboard/leads/page.tsx` + `leads-table.tsx` | role-match |
| `app/(dashboard)/[tenant_slug]/configuracoes/editorial/page.tsx` | component | CRUD | `app/dashboard/configuracoes/page.tsx` + `config-form.tsx` + `actions.ts` | exact |

---

## Pattern Assignments

### `app/api/webhooks/evolution/route.ts` (controller, request-response)

**Analog:** `app/api/webhooks/leads/route.ts` (lines 1–80)

**Imports pattern** (lines 1–4 of analog):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature } from '@/lib/webhooks/verify-signature'
// Add: import { openaiToolUseLoop } from '@/lib/openai/client'
// Add: import { buildSystemPrompt } from '@/lib/agents/cmo/system-prompt'
// Add: import { applyGuardrails } from '@/lib/agents/cmo/guardrails'
```

**Runtime declaration** (line 7 of analog — mandatory for node:crypto):
```typescript
export const runtime = 'nodejs'
```

**Security gate order** (lines 20–47 of analog — copy exact gate ordering):
```typescript
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()

    // Gate 1: HMAC-SHA256 signature — FIRST action after reading body
    const secret = process.env.EVOLUTION_WEBHOOK_SECRET
    if (!secret) {
      console.error('[webhook/evolution] EVOLUTION_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'webhook_misconfigured' }, { status: 500 })
    }
    if (!verifyWebhookSignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }

    // Gate 2: rate limit IP (before tenant resolution)
    // Gate 3: resolve tenant via fn_tenant_id_by_evolution_instance(instance_name)
    // Gate 4: rate limit tenant
    // Gate 5: rpc_persistir_mensagem_entrada — ALWAYS return 200 after this succeeds
    // ... remainder of 14-step pipeline
  } catch {
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
```

**200-always philosophy** (comments at lines 9–19 of analog):
```typescript
// Webhook always returns 200 when message is persisted, regardless of LLM result.
// Prevents Evolution API redelivery loop.
// Do NOT return 4xx/5xx after rpc_persistir_mensagem_entrada succeeds.
```

**Admin client usage** (line 56 of analog):
```typescript
const supabase = createAdminClient()
// Use for all RPC calls in webhook — caller is unauthenticated, no session cookie
```

**Error pattern** (lines 76–79 of analog — never echo exception message):
```typescript
  } catch {
    // Never echo exception.message — may contain env values or lead PII
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
```

---

### `lib/openai/client.ts` (service, request-response)

**Analog:** `lib/aprovacoes/campaign-gate.ts` (RPC-call-with-error pattern) + `app/api/invite/route.ts` (step-by-step pipeline with rollback)

No OpenAI client exists in codebase yet — use RESEARCH.md for the OpenAI SDK call shape.

**RPC call pattern to reuse** (lines 26–29 of `lib/aprovacoes/campaign-gate.ts`):
```typescript
// Pattern for calling Supabase RPC from a service (adminClient, not server cookie client)
const { data: tenantId } = await supabase.rpc('fn_tenant_id_by_evolution_instance', {
  p_instance_name: instanceName,
})
if (!tenantId) throw new Error('tenant_unresolved')
```

**Step pipeline with try/catch rollback pattern** (lines 103–158 of `app/api/invite/route.ts`):
```typescript
// Pattern for chained async steps where each failure must be caught individually
try {
  // Step N: do work
  const { data, error } = await admin.from('table').select(...)
  if (error || !data) throw new Error(`step_N_failed: ${error?.message}`)

  // ... next steps
  return NextResponse.json({ success: true })
} catch (err) {
  // rollback / log
  const message = err instanceof Error ? err.message : 'Erro interno.'
  return NextResponse.json({ error: message }, { status: 500 })
}
```

**Tool-use loop shape** (no analog — implement per ADR §7):
```typescript
// Max 5 iterations; hard fallback on timeout or max-iter reached
// Never throws — returns { texto, handoff_solicitado, motivo } same as guardrails output
export async function openaiToolUseLoop(params: {
  systemPrompt: string
  userMessage: string
  tools: ChatCompletionTool[]
  tenantId: string
  supabase: ReturnType<typeof createAdminClient>
}): Promise<{ texto: string; handoff_solicitado: boolean; motivo?: string; usage: UsageStats }>
```

---

### `lib/agents/cmo/system-prompt.ts` (service, transform)

**Analog:** `lib/queries/academia-config.ts` (DB read + shape into typed output) + `app/dashboard/configuracoes/actions.ts` (fn_tenant_id pattern)

**DB read pattern** (lines 1–36 of `lib/queries/academia-config.ts`):
```typescript
// Import admin client (not server cookie client — called from webhook, no session)
import { createAdminClient } from '@/lib/supabase/admin'

// Read academia_config for a specific tenant_id (not RLS-implicit — webhook context)
const supabase = createAdminClient()
const { data, error } = await supabase
  .from('academia_config')
  .select('nome_academia, bairro, cidade, tom_de_voz, diferenciais, horarios, planos, ' +
          'caderno_editorial_escopo, caderno_editorial_tom, caderno_editorial_restricoes, ' +
          'caderno_editorial_objetivos, caderno_editorial_exemplos')
  .eq('tenant_id', tenantId)  // ALWAYS explicit tenant_id in webhook context (no RLS session)
  .single()

if (error || !data) throw new Error('academia_config_not_found')
```

**Transform-into-string pattern** (modelled after `lib/webhooks/parse-lead.ts` pure-function approach):
```typescript
// Pure function — never throws, returns string
// Assemble 5 blocks as a concatenated template string
export function buildSystemPrompt(params: {
  academiaConfig: AcademiaConfigRow
  chatHistory: ChatMessage[]
}): string {
  // Block 1: Persona CMO (static — cache-eligible)
  // Block 2: DNA academia from academia_config (stable per tenant — cache-eligible)
  // Block 3: Caderno editorial (stable per tenant — cache-eligible)
  // Block 4: Regras inegociáveis (static — cache-eligible)
  // Block 5: Last 20 messages (variable — not cached)
  return [block1, block2, block3, block4, block5].join('\n\n')
}
```

---

### `lib/agents/cmo/tools.ts` (service, request-response)

**Analog:** `lib/aprovacoes/campaign-gate.ts` (SECURITY DEFINER RPC call + typed error + explicit tenant_id) + `app/dashboard/leads/actions.ts` (Zod validate → fn_tenant_id → RPC/update → error return)

**Zod schema pattern** (lines 1–12 of `lib/validators/academia-config.ts`):
```typescript
import { z } from 'zod'

// Define tool input schemas — used both for OpenAI function_call JSON parsing and runtime validation
export const consultarDisponibilidadeSchema = z.object({
  data_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  horario_preferido: z.string().optional(),
})
// ... one z.object() per tool
```

**RPC call with explicit tenant_id** (lines 23–43 of `lib/aprovacoes/campaign-gate.ts`):
```typescript
// ALWAYS pass tenantId explicitly to RPC — webhook has no session, fn_tenant_id() returns null
const { data, error } = await supabase.rpc('rpc_agendar_aula_experimental', {
  p_tenant_id: tenantId,
  p_lead_id: args.lead_id,
  p_data_iso: args.data_iso,
  p_horario: args.horario,
})
if (error) throw new Error(`tool_error: ${error.message}`)
```

**Never-throws contract** (pattern from `lib/webhooks/verify-signature.ts`):
```typescript
// Tool handlers: never throw raw — catch and return structured error
// Caller (tool-use loop) decides whether to handoff or retry
export async function handleTool(
  name: string,
  args: unknown,
  context: ToolContext
): Promise<{ resultado: unknown } | { erro: string }> {
  try {
    // ... dispatch to specific handler
  } catch (err) {
    return { erro: err instanceof Error ? err.message : 'tool_failed' }
  }
}
```

---

### `lib/agents/cmo/guardrails.ts` (utility, transform)

**Analog:** `lib/webhooks/parse-lead.ts` (pure transform, never throws, discriminated union return, sequential checks)

**Pure function / discriminated union pattern** (lines 56–111 of `lib/webhooks/parse-lead.ts`):
```typescript
// Never throws. Returns success or error shape — no exceptions.
export function applyGuardrails(
  texto: string,
  context: GuardrailContext
): { texto: string; handoff_solicitado: boolean; motivo?: string } {
  // Guards execute in order — handoff short-circuits remaining checks
  // Guard 1: Horário (timing check)
  // Guard 2: Desconto (regex → force handoff)
  // Guard 3: Preço (>5% divergence → handoff)
  // Guard 4: Palavras proibidas (blocklist regex)
  // Guard 5: Identidade (tenant identity leak check)
  // Guard 6: Loop tool-use (max iter exceeded)
  // Guard 7: Resposta vazia / muito longa
  return { texto: sanitized, handoff_solicitado: false }
}
```

**Sequential check with early return** (lines 61–108 of `lib/webhooks/parse-lead.ts` — try Meta shape then WhatsApp shape):
```typescript
// Pattern: try check A → if triggered return early; try check B → ...
if (descontoRegex.test(texto)) {
  return { texto: FALLBACK_DESCONTO, handoff_solicitado: true, motivo: 'desconto_detectado' }
}
// ... next guard
```

---

### `app/api/admin/saude-mkt/route.ts` (controller, request-response)

**Analog:** `app/api/invite/route.ts` (auth check → role gate → adminClient → JSON response)

**Auth + role guard pattern** (lines 38–78 of `app/api/invite/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUsuario } from '@/lib/queries/usuario'

export async function GET(request: NextRequest) {
  // Auth check — revalidate session against Supabase auth server
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const usuario = await getCurrentUsuario()
  if (!usuario) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 401 })
  }

  // Role gate: only owner can see diagnostics
  if (usuario.role !== 'owner') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const tenantId = usuario.tenant_id  // from DB, never from request body/query

  // Use admin client for cross-table aggregation (RLS would block some counts)
  const admin = createAdminClient()
  // ... aggregate queries scoped to tenantId
  // NEVER return lead PII — diagnostics only (usage counts, latency p95, handoff rate)
  return NextResponse.json({ /* diagnostic payload */ }, { status: 200 })
}
```

---

### `app/(dashboard)/[tenant_slug]/conversas/page.tsx` (component, CRUD)

**Analog:** `app/dashboard/leads/page.tsx` (Server Component, Promise.all data fetch, role-aware, table sub-component) + `app/dashboard/leads/leads-table.tsx` (client table with status badges)

**Server Component data fetch pattern** (lines 1–61 of `app/dashboard/leads/page.tsx`):
```typescript
import { createClient } from '@/lib/supabase/server'
import { getCurrentUsuario } from '@/lib/queries/usuario'

export const dynamic = 'force-dynamic'

// [tenant_slug] param available via props — validate it matches usuario.tenant_id before use
export default async function ConversasPage() {
  const [conversas, usuario] = await Promise.all([
    getConversas(),       // new query in lib/queries/conversas.ts
    getCurrentUsuario(),
  ])

  const role = usuario?.role ?? 'viewer'

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-[#0F172A]">
          Conversas
        </h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {conversas.length === 0 ? (
          <Card ...><CardContent ...>Nenhuma conversa ainda.</CardContent></Card>
        ) : (
          <ConversasTable conversas={conversas} role={role} />
        )}
      </div>
    </div>
  )
}
```

**Client table with status badges** (lines 1–133 of `app/dashboard/leads/leads-table.tsx`):
```typescript
'use client'
// Pattern: const STATUS_LABELS: Record<string, string> = { ... }
// Pattern: 'use client' only for the table sub-component, page stays Server Component
// Pattern: useTransition for mutation actions (handoff toggle)
// Pattern: Badge from @/components/ui/badge for ia_ativa / status display
// Pattern: overflow-x-auto rounded-lg border border-[#E2E8F0] table container
```

**Read-only constraint for conversas:** No mutations from the UI in MVP — `canWrite` is always false for this page. Handoff toggle uses `rpc_handoff_humano` via Server Action.

---

### `app/(dashboard)/[tenant_slug]/configuracoes/editorial/page.tsx` (component, CRUD)

**Analog:** `app/dashboard/configuracoes/page.tsx` + `config-form.tsx` + `actions.ts` — exact match (same data fetch + Zod form + Server Action pattern)

**Page Server Component pattern** (lines 1–41 of `app/dashboard/configuracoes/page.tsx`):
```typescript
import { getAcademiaConfig } from '@/lib/queries/academia-config'
import { getCurrentUsuario } from '@/lib/queries/usuario'
// Replace with editorial-specific form component
import { EditorialForm } from './editorial-form'

export const dynamic = 'force-dynamic'

export default async function EditorialPage() {
  const [config, usuario] = await Promise.all([
    getAcademiaConfig(),    // reads caderno_editorial_* columns added in migration 0006
    getCurrentUsuario(),
  ])
  const role = usuario?.role ?? 'owner'

  const initialValues = config ? {
    caderno_editorial_escopo: config.caderno_editorial_escopo ?? '',
    caderno_editorial_tom: config.caderno_editorial_tom ?? '',
    caderno_editorial_restricoes: config.caderno_editorial_restricoes ?? '',
    caderno_editorial_objetivos: config.caderno_editorial_objetivos ?? [],
    caderno_editorial_exemplos: config.caderno_editorial_exemplos ?? '',
  } : null

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto max-w-[720px]">
        <h1 className="mb-8 text-xl font-bold uppercase tracking-wider text-foreground">
          Caderno Editorial
        </h1>
        <EditorialForm initialValues={initialValues} role={role} />
      </div>
    </div>
  )
}
```

**Client form pattern** (lines 1–341 of `app/dashboard/configuracoes/config-form.tsx`):
```typescript
'use client'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'

// Pattern: const [serverError, setServerError] = useState<string | null>(null)
// Pattern: const [successMessage, setSuccessMessage] = useState(false)
// Pattern: useForm with zodResolver + mode: 'onBlur'
// Pattern: isViewer check → readOnly={isViewer} on all inputs
// Pattern: TagInput for array fields (diferenciais → caderno_editorial_objetivos)
// Pattern: Textarea for long-text fields (horarios/planos → escopo, tom, restricoes)
// Pattern: async onSubmit → call Server Action → handle { error } | { success: true }
// Pattern: setTimeout(() => setSuccessMessage(false), 3000) after save
```

**Server Action pattern** (lines 1–51 of `app/dashboard/configuracoes/actions.ts`):
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { editorialConfigSchema } from '@/lib/validators/editorial-config'  // new validator
import { revalidatePath } from 'next/cache'

export async function saveEditorialConfig(formData: unknown) {
  const parsed = editorialConfigSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.flatten() }

  const supabase = await createClient()

  const { data: tenantId } = await supabase.rpc('fn_tenant_id')
  if (!tenantId) return { error: 'Não foi possível identificar a academia. Recarregue e tente novamente.' }

  const { error } = await supabase
    .from('academia_config')
    .upsert({ ...parsed.data, tenant_id: tenantId }, { onConflict: 'tenant_id' })

  if (error) return { error: error.message }

  revalidatePath('/[tenant_slug]/configuracoes/editorial')
  return { success: true }
}
```

---

## Shared Patterns

### HMAC Signature Verification
**Source:** `lib/webhooks/verify-signature.ts` (lines 1–34)
**Apply to:** `app/api/webhooks/evolution/route.ts`
```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'))
  } catch {
    return false
  }
}
```
The Evolution webhook uses the same `x-hub-signature-256` header convention. Call `verifyWebhookSignature(raw, request.headers.get('x-hub-signature-256'), secret)` — no changes needed to this utility.

### Service-Role Admin Client
**Source:** `lib/supabase/admin.ts` (lines 1–11)
**Apply to:** `app/api/webhooks/evolution/route.ts`, `app/api/admin/saude-mkt/route.ts`, `lib/openai/client.ts`, `lib/agents/cmo/system-prompt.ts`, `lib/agents/cmo/tools.ts`
```typescript
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```
Webhook routes are called by Evolution API (unauthenticated) — use `createAdminClient()` everywhere in Phase 3 webhook pipeline. Never use `createClient()` (requires session cookie).

### RPC Call with fn_tenant_id
**Source:** `app/dashboard/configuracoes/actions.ts` (lines 19–23) and `lib/aprovacoes/campaign-gate.ts` (lines 26–29)
**Apply to:** All Server Actions for editorial/conversas pages. Dashboard routes use RLS session — call `supabase.rpc('fn_tenant_id')`. Webhook routes use admin client — call `supabase.rpc('fn_tenant_id_by_evolution_instance', { p_instance_name })`.
```typescript
// Dashboard Server Actions (session-aware):
const { data: tenantId } = await supabase.rpc('fn_tenant_id')
if (!tenantId) return { error: 'Não foi possível identificar a academia. Recarregue e tente novamente.' }

// Webhook pipeline (no session — pass instance_name):
const { data: tenantId } = await supabase.rpc('fn_tenant_id_by_evolution_instance', {
  p_instance_name: instanceName,
})
if (!tenantId) return NextResponse.json({ error: 'unknown_instance' }, { status: 200 }) // 200 — idempotency
```

### Zod Validation
**Source:** `lib/validators/academia-config.ts` (lines 1–18), `lib/validators/aprovacao.ts` (lines 1–11)
**Apply to:** `lib/agents/cmo/tools.ts` (tool input schemas), `lib/validators/editorial-config.ts` (new file needed for editorial form)
```typescript
import { z } from 'zod'
export const toolSchema = z.object({ ... })
export type ToolInput = z.infer<typeof toolSchema>
// Use .safeParse() — never .parse() — in service code that must not throw
```

### Server Component Page Structure
**Source:** `app/dashboard/leads/page.tsx` (lines 1–61), `app/dashboard/configuracoes/page.tsx` (lines 1–41)
**Apply to:** `app/(dashboard)/[tenant_slug]/conversas/page.tsx`, `app/(dashboard)/[tenant_slug]/configuracoes/editorial/page.tsx`
```typescript
export const dynamic = 'force-dynamic'  // required on all pages reading live DB data

// Top bar pattern:
<header className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
  <h1 className="text-xl font-bold uppercase tracking-wider text-[#0F172A]">
    {/* page title */}
  </h1>
</header>

// Empty state pattern:
<Card className="border-[#E2E8F0] bg-[#F8FAFC]">
  <CardContent className="p-6 text-center text-[#64748B]">
    {/* empty message */}
  </CardContent>
</Card>
```

### tenant_id Defense-in-Depth (double filter)
**Source:** `app/dashboard/leads/actions.ts` (line 55), `lib/aprovacoes/campaign-gate.ts` (line 37)
**Apply to:** All DB writes in Phase 3
```typescript
// Always filter by tenant_id explicitly even though RLS also enforces it
.eq('tenant_id', tenantId)  // defense-in-depth on top of RLS
// Comment must be present — makes the audit reason explicit
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/openai/client.ts` (core tool-use loop) | service | request-response | No LLM client exists in codebase. Use OpenAI SDK `openai.chat.completions.create({ tools })` per ADR §8. Loop pattern must be implemented net-new. |

The OpenAI SDK tool-use loop (max 5 iterations, message accumulation, tool call dispatch) has no codebase analog. The planner should reference ADR-MKT-001 §7 and §8 for the exact loop contract.

---

## Metadata

**Analog search scope:** `app/`, `lib/`, `supabase/migrations/`
**Files scanned:** 22 files read, all route.ts files enumerated
**Pattern extraction date:** 2026-05-20
