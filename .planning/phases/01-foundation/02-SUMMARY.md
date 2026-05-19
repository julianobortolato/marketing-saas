---
phase: 01-foundation
plan: "02"
subsystem: auth-ui
tags: [auth, supabase, react-hook-form, zod, signup, login, password-input, ui]
dependency_graph:
  requires:
    - "01-01: Next.js scaffold, three Supabase clients, brand tokens, shadcn components"
  provides:
    - /signup screen wired to supabase.auth.signUp
    - /login screen wired to supabase.auth.signInWithPassword
    - Shared auth zod schemas (loginSchema, signupSchema) with PT-BR error messages
    - PasswordInput component with Eye/EyeOff toggle and ARIA labels
  affects:
    - FOUND-01 (auth vertical slice complete — screens built; session persistence awaits human checkpoint)
tech_stack:
  added: []
  patterns:
    - react-hook-form + zodResolver(signupSchema|loginSchema) with onBlur validation
    - createClient() called inside submit handler (not at module level) to avoid SSR/prerender error
    - Generic inline error message for auth failures (no field-specific leak — T-01-06 mitigation)
    - Loader2 + gerund copy loading state pattern (CTA disabled during async call)
key_files:
  created:
    - lib/validators/auth.ts
    - components/password-input.tsx
    - app/(auth)/signup/page.tsx
    - app/(auth)/login/page.tsx
  modified: []
decisions:
  - "createClient() moved inside onSubmit handler (not at component top level) to prevent SSR/prerender crash — Next.js tries to statically render pages at build time; createBrowserClient() fails without NEXT_PUBLIC_ vars present"
  - "'Esqueceu sua senha?' link rendered as href='#' with no action per plan spec (Phase 1 scope excludes password reset); not labeled placeholder/v2 in code per plan instructions"
  - "isButtonDisabled uses isDirty && isValid combo so button enables only after user touches a field — prevents premature submission"
metrics:
  duration_minutes: 5
  completed_date: "2026-05-19"
  tasks_completed: 2
  tasks_total: 3
  files_created: 4
  files_modified: 0
---

# Phase 01 Plan 02: Auth Screens — Summary

**One-liner:** /signup and /login pages built with react-hook-form + zod, Supabase Auth browser client, PasswordInput with Eye/EyeOff toggle, and brand-accurate UI matching 01-UI-SPEC.md contracts.

## What Was Built

**Task 1 — Shared auth validation + PasswordInput:**
- `lib/validators/auth.ts`: `loginSchema` (email + non-empty password) and `signupSchema` (email + min 8 char password) with exact Portuguese error strings from UI-SPEC Copywriting Contract
- `LoginInput` and `SignupInput` TypeScript inferred types exported
- `components/password-input.tsx`: `'use client'` component wrapping a native `<input>` with identical styling classes as shadcn Input; manages `visible` boolean state; toggles `type` between `password`/`text` and icon between `Eye`/`EyeOff`; `aria-label="Mostrar senha"` / `"Ocultar senha"` on toggle button; `forwardRef` + spread props for react-hook-form register compatibility

**Task 2 — /signup and /login screens:**
- `app/(auth)/signup/page.tsx`: `'use client'`; react-hook-form with `zodResolver(signupSchema)`, `mode: 'onBlur'`; centered 400px Card on `#F8FAFC` background; logo wordmark, display heading "Seu CMO autônomo começa aqui", subheading, email Input, PasswordInput, primary CTA "Criar conta" (`bg-primary` = `#E30613`), Separator + cross-link to /login; on `signUp` success → `router.push('/dashboard/configuracoes')`; on error → inline generic message
- `app/(auth)/login/page.tsx`: `'use client'`; `zodResolver(loginSchema)`; heading "Bem-vindo de volta" (uppercase bold); email, password with "Esqueceu sua senha?" link; CTA "Entrar na conta"; on `signInWithPassword` success → `router.push('/dashboard/overview')`; on error → inline "E-mail ou senha incorretos. Verifique e tente novamente." (generic, no field specifics — T-01-06 mitigation)
- Both pages: `Loader2 animate-spin` + gerund copy ("Criando conta..." / "Entrando...") + disabled CTA during async call; `aria-describedby` + `aria-invalid` on inputs for accessibility

**Task 3 — Checkpoint:** Awaiting human verification (runtime smoke test: signup creates tenant+usuario, session persists on reload, wrong-password shows inline error).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] createClient() must be lazy-called inside submit handler**
- **Found during:** Task 2, npm run build
- **Issue:** `createClient()` at the component function body level causes Next.js static generation to fail at build time — `createBrowserClient()` validates env vars immediately and throws `Your project's URL and API key are required` when `NEXT_PUBLIC_SUPABASE_URL` is not set in CI/build environment
- **Fix:** Moved `const supabase = createClient()` inside the `onSubmit` async handler where it is only called in the browser during user interaction, never during SSR/prerender
- **Files modified:** `app/(auth)/signup/page.tsx`, `app/(auth)/login/page.tsx`
- **Commit:** 5f07732

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `87ec96b` | feat(01-02): add auth zod schemas and PasswordInput component |
| Task 2 | `5f07732` | feat(01-02): add /signup and /login screens wired to Supabase Auth |

## Blocking Checkpoint — Task 3

**Status:** Awaiting human verification — runtime smoke test required

Task 3 requires:
1. `npm run dev`, open `/signup`
2. Sign up with a fresh email (e.g. `dono+1@academia.com.br`) and an 8+ char password. Expect redirect to `/dashboard/configuracoes`
3. In Supabase SQL Editor: `SELECT * FROM public.tenants; SELECT * FROM public.usuarios;` — confirm the signup created a new tenant + owner usuario (proves Plan 01 trigger fired from a real signup)
4. Hard-refresh the browser (Cmd+Shift+R) — confirm you stay logged in (session persistence — FOUND-01 requirement; depends on HttpOnly cookie, cannot be asserted by build)
5. Open `/login` while still logged in — confirm redirect to `/dashboard/overview` (Plan 01 middleware)
6. In a private window, go to `/login`, enter wrong password — confirm inline error "E-mail ou senha incorretos. Verifique e tente novamente." appears (no toast, no field-specific leak)

Signal: type "approved" once verified, or describe failure.

## Known Stubs

- `app/(auth)/login/page.tsx` line ~62: `href="#"` on "Esqueceu sua senha?" link — per plan spec: "render it as a static link with no action; do NOT label it a placeholder/v2 in code". Password reset is out of Phase 1 scope. The link is intentionally inert.

## Threat Flags

No new threat surface beyond plan's threat model. All T-01-06..08 mitigations confirmed:
- T-01-06 (Information Disclosure): generic error "E-mail ou senha incorretos..." — implemented in both pages
- T-01-07 (Spoofing): `supabase.auth.signInWithPassword` used — Supabase bcrypt server-side
- T-01-08 (Tampering): `zodResolver(loginSchema|signupSchema)` validates all form inputs

## Self-Check: PASSED

Files verified present:
- lib/validators/auth.ts: EXISTS
- components/password-input.tsx: EXISTS
- app/(auth)/signup/page.tsx: EXISTS
- app/(auth)/login/page.tsx: EXISTS

Commits verified:
- 87ec96b: EXISTS
- 5f07732: EXISTS

`npm run build` exits 0 — /login and /signup prerendered as static content (7/7 pages OK).
