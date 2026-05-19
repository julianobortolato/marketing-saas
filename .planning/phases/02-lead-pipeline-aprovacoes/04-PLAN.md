---
phase: 02-lead-pipeline-aprovacoes
plan: "04"
type: execute
wave: 1
depends_on: ["01"]
files_modified:
  - app/dashboard/aprovacoes/page.tsx
  - app/dashboard/aprovacoes/batch-approval.tsx
  - app/dashboard/aprovacoes/actions.ts
  - lib/validators/aprovacao.ts
  - lib/queries/aprovacoes.ts
  - lib/aprovacoes/campaign-gate.ts
  - components/app-shell.tsx
autonomous: false
requirements: [APROV-01, APROV-02]

must_haves:
  truths:
    - "Owner opens /dashboard/aprovacoes and sees the current weekly batch of pending organic-content approvals, capped at 10 items"
    - "Owner can approve the whole batch in one action and reject the whole batch in one action; the queue empties accordingly and the change persists after reload"
    - "assertCampaignApproved(campaignId) returns/throws such that a paid campaign with no aprovacoes row of tipo='campanha', status='aprovado' for that campaign CANNOT be published"
    - "A campaign WITH an aprovacoes row tipo='campanha' status='aprovado' for its id passes the gate"
    - "Batch approve/reject Server Actions resolve tenant_id from fn_tenant_id() server-side; tenant_id is never accepted from the client"
    - "A viewer sees the queue read-only: no Approve-all / Reject-all buttons rendered (not just disabled)"
  artifacts:
    - path: "app/dashboard/aprovacoes/page.tsx"
      provides: "Server Component: reads weekly organic batch + role, renders queue"
      contains: "export default async function"
    - path: "app/dashboard/aprovacoes/actions.ts"
      provides: "approveBatch + rejectBatch Server Actions, tenant from fn_tenant_id()"
      contains: "'use server'"
    - path: "lib/queries/aprovacoes.ts"
      provides: "Typed read of the pending weekly organic batch (≤10, RLS-scoped)"
      contains: "from('aprovacoes')"
    - path: "lib/aprovacoes/campaign-gate.ts"
      provides: "assertCampaignApproved guard enforcing APROV-02 (no paid campaign without an aprovado record)"
      contains: "assertCampaignApproved"
    - path: "lib/validators/aprovacao.ts"
      provides: "Zod schema for the batch decision payload"
      contains: "batchDecisionSchema"
    - path: "components/app-shell.tsx"
      provides: "Sidebar with an Aprovacoes active link"
      contains: "/dashboard/aprovacoes"
  key_links:
    - from: "app/dashboard/aprovacoes/page.tsx"
      to: "lib/queries/aprovacoes.ts"
      via: "Server Component reads the weekly organic batch"
      pattern: "getWeeklyOrganicBatch"
    - from: "app/dashboard/aprovacoes/actions.ts"
      to: "supabase.rpc('fn_tenant_id')"
      via: "server-side tenant resolution before batch update"
      pattern: "fn_tenant_id"
    - from: "lib/aprovacoes/campaign-gate.ts"
      to: "public.aprovacoes"
      via: "checks an aprovado tipo=campanha row exists for the campaign before publish"
      pattern: "tipo.*campanha|campanha.*aprovado"
    - from: "app/dashboard/aprovacoes/batch-approval.tsx"
      to: "app/dashboard/aprovacoes/actions.ts"
      via: "approveBatch / rejectBatch server action calls"
      pattern: "approveBatch"
---

<objective>
Deliver the aprovacoes vertical slice: `/dashboard/aprovacoes` showing the current weekly batch of pending organic-content approvals (capped at 10), one-action batch approve and batch reject, and an `assertCampaignApproved()` gate that makes it impossible to publish a paid campaign without an explicit per-campaign `aprovacoes` (tipo='campanha', status='aprovado') record. Tenant_id is always resolved server-side; a viewer sees the queue read-only. This completes APROV-01 + APROV-02 and Phase 2 Success Criteria 4 & 5, and activates an Aprovacoes sidebar nav item.

Purpose: CLAUDE.md is non-negotiable: organic posts ship as a weekly batch of 10 without individual approval, while anything that increases spend (paid campaigns) requires an explicit per-campaign approve. APROV-02 must be a real enforced gate now (consumed by Phase 5), not a future placeholder.

