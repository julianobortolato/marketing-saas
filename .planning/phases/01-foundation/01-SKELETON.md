# Walking Skeleton — marketing-saas

**Phase:** 1
**Generated:** 2026-05-19

> Architectural backbone for every later vertical slice. Treat this as a contract:
> Phases 2-6 add capabilities on top of these decisions without renegotiating them.
> Produced alongside 01-PLAN-01.md; the skeleton is realized when Plan 01 (Wave 0)
> completes and the first slice (Plans 02-04, Wave 1) proves it end to end.

## Capability Proven End-to-End

A gym owner can sign up with email + password; the signup atomically creates an
isolated tenant (slug + plan + billing fields) via a database trigger; the owner stays
logged in across browser reloads, fills the academia DNA form, sees it persisted, and
the system enforces tenant isolation and role-based access by default.

(Thinnest stack proof: scaffold → routing → real DB write via the `handle_new_user`
trigger on signup → real DB read on dashboard → interactive DNA form wired to a Server
Action → running on Vercel/local dev with `next build` green.)

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14.2.35 App Router, TypeScript strict, no `src/` dir | Locked by PRD/CLAUDE.md/ARCHITECTURE.md; `app/` at repo root per ARCHITECTURE folder layout |
| UI system | Tailwind v3 + shadcn/ui (Default style, Zinc base) overridden with Fitness UNIC brand HSL tokens; Inter via next/font/google | shadcn requires Tailwind v3 (v4 incompatible); brand `--primary: 354 95% 46%` (#E30613) per 01-UI-SPEC.md |
| Data layer | Supabase hosted PostgreSQL, migrations in `supabase/migrations/`, applied via `supabase db push` | ADR-001 (single schema + RLS); no Docker available so hosted project (RESEARCH Env Availability) |
| Multi-tenancy | `tenant_id NOT NULL` on every table + dual RLS (PERMISSIVE capability + RESTRICTIVE isolation); `fn_tenant_id()`/`fn_usuario_role()` SECURITY DEFINER reading from `usuarios`, never JWT | CLAUDE.md inegociável; ADR-001; RESEARCH Pattern 4 + Anti-Patterns |
| Tenant provisioning | `handle_new_user` AFTER INSERT trigger on `auth.users` creates `tenants` + `usuarios(role=owner)` atomically; slug from email prefix with collision retry | RESEARCH Pattern 3; only approach guaranteeing tenant exists before app code runs |
| Auth | Supabase Auth (email/password, server-side bcrypt); `@supabase/ssr` cookie sessions; middleware refreshes via `supabase.auth.getUser()` (never `getSession()`) | RESEARCH Pattern 2 + Pitfall 2; official Supabase guidance |
| Supabase client split | Three files: `client.ts` (browser), `server.ts` (Server Components/Actions, anon key), `admin.ts` (service role, `import 'server-only'`, API routes only) | RESEARCH Pattern 1 + Pitfall 4; prevents service-key exposure & cookie-write errors |
| Form stack | react-hook-form@7.76.0 + @hookform/resolvers@5.2.2 + zod@3.25.76 (pinned — v4 breaks zodResolver) | RESEARCH Pitfall 6; UI-SPEC requires onBlur field-level validation |
| Routing model | Route groups: `(auth)` public (/login,/signup), `(dashboard)` protected (/overview,/configuracoes) + AppShell layout; `/api/*` route handlers | ARCHITECTURE folder layout + 01-UI-SPEC.md screen inventory |
| Deployment target | Vercel (PRD); Phase 1 gate = `next build` green locally + manual smoke of the 4 success criteria | PRD stack; RESEARCH/VALIDATION (no Jest in Phase 1 — no pure business logic to unit test) |
| Directory layout | `app/` (route groups + api), `components/` (+ `components/ui/` shadcn), `lib/supabase|queries|validators`, `supabase/migrations`, `middleware.ts` at root | ARCHITECTURE.md § Estrutura de pastas + RESEARCH § Recommended Project Structure |

## Stack Touched in Phase 1

- [x] Project scaffold — `create-next-app@14`, Tailwind v3, ESLint, shadcn init, pinned deps (Plan 01 Task 1)
- [x] Routing — `(auth)`, `(dashboard)` route groups + `/api/invite`; middleware route protection (Plans 01, 02, 03, 04)
- [x] Database — real WRITE on signup (handle_new_user trigger creates tenant+usuario) + DNA upsert; real READ on dashboard (academia_config, usuario role) (Plans 01, 03, 04)
- [x] UI wired to API — DNA form (Client) → Server Action `saveAcademiaConfig` → academia_config (Plan 03); auth screens → Supabase Auth (Plan 02)
- [x] Deployment — `next build` green required before every push (CLAUDE.md); local `npm run dev` exercises the full stack against the hosted Supabase project

## Out of Scope (Deferred to Later Slices)

Explicit — prevents later phases from re-litigating Phase 1 minimalism:

- Password reset / "Esqueceu sua senha?" behavior (link shown per UI-SPEC, no action in Phase 1)
- Custom invite email branding (Supabase default invite email is used — RESEARCH Open Question 2)
- Structured (object) horarios/planos — stored as `{ "text": "<textarea>" }` JSONB wrapper in Phase 1 (RESEARCH Assumption A5)
- `fundador` auto-assignment for first 10 tenants (defaults `false`; manual migration later — RESEARCH Open Question 1)
- Invite-aware `handle_new_user` trigger (Phase 1 reconciles invited users post-invite via admin client; future migration may use `raw_user_meta_data`)
- Lead pipeline, WhatsApp agent, content generation, campaigns, competitive intelligence (Phases 2-6)
- Jest/unit-test harness (no pure business logic in Phase 1; `next build` + manual smoke are the gates)
- IARA Systems bridge logic (`iara_tenant_id` column exists, no logic — REQUIREMENTS Out of Scope)
- Billing UI / real pricing (`fn_calcular_mensalidade` callable with placeholder pricing — RESEARCH Assumption A4)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its
architectural decisions (multi-tenant RLS, three Supabase clients, route groups, auth model):

- Phase 2: Webhook lead ingestion + filterable lead panel + manual lead entry + weekly batch / per-campaign approval queue (`leads`, `aprovacoes` tables, same RLS pattern)
- Phase 3: WhatsApp agent (Evolution API) — < 5 min auto-response, AE scheduling, human handoff; only for tenants with `iara_tenant_id IS NULL`
- Phase 4: Video upload + AI content generation from academia DNA + preview/approve + Instagram publish (depends on this foundation, not Phase 2)
- Phase 5: AI campaign creatives + per-creative approval + metrics panel
- Phase 6: Meta Ad Library competitor monitoring + AI offer-gap analysis (consumes academia DNA from this phase)
