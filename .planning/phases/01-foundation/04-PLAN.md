---
phase: 01-foundation
plan: 04
type: execute
wave: 1
depends_on: ["01"]
files_modified:
  - app/(dashboard)/layout.tsx
  - app/(dashboard)/overview/page.tsx
  - app/api/invite/route.ts
  - components/app-shell.tsx
  - components/nav-item.tsx
  - lib/queries/usuario.ts
autonomous: false
requirements: [FOUND-04]

must_haves:
  truths:
    - "A logged-in owner/manager sees the dashboard shell (sidebar + overview) with their role badge"
    - "An invited manager can log in and reach /dashboard/overview"
    - "A viewer sees the configuracoes form read-only with NO save button rendered (not just disabled)"
    - "An owner can invite a manager/viewer by email and the invite API uses the service-role admin client server-side only"
    - "Tenant A authenticated user cannot read Tenant B's academia_config (RLS RESTRICTIVE proven by Task 3 blocking checkpoint, step 5 SQL test)"
  artifacts:
    - path: "app/(dashboard)/layout.tsx"
      provides: "Dashboard route-group layout: auth guard + AppShell wrapper"
      contains: "AppShell"
    - path: "components/app-shell.tsx"
      provides: "Sidebar + main layout Server Component with role badge"
      contains: "sidebar"
    - path: "app/api/invite/route.ts"
      provides: "POST invite endpoint using admin client (service role, server-only)"
      contains: "inviteUserByEmail"
    - path: "app/(dashboard)/overview/page.tsx"
      provides: "Overview hub: welcome card (no config) or counter cards"
      contains: "Configurar academia"
    - path: "lib/queries/usuario.ts"
      provides: "Typed read of current usuario role + tenant"
      contains: "role"
  key_links:
    - from: "app/(dashboard)/layout.tsx"
      to: "supabase.auth.getUser"
      via: "server-side auth guard before rendering shell"
      pattern: "auth\\.getUser"
    - from: "app/api/invite/route.ts"
      to: "createAdminClient"
      via: "service-role admin client, server-only"
      pattern: "createAdminClient"
    - from: "components/app-shell.tsx"
      to: "lib/queries/usuario.ts"
      via: "role read from usuarios (not JWT) for badge + gating"
      pattern: "role"
---

<objective>
Deliver the role-based access vertical slice: the dashboard shell (sidebar + overview), the server-only manager/viewer invite endpoint, and role enforcement so viewers cannot perform write actions and tenant A cannot read tenant B. This completes FOUND-04 and Success Criterion 4.

Purpose: Multi-tenant + RBAC is the inegociável core of this product (CLAUDE.md). This slice proves the RESTRICTIVE RLS from Plan 01 actually isolates tenants and that role gates work in the UI and at the DB.

Output: A working dashboard shell with role badge, an invite API using the service-role admin client server-side only, and verified tenant isolation + viewer write-block.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/01-foundation/01-UI-SPEC.md
@.planning/phases/01-foundation/01-RESEARCH.md

<interfaces>
<!-- From Plan 01 (01-SUMMARY.md). Use directly. -->

lib/supabase/server.ts:  async createClient(): Promise<SupabaseClient>   // Server Components
lib/supabase/admin.ts:   createAdminClient(): SupabaseClient             // API routes ONLY (import 'server-only')

Database (Plan 01 migrations):
  public.usuarios(id uuid pk, tenant_id uuid not null, role text in owner|manager|viewer, nome text)
  public.tenants(id, nome, ...)
  RPC: supabase.rpc('fn_usuario_role') -> text   // 'owner'|'manager'|'viewer', read from usuarios (NOT JWT)
  RLS: academia_config readable by owner/manager/viewer of same tenant; RESTRICTIVE blocks cross-tenant

Supabase Admin: supabase.auth.admin.inviteUserByEmail(email)  // requires service role key — server-only route only