Output: A working batch-approval queue plus a reusable, enforced campaign-approval guard.
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
<!-- From Phase 1 + Plan 01. Use directly — do not re-explore. -->

lib/supabase/server.ts:  async createClient(): Promise<SupabaseClient>   // Server Components / Server Actions
lib/queries/usuario.ts:  getCurrentUsuario(): Promise<Usuario | null>
  export type UsuarioRole = 'owner' | 'manager' | 'viewer'

Database (Plan 01 migration 20260520000002 + RLS 20260520000003):
  public.aprovacoes(id uuid pk, tenant_id uuid NOT NULL, tipo text CHECK
    (conteudo|campanha), referencia_id uuid, status text CHECK
    (pendente|aprovado|rejeitado) default 'pendente', criado_em timestamptz default now())
  RLS: SELECT for any role of same tenant; INSERT/UPDATE PERMISSIVE require
    fn_usuario_role() IN ('owner','manager') (viewer DB write-block); RESTRICTIVE
    enforces tenant isolation.
  RPC: supabase.rpc('fn_tenant_id') -> uuid (current tenant, from usuarios — NOT JWT)
  Domain rule (CLAUDE.md canonical): tipo='conteudo' = weekly organic batch, no
  individual approval (APROV-01, up to 10/week). tipo='campanha' = per-campaign paid
  approval, mandatory (APROV-02 — no paid campaign publishes without an aprovado row).
  referencia_id has NO FK (conteudos/campanhas tables arrive Phases 4/5).

