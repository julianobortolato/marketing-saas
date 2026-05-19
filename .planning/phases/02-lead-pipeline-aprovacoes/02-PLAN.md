---
phase: 02-lead-pipeline-aprovacoes
plan: "02"
type: execute
wave: 1
depends_on: ["01"]
files_modified:
  - app/api/webhooks/leads/route.ts
  - lib/webhooks/verify-signature.ts
  - lib/webhooks/parse-lead.ts
  - .env.local.example
autonomous: false
requirements: [LEAD-01]

must_haves:
  truths:
    - "A POST to /api/webhooks/leads with a valid signature and a Meta Lead Form payload creates one public.leads row with origem='meta_form', status='novo', and the phone/name from the payload"
    - "A POST with a valid signature and a raw WhatsApp message payload creates one public.leads row with origem='whatsapp', status='novo', telefone + remotejid set from the payload"
    - "A POST with a missing or wrong signature is rejected with HTTP 401 and creates NO lead row"
    - "tenant_id on the created lead is derived from the webhook token/config — never read from the request body"
    - "The endpoint uses the service-role admin client (server-only) to insert, because the caller is unauthenticated (external webhook)"
  artifacts:
    - path: "app/api/webhooks/leads/route.ts"
      provides: "POST webhook handler: verify signature → resolve tenant → parse → insert lead"
      contains: "createAdminClient"
    - path: "lib/webhooks/verify-signature.ts"
      provides: "HMAC-SHA256 signature verification (timing-safe)"
      contains: "timingSafeEqual"
    - path: "lib/webhooks/parse-lead.ts"
      provides: "Normalizes Meta Lead Form + raw WhatsApp payloads into a lead insert shape"
      contains: "origem"
  key_links:
    - from: "app/api/webhooks/leads/route.ts"
      to: "lib/webhooks/verify-signature.ts"
      via: "signature check BEFORE parsing/processing the payload"
      pattern: "verifyWebhookSignature"
    - from: "app/api/webhooks/leads/route.ts"
      to: "createAdminClient"
      via: "service-role insert into public.leads (external caller is unauthenticated)"
      pattern: "createAdminClient"
    - from: "app/api/webhooks/leads/route.ts"
      to: "public.leads"
      via: "insert with tenant_id resolved from the webhook token, not the body"
      pattern: "from\\('leads'\\)"
---

<objective>
Deliver the lead-ingestion vertical slice: a `POST /api/webhooks/leads` endpoint that verifies an HMAC-SHA256 signature BEFORE touching the payload, resolves the tenant from the webhook token (never the body), normalizes both Meta Lead Form and raw WhatsApp payloads, and inserts a `public.leads` row (`status='novo'`) via the server-only admin client. This is the end-to-end slice that satisfies LEAD-01 and Phase 2 Success Criterion 1.

Purpose: This is the system's front door for leads. CLAUDE.md is non-negotiable: webhooks validate the signature before processing, and tenant_id is never trusted from external input. Without signature validation, anyone could inject fake leads or cross-tenant data.

Output: A working, signature-protected webhook that creates correctly-tenanted lead rows visible to the Plan 03 panel.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@ARCHITECTURE.md

<interfaces>
<!-- From Phase 1 + Plan 01. Use directly. -->

lib/supabase/admin.ts:
  function createAdminClient(): SupabaseClient
  // first line is `import 'server-only'` — service role key. API routes ONLY.
  // service_role BYPASSES RLS, so this client can insert a lead for any tenant —
  // which is exactly why tenant_id MUST be derived from the webhook token, not the body.

Database (Plan 01 migration 20260520000001):
  public.leads(id uuid pk, tenant_id uuid NOT NULL, nome text, telefone text,
    origem text CHECK in (meta_form|whatsapp|google|manual), status text CHECK in
    (novo|contatado|agendado|convertido|perdido) default 'novo', remotejid text,
    score smallint, criado_em timestamptz default now())
  GRANT ALL ON public.leads TO service_role (Plan 01 migration 20260520000004)

Existing route handler patterns to mirror:
  app/auth/callback/route.ts — NextRequest/NextResponse, NextResponse.redirect/json
  app/api/invite/route.ts — POST handler, inline zod validation, JSON error responses,
    createAdminClient() used server-only, never leak the service key in a response/log

