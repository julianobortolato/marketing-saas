---
phase: 01-foundation
plan: "03"
subsystem: foundation
tags: [academia-config, server-action, react-hook-form, zod, tag-input, multi-tenant, rls, tenant-id]
dependency_graph:
  requires:
    - plan-01: supabase clients, migrations (academia_config table + fn_tenant_id RPC + RLS)
    - plan-01: lib/supabase/server.ts createClient()
    - plan-01: components/ui/button, input, label, card, textarea, radio-group
    - plan-01: react-hook-form@7.76.0, @hookform/resolvers@5.2.2, zod@3.25.76
  provides:
    - lib/validators/academia-config.ts: academiaConfigSchema + AcademiaConfigInput + AcademiaConfigFormValues
    - components/tag-input.tsx: chip input for diferenciais (max 10)
    - lib/queries/academia-config.ts: getAcademiaConfig() typed server query
    - lib/queries/usuario.ts: getCurrentUsuario() role from DB (Plan-04 contract)
    - app/(dashboard)/configuracoes/actions.ts: saveAcademiaConfig Server Action with fn_tenant_id()
    - app/(dashboard)/configuracoes/config-form.tsx: 4-section DNA form with role prop
    - app/(dashboard)/configuracoes/page.tsx: Server Component pre-filling form with saved values
  affects:
    - plan-04: getCurrentUsuario() contract defined here — Plan 04 can extend without breaking this
tech_stack:
  added: []
  patterns:
    - zodResolver with z.input<typeof schema> for form values (zod v3 .default() fields require input type)
    - Server Action resolves tenant_id via supabase.rpc('fn_tenant_id') before upsert — never from client payload
    - horarios/planos captured as textarea strings, stored as JSONB {text: value} wrapper (RESEARCH A5)
    - role prop pattern: Server Component reads role from DB, passes to Client Component; viewer = read-only + hidden save button
key_files:
  created:
    - lib/validators/academia-config.ts
    - components/tag-input.tsx
    - lib/queries/academia-config.ts
    - lib/queries/usuario.ts
    - app/(dashboard)/configuracoes/actions.ts
    - app/(dashboard)/configuracoes/config-form.tsx
    - app/(dashboard)/configuracoes/page.tsx
  modified:
    - lib/validators/academia-config.ts (added AcademiaConfigFormValues for zod v3 zodResolver compat)
decisions:
  - "AcademiaConfigFormValues (z.input<>) used for useForm<> type — zod v3 .default() creates optional input fields but required output fields; zodResolver expects the input type to avoid TS type mismatch"
  - "getCurrentUsuario() created in lib/queries/usuario.ts as Plan-04 contract stub — Plan 04 can extend this function without breaking page.tsx"
  - "role defaults to 'owner' in page.tsx when usuario is null — middleware already guards the route so this is a defensive fallback"
  - "console.error used (not console.log) for query errors per CLAUDE.md anti-patterns (no sensitive data logged)"
metrics:
  duration_minutes: 5
  completed_date: "2026-05-19"
  tasks_completed: 2
  tasks_total: 3
  files_created: 7
  files_modified: 1
---

# Phase 01 Plan 03: Academia DNA Form — Summary

**One-liner:** Academia DNA vertical slice: zod schema + TagInput chip component + typed DB query + Server Action upsert via fn_tenant_id() + 4-section react-hook-form client form with role-based save button visibility.

## What Was Built

Tasks 1-2 complete. Task 3 is a blocking checkpoint awaiting human verification (live DNA form save round-trip against running Supabase project).

**Task 1 — Shared DNA zod schema + TagInput + typed query:**
- `lib/validators/academia-config.ts`: `academiaConfigSchema` with required fields (nome_academia/bairro/cidade), raio_km coerced 1..50 default 5, tom_de_voz enum default 'neutro', diferenciais array max 10 default []. Two exported types: `AcademiaConfigInput` (z.infer — output type) and `AcademiaConfigFormValues` (z.input — form type).
- `components/tag-input.tsx`: `'use client'` chip input wrapping shadcn Input. Enter adds chip; × button removes; max 10 chips enforced (input disabled + placeholder text changes); empty/whitespace chips blocked. Chips render with `#F1F5F9` bg / `#0F172A` text per UI-SPEC.
- `lib/queries/academia-config.ts`: `getAcademiaConfig()` — async Server Component query using `createClient()` from `lib/supabase/server.ts`. Uses `.maybeSingle()` for clean null return. RLS scopes to current tenant (no client tenant_id passed per CLAUDE.md).