Proven Phase 1 patterns to REPLICATE:
  - Server Action: app/dashboard/configuracoes/actions.ts (see Plan 03 interfaces — same shape)
  - Shared zod validator: lib/validators/academia-config.ts
  - RLS-scoped typed query: lib/queries/academia-config.ts (no client tenant_id)
  - Role-gated UI: control NOT rendered (absent from DOM) when role==='viewer'
  - Routing: app/dashboard/* (NOT a route group); middleware protects /dashboard/*.

components/app-shell.tsx currently has NavItems Visao Geral, Configuracoes, Leads
  (Plan 03 makes Leads active), Conteudo/Campanhas/Inteligencia disabled. Aprovacoes
  is NOT yet in the sidebar — this plan ADDS a new active NavItem
  `<NavItem href="/dashboard/aprovacoes" label="Aprovacoes" />` after the Leads item.
  NOTE: Plan 03 also edits components/app-shell.tsx (Leads item). Plan 03 is wave 1
  and this plan is wave 1 — but they share this file. To avoid a write conflict this
  plan depends_on Plan 01 only; the wave assigner bumps THIS plan to run after Plan 03
  (shared file = implicit dependency). Apply the edit additively against whatever the
  current file state is (add the Aprovacoes NavItem; do not revert Plan 03's Leads change).

shadcn available (components/ui/, @base-ui/react / base-nova): button, card, badge,
  separator, etc. Do NOT add a new shadcn/npm component. Brand: #E30613 only on the
  primary CTA (Approve all); Reject is a neutral/outline button (CLAUDE.md 60-30-10).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Aprovacao schema + weekly-batch query + assertCampaignApproved gate (APROV-02)</name>
  <files>lib/validators/aprovacao.ts, lib/queries/aprovacoes.ts, lib/aprovacoes/campaign-gate.ts</files>
  <read_first>
    - lib/validators/academia-config.ts (export style: schema + Input type)
    - lib/queries/academia-config.ts + lib/queries/leads.ts (Plan 03) (RLS-scoped query pattern: createClient(), no client tenant_id, typed return, never throw)
    - supabase/migrations/20260520000002_create_aprovacoes.sql (Plan 01 — exact columns + tipo/status CHECK values)
    - CLAUDE.md (§ Multi-tenant; § Anti-padrões — aprovação obrigatória só para o que aumenta gasto; posts orgânicos lote semanal de 10 sem aprovação individual)
  </read_first>
  <behavior>
    - `batchDecisionSchema` validates `ids: string().uuid() array (min 1, max 10)` + `decision: enum('aprovado','rejeitado')`
    - `getWeeklyOrganicBatch()` returns the current tenant's pending tipo='conteudo' aprovacoes created within the last 7 days, ordered criado_em asc, **LIMIT 10** (the weekly batch cap, APROV-01); RLS-scoped, no tenant_id arg; returns `Aprovacao[]`
    - `assertCampaignApproved(campaignId: string)` resolves true ONLY when an aprovacoes row exists with tipo='campanha', referencia_id=campaignId, status='aprovado' for the current tenant; otherwise it throws `CampaignNotApprovedError` (APROV-02 — a paid campaign with no aprovado record can never proceed to publish)
    - `assertCampaignApproved` relies on RLS for tenant scoping AND additionally filters tenant via fn_tenant_id() inside the query (defense in depth); never silently returns true on a query error (fails closed → throws)
  </behavior>
  <action>
Create `lib/validators/aprovacao.ts` exporting `batchDecisionSchema` (zod: `ids: z.array(z.string().uuid()).min(1).max(10)` with message 'Selecione de 1 a 10 itens.', `decision: z.enum(['aprovado','rejeitado'])`) and inferred `BatchDecisionInput`.

Create `lib/queries/aprovacoes.ts` exporting `export interface Aprovacao { id:string; tipo:string; referencia_id:string|null; status:string; criado_em:string }` and `async function getWeeklyOrganicBatch(): Promise<Aprovacao[]>`. `const supabase = await createClient()`; `supabase.from('aprovacoes').select('id,tipo,referencia_id,status,criado_em').eq('tipo','conteudo').eq('status','pendente').gte('criado_em', new Date(Date.now()-7*24*60*60*1000).toISOString()).order('criado_em',{ascending:true}).limit(10)`. RLS scopes to tenant — do NOT pass tenant_id. Return `(data ?? []) as Aprovacao[]`; on error log message + return `[]`.

Create `lib/aprovacoes/campaign-gate.ts` exporting `export class CampaignNotApprovedError extends Error {}` and `async function assertCampaignApproved(campaignId: string): Promise<void>`. Use `createClient()`. `const { data: tenantId } = await supabase.rpc('fn_tenant_id')`; if `!tenantId` throw `CampaignNotApprovedError('tenant_unresolved')` (fail closed). `const { data, error } = await supabase.from('aprovacoes').select('id').eq('tipo','campanha').eq('referencia_id', campaignId).eq('status','aprovado').eq('tenant_id', tenantId).limit(1).maybeSingle()`. If `error` throw `CampaignNotApprovedError(error.message)` (fail closed — never proceed on a query failure). If `!data` throw `CampaignNotApprovedError('Campanha sem aprovação registrada — publicação bloqueada (APROV-02).')`. Return void on success. Add a JSDoc note: "APROV-02 enforcement point. Phase 5 (Campanhas) MUST call assertCampaignApproved(campaignId) before any paid-campaign publish/activation. This is a real enforced gate, not a placeholder."
  </action>
  <verify>
    <automated>grep -q "batchDecisionSchema" lib/validators/aprovacao.ts && grep -q "max(10)" lib/validators/aprovacao.ts && grep -q "getWeeklyOrganicBatch" lib/queries/aprovacoes.ts && grep -q ".limit(10)" lib/queries/aprovacoes.ts && grep -q "eq('tipo','conteudo')" lib/queries/aprovacoes.ts && grep -q "assertCampaignApproved" lib/aprovacoes/campaign-gate.ts && grep -q "CampaignNotApprovedError" lib/aprovacoes/campaign-gate.ts && grep -q "eq('status','aprovado')" lib/aprovacoes/campaign-gate.ts && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `batchDecisionSchema` caps `ids` at max 10 and restricts `decision` to aprovado|rejeitado
    - `getWeeklyOrganicBatch()` filters tipo='conteudo' + status='pendente' + last 7 days, `.limit(10)`, RLS-scoped (no tenant_id arg), never throws
    - `assertCampaignApproved(id)` throws `CampaignNotApprovedError` when no tipo='campanha'/status='aprovado'/referencia_id=id row exists, on tenant-unresolved, OR on query error (fails closed); returns void only when such a row exists
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Batch schema, the ≤10 weekly organic query, and the enforced APROV-02 campaign gate are ready.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Batch approve/reject Server Actions + add Aprovacoes nav</name>
  <files>app/dashboard/aprovacoes/actions.ts, components/app-shell.tsx</files>
  <read_first>
    - app/dashboard/configuracoes/actions.ts (EXACT Server Action pattern: 'use server', safeParse, createClient, supabase.rpc('fn_tenant_id'), null-tenant error string, revalidatePath)
    - lib/validators/aprovacao.ts, lib/queries/aprovacoes.ts (Task 1 contracts)
    - components/app-shell.tsx (current sidebar — add the Aprovacoes NavItem after Leads; do NOT revert Plan 03's Leads change since this plan runs after Plan 03 on the shared file)
    - CLAUDE.md (§ Anti-padrões — update sem tenant_id proibido; tenant_id nunca do cliente; aprovação só para gasto)
  </read_first>
  <behavior>
    - `approveBatch(input)` / `rejectBatch(input)` safeParse with `batchDecisionSchema`; resolve tenant via `supabase.rpc('fn_tenant_id')`; null tenant → `{ error:'Não foi possível identificar a academia. Recarregue e tente novamente.' }`
    - The action updates `aprovacoes` SET status=decision WHERE id = ANY(ids) AND tipo='conteudo' AND tenant_id = <rpc tenant> (only organic-content rows, only in-tenant, max 10 enforced by the schema). It must NOT be able to flip a tipo='campanha' row (APROV-02 stays a deliberate per-campaign action, never part of a bulk organic decision)
    - A viewer's call is rejected by the Plan 01 PERMISSIVE write policy (owner/manager) → returned as `{ error }`, never silent success
    - On success revalidate `/dashboard/aprovacoes` and return `{ success:true, count }`
    - A new active Aprovacoes NavItem appears in the sidebar
  </behavior>
  <action>
Create `app/dashboard/aprovacoes/actions.ts` (`'use server'`). Implement a private `applyBatch(input: unknown, decision: 'aprovado'|'rejeitado')`: `batchDecisionSchema.safeParse({ ...input as object, decision })`; on failure return `{ error: parsed.error.flatten() }`. `const supabase = await createClient()`; `const { data: tenantId } = await supabase.rpc('fn_tenant_id'); if (!tenantId) return { error:'Não foi possível identificar a academia. Recarregue e tente novamente.' }`. `const { data, error } = await supabase.from('aprovacoes').update({ status: decision }).in('id', parsed.data.ids).eq('tipo','conteudo').eq('tenant_id', tenantId).select('id')`. `if (error) return { error: error.message }` (viewer RLS rejection surfaces here). `revalidatePath('/dashboard/aprovacoes'); return { success:true, count: data?.length ?? 0 }`. Export `approveBatch(input)` = `applyBatch(input,'aprovado')` and `rejectBatch(input)` = `applyBatch(input,'rejeitado')`. The `.eq('tipo','conteudo')` guard guarantees a bulk action can NEVER approve a paid campaign (APROV-02 isolation).

Edit `components/app-shell.tsx`: add `<NavItem href="/dashboard/aprovacoes" label="Aprovacoes" />` immediately after the Leads NavItem and before the disabled Conteudo item. Apply additively to the CURRENT file content (Plan 03 already made Leads active — keep that). Do not change the disabled Conteudo/Campanhas/Inteligencia items.
  </action>
  <verify>
    <automated>grep -q "'use server'" app/dashboard/aprovacoes/actions.ts && grep -q "approveBatch" app/dashboard/aprovacoes/actions.ts && grep -q "rejectBatch" app/dashboard/aprovacoes/actions.ts && grep -q "fn_tenant_id" app/dashboard/aprovacoes/actions.ts && grep -q "eq('tipo','conteudo')" app/dashboard/aprovacoes/actions.ts && grep -q 'href="/dashboard/aprovacoes" label="Aprovacoes"' components/app-shell.tsx && grep -q 'href="/dashboard/leads" label="Leads" />' components/app-shell.tsx && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `actions.ts` is `'use server'`; approveBatch/rejectBatch safeParse, resolve tenant via `supabase.rpc('fn_tenant_id')`, explicit null-tenant error (no silent fail)
    - Update is constrained by `.in('id', ids)` + `.eq('tipo','conteudo')` + `.eq('tenant_id', tenantId)` — a campanha row can never be flipped by a batch action, tenant never from client
    - DB rejection (viewer write blocked) returned as `{ error }`, not swallowed
    - app-shell.tsx has an active Aprovacoes NavItem AND still has Plan 03's active Leads link (no regression)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>One-action batch approve/reject on organic-content only, tenant-safe; Aprovacoes sidebar link live.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Aprovacoes page (Server Component) + batch approval UI</name>
  <files>app/dashboard/aprovacoes/page.tsx, app/dashboard/aprovacoes/batch-approval.tsx</files>
  <read_first>
    - app/dashboard/overview/page.tsx (top-bar UPPERCASE heading + Card + empty-state copy pattern)
    - app/dashboard/configuracoes/config-form.tsx (role-gated control NOT rendered for viewer; inline green success convention, not a toast)
    - lib/queries/aprovacoes.ts + lib/queries/usuario.ts (Task 1 + Phase 1 — getWeeklyOrganicBatch / getCurrentUsuario)
    - app/dashboard/aprovacoes/actions.ts (Task 2 — approveBatch/rejectBatch contracts)
    - CLAUDE.md (§ Identidade visual — 60-30-10; Server Components por padrão, 'use client' só quando necessário)
  </read_first>
  <behavior>
    - `page.tsx` (Server Component) calls `getWeeklyOrganicBatch()` + `getCurrentUsuario()`; renders the "APROVAÇÕES" top bar, a "Lote semanal — até 10 posts orgânicos" heading, and the list of pending items (id/criado_em/referencia_id), with a visible count "X de 10"
    - Empty batch → friendly empty-state Card ("Nenhum post aguardando aprovação."), not a blank list
    - owner/manager: an "Aprovar lote" primary button (#E30613) and a "Rejeitar lote" neutral/outline button; clicking either calls the matching Server Action with ALL listed ids in one action; on success an inline green message ("Lote aprovado." / "Lote rejeitado.") shows and the queue empties after revalidation
    - viewer: the list is read-only — NEITHER batch button is rendered (absent from DOM, not disabled)
  </behavior>
  <action>
Create `app/dashboard/aprovacoes/page.tsx` (Server Component, `export default async function`): `const [batch, usuario] = await Promise.all([getWeeklyOrganicBatch(), getCurrentUsuario()])`. Render the `APROVAÇÕES` uppercase top bar (mirror overview heading) + subheading "Lote semanal — até 10 posts orgânicos" + a `Badge` showing `${batch.length} de 10`. If `batch.length === 0` render the empty-state Card and stop. Otherwise render the list (each item: short id, criado_em pt-BR date, referencia_id) and — only when `usuario.role !== 'viewer'` — `<BatchApproval ids={batch.map(b=>b.id)} />`. Route protected by Plan 01 middleware + dashboard layout — no extra guard.

Create `app/dashboard/aprovacoes/batch-approval.tsx` (`'use client'`, prop `{ ids: string[] }`): two buttons — "Aprovar lote" (primary, bg #E30613) and "Rejeitar lote" (outline/neutral, per CLAUDE.md 60-30-10 — reject is not red). Each wraps the matching action in `useTransition`: "Aprovar lote" → `approveBatch({ ids })`, "Rejeitar lote" → `rejectBatch({ ids })`. On `{ error }` show an inline red error; on `{ success }` show the inline green message ("Lote aprovado." / "Lote rejeitado.", Phase 1 inline-success convention — not a toast) and rely on `revalidatePath` to refresh the (now-empty) Server Component. Disable both buttons while the transition is pending and show "Processando...".
  </action>
  <verify>
    <automated>grep -q "export default async function" app/dashboard/aprovacoes/page.tsx && grep -q "getWeeklyOrganicBatch" app/dashboard/aprovacoes/page.tsx && grep -q "getCurrentUsuario" app/dashboard/aprovacoes/page.tsx && grep -q "role !== 'viewer'" app/dashboard/aprovacoes/page.tsx && grep -q "approveBatch" app/dashboard/aprovacoes/batch-approval.tsx && grep -q "rejectBatch" app/dashboard/aprovacoes/batch-approval.tsx && grep -q "useTransition" app/dashboard/aprovacoes/batch-approval.tsx && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `page.tsx` is an async Server Component reading `getWeeklyOrganicBatch()` + `getCurrentUsuario()`; shows the count "X de 10" and the empty-state Card when the batch is empty
    - owner/manager see "Aprovar lote" (red CTA) + "Rejeitar lote" (neutral); a single click sends ALL listed ids to one Server Action
    - viewer: NEITHER batch button in the DOM (absent, not disabled)
    - Success shows the inline green message (not a toast); queue empties after revalidation
    - No new npm/shadcn package added; brand 60-30-10 respected (only Aprovar is red)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Weekly organic batch queue with one-action approve/reject, role-gated, brand-accurate.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Verify weekly batch approve/reject + APROV-02 campaign gate + viewer read-only (APROV-01 + APROV-02)</name>
  <what-built>Tasks 1-3 built the batch schema, ≤10 weekly query, the enforced campaign gate, the batch Server Actions, and the aprovacoes page/UI, and added the Aprovacoes nav. This proves the APROV-01 + APROV-02 behaviors that only a running system + live RLS can prove.</what-built>
  <how-to-verify>
1. Seed organic items (SQL Editor, as needed since no content pipeline exists until Phase 4): insert 12 rows into public.aprovacoes for the Fitness UNIC tenant_id with tipo='conteudo', status='pendente', criado_em=now(): `INSERT INTO public.aprovacoes (tenant_id, tipo, status) SELECT '<tenant_A_id>','conteudo','pendente' FROM generate_series(1,12);`
2. `npm run dev`. Log in as the owner. Confirm the sidebar now has an active "Aprovacoes" link AND the Plan 03 "Leads" link is still active (no regression). Open `/dashboard/aprovacoes`.
3. Confirm the queue shows exactly 10 items (NOT 12 — the weekly cap APROV-01) and the badge reads "10 de 10".
4. Click "Aprovar lote". Confirm the inline green "Lote aprovado." (not a toast), the queue then shows the remaining items (the 2 not in the first batch of 10, if within 7 days) or empties. Hard-refresh → state persists. SQL: `SELECT status, count(*) FROM public.aprovacoes WHERE tipo='conteudo' GROUP BY status;` → 10 are 'aprovado'.
5. Reject path: insert 3 more pending conteudo rows, reload, click "Rejeitar lote" → SQL confirms those are 'rejeitado'. (APROV-01 one-action batch approve AND reject both proven.)
6. APROV-02 gate — negative: pick any UUID as a fake campaignId with NO aprovacoes row. In a scratch route or `node -e` style harness (or a temporary test calling the exported function), call `assertCampaignApproved('<fakeCampaignId>')` while authenticated as the owner → it MUST throw `CampaignNotApprovedError` (paid campaign cannot publish without an aprovado record).
7. APROV-02 gate — positive: `INSERT INTO public.aprovacoes (tenant_id, tipo, referencia_id, status) VALUES ('<tenant_A_id>','campanha','<campaignId>','aprovado');` then call `assertCampaignApproved('<campaignId>')` → it MUST resolve without throwing.
8. Confirm a bulk "Aprovar lote" never touched the tipo='campanha' row from step 7: `SELECT status FROM public.aprovacoes WHERE tipo='campanha';` is still 'aprovado' and was never flipped by a batch action (the `.eq('tipo','conteudo')` guard).
9. Viewer: log in as a viewer, open `/dashboard/aprovacoes` → confirm NO "Aprovar lote" / "Rejeitar lote" buttons render. Attempt the `approveBatch` Server Action from devtools as the viewer → confirm the DB rejects it (RLS owner/manager) and statuses do not change.
10. Cross-tenant: as tenant B's owner, `/dashboard/aprovacoes` shows none of tenant A's items (RESTRICTIVE RLS).
  </how-to-verify>
  <files>(no source changes — runtime + RLS verification of Tasks 1-3 output)</files>
  <action>Run the dev server and follow the how-to-verify steps to confirm the ≤10 weekly batch caps at 10, one-action approve and reject both persist, the APROV-02 gate blocks an unapproved campaign and passes an approved one, a batch action never flips a campanha row, the viewer is read-only + DB-blocked, and cross-tenant isolation holds. Verification only; no source modification.</action>
  <verify>
    <automated>MISSING — batch cap behavior, the live APROV-02 gate, viewer DB write-block, and cross-tenant isolation require a running app + live RLS; verified by the human steps above (consistent with Phase 1 blocking checkpoints)</automated>
  </verify>
  <done>Queue capped at 10, batch approve and reject both persisted, assertCampaignApproved threw for an unapproved campaign and passed for an approved one, a batch action never flipped a campanha row, the viewer was read-only + DB-blocked, and tenant B saw none of tenant A's approvals.</done>
  <resume-signal>Type "approved" once the weekly batch capped at 10, batch approve+reject persisted, the APROV-02 gate blocked an unapproved campaign and passed an approved one, no batch action flipped a campanha row, the viewer was read-only + DB-blocked, and cross-tenant isolation held; otherwise describe the failure.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser batch buttons → Server Actions | Untrusted ids/decision; zod-revalidated, capped at 10, in-tenant only |
| Server Action → public.aprovacoes | tenant_id from fn_tenant_id(), never client; tipo='conteudo' guard isolates organic from paid |
| Phase 5 publish path → assertCampaignApproved | The APROV-02 enforcement boundary — fails closed |
| Viewer → batch controls | UI omits buttons; DB RLS (owner/manager) is the enforcing boundary |
| Authenticated tenant B → tenant A approvals | RESTRICTIVE RLS is the hard boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-13 | Elevation of Privilege | Paid campaign published without approval (APROV-02 bypass) | mitigate | `assertCampaignApproved` requires a tipo='campanha'/status='aprovado'/referencia_id row and FAILS CLOSED (throws on missing row, tenant-unresolved, or query error); Phase 5 must call it before publish |
| T-02-14 | Tampering | Bulk organic action flips a paid-campaign row | mitigate | Batch update constrained by `.eq('tipo','conteudo')` — campanha rows are unreachable from approveBatch/rejectBatch |
| T-02-10 | Tampering | tenant_id supplied via batch payload | mitigate | tenant resolved via `supabase.rpc('fn_tenant_id')`; update `.eq('tenant_id', tenantId)`; RLS WITH CHECK rejects mismatch |
| T-02-03 | Elevation of Privilege | Viewer approves/rejects a batch | mitigate | Batch buttons not rendered for viewer (UI) + Plan 01 PERMISSIVE write owner/manager only (DB) — verified checkpoint step 9 |
| T-02-15 | Tampering | Over-large batch (>10) bypassing APROV-01 cap | mitigate | `batchDecisionSchema` caps ids at max 10; query returns ≤10; cap proven in checkpoint step 3 |
| T-02-01 | Information Disclosure | Cross-tenant approvals read | mitigate | getWeeklyOrganicBatch relies on RESTRICTIVE RLS, no tenant_id arg; verified checkpoint step 10 |
| T-02-SC | Tampering | npm installs | accept | No new packages — zod/supabase/base-ui all from Phase 1 (grep package.json unchanged) |
</threat_model>

<verification>
- `npm run build` green
- batchDecisionSchema caps at 10; getWeeklyOrganicBatch tipo=conteudo + pending + 7d + .limit(10), RLS-scoped
- assertCampaignApproved fails closed (throws on missing/tenant-unresolved/query-error); passes only with an aprovado campanha row
- Batch actions tipo='conteudo' only + tenant from fn_tenant_id(); viewer write-blocked at UI + DB
- Aprovacoes nav added; Plan 03 Leads link not regressed
- [BLOCKING] checkpoint: cap=10, approve+reject persist, APROV-02 gate blocks/passes correctly, no campanha row flipped by batch, viewer read-only + DB-blocked, cross-tenant isolation holds
</verification>

<success_criteria>
- APROV-01: owner sees a weekly batch of up to 10 organic posts and approves OR rejects them in one action (Phase 2 Success Criterion 4)
- APROV-02: no paid campaign can publish without an explicit per-campaign aprovacoes record — enforced by assertCampaignApproved, consumable by Phase 5 (Phase 2 Success Criterion 5)
- tenant_id never trusted from client; viewer write-blocked at UI + DB (CLAUDE.md inegociável)
</success_criteria>

<output>
Create `.planning/phases/02-lead-pipeline-aprovacoes/04-SUMMARY.md` when done.
</output>
