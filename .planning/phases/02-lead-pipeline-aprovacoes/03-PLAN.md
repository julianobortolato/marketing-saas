---
phase: 02-lead-pipeline-aprovacoes
plan: "03"
type: execute
wave: 1
depends_on: ["01"]
files_modified:
  - app/dashboard/leads/page.tsx
  - app/dashboard/leads/leads-table.tsx
  - app/dashboard/leads/lead-filters.tsx
  - app/dashboard/leads/new-lead-dialog.tsx
  - app/dashboard/leads/actions.ts
  - lib/validators/lead.ts
  - lib/queries/leads.ts
  - components/app-shell.tsx
autonomous: false
requirements: [LEAD-02, LEAD-03]

must_haves:
  truths:
    - "Owner opens /dashboard/leads and sees a table of the tenant's leads (nome, telefone, origem, status, criado_em), newest first"
    - "Owner can filter the list by status, by canal/origem, and by a date range, and the table updates to match"
    - "Owner can change a lead's status from the table and the new status persists after a page reload"
    - "Owner can click 'Novo lead', enter nome + telefone + origem, submit, and the new lead appears in the table with status='novo'"
    - "The status-change and create Server Actions resolve tenant_id from fn_tenant_id() server-side; tenant_id is never accepted from the client"
    - "A viewer sees the leads list read-only: no status dropdown control and no 'Novo lead' button rendered (not just disabled)"
    - "The sidebar 'Leads' nav item is an active link to /dashboard/leads (no longer the disabled '(em breve)' placeholder)"
  artifacts:
    - path: "app/dashboard/leads/page.tsx"
      provides: "Server Component: reads filtered leads + role, renders panel"
      contains: "export default async function"
    - path: "app/dashboard/leads/actions.ts"
      provides: "Server Actions: createLead + updateLeadStatus, tenant from fn_tenant_id()"
      contains: "'use server'"
    - path: "lib/queries/leads.ts"
      provides: "Typed filtered leads read (RLS-scoped, server-side filter args)"
      contains: "from('leads')"
    - path: "lib/validators/lead.ts"
      provides: "Zod schemas for create + status update"
      contains: "leadCreateSchema"
    - path: "app/dashboard/leads/leads-table.tsx"
      provides: "Table with per-row status control gated by role"
      contains: "status"
    - path: "components/app-shell.tsx"
      provides: "Sidebar with Leads as an active link (disabled prop removed)"
      contains: "/dashboard/leads"
  key_links:
    - from: "app/dashboard/leads/page.tsx"
      to: "lib/queries/leads.ts"
      via: "Server Component reads filtered leads via searchParams"
      pattern: "getLeads"
    - from: "app/dashboard/leads/actions.ts"
      to: "supabase.rpc('fn_tenant_id')"
      via: "server-side tenant resolution before insert/update"
      pattern: "fn_tenant_id"
    - from: "app/dashboard/leads/leads-table.tsx"
      to: "app/dashboard/leads/actions.ts"
      via: "updateLeadStatus server action call from the status control"
      pattern: "updateLeadStatus"
    - from: "app/dashboard/leads/new-lead-dialog.tsx"
      to: "app/dashboard/leads/actions.ts"
      via: "createLead server action call on submit"
      pattern: "createLead"
---

<objective>
Deliver the lead-panel vertical slice: `/dashboard/leads` showing the tenant's leads in a table with status/canal/date filters, a per-row status change (Server Action), and a "Novo lead" dialog to add a lead manually (nome, telefone, origem). Tenant_id is always resolved server-side via fn_tenant_id(); a viewer sees everything read-only. This completes LEAD-02 + LEAD-03 and Phase 2 Success Criteria 2 & 3, and activates the Leads sidebar nav.

Purpose: This is where the owner actually works leads day-to-day. It must respect the inegociável rules (tenant_id never from client, viewer write-block via UI + RLS) and reuse the proven Phase 1 form/action/query patterns.

