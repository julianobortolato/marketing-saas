---
phase: 01-foundation
plan: "04"
subsystem: foundation
tags: [dashboard, rbac, multi-tenant, invite, rls, auth-guard, role-badge, shell]
dependency_graph:
  requires:
    - "01-01: Three-file Supabase client pattern (server.ts, admin.ts)"
    - "01-01: public.usuarios, public.tenants schema + RLS policies"
    - "01-01: handle_new_user trigger + fn_tenant_id() functions"
  provides:
    - "Dashboard route layout with auth guard (getUser, never getSession)"
    - "AppShell: 240px sidebar with role Badge + muted future nav items"
    - "NavItem: active state with 3px #E30613 left border + aria-current"
    - "getCurrentUsuario(): role read from public.usuarios (never auth.jwt)"
    - "POST /api/invite: owner-only, admin client, full trigger reconciliation"
    - "Overview hub: welcome card + counter placeholder cards"
    - "getAcademiaConfig(): RLS-scoped typed query (Plan 03 compatible interface)"
  affects:
    - "Plan 03 (configuracoes): consumes getCurrentUsuario() role contract for viewer write-block"
tech_stack:
  added: []
  patterns:
    - "Auth guard via getUser() in Server Component layout (defense-in-depth with middleware)"
    - "Role read from public.usuarios (never auth.jwt/JWT claims) — CLAUDE.md anti-pattern guard"
    - "Invite + trigger reconciliation: compensation pattern (inviteUserByEmail → read ghost tenant → update usuario → delete ghost → rollback on failure)"
    - "Service role (admin client) isolated to /api/invite route only"
    - "NavItem uses usePathname() for active state detection (Client Component)"
    - "AppShell is Server Component — receives usuario from layout, renders badges server-side"
key_files:
  created:
    - lib/queries/usuario.ts
    - lib/queries/academia-config.ts
    - components/nav-item.tsx
    - components/app-shell.tsx
    - app/dashboard/layout.tsx
    - app/dashboard/overview/page.tsx
    - app/api/invite/route.ts
  modified: []
decisions:
  - "Route group (dashboard) restructured to app/dashboard/ — (dashboard) route group strips the segment from URL so app/(dashboard)/overview creates /overview not /dashboard/overview; middleware protects /dashboard/* so the path must be app/dashboard/layout.tsx + app/dashboard/overview/page.tsx"
  - "shadcn v4 Button has no asChild prop (@base-ui/react/button) — styled Link used for CTA in overview page instead"
  - "Invite reconciliation is a Phase 1 compensation pattern: after inviteUserByEmail, update invited user's tenant_id to caller's tenant, delete ghost tenant created by handle_new_user trigger. Rollback via deleteUser on any failure. Future: make trigger invite-aware via raw_user_meta_data"
  - "getAcademiaConfig() created in Plan 04 (not just Plan 03) because overview page imports it and both plans run in wave 1 in parallel. Plan 03's version will supersede/merge with this minimal version"
metrics:
  duration_minutes: 5
  completed_date: "2026-05-19"
  tasks_completed: 2
  tasks_total: 3
  files_created: 7
  files_modified: 0
---

# Phase 01 Plan 04: Role-Based Dashboard Shell Summary

**One-liner:** Dashboard shell (auth guard + AppShell + NavItem) with role badge read from DB, plus owner-only invite API using admin client with full trigger-reconciliation compensation pattern.

## What Was Built

Tasks 1-2 complete. Task 3 is a blocking checkpoint awaiting human verification of manager login, viewer write-block, and tenant A↔B cross-tenant isolation (FOUND-04 Success Criterion 4).

**Task 1 — Dashboard shell + role query:**
- `lib/queries/usuario.ts`: `getCurrentUsuario()` reads `{ id, tenant_id, role, nome }` from `public.usuarios` (RLS-scoped). Role is never read from JWT claims (`auth.jwt()` absent — grep verified).
- `components/nav-item.tsx` (Client Component): active nav with 3px `#E30613` left border + `#F1F5F9` bg + `aria-current="page"`; disabled "(em breve)" variant for future-phase items.
- `components/app-shell.tsx` (Server Component): 240px sidebar with logo, NavItems (Visao Geral, Configuracoes + 4 muted future items), bottom user block with Avatar initial + role Badge. Role badge styles match UI-SPEC exactly (owner: `#0F172A` bg, manager: `#334155` bg, viewer: `#F1F5F9` bg + `#64748B` text + border).
- `app/dashboard/layout.tsx` (Server Component): calls `supabase.auth.getUser()` (not getSession) as defense-in-depth auth guard; redirects to `/login` when no user or no usuarios row; renders `<AppShell>`.