Node runtime crypto is available in Next 14 route handlers (Node.js runtime, not Edge).
Use `node:crypto` createHmac + timingSafeEqual. Read the RAW request body
(`await request.text()`) for HMAC — parsing to JSON first would change the bytes
and break signature verification.

Tenant resolution (Phase 2 approach — no per-tenant OAuth until v2 per ROADMAP):
  Each tenant configures a static webhook token. Map token → tenant_id via an env
  var `WEBHOOK_TENANT_MAP` (JSON: { "<token>": "<tenant_uuid>" }). For the first
  client (Fitness UNIC) this is a single entry. The signing secret is
  `LEADS_WEBHOOK_SECRET`. Both are server-only env vars (no NEXT_PUBLIC_ prefix —
  CLAUDE.md § Segurança). Document them in .env.local.example.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: HMAC signature verification + payload normalizer</name>
  <files>lib/webhooks/verify-signature.ts, lib/webhooks/parse-lead.ts</files>
  <read_first>
    - app/api/invite/route.ts (inline zod validation + JSON error response style to mirror)
    - CLAUDE.md (§ Segurança — webhooks externos: validar assinatura ANTES de processar payload; secrets nunca no código)
    - ARCHITECTURE.md (§ Regras de segurança — webhooks Meta/Google/Evolution validar assinatura antes de processar)
    - supabase/migrations/20260520000001_create_leads.sql (Plan 01 — exact leads columns + origem/status CHECK values the normalizer must produce)
  </read_first>
  <behavior>
    - `verifyWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean` returns true ONLY when HMAC-SHA256(rawBody, secret) equals the provided signature, compared with `timingSafeEqual`; returns false for null/empty/wrong-length signature (no throw, no early-length leak)
    - `parseLeadPayload(rawBody: string)` detects a Meta Lead Form payload (has `field_data`/`leadgen_id` shape) → `{ origem:'meta_form', nome, telefone, remotejid:null }`
    - `parseLeadPayload` detects a raw WhatsApp message payload (has a phone/wa_id/`from` field) → `{ origem:'whatsapp', nome, telefone, remotejid:<wa_id> }`
    - Unknown/unparseable payload → returns `{ error: 'unrecognized_payload' }` (caller maps to HTTP 422), never throws
    - Output telefone is digit-normalized (strip spaces/+/() ); name falls back to null when absent
  </behavior>
  <action>
Create `lib/webhooks/verify-signature.ts` exporting `verifyWebhookSignature(rawBody, signatureHeader, secret)`. Use `import { createHmac, timingSafeEqual } from 'node:crypto'`. Compute `const expected = createHmac('sha256', secret).update(rawBody).digest('hex')`. The Meta convention sends `X-Hub-Signature-256: sha256=<hex>`; strip an optional `sha256=` prefix from `signatureHeader` before comparing. Return false if `signatureHeader` is null/empty. Compare with `timingSafeEqual(Buffer.from(expected,'hex'), Buffer.from(provided,'hex'))` inside a try/catch (Buffer length mismatch throws — catch and return false; do NOT branch on length before the compare, which would leak length via timing).