Routing: middleware (Plan 01) already redirects logged-out /dashboard/* -> /login.
NOTE: Plan 03 owns app/(dashboard)/configuracoes/* — this plan does NOT touch it. Viewer
read-only enforcement of that form is delivered here ONLY via the role passed down through
the shared layout/role query; the configuracoes form (Plan 03) consumes the role to hide its
save button. Coordinate via the role contract below, not by editing Plan 03 files.

Role contract (consumed by Plan 03's config-form via the shell): lib/queries/usuario.ts
exports getCurrentUsuario() -> { id, tenant_id, role, nome }. role === 'viewer' => form
fields readOnly + save button NOT rendered (UI-SPEC § Role-based UI rules).

Brand tokens applied (Plan 01). shadcn: Avatar, Badge, Card, Button. Nav muted-future items
labeled "(em breve)" per UI-SPEC § Screen /dashboard/overview.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Current-usuario query + AppShell + NavItem + dashboard layout (auth guard)</name>
  <files>lib/queries/usuario.ts, components/app-shell.tsx, components/nav-item.tsx, app/(dashboard)/layout.tsx</files>
  <read_first>
    - .planning/phases/01-foundation/01-UI-SPEC.md (§ Screen /dashboard/overview — sidebar 240px, nav items + muted future items "(em breve)", role badge styles owner/manager/viewer, app shell colors; § Accessibility — aria-current on active nav)
    - .planning/phases/01-foundation/01-RESEARCH.md (§ Anti-Patterns — read role from usuarios via fn_usuario_role, never JWT; § Architecture Diagram — layout reads role in Server Component; getUser not getSession)
    - CLAUDE.md (§ Multi-tenant; § Anti-padrões — auth.jwt() role direct forbidden)
  </read_first>
  <behavior>
    - `getCurrentUsuario()` returns `{ id, tenant_id, role, nome }` for the authenticated user, read from `public.usuarios` (RLS-scoped) — never from JWT claims
    - `app/(dashboard)/layout.tsx` (Server Component) calls `supabase.auth.getUser()`; if no user it redirects to `/login` (defense-in-depth alongside middleware); otherwise renders `AppShell` with children
    - `AppShell` renders the 240px sidebar (logo, active "Visao Geral", "Configuracoes" link, muted "(em breve)" future items) + main area; bottom shows avatar initial + truncated email + role `Badge` styled per role (owner/manager/viewer color sets from UI-SPEC)
    - Active nav item has the 3px #E30613 left border and `aria-current="page"`
  </behavior>
  <action>
Create `lib/queries/usuario.ts` exporting async `getCurrentUsuario()` using `createClient()` from `lib/supabase/server.ts`: get `auth.getUser()`, then select `id, tenant_id, role, nome` from `public.usuarios` for that user (RLS scopes it). Return typed object or null. Never read role from `auth.jwt()` (CLAUDE.md anti-pattern; RESEARCH Anti-Pattern).

Create `components/nav-item.tsx` (`'use client'` for active-path detection via `usePathname`): renders a sidebar link; active state = 3px left border `#E30613` + `#F1F5F9` bg + `aria-current="page"`; supports a `disabled` muted variant rendering the "(em breve)" 12px suffix with no link action (future-phase placeholders per UI-SPEC — render as specified; this is a spec-mandated UI state, not scope reduction).

Create `components/app-shell.tsx` (Server Component): receives `usuario` + children; renders sidebar (logo 24px, NavItems: "Visao Geral" active, "Configuracoes" -> /dashboard/configuracoes, plus muted Leads/Conteudo/Campanhas/Inteligencia "(em breve)") and the main content area; bottom block = Avatar (email initial), truncated email, role `Badge` with the exact owner/manager/viewer styles from UI-SPEC § Role badge styles.

Create `app/(dashboard)/layout.tsx` (Server Component): `createClient()`, `const { data: { user } } = await supabase.auth.getUser()`; if `!user` `redirect('/login')`; call `getCurrentUsuario()`; render `<AppShell usuario={usuario}>{children}</AppShell>`. Use `getUser()` not `getSession()`.
  </action>
  <verify>
    <automated>grep -q "getCurrentUsuario" lib/queries/usuario.ts && ! grep -q "auth.jwt" lib/queries/usuario.ts && grep -q "getUser" "app/(dashboard)/layout.tsx" && ! grep -q "getSession" "app/(dashboard)/layout.tsx" && grep -q "em breve" components/app-shell.tsx && grep -q "aria-current" components/nav-item.tsx && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `getCurrentUsuario()` reads role from `public.usuarios`, zero `auth.jwt(` occurrences
    - `app/(dashboard)/layout.tsx` uses `getUser()` (no `getSession`), redirects to /login when no user
    - AppShell renders role-styled Badge + sidebar with "(em breve)" muted future items
    - Active NavItem has `aria-current="page"`
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Dashboard shell with role badge + auth-guarded layout; role read from DB, never JWT.</done>
</task>

<task type="auto">
  <name>Task 2: Overview hub page + server-only invite API route</name>
  <files>app/(dashboard)/overview/page.tsx, app/api/invite/route.ts</files>
  <read_first>
    - .planning/phases/01-foundation/01-UI-SPEC.md (§ Screen /dashboard/overview — welcome card when academia_config empty, 3 placeholder counter cards when present, top bar copy; § Copywriting — "Configurar academia", welcome heading/body)
    - .planning/phases/01-foundation/01-RESEARCH.md (§ Architecture Diagram — invite via admin.inviteUserByEmail server-only API route; Assumption A3 — invite email flow; Open Question 2 — Supabase default invite email is fine for Phase 1; § Pitfall 4 — server-only)
    - lib/queries/usuario.ts (Task 1), lib/queries/academia-config.ts (Plan 03), lib/supabase/admin.ts (Plan 01)
  </read_first>
  <action>
Create `app/(dashboard)/overview/page.tsx` (Server Component): read academia_config (reuse `getAcademiaConfig()` from Plan 03's `lib/queries/academia-config.ts`) and `getCurrentUsuario()`. Top bar: "VISAO GERAL" uppercase + tenant name. If no academia_config row: render the welcome Card ("Configure o DNA da sua academia" + body + "Configurar academia" Button -> /dashboard/configuracoes) per UI-SPEC. If a row exists: render the 3 placeholder counter cards (Leads/Agendamentos/Conteudos showing "0") per UI-SPEC § Empty states. Exact copy from § Copywriting Contract.

Create `app/api/invite/route.ts` (Route Handler, POST): parse `{ email, role }` from the JSON body; validate with a small inline zod schema (email valid, role in ['manager','viewer'] — owners are created only via the signup trigger, not invited). Authn/authz: use `createClient()` (server.ts) to `getUser()` and `getCurrentUsuario()`; reject with 403 unless the caller's role is `'owner'`. Then use `createAdminClient()` from `lib/supabase/admin.ts` (service role, server-only — RESEARCH Pitfall 4) to call `supabase.auth.admin.inviteUserByEmail(email)`.

Trigger reconciliation (REQUIRED, not optional): the Plan 01 `handle_new_user` trigger fires on every auth.users INSERT and creates a NEW tenant + owner usuario. For an invited teammate that extra tenant is a WRONG ghost tenant the invited user would own (privilege-escalation risk). Reconciliation MUST be transactional-by-compensation:

1. Call `inviteUserByEmail(email)`; capture the returned invited user's `auth.users.id` (`invitedUserId`).
2. The trigger has just created a ghost `tenants` row + a `usuarios` row (role='owner') for `invitedUserId`. Look up the invited user's `public.usuarios` row by `id = invitedUserId`, read its current `tenant_id` (`ghostTenantId`).
3. Reconcile: update the invited user's `public.usuarios` row so `tenant_id` = the CALLER's tenant_id (from `getCurrentUsuario()`, never the request body) and `role` = the requested role (idempotent, keyed on `usuarios.id`).
4. DELETE the orphaned ghost tenant: `delete from public.tenants where id = ghostTenantId` (it now has no usuarios pointing at it and was created solely by the trigger for this invited user). Guard the delete so it can never target the caller's tenant (`ghostTenantId !== callerTenantId`).
5. Wrap steps 2–4 in try/catch. On ANY failure, roll back by calling `supabase.auth.admin.deleteUser(invitedUserId)` (admin client) so the invited user never reaches the system with a wrong/ghost tenant context, then return a 500 JSON error. Do not leave a half-reconciled user.

This is a real working reconciliation delivered in Phase 1 — document it in the SUMMARY as a known Phase 1 simplification (a future migration may make the trigger invite-aware via `raw_user_meta_data`). Do not label it a placeholder/v1/v2 in code.

Return 200 `{ success: true }` or the appropriate 4xx with a JSON error. Service role key must never appear in any response or log (CLAUDE.md § Segurança).
  </action>
  <verify>
    <automated>grep -q "inviteUserByEmail" "app/api/invite/route.ts" && grep -q "createAdminClient" "app/api/invite/route.ts" && grep -q "Configurar academia" "app/(dashboard)/overview/page.tsx" && grep -Eq "403|owner" "app/api/invite/route.ts" && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - Overview shows welcome card when no academia_config, counter cards when present, with exact UI-SPEC copy
    - `/api/invite` rejects non-owner callers (403) and roles outside manager|viewer
    - Invite uses `createAdminClient()` (service role) only in the route; invited user's usuarios row is reconciled to the CALLER's tenant_id (from getCurrentUsuario, never request body)
    - The ghost `tenants` row auto-created by the Plan 01 trigger for the invited user is DELETED after reconciliation (guarded so it can never delete the caller's tenant)
    - Reconciliation is wrapped in try/catch; on ANY failure `supabase.auth.admin.deleteUser(invitedUserId)` rolls the invited user back and the route returns a 500 (no half-reconciled / ghost-owner user)
    - No service role key in any response/log
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Overview hub renders both empty/configured states; owners can invite manager/viewer teammates into their own tenant via a server-only endpoint.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify manager login, viewer write-block, and tenant A↔B isolation (FOUND-04)</name>
  <what-built>Tasks 1-2 built the shell, role query, overview, and invite endpoint. This verifies the three FOUND-04 behaviors that only a running system + live RLS can prove.</what-built>
  <how-to-verify>
1. `npm run dev`. As an owner (tenant A), POST to `/api/invite` (via curl or browser fetch) inviting `gestor@academia.com.br` as `manager` and `leitor@academia.com.br` as `viewer`. Confirm 200 and that each invited user's usuarios row has tenant_id = tenant A (SQL editor). Also confirm NO orphan ghost tenant remains: `SELECT t.id FROM public.tenants t LEFT JOIN public.usuarios u ON u.tenant_id = t.id WHERE u.id IS NULL;` returns 0 rows (the ghost tenant created by the trigger for each invited user was deleted by the reconciliation).
2. Manager: accept the Supabase invite email, set a password, log in. Confirm they reach `/dashboard/overview` and the sidebar badge shows "manager" (01-VALIDATION.md § Manual-Only — invite email is manual).
3. Viewer: log in as the viewer, go to `/dashboard/configuracoes` (Plan 03 form). Confirm the form renders read-only and the "Salvar configurações" button is NOT present (hidden, not merely disabled — UI-SPEC § Role-based UI rules). Confirm the role badge shows "viewer".
4. Viewer DB write block: while logged in as the viewer, attempt a direct write (browser devtools console calling the Plan 03 Server Action, or a crafted `supabase.from('academia_config').update(...)`). Confirm the DB rejects it (RLS — Plan 01 migration 0004 allows write only for owner/manager).
5. Cross-tenant isolation: create a second owner (tenant B) via /signup, save a distinct academia_config. In Supabase SQL Editor, per 01-VALIDATION.md Security Threat Map, run `SELECT * FROM public.academia_config WHERE tenant_id = '<tenant_A_id>'` in the tenant B user's context — confirm 0 rows (RESTRICTIVE RLS).
6. Confirm the automated grep gate below passes (service key never reachable from UI/components).
  </how-to-verify>
  <files>(no source changes — runtime + RLS verification of Tasks 1-2 output)</files>
  <action>Run the dev server and follow the how-to-verify steps to confirm an invited manager can log in, a viewer sees the form read-only with no save button and the DB rejects viewer writes, and tenant B cannot read tenant A's academia_config. Verification only; no source modification.</action>
  <verify>
    <automated>! grep -rn "SUPABASE_SERVICE_ROLE_KEY" "app/(dashboard)" components/ 2>/dev/null && echo "NO_SVC_KEY_IN_UI — remaining FOUND-04 checks (invite email, viewer UI, live RLS) are manual per 01-VALIDATION.md Manual-Only Verifications"</automated>
  </verify>
  <done>Invited manager logged in and reached the dashboard, viewer was blocked at UI and DB, and cross-tenant read returned 0 rows.</done>
  <resume-signal>Type "approved" once: invited manager logged in and reached the dashboard, no orphan ghost tenant remained after invite, viewer saw the form read-only with no save button AND the DB rejected a viewer write, and tenant B could not read tenant A's academia_config; otherwise describe the failure.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser -> /api/invite | Untrusted caller; must be an authenticated owner of the target tenant |
| Invite route -> Supabase admin (service role) | Privileged client; server-only, never exposed |
| Authenticated tenant B user -> tenant A data | RESTRICTIVE RLS is the hard boundary |
| Viewer -> write operations | UI hides save; DB RLS is the enforcing boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Information Disclosure | Cross-tenant academia_config read | mitigate | RESTRICTIVE RLS (Plan 01 migration 0004); verified in checkpoint step 5 |
| T-01-02 | Tampering | Role read for gating | mitigate | role read from `public.usuarios` via getCurrentUsuario(), never `auth.jwt()` (grep gate Task 1) |
| T-01-03 | Elevation of Privilege | Service role key exposure | mitigate | admin client only in `app/api/invite/route.ts`; grep gate Task 3 confirms none under app/(dashboard) or components |
| T-01-04 | Elevation of Privilege | Viewer privilege escalation via URL/devtools | mitigate | Save button not rendered for viewer (UI) + RLS write policy owner/manager only (DB) — defense in depth, verified checkpoint step 4 |
| T-01-12 | Elevation of Privilege | Non-owner invites users / cross-tenant invite | mitigate | /api/invite returns 403 unless caller role='owner'; invited user's tenant_id forced to caller's tenant, never request body |
| T-01-05 | Spoofing / Auth Bypass | Stale session reaching dashboard | mitigate | layout.tsx uses `getUser()` (no getSession) as defense-in-depth with middleware |
| T-01-SC | Tampering | npm installs | accept | No new packages (all from Plan 01 Approved set) |
</threat_model>

<verification>
- `npm run build` green
- getCurrentUsuario reads from usuarios (no auth.jwt); layout uses getUser (no getSession)
- /api/invite: 403 for non-owner, admin client server-only, tenant_id from caller not body
- Overview renders welcome/counter states with exact UI-SPEC copy
- [BLOCKING] checkpoint: manager login works, viewer form read-only + no save button + DB rejects viewer write, tenant B cannot read tenant A
</verification>

<success_criteria>
- FOUND-04: invited manager can log in and access the dashboard; viewer cannot perform write actions (UI hidden + RLS blocked); tenant A cannot read tenant B's data (Success Criterion 4)
- Service role key never reachable from client/UI (CLAUDE.md § Segurança)
</success_criteria>

<output>
Create `.planning/phases/01-foundation/04-SUMMARY.md` when done.
Document the invite/trigger reconciliation as a known Phase 1 simplification in the SUMMARY.
</output>