Output: A working, brand-accurate leads panel with filtering, manual status change, manual entry, and role-gated write controls.
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
<!-- From Phase 1 + Plan 01. Use these directly — do not re-explore. -->

lib/supabase/server.ts:  async createClient(): Promise<SupabaseClient>   // Server Components / Server Actions
lib/queries/usuario.ts:  getCurrentUsuario(): Promise<Usuario | null>
  export type UsuarioRole = 'owner' | 'manager' | 'viewer'
  export interface Usuario { id: string; tenant_id: string; role: UsuarioRole; nome: string }

Database (Plan 01 migration 20260520000001 + RLS 20260520000003):
  public.leads(id uuid pk, tenant_id uuid NOT NULL, nome text, telefone text,
    origem text CHECK (meta_form|whatsapp|google|manual), status text CHECK
    (novo|contatado|agendado|convertido|perdido) default 'novo', remotejid text,
    score smallint, criado_em timestamptz default now())
  RLS: SELECT allowed for any role of the same tenant; INSERT/UPDATE PERMISSIVE
    require fn_usuario_role() IN ('owner','manager') → a viewer's write is rejected
    at the DB even if the UI is bypassed. RESTRICTIVE enforces tenant isolation.
  RPC: supabase.rpc('fn_tenant_id') -> uuid  (current tenant, from usuarios — NOT JWT)