Create `lib/webhooks/parse-lead.ts` exporting `parseLeadPayload(rawBody: string): { origem:'meta_form'|'whatsapp'; nome: string | null; telefone: string | null; remotejid: string | null } | { error: string }`. `JSON.parse` inside try/catch (malformed JSON → `{ error:'invalid_json' }`). Branch: Meta Lead Form (presence of `field_data` array or `leadgen_id`) extract full_name/phone_number from field_data entries; raw WhatsApp (presence of `wa_id` or `messages[0].from` or top-level `from`) extract the sender phone as both `telefone` and `remotejid`, and `profile.name`/`pushName` as nome. Else `{ error:'unrecognized_payload' }`. Normalize telefone by `replace(/[^\d]/g,'')`. Use a small zod schema per branch to keep parsing strict; never throw out of this function.
  </action>
  <verify>
    <automated>grep -q "timingSafeEqual" lib/webhooks/verify-signature.ts && grep -q "createHmac" lib/webhooks/verify-signature.ts && grep -q "unrecognized_payload" lib/webhooks/parse-lead.ts && grep -Eq "meta_form" lib/webhooks/parse-lead.ts && grep -Eq "whatsapp" lib/webhooks/parse-lead.ts && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `verifyWebhookSignature` uses `node:crypto` createHmac sha256 + `timingSafeEqual`, returns false (never throws) for null/short/wrong signature, strips a `sha256=` prefix
    - `parseLeadPayload` returns `origem:'meta_form'` for a Meta Lead Form shape, `origem:'whatsapp'` (with remotejid set) for a WhatsApp shape, `{ error }` for invalid/unknown JSON, and never throws
    - telefone is digit-only normalized; missing nome → null
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Signature verification and dual-format payload normalization are pure, tested, throw-free helpers.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: POST /api/webhooks/leads route — verify → resolve tenant → insert</name>
  <files>app/api/webhooks/leads/route.ts, .env.local.example</files>
  <read_first>
    - app/api/invite/route.ts (POST Route Handler structure, createAdminClient usage, JSON error responses, never leak service key)
    - app/auth/callback/route.ts (NextRequest/NextResponse import + usage)
    - lib/supabase/admin.ts (createAdminClient signature — service role, server-only, bypasses RLS)
    - lib/webhooks/verify-signature.ts, lib/webhooks/parse-lead.ts (Task 1 — function signatures)
    - .env.local.example (current Phase 1 placeholder format to extend, never commit real secrets — CLAUDE.md § Segurança)
  </read_first>
  <behavior>
    - Reads the RAW body via `request.text()` BEFORE any JSON parse; calls `verifyWebhookSignature(raw, request.headers.get('x-hub-signature-256'), process.env.LEADS_WEBHOOK_SECRET)` first
    - Signature missing/invalid → respond `401 { error:'invalid_signature' }`, NO DB write, no body parsing beyond what verification needs
    - Tenant token: read from header `x-webhook-token` (or `?token=` query); look it up in `JSON.parse(process.env.WEBHOOK_TENANT_MAP)` → tenant_id. Unknown/missing token → `401 { error:'unknown_tenant' }`, NO DB write. tenant_id NEVER comes from the request body
    - Valid signature + known tenant + parseable payload → insert `{ tenant_id, nome, telefone, remotejid, origem, status:'novo' }` into public.leads via `createAdminClient()`; respond `201 { id }`
    - Parse error → `422 { error:'unrecognized_payload' }`, NO DB write
    - Any service key value never appears in a response body or console log
  </behavior>
  <action>
Create `app/api/webhooks/leads/route.ts` exporting `async function POST(request: NextRequest)`. Add `export const runtime = 'nodejs'` (node:crypto requires the Node runtime, not Edge). Steps in order:
1. `const raw = await request.text()`.
2. `const secret = process.env.LEADS_WEBHOOK_SECRET`; if missing, log a server-side error (no secret value) and return `500 { error:'webhook_misconfigured' }`.
3. `if (!verifyWebhookSignature(raw, request.headers.get('x-hub-signature-256'), secret)) return NextResponse.json({ error:'invalid_signature' }, { status:401 })`. (Signature check is the FIRST gate after reading the body — CLAUDE.md inegociável.)
4. Resolve tenant: `const token = request.headers.get('x-webhook-token') ?? request.nextUrl.searchParams.get('token')`. `const map = JSON.parse(process.env.WEBHOOK_TENANT_MAP ?? '{}')`. `const tenantId = token ? map[token] : undefined`. If `!tenantId` return `401 { error:'unknown_tenant' }`. (tenant_id is derived here from the token, NEVER from the parsed body — security_requirements: tenant spoofing mitigation.)
5. `const parsed = parseLeadPayload(raw)`; if `'error' in parsed` return `422 { error: parsed.error }`.
6. `const supabase = createAdminClient()`; `const { data, error } = await supabase.from('leads').insert({ tenant_id: tenantId, nome: parsed.nome, telefone: parsed.telefone, remotejid: parsed.remotejid, origem: parsed.origem, status: 'novo' }).select('id').single()`.
7. On `error` → `console.error('[webhook/leads] insert failed', error.message)` (message only, never the service key) and return `500 { error:'insert_failed' }`. On success → `NextResponse.json({ id: data.id }, { status:201 })`.
Wrap the body in try/catch; on unexpected throw return `500 { error:'internal' }` (do not echo the exception if it could contain env values).