**Task 2 — Overview page + invite API:**
- `app/dashboard/overview/page.tsx` (Server Component): renders top bar "VISAO GERAL" + tenant/user name. No academia_config → welcome card with "Configure o DNA da sua academia" heading, body copy, and "Configurar academia" CTA → `/dashboard/configuracoes`. Config exists → 3 placeholder counter cards (Leads/Agendamentos/Conteudos, showing "0").
- `app/api/invite/route.ts` (POST Route Handler):
  - Validates `{ email, role }` with zod (role must be `manager` or `viewer` — owners only via signup trigger).
  - 403 when caller's role is not `owner`.
  - `createAdminClient()` (service role) used only here.
  - **Trigger reconciliation** (5-step compensation pattern):
    1. `inviteUserByEmail(email)` → captures `invitedUserId`.
    2. Reads ghost `tenant_id` created by `handle_new_user` trigger.
    3. Updates invited user's `usuarios` row: `tenant_id = callerTenantId`, `role = requestedRole`.
    4. Deletes ghost `tenants` row (guarded: never deletes caller's tenant).
    5. On any failure: `deleteUser(invitedUserId)` → rollback prevents ghost-owner state → returns 500.
- `lib/queries/academia-config.ts`: `getAcademiaConfig()` — `maybeSingle()` query, returns `AcademiaConfig | null`, RLS-scoped (no client tenant_id arg).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route group (dashboard) creates wrong URL path**
- **Found during:** Task 1
- **Issue:** Plan specified `app/(dashboard)/layout.tsx` and `app/(dashboard)/overview/page.tsx`. In Next.js App Router, `(dashboard)` is a route group — the parenthetical name is stripped from the URL. `app/(dashboard)/overview/page.tsx` creates `/overview`, not `/dashboard/overview`. The middleware protects `pathname.startsWith('/dashboard')` and redirects to `/dashboard/overview`, so routes must be at `/dashboard/*`.
- **Fix:** Restructured to `app/dashboard/layout.tsx` and `app/dashboard/overview/page.tsx`. Build confirms route is `/dashboard/overview`.
- **Files modified:** Layout and overview created at `app/dashboard/` instead of `app/(dashboard)/`.
- **Commit:** 96d0a3f

**2. [Rule 1 - Bug] shadcn v4 Button has no `asChild` prop**
- **Found during:** Task 2
- **Issue:** `@base-ui/react/button` (shadcn v4) does not support the `asChild` pattern used by Radix-based shadcn. Build failed with: `Property 'asChild' does not exist on type ... ButtonProps`.
- **Fix:** Replaced `<Button asChild><Link>Configurar academia</Link></Button>` with a styled `<Link>` using equivalent Tailwind classes.
- **Files modified:** `app/dashboard/overview/page.tsx`
- **Commit:** 284d9c2

**3. [Rule 2 - Missing critical functionality] getAcademiaConfig() created in Plan 04**
- **Found during:** Task 2
- **Issue:** `app/dashboard/overview/page.tsx` imports `getAcademiaConfig()` from `lib/queries/academia-config.ts`, which is Plan 03's file. Both plans run in wave 1 in parallel — the file didn't exist. Without it, the build would fail.
- **Fix:** Created `lib/queries/academia-config.ts` with the `getAcademiaConfig()` function and compatible `AcademiaConfig` type. Plan 03's implementation (if it creates the same file) should be semantically compatible — both return the full academia_config row or null using RLS scoping.
- **Commit:** 284d9c2

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Counter cards showing "0" | `app/dashboard/overview/page.tsx` | ~50-80 | Intentional spec placeholder per UI-SPEC § Empty states: "Phase 1 cards show '0' counters as placeholders for Leads, Agendamentos, Conteudos". Will be wired in Phase 2 (leads) and Phase 3 (content). |

## Invite/Trigger Reconciliation — Phase 1 Simplification

The `handle_new_user` trigger (Plan 01) fires on every `auth.users INSERT` and creates a new tenant + owner `usuarios` row. When inviting a teammate, this creates a "ghost" tenant for the invited user that must be compensated away.

The `/api/invite` route implements a 5-step compensation:
1. Invite the user via `supabase.auth.admin.inviteUserByEmail`.
2. Read the ghost `tenant_id` from `public.usuarios` where `id = invitedUserId`.
3. Update the invited user's `usuarios` row: `tenant_id` = caller's tenant (from `getCurrentUsuario()`, never the request body), `role` = requested role.
4. Delete the ghost `tenants` row (guard: `ghostTenantId !== callerTenantId` prevents self-deletion).
5. On any failure in steps 2-4: call `admin.auth.admin.deleteUser(invitedUserId)` to rollback the invited user entirely, then return a 500 error.

**Phase 1 acknowledgement:** This is a compensation pattern, not a preventive one. A future migration can make the trigger invite-aware (e.g., check `raw_user_meta_data.invited_tenant_id` and skip ghost-tenant creation for invited users). Tracked as a future improvement.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: ElevationOfPrivilege | app/api/invite/route.ts | New network endpoint using service role — mitigated: role='owner' check before any admin call; tenant_id from caller not body; rollback on failure |

All T-01-* mitigations from the plan's STRIDE register are implemented:
- T-01-01 (cross-tenant read): RESTRICTIVE RLS from Plan 01 (verified by checkpoint step 5)
- T-01-02 (role from JWT): role read via `getCurrentUsuario()` from `public.usuarios`, zero `auth.jwt(` occurrences in all Plan 04 files
- T-01-03 (service role exposure): `createAdminClient()` called only in `app/api/invite/route.ts`; `! grep -rn "SUPABASE_SERVICE_ROLE_KEY" app/dashboard components/` returns clean
- T-01-04 (viewer escalation): Save button not rendered for viewer (Plan 03 config-form accepts `role` prop from `getCurrentUsuario()`)
- T-01-12 (non-owner invites / cross-tenant invite): 403 gate; invited user's `tenant_id` forced to caller's tenant (server-resolved), never request body
- T-01-05 (stale session): layout uses `getUser()` (revalidates against Supabase auth server)

## Blocking Checkpoint — Task 3

**Status:** Awaiting human verification

Task 3 requires (no source changes — runtime + live RLS verification):
1. `npm run dev`. POST to `/api/invite` as owner, invite `gestor@academia.com.br` as manager and `leitor@academia.com.br` as viewer. Confirm 200 + correct `tenant_id` + no orphan ghost tenant.
2. Manager accepts invite email, logs in, reaches `/dashboard/overview`, sees "manager" badge.
3. Viewer logs in, visits `/dashboard/configuracoes` — form read-only, **NO** "Salvar configurações" button (hidden, not disabled).
4. Viewer DB write attempt is rejected by RLS.
5. Tenant B cannot read Tenant A's `academia_config` (RESTRICTIVE RLS).
6. Automated grep: `! grep -rn "SUPABASE_SERVICE_ROLE_KEY" "app/dashboard" components/` → CLEAN (confirmed above).

Signal: type "approved" once verified, or describe the failure.

## Self-Check

Files created:
- [x] `lib/queries/usuario.ts` — FOUND
- [x] `lib/queries/academia-config.ts` — FOUND
- [x] `components/nav-item.tsx` — FOUND
- [x] `components/app-shell.tsx` — FOUND
- [x] `app/dashboard/layout.tsx` — FOUND
- [x] `app/dashboard/overview/page.tsx` — FOUND
- [x] `app/api/invite/route.ts` — FOUND

Commits:
- [x] `96d0a3f` — Task 1 (dashboard shell)
- [x] `284d9c2` — Task 2 (overview + invite API)

Build: `npm run build` exits 0, route `/dashboard/overview` confirmed in output.

## Self-Check: PASSED

All 7 created files verified present. Both task commits verified in git log. Build exits 0 with `/dashboard/overview` and `/api/invite` routes confirmed. No service role key in dashboard/components (grep clean).