**Task 2 — Configuracoes page + form + Server Action:**
- `app/(dashboard)/configuracoes/actions.ts`: `'use server'`, zod `safeParse` server-side, `supabase.rpc('fn_tenant_id')` with explicit null guard (Pitfall 7 — no silent failures), horarios/planos wrapped as `{text: value}` JSONB, upsert `onConflict: 'tenant_id'`, `revalidatePath('/dashboard/configuracoes')` on success.
- `app/(dashboard)/configuracoes/config-form.tsx`: `'use client'`, react-hook-form + zodResolver, 4 sections per UI-SPEC (Identidade / Tom de voz / Diferenciais / Horários e Planos). onBlur validation, required asterisks in `#E30613`, RadioGroup cards with `#E30613` border + `#FFF5F5` tint on selection, inline green `#16A34A` success message disappearing after 3s, loading state with Loader2 + "Salvando...". `role` prop: save button absent from DOM (not disabled) when `role === 'viewer'`, all fields `readOnly`.
- `app/(dashboard)/configuracoes/page.tsx`: Server Component, `force-dynamic` for fresh data, parallel `getAcademiaConfig()` + `getCurrentUsuario()` fetch, JSONB text extraction for form pre-fill, passes role and initialValues to ConfigForm.
- `lib/queries/usuario.ts`: `getCurrentUsuario()` — reads from `public.usuarios` via `supabase.auth.getUser()` + DB query (role from DB, never JWT per CLAUDE.md). Plan-04 contract stub.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] zod v3 .default() fields cause zodResolver TypeScript mismatch**
- **Found during:** Task 2 — first `npm run build`
- **Issue:** `zod@3.25.76` with `.default()` fields creates a divergence between the input type (optional fields) and the output type (required fields after default applied). `zodResolver` expects the input type in `useForm<T>`, but `z.infer<typeof schema>` gives the output type — causing "Type 'undefined' is not assignable to type 'number'" on raio_km and similar.
- **Fix:** Added `AcademiaConfigFormValues = z.input<typeof academiaConfigSchema>` to the validators file. Changed `useForm<>` to use `AcademiaConfigFormValues` (input type). Server Action still accepts `unknown` and runs `safeParse` server-side against the full schema — correctness unaffected.
- **Files modified:** `lib/validators/academia-config.ts` (added AcademiaConfigFormValues), `app/(dashboard)/configuracoes/config-form.tsx` (changed useForm type)
- **Commits:** `29282dc` (initial), `22a2abd` (fix applied in Task 2 commit)

**2. [Rule 2 - Missing critical functionality] getCurrentUsuario() needed by page.tsx but Plan-04 deliverable**
- **Found during:** Task 2 — page.tsx requires getCurrentUsuario() to resolve role
- **Issue:** Plan-04 is supposed to produce `lib/queries/usuario.ts`, but this plan's page.tsx already depends on the contract. Without it, the build would fail.
- **Fix:** Created `lib/queries/usuario.ts` with `getCurrentUsuario()` implementing the Plan-04 contract signature (`{ id, tenant_id, role, nome } | null`). Plan-04 can extend this function without breaking the existing contract.
- **Files modified:** `lib/queries/usuario.ts` (new file)
- **Commit:** `22a2abd`

## Blocking Checkpoint — Task 3

**Status:** Awaiting human verification — live DNA form save round-trip

Task 3 requires:
1. `npm run dev` — navigate to `/dashboard/configuracoes` as owner
2. Verify defaults: raio_km=5, Neutro radio pre-selected
3. Fill required fields, add 2-3 diferenciais, verify 11th chip is blocked, fill horarios/planos
4. Submit — confirm inline green "Configurações salvas com sucesso." appears (not toast)
5. Hard-refresh — confirm all values still showing (round-trip persistence)
6. In Supabase SQL Editor: confirm academia_config has one row with non-null tenant_id and horarios/planos as JSON `{"text": ...}`

Signal: type "approved" once verified.

## Known Stubs

None — all fields are wired to real DB persistence. The `getCurrentUsuario()` in `lib/queries/usuario.ts` is a working implementation (not a stub), though Plan-04 may extend it.

## Threat Flags

No new threat surface beyond the plan's threat model. All T-01-* mitigations verified in code:
- T-01-09 (tenant_id tampering): `saveAcademiaConfig` calls `supabase.rpc('fn_tenant_id')` before upsert; tenant_id in payload comes exclusively from this RPC call, never the client form data
- T-01-01 (cross-tenant read): `getAcademiaConfig()` relies on RLS RESTRICTIVE policy (Plan 01 migration 0004); no tenant_id is passed from app code
- T-01-10 (form input tampering): `academiaConfigSchema.safeParse(formData)` runs server-side in the action before any DB operation
- T-01-11 (silent NULL tenant_id): explicit null guard returns informative error — never a silent partial write

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `29282dc` | feat(01-03): add DNA zod schema, TagInput chip component, and typed config query |
| Task 2 | `22a2abd` | feat(01-03): add configuracoes page, DNA form, upsert Server Action, and usuario query |

## Self-Check: PASSED

All created files verified present. Both task commits verified in git log. `npm run build` exits 0. Key invariants:
- `grep -q "academiaConfigSchema" lib/validators/academia-config.ts` → PASS
- `grep -q "getAcademiaConfig" lib/queries/academia-config.ts` → PASS
- `grep -Eq "max\(10\)|10" components/tag-input.tsx` → PASS
- `grep -q "'use server'" "app/(dashboard)/configuracoes/actions.ts"` → PASS
- `grep -q "fn_tenant_id" "app/(dashboard)/configuracoes/actions.ts"` → PASS
- `grep -q "onConflict" "app/(dashboard)/configuracoes/actions.ts"` → PASS
- `grep -q "Configurações salvas com sucesso" "app/(dashboard)/configuracoes/config-form.tsx"` → PASS
- `grep -q "zodResolver" "app/(dashboard)/configuracoes/config-form.tsx"` → PASS