Proven Phase 1 patterns to REPLICATE (do not invent new ones):
  - Server Action shape: app/dashboard/configuracoes/actions.ts —
    'use server' → schema.safeParse → createClient() → supabase.rpc('fn_tenant_id')
    → if !tenantId return { error:'Não foi possível identificar a academia...' }
    → mutate with tenant_id set ONLY from the rpc → revalidatePath → { success:true }
  - Shared zod validator: lib/validators/academia-config.ts (export schema + Input type)
  - Typed RLS-scoped query: lib/queries/academia-config.ts (createClient, no client tenant_id)
  - Role-gated UI: Plan 01 03-PLAN config-form — control NOT rendered (absent from DOM,
    not disabled) when role==='viewer'
  - Routing: app/dashboard/* (NOT a route group). Plan 01 middleware protects /dashboard/*.

components/app-shell.tsx currently renders:
  <NavItem href="/dashboard/leads" label="Leads" disabled />
  → this plan removes the `disabled` prop so Leads becomes an active link.
  Do NOT touch the other disabled NavItems (Conteudo/Campanhas/Inteligencia — later phases).

shadcn available: button, input, label, card, separator, badge, radio-group, textarea,
  avatar (components/ui/). Uses @base-ui/react (Phase 1 used base-nova style — no Radix).
  For the status control prefer a native <select> styled with Tailwind or a small
  @base-ui/react primitive; do NOT add a new shadcn component requiring a package install.
  Brand tokens already global (primary #E30613).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Lead zod schemas + filtered RLS-scoped query</name>
  <files>lib/validators/lead.ts, lib/queries/leads.ts</files>
  <read_first>
    - lib/validators/academia-config.ts (exact export style: schema + inferred Input type, error string convention)
    - lib/queries/academia-config.ts (RLS-scoped query pattern: createClient(), no client tenant_id, typed return)
    - supabase/migrations/20260520000001_create_leads.sql (Plan 01 — exact columns + origem/status CHECK values the schemas must mirror)
    - CLAUDE.md (§ Multi-tenant — toda query filtra por tenant_id; § Código — TS strict, sem any)
  </read_first>
  <behavior>
    - `leadCreateSchema` validates `nome` (required, "Campo obrigatório."), `telefone` (required, digit-normalized, min 8 digits), `origem` enum meta_form|whatsapp|google|manual default 'manual'; status is NOT user-supplied on create (always 'novo')
    - `leadStatusUpdateSchema` validates `id` (uuid) + `status` enum novo|contatado|agendado|convertido|perdido
    - `getLeads(filters)` returns the current tenant's leads (RLS-scoped — NO tenant_id arg) filtered by optional `status`, `origem`, `from` date, `to` date, ordered `criado_em desc`; returns typed `Lead[]`
    - Invalid/empty filter values are ignored (no filter applied), never throw
  </behavior>
  <action>
Create `lib/validators/lead.ts` exporting `leadCreateSchema` (zod: nome string min 1 message 'Campo obrigatório.', telefone string transformed via `.transform(v => v.replace(/[^\d]/g,''))` then refined min length 8 message 'Telefone inválido.', origem enum ['meta_form','whatsapp','google','manual'] default 'manual'), `leadStatusUpdateSchema` (id: z.string().uuid(), status: z.enum(['novo','contatado','agendado','convertido','perdido'])), plus inferred `LeadCreateInput` / `LeadStatusUpdateInput` types. Error strings in pt-BR matching the Phase 1 convention.

Create `lib/queries/leads.ts` exporting `export interface Lead { id:string; nome:string|null; telefone:string|null; origem:string; status:string; remotejid:string|null; criado_em:string }` and `async function getLeads(filters?: { status?: string; origem?: string; from?: string; to?: string }): Promise<Lead[]>`. Use `createClient()` from `lib/supabase/server.ts`. Build `let q = supabase.from('leads').select('id,nome,telefone,origem,status,remotejid,criado_em').order('criado_em',{ascending:false})`. Conditionally `.eq('status', filters.status)` only when it is one of the 5 valid statuses; `.eq('origem', filters.origem)` only when one of the 4 valid origens; `.gte('criado_em', filters.from)` / `.lte('criado_em', filters.to)` only when the value parses as a valid date. RLS scopes rows to the tenant — do NOT pass tenant_id (CLAUDE.md: never from client; RLS already filters). Return `(data ?? []) as Lead[]`; on error log message and return `[]`.
  </action>
  <verify>
    <automated>grep -q "leadCreateSchema" lib/validators/lead.ts && grep -q "leadStatusUpdateSchema" lib/validators/lead.ts && grep -q "getLeads" lib/queries/leads.ts && grep -q "from('leads')" lib/queries/leads.ts && ! grep -q "tenant_id" lib/queries/leads.ts && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `leadCreateSchema` requires nome + digit-normalized telefone (min 8 digits) + origem enum (4 values, default 'manual'); does not accept a status field
    - `leadStatusUpdateSchema` validates a uuid id + the 5-value status enum
    - `getLeads()` is RLS-scoped (no `tenant_id` reference anywhere in the file), supports status/origem/from/to filters, orders criado_em desc, returns `Lead[]`, never throws
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Validation + filtered RLS-scoped lead read are ready for the page, table, and dialog.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Server Actions (createLead + updateLeadStatus) + activate Leads nav</name>
  <files>app/dashboard/leads/actions.ts, components/app-shell.tsx</files>
  <read_first>
    - app/dashboard/configuracoes/actions.ts (EXACT Server Action pattern to replicate: 'use server', safeParse, createClient, supabase.rpc('fn_tenant_id'), null-tenant error string, revalidatePath, { success } / { error })
    - lib/validators/lead.ts (Task 1 schemas), lib/queries/leads.ts (Task 1 — Lead type)
    - components/app-shell.tsx (current sidebar — the exact `<NavItem href="/dashboard/leads" label="Leads" disabled />` line to change)
    - CLAUDE.md (§ Anti-padrões — query/insert sem tenant_id proibido; tenant_id nunca do cliente)
  </read_first>
  <behavior>
    - `createLead(input)` safeParses with `leadCreateSchema`; resolves tenant via `supabase.rpc('fn_tenant_id')`; null tenant → `{ error:'Não foi possível identificar a academia. Recarregue e tente novamente.' }`; inserts `{ ...parsed, tenant_id, status:'novo' }` into leads; revalidates `/dashboard/leads`; returns `{ success:true }` or `{ error }`
    - `updateLeadStatus(input)` safeParses with `leadStatusUpdateSchema`; resolves tenant via the rpc; updates `leads` SET status WHERE id = input.id (RLS + RESTRICTIVE additionally enforce the row is in-tenant; do not trust id alone — also `.eq('tenant_id', tenantId)` defense-in-depth); revalidates; returns `{ success:true }` or `{ error }`
    - A viewer calling either action is rejected at the DB by the Plan 01 PERMISSIVE write policy (owner/manager only) — surface that as `{ error }`, never a silent success
    - The sidebar 'Leads' item becomes an active link (disabled prop removed); other future NavItems stay disabled
  </behavior>
  <action>
Create `app/dashboard/leads/actions.ts` (`'use server'`) with `createLead(input: unknown)` and `updateLeadStatus(input: unknown)`. Both: import schemas from `lib/validators/lead.ts`; `const parsed = schema.safeParse(input); if (!parsed.success) return { error: parsed.error.flatten() }`; `const supabase = await createClient()`; `const { data: tenantId } = await supabase.rpc('fn_tenant_id'); if (!tenantId) return { error:'Não foi possível identificar a academia. Recarregue e tente novamente.' }`.
- `createLead`: `await supabase.from('leads').insert({ nome: parsed.data.nome, telefone: parsed.data.telefone, origem: parsed.data.origem, status:'novo', tenant_id: tenantId })`. tenant_id set ONLY from the rpc (CLAUDE.md inegociável — never from input).
- `updateLeadStatus`: `await supabase.from('leads').update({ status: parsed.data.status }).eq('id', parsed.data.id).eq('tenant_id', tenantId)`.
Both: `if (error) return { error: error.message }` (a viewer's call returns the RLS rejection here — never silent), then `revalidatePath('/dashboard/leads')` and `return { success:true }`.

Edit `components/app-shell.tsx`: change `<NavItem href="/dashboard/leads" label="Leads" disabled />` to `<NavItem href="/dashboard/leads" label="Leads" />` (remove ONLY the `disabled` prop on the Leads item). Leave the Conteudo/Campanhas/Inteligencia NavItems with `disabled` (those ship in later phases — leaving them as spec-mandated "(em breve)" placeholders is correct, not scope reduction).
  </action>
  <verify>
    <automated>grep -q "'use server'" app/dashboard/leads/actions.ts && grep -q "createLead" app/dashboard/leads/actions.ts && grep -q "updateLeadStatus" app/dashboard/leads/actions.ts && grep -q "fn_tenant_id" app/dashboard/leads/actions.ts && grep -q "status: 'novo'" app/dashboard/leads/actions.ts && grep -q 'href="/dashboard/leads" label="Leads" />' components/app-shell.tsx && grep -q 'label="Conteudo" disabled' components/app-shell.tsx && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `actions.ts` is `'use server'`; both actions safeParse, resolve tenant via `supabase.rpc('fn_tenant_id')`, and return an explicit error string when tenant is null (no silent fail)
    - `createLead` sets `status:'novo'` and `tenant_id` only from the rpc (never from input); `updateLeadStatus` constrains the update with `.eq('tenant_id', tenantId)` defense-in-depth
    - A DB rejection (e.g. viewer write blocked by RLS) is returned as `{ error }`, not swallowed
    - app-shell.tsx Leads NavItem no longer has `disabled`; Conteudo/Campanhas/Inteligencia still do
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Create + status-update Server Actions enforce server-side tenant resolution; the Leads sidebar link is live.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Leads page (Server Component) + filters + table + new-lead dialog</name>
  <files>app/dashboard/leads/page.tsx, app/dashboard/leads/lead-filters.tsx, app/dashboard/leads/leads-table.tsx, app/dashboard/leads/new-lead-dialog.tsx</files>
  <read_first>
    - app/dashboard/configuracoes/page.tsx + config-form.tsx (Server Component reads data + role then passes to a 'use client' child; role-gated control NOT rendered for viewer)
    - app/dashboard/overview/page.tsx (top-bar heading style: UPPERCASE section title; Card usage; empty-state copy pattern)
    - lib/queries/leads.ts + lib/queries/usuario.ts (Task 1 + Phase 1 — getLeads / getCurrentUsuario signatures)
    - app/dashboard/leads/actions.ts, lib/validators/lead.ts (Task 1-2 — action + schema contracts)
    - CLAUDE.md (§ Identidade visual — 60-30-10, vermelho só em CTA; Server Components por padrão, 'use client' só quando necessário)
  </read_first>
  <behavior>
    - `page.tsx` (Server Component) reads `searchParams` (status, origem, from, to), calls `getLeads(filters)` + `getCurrentUsuario()`, renders the "LEADS" top bar + filters + table + (for owner/manager) the "Novo lead" trigger
    - Filters are reflected in the URL querystring; changing a filter reloads the Server Component with the new `searchParams` and the table shows only matching rows; "Limpar filtros" resets
    - Empty result → a friendly empty-state Card ("Nenhum lead ainda." / "Nenhum lead corresponde aos filtros."), not a blank table
    - Per-row status control: owner/manager see a status `<select>` that calls `updateLeadStatus` and reflects the new value after revalidation; a viewer sees the status as a static Badge with NO select control rendered
    - "Novo lead" button is rendered ONLY for owner/manager (absent from DOM for viewer); the dialog form (nome/telefone/origem) calls `createLead`, shows inline field errors + an inline green success, and the new row appears after revalidation
  </behavior>
  <action>
Create `app/dashboard/leads/page.tsx` (Server Component, `export default async function`): accept `{ searchParams }`; build `filters` from `searchParams.status/origem/from/to`; `const [leads, usuario] = await Promise.all([getLeads(filters), getCurrentUsuario()])`. Render a top bar `LEADS` (uppercase, mirror overview page heading) + tenant context. Render `<LeadFilters />` (client), `<LeadsTable leads={leads} role={usuario.role} />` (client island for the status control), and — only when `usuario.role !== 'viewer'` — `<NewLeadDialog />` trigger button (#E30613 primary CTA, the only red accent per CLAUDE.md 60-30-10). Route already protected by Plan 01 middleware + dashboard layout — do not re-implement the auth guard.

Create `app/dashboard/leads/lead-filters.tsx` (`'use client'`): a status `<select>` (all 5 + "Todos"), an origem/canal `<select>` (4 + "Todos"), two date inputs (from/to). On change, `useRouter().push` / update the URL `searchParams` (e.g. via `URLSearchParams`) so the Server Component re-renders filtered; include a "Limpar filtros" button that navigates to `/dashboard/leads` with no query. No new package — use `next/navigation` useRouter + useSearchParams.

Create `app/dashboard/leads/leads-table.tsx` (`'use client'`, props `{ leads: Lead[]; role: UsuarioRole }`): a table with columns Nome, Telefone, Origem (Badge), Status, Criado em (locale pt-BR date). Status column: when `role === 'viewer'` render a static `Badge` (NO select); otherwise render a `<select>` of the 5 statuses whose `onChange` calls `updateLeadStatus({ id, status })` (wrap in `useTransition`; on `{ error }` show an inline row error, on success the revalidatePath refreshes the Server Component). Empty `leads` → render the empty-state Card copy. Brand: status Badges use neutral zinc tones; only the Novo-lead CTA is red.

Create `app/dashboard/leads/new-lead-dialog.tsx` (`'use client'`): a dialog/disclosure (use a controlled @base-ui/react Dialog primitive already available via shadcn deps, OR a simple controlled `<dialog>` / conditional Card — do NOT add a new shadcn/npm component) containing a react-hook-form + `zodResolver(leadCreateSchema)` form with Nome, Telefone, Origem (`<select>` 4 values). Submit calls `createLead`; on field errors show inline messages; on `{ success }` show the inline green "Lead cadastrado com sucesso." (Phase 1 success-message convention, not a toast), close the dialog, and rely on `revalidatePath` to surface the new row. Loading state = disabled submit + "Salvando...".
  </action>
  <verify>
    <automated>grep -q "export default async function" app/dashboard/leads/page.tsx && grep -q "getLeads" app/dashboard/leads/page.tsx && grep -q "getCurrentUsuario" app/dashboard/leads/page.tsx && grep -q "role !== 'viewer'" app/dashboard/leads/page.tsx && grep -q "updateLeadStatus" app/dashboard/leads/leads-table.tsx && grep -q "zodResolver" app/dashboard/leads/new-lead-dialog.tsx && grep -q "createLead" app/dashboard/leads/new-lead-dialog.tsx && grep -Eq "useSearchParams|URLSearchParams" app/dashboard/leads/lead-filters.tsx && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `page.tsx` is an async Server Component reading `searchParams`, calling `getLeads(filters)` + `getCurrentUsuario()`, ordering newest-first via the query
    - Changing status/origem/date filters updates the URL searchParams and the rendered rows; "Limpar filtros" resets to all
    - viewer: NO status `<select>` and NO "Novo lead" button in the DOM (absent, not disabled); owner/manager: both present
    - New-lead dialog uses `zodResolver(leadCreateSchema)`, calls `createLead`, shows inline green success (not a toast), and the row appears after revalidation
    - No new npm/shadcn package added (grep package.json unchanged); brand: single red CTA, neutral status badges
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Filterable leads panel with role-gated per-row status change and manual lead creation, brand-accurate and tenant-safe.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Verify filter, manual status change, manual create, and viewer read-only (LEAD-02 + LEAD-03)</name>
  <what-built>Tasks 1-3 built the schemas, filtered query, Server Actions, and the leads page/table/filters/dialog, and activated the Leads nav. This proves the LEAD-02 + LEAD-03 behaviors that only a running system + live RLS can prove.</what-built>
  <how-to-verify>
1. `npm run dev`. Log in as the owner. Confirm the sidebar "Leads" item is now an active link (no "(em breve)"); click it → `/dashboard/leads`.
2. Seed data: either reuse the leads created by Plan 02's webhook, or click "Novo lead", enter Nome="Ana Teste", Telefone="(11) 99999-1111", Origem="manual", submit. Confirm the inline green "Lead cadastrado com sucesso." appears (not a toast) and the row appears in the table with status "novo".
3. Filter — status: select status="novo" → only novo leads show. Select status="convertido" → the Ana row disappears. "Limpar filtros" → all rows return. Confirm the URL querystring changes with the filter.
4. Filter — canal + date: pick origem="manual" then a from-date of today → Ana still shows; set from-date to tomorrow → Ana disappears (date filter works).
5. Manual status change: on the Ana row, change the status `<select>` from "novo" to "contatado". Hard-refresh the page → Ana still shows status "contatado" (persisted, LEAD-02 round-trip). In Supabase SQL Editor: `SELECT status FROM public.leads WHERE nome='Ana Teste';` → 'contatado'.
6. Tenant safety: confirm `SELECT tenant_id FROM public.leads WHERE nome='Ana Teste';` equals the owner's tenant (cross-check `SELECT id FROM public.tenants;`). It must NOT be null and must be the logged-in tenant (tenant_id came from fn_tenant_id(), not the form).
7. Viewer: log in as a viewer (invited in Phase 1). Open `/dashboard/leads`. Confirm: NO "Novo lead" button anywhere, and each row's status is a static Badge with NO dropdown. In devtools, attempt to call the `updateLeadStatus` Server Action directly (or `supabase.from('leads').update`) as the viewer → confirm it is rejected (RLS owner/manager-only write) and the table value does not change.
8. Cross-tenant: as a second tenant's owner (tenant B from Phase 1), open `/dashboard/leads` → Ana (tenant A) must NOT appear (RESTRICTIVE RLS).
  </how-to-verify>
  <files>(no source changes — runtime + RLS verification of Tasks 1-3 output)</files>
  <action>Run the dev server and follow the how-to-verify steps to confirm filtering, manual status change persistence, manual lead creation, viewer read-only (UI + DB), and cross-tenant isolation. Verification only; no source modification.</action>
  <verify>
    <automated>MISSING — filter round-trip, status persistence, viewer DB write-block, and cross-tenant isolation require a running app + live RLS; verified by the human steps above (consistent with Phase 1 03/04-PLAN blocking checkpoints)</automated>
  </verify>
  <done>Filters narrowed the list, a manual status change persisted across reload, a manually created lead appeared with status novo and the owner's tenant_id, the viewer saw the panel read-only and was DB-blocked, and tenant B could not see tenant A's leads.</done>
  <resume-signal>Type "approved" once filtering works, a manual status change persisted on reload, manual create worked with correct tenant_id, the viewer was read-only + DB-blocked, and cross-tenant isolation held; otherwise describe the failure.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser filters/forms → Server Component / Server Actions | Untrusted; filters sanitized, form payload zod-revalidated server-side |
| Server Action → public.leads | tenant_id must come from fn_tenant_id(), never the client |
| Viewer → write controls | UI omits controls; DB RLS (owner/manager) is the enforcing boundary |
| Authenticated tenant B → tenant A leads | RESTRICTIVE RLS is the hard boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-10 | Tampering | tenant_id supplied via create/update payload | mitigate | createLead/updateLeadStatus resolve tenant via `supabase.rpc('fn_tenant_id')`; update also `.eq('tenant_id', tenantId)`; RLS WITH CHECK rejects mismatch (Plan 01) |
| T-02-03 | Elevation of Privilege | Viewer changes a lead status / creates a lead | mitigate | Status select + "Novo lead" not rendered for viewer (UI) + Plan 01 PERMISSIVE write policy owner/manager only (DB) — defense in depth, verified checkpoint step 7 |
| T-02-01 | Information Disclosure | Cross-tenant lead read in the panel | mitigate | getLeads relies on RESTRICTIVE RLS scoping, passes no tenant_id; verified checkpoint step 8 |
| T-02-11 | Tampering | Crafted searchParams (SQL/enum injection) | mitigate | Filters validated against the fixed enum/date allowlist before being applied to the query builder; unknown values ignored |
| T-02-12 | Denial of Service | Malformed form/filter input | mitigate | zod safeParse on the action input; query helper never throws (returns []) |
| T-02-SC | Tampering | npm installs | accept | No new packages — react-hook-form, zod, supabase, base-ui all from Phase 1 (grep package.json unchanged) |
</threat_model>

<verification>
- `npm run build` green
- Server Actions 'use server', tenant via fn_tenant_id() rpc, explicit null-tenant error, never tenant_id from client
- getLeads RLS-scoped (no tenant_id) with status/origem/date filters
- viewer: no status select + no Novo-lead button in DOM; Leads nav active
- [BLOCKING] checkpoint: filter works, manual status change persists, manual create works with correct tenant, viewer read-only + DB-blocked, cross-tenant isolation holds
</verification>

<success_criteria>
- LEAD-02: owner sees leads with status, filters (status/canal/data), and changes status manually — persisted (Phase 2 Success Criterion 2)
- LEAD-03: owner adds a lead manually (nome, telefone, origem) and it appears (Phase 2 Success Criterion 3)
- tenant_id never trusted from client; viewer write-blocked at UI + DB (CLAUDE.md inegociável)
</success_criteria>

<output>
Create `.planning/phases/02-lead-pipeline-aprovacoes/03-SUMMARY.md` when done.
</output>