Update `.env.local.example`: append (no real values) `LEADS_WEBHOOK_SECRET=` (HMAC signing secret shared with the webhook source) and `WEBHOOK_TENANT_MAP=` (JSON map token→tenant_uuid, e.g. `{"<COLE_AQUI_TOKEN>":"<COLE_AQUI_TENANT_UUID>"}` — instruction: token is chosen by you and configured on the Meta/WhatsApp side; tenant_uuid is the Fitness UNIC tenants.id from the Supabase dashboard). Both are server-only — no NEXT_PUBLIC_ prefix (CLAUDE.md anti-pattern).
  </action>
  <verify>
    <automated>grep -q "request.text()" app/api/webhooks/leads/route.ts && grep -q "verifyWebhookSignature" app/api/webhooks/leads/route.ts && grep -q "createAdminClient" app/api/webhooks/leads/route.ts && grep -q "runtime = 'nodejs'" app/api/webhooks/leads/route.ts && grep -q "401" app/api/webhooks/leads/route.ts && ! grep -q "SUPABASE_SERVICE_ROLE_KEY" app/api/webhooks/leads/route.ts && grep -q "LEADS_WEBHOOK_SECRET" .env.local.example && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - Handler reads `request.text()` then calls `verifyWebhookSignature` as the FIRST gate; invalid/missing signature → 401 with no DB insert
    - tenant_id resolved from `WEBHOOK_TENANT_MAP` via the token header/query, never from the request body; unknown token → 401
    - Successful valid request inserts one leads row via `createAdminClient()` with `status:'novo'` and returns 201 `{ id }`
    - Parse failure → 422, signature failure → 401, missing secret → 500, none of which write a row
    - `runtime = 'nodejs'` exported; no `SUPABASE_SERVICE_ROLE_KEY` literal in the route; `.env.local.example` documents `LEADS_WEBHOOK_SECRET` + `WEBHOOK_TENANT_MAP` with no real values
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>POST /api/webhooks/leads verifies the signature first, derives the tenant from the token, and creates a status='novo' lead via the server-only admin client.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify webhook creates a tenanted lead and rejects unsigned requests (LEAD-01)</name>
  <what-built>Tasks 1-2 built the signature verifier, payload normalizer, and the POST endpoint. This proves the LEAD-01 round-trip against the live Plan 01 schema: signed POST → lead row; unsigned POST → 401 + no row.</what-built>
  <how-to-verify>
1. Ensure `.env.local` has `LEADS_WEBHOOK_SECRET` set to a chosen secret and `WEBHOOK_TENANT_MAP` mapping a test token to the Fitness UNIC tenants.id (get the UUID from Supabase: `SELECT id, slug FROM public.tenants;`).
2. `npm run dev`.
3. Compute a valid signature for a Meta-shaped JSON body and POST it:
   `BODY='{"leadgen_id":"1","field_data":[{"name":"full_name","values":["Maria Teste"]},{"name":"phone_number","values":["+55 11 98888-7777"]}]}'`
   `SIG="sha256=$(printf '%s' \"$BODY\" | openssl dgst -sha256 -hmac \"$LEADS_WEBHOOK_SECRET\" | sed 's/^.* //')"`
   `curl -i -X POST localhost:3000/api/webhooks/leads -H "x-webhook-token: <test_token>" -H "x-hub-signature-256: $SIG" -H 'content-type: application/json' -d "$BODY"`
   Expect `HTTP 201` + `{ "id": "<uuid>" }`.
4. In Supabase SQL Editor: `SELECT tenant_id, nome, telefone, origem, status FROM public.leads ORDER BY criado_em DESC LIMIT 1;` → one row, origem='meta_form', status='novo', telefone='5511988887777' (digit-normalized), tenant_id = the Fitness UNIC tenant.
5. Negative — wrong signature: re-run the curl with `-H "x-hub-signature-256: sha256=deadbeef"`. Expect `HTTP 401` `{ "error":"invalid_signature" }` and `SELECT count(*) FROM public.leads;` is unchanged (no new row).
6. Negative — unknown tenant: valid signature but `-H "x-webhook-token: bogus"`. Expect `HTTP 401` `{ "error":"unknown_tenant" }`, no new row.
7. WhatsApp shape: POST `{"wa_id":"5511977776666","pushName":"Joao WA","from":"5511977776666"}` with a valid signature + token → 201; confirm a row with origem='whatsapp', remotejid='5511977776666'.
8. Confirm no secret/service-key value appears in the dev server logs for any of the above.
  </how-to-verify>
  <files>(no source changes — runtime verification of Tasks 1-2 output against the live Plan 01 schema)</files>
  <action>Run the dev server and execute the signed/unsigned curl scenarios to confirm a valid signed webhook creates a correctly-tenanted status='novo' lead and that unsigned/unknown-tenant requests are rejected with 401 and no DB write. Verification only; no source modification.</action>
  <verify>
    <automated>MISSING — exercising the live endpoint + inspecting public.leads requires a running app and the pushed Plan 01 schema; verified by the human curl/SQL steps above</automated>
  </verify>
  <done>Signed Meta + WhatsApp POSTs created correctly-tenanted status='novo' leads; wrong-signature and unknown-token POSTs returned 401 with zero new rows; no secret leaked to logs.</done>
  <resume-signal>Type "approved" once a signed POST created a correctly-tenanted novo lead AND an unsigned/unknown-token POST returned 401 with no row; otherwise describe the failure (status code + response + leads count).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| External webhook source → /api/webhooks/leads | Fully untrusted; signature is the only proof of authenticity |
| Webhook route → public.leads (service role) | Privileged (RLS-bypassing) — tenant_id MUST come from the token, not the payload |
| Env (secret/token map) → route | Server-only secrets; never NEXT_PUBLIC_, never logged |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-05 | Spoofing | Unsigned/forged POST injecting fake leads | mitigate | `verifyWebhookSignature` HMAC-SHA256 is the FIRST gate after reading the raw body; invalid → 401, no DB write (security_requirements: webhook spoofing) |
| T-02-06 | Tampering | Tenant spoofing via body-supplied tenant_id | mitigate | tenant_id resolved from `WEBHOOK_TENANT_MAP` keyed by the webhook token; request body tenant_id is never read (security_requirements: tenant spoofing) |
| T-02-07 | Information Disclosure | Service-role key leaked in response/log | mitigate | createAdminClient kept in route only; only `error.message` logged; grep gate asserts no key literal; mirror app/api/invite pattern |
| T-02-08 | Tampering | Signature timing/length side-channel | mitigate | `timingSafeEqual` with try/catch on length mismatch; no pre-compare length branch |
| T-02-09 | Denial of Service | Malformed JSON crashing the route | mitigate | parseLeadPayload never throws (try/catch JSON.parse) → 422; route wrapped in try/catch → 500 generic |
| T-02-SC | Tampering | npm installs | accept | No new packages — node:crypto built-in, zod + supabase-js already in package.json (Phase 1) |
</threat_model>

<verification>
- `npm run build` green
- Signature verified BEFORE payload processed; invalid → 401, no insert
- tenant_id from token map, never from body; unknown token → 401
- Service-role admin client used (external caller unauthenticated); no key in response/log
- runtime='nodejs' set; .env.local.example documents the two new server-only vars (no real values)
- [BLOCKING] checkpoint: signed Meta + WhatsApp POSTs create tenanted novo leads; unsigned/unknown-tenant → 401 with no row
</verification>

<success_criteria>
- LEAD-01: a POST to the webhook creates a leads row with origem, telefone, status='novo' — visible to the Plan 03 panel (Phase 2 Success Criterion 1)
- Webhook validates the signature before processing the payload; tenant_id never trusted from external input (CLAUDE.md inegociável)
</success_criteria>

<output>
Create `.planning/phases/02-lead-pipeline-aprovacoes/02-SUMMARY.md` when done.
</output>
