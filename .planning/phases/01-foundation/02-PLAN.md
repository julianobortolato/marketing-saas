---
phase: 01-foundation
plan: 02
type: execute
wave: 1
depends_on: ["01"]
files_modified:
  - app/(auth)/signup/page.tsx
  - app/(auth)/login/page.tsx
  - components/password-input.tsx
  - lib/validators/auth.ts
autonomous: false
requirements: [FOUND-01]

must_haves:
  truths:
    - "A new owner can submit email + password on /signup and is redirected into the dashboard"
    - "After signup, refreshing the browser keeps the user logged in (session persists)"
    - "An existing user can sign in at /login with email + password"
    - "Wrong credentials show the inline error 'E-mail ou senha incorretos. Verifique e tente novamente.'"
    - "A logged-in user visiting /login or /signup is redirected to /dashboard/overview"
  artifacts:
    - path: "app/(auth)/signup/page.tsx"
      provides: "Signup screen with email/password, react-hook-form + zodResolver"
      contains: "signUp"
    - path: "app/(auth)/login/page.tsx"
      provides: "Login screen with email/password"
      contains: "signInWithPassword"
    - path: "components/password-input.tsx"
      provides: "Password field with Eye/EyeOff visibility toggle"
      contains: "EyeOff"
    - path: "lib/validators/auth.ts"
      provides: "Shared zod schema for auth forms"
      contains: "z.object"
  key_links:
    - from: "app/(auth)/signup/page.tsx"
      to: "supabase.auth.signUp"
      via: "browser client createClient()"
      pattern: "auth\\.signUp"
    - from: "app/(auth)/login/page.tsx"
      to: "supabase.auth.signInWithPassword"
      via: "browser client createClient()"
      pattern: "signInWithPassword"
    - from: "lib/validators/auth.ts"
      to: "@hookform/resolvers/zod"
      via: "zodResolver in both pages"
      pattern: "zodResolver"
---

<objective>
Deliver the authentication vertical slice: the /signup and /login screens, wired to Supabase Auth via the browser client, with inline zod validation and the password visibility toggle. This completes FOUND-01 — an owner can create an account, stay logged in across reloads, and sign back in.

Purpose: This is the front door. Plan 01 built the schema + trigger; signing up here fires that trigger and creates the tenant. Without these screens no tenant ever gets created.

Output: Two working auth screens matching the UI-SPEC contract, shared validation, and session persistence proven by reload.
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
<!-- From Plan 01 (01-SUMMARY.md). Use directly — do not re-derive. -->

lib/supabase/client.ts:
  function createClient(): SupabaseClient   // 'use client' only

Routing contract (enforced by middleware.ts from Plan 01):
  Logged-in + /login or /signup    -> middleware already redirects to /dashboard/overview
  Successful signup (new tenant)   -> client navigates to /dashboard/configuracoes (first-run flow)
  Successful login                 -> client navigates to /dashboard/overview

Supabase Auth calls (from @supabase/supabase-js via browser client):
  supabase.auth.signUp({ email, password })            -> fires handle_new_user trigger (Plan 01 migration 0005)
  supabase.auth.signInWithPassword({ email, password })

Brand tokens already in app/globals.css (Plan 01 Task 1): use shadcn `Button` (primary = #E30613), `Input`, `Label`, `Card`, `Separator`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared auth zod schema + PasswordInput component</name>
  <files>lib/validators/auth.ts, components/password-input.tsx</files>
  <read_first>
    - .planning/phases/01-foundation/01-RESEARCH.md (§ Pitfall 6 — zod v3 pin is why zodResolver works; § Code Examples — zod schema shape)
    - .planning/phases/01-foundation/01-UI-SPEC.md (§ Copywriting Contract — exact error strings; § Component Inventory — PasswordInput is custom; § Accessibility Minimums — aria-label on toggle)
    - CLAUDE.md (§ Código — TypeScript strict, no any without justification)
  </read_first>
  <behavior>
    - `loginSchema` accepts `{ email: valid email, password: non-empty }`; invalid email fails with message "Informe um e-mail válido."
    - `signupSchema` requires password length >= 8 with message "A senha deve ter pelo menos 8 caracteres."; empty required field message "Campo obrigatório."
    - `PasswordInput` renders a shadcn Input type=password; clicking the toggle button flips type to text and swaps the lucide Eye/EyeOff icon
    - Toggle button exposes `aria-label="Mostrar senha"` when hidden and `"Ocultar senha"` when visible
  </behavior>
  <action>
Create `lib/validators/auth.ts` exporting `loginSchema` and `signupSchema` as zod objects with the exact Portuguese error messages from 01-UI-SPEC.md § Copywriting Contract. Export inferred types (`LoginInput`, `SignupInput`). TypeScript strict — no `any`.

Create `components/password-input.tsx` (`'use client'`): wraps shadcn `Input`, manages a `visible` boolean state, renders a trailing icon button toggling between lucide `Eye` / `EyeOff` and `type` between `password` / `text`. Button has the aria-labels above and is keyboard-focusable. Forward `ref` and spread `react-hook-form` register props so it integrates with `zodResolver`.
  </action>
  <verify>
    <automated>grep -q "A senha deve ter pelo menos 8 caracteres" lib/validators/auth.ts && grep -q "Mostrar senha" components/password-input.tsx && grep -q "EyeOff" components/password-input.tsx && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `lib/validators/auth.ts` exports `loginSchema` + `signupSchema` with exact UI-SPEC error strings
    - `components/password-input.tsx` toggles type and icon, has both aria-label values
    - No `any` without an inline justification comment
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Shared validation + accessible password toggle ready for both auth screens.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: /signup and /login screens wired to Supabase Auth</name>
  <files>app/(auth)/signup/page.tsx, app/(auth)/login/page.tsx</files>
  <read_first>
    - .planning/phases/01-foundation/01-UI-SPEC.md (§ Screen Inventory /signup and /login — element order, copy, layout 400px centered card; § Interaction Contracts — onBlur validation, loading states; § Color — accent reserved for CTA only)
    - .planning/phases/01-foundation/01-RESEARCH.md (§ Architecture Diagram — public route group, browser client signUp/signInWithPassword, router.push targets)
    - lib/validators/auth.ts and components/password-input.tsx (from Task 1)
  </read_first>
  <behavior>
    - Submitting /signup with a valid email + 8+ char password calls `supabase.auth.signUp` then navigates to `/dashboard/configuracoes`
    - Submitting /login with valid credentials calls `signInWithPassword` then navigates to `/dashboard/overview`
    - A failed login renders inline (not toast) the text "E-mail ou senha incorretos. Verifique e tente novamente."
    - During the async call the CTA shows the spinner + progressive copy ("Criando conta..." / "Entrando...") and is disabled
    - Validation fires on blur; submit button disabled until required fields non-empty
  </behavior>
  <action>
Create the `(auth)` route group with `app/(auth)/signup/page.tsx` and `app/(auth)/login/page.tsx`, both `'use client'` Client Components using `react-hook-form` + `zodResolver(signupSchema|loginSchema)` from Task 1 and `createClient()` from `lib/supabase/client.ts` (browser client per Plan 01 interface).

Build the screens to match 01-UI-SPEC.md § Screen Inventory exactly: centered 400px Card, logo wordmark, display/heading copy, email Input, `PasswordInput`, full-width primary Button (the only accent #E30613 element), Separator divider with cross-link. Use the exact copy strings from § Copywriting Contract (CTA labels, loading gerunds, error messages, headings).

Signup: on `auth.signUp` success `router.push('/dashboard/configuracoes')` (first-run flow per UI-SPEC § Auth redirect rules). Login: on `signInWithPassword` success `router.push('/dashboard/overview')`. On auth error, set a form-level error rendering the security-neutral message inline below the form (never reveal which field is wrong — UI-SPEC copywriting note). Loading state: disable CTA, swap to gerund copy + lucide `Loader2 animate-spin`.

Do not implement "Esqueceu sua senha?" behavior (the link is shown per spec but password reset is out of Phase 1 scope) — render it as a static link with no action; do NOT label it a placeholder/v2 in code.

The logged-in -> redirect-away rule is already enforced by Plan 01 middleware; do not re-implement it here.
  </action>
  <verify>
    <automated>grep -q "auth.signUp" "app/(auth)/signup/page.tsx" && grep -q "signInWithPassword" "app/(auth)/login/page.tsx" && grep -q "E-mail ou senha incorretos" "app/(auth)/login/page.tsx" && grep -q "/dashboard/configuracoes" "app/(auth)/signup/page.tsx" && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - /signup calls `auth.signUp` and on success pushes `/dashboard/configuracoes`
    - /login calls `signInWithPassword` and on success pushes `/dashboard/overview`
    - Failed login shows the exact inline error string from UI-SPEC (not a toast)
    - CTAs use brand primary; loading state shows Loader2 + gerund copy + disabled
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Owner can create an account and sign in through brand-accurate screens wired to Supabase Auth.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify signup -> tenant creation -> session persists on reload (FOUND-01)</name>
  <what-built>Tasks 1-2 built the /signup and /login screens wired to Supabase Auth. This verifies the end-to-end FOUND-01 behavior including the cookie-based session persistence that cannot be asserted by a build.</what-built>
  <how-to-verify>
1. `npm run dev`, open `/signup`.
2. Sign up with a fresh email (e.g. `dono+1@academia.com.br`) and an 8+ char password. Expect redirect to `/dashboard/configuracoes`.
3. In Supabase SQL Editor: `SELECT * FROM public.tenants; SELECT * FROM public.usuarios;` — confirm the signup created a new tenant + owner usuario (proves the Plan 01 trigger fired from a real signup).
4. Hard-refresh the browser (Cmd+Shift+R) — confirm you stay logged in (still on a /dashboard route, not bounced to /login). This is the FOUND-01 session-persistence requirement (manual per VALIDATION § Manual-Only Verifications — depends on HttpOnly cookie).
5. Open a new tab to `/login`, sign out is not required — confirm visiting `/login` while logged in redirects to `/dashboard/overview` (Plan 01 middleware).
6. Sign out (or use a private window), go to `/login`, enter wrong password — confirm the inline error "E-mail ou senha incorretos. Verifique e tente novamente." appears (no toast, no field-specific leak).
  </how-to-verify>
  <files>(no source changes — runtime verification of Tasks 1-2 output)</files>
  <action>Run the dev server and follow the how-to-verify steps to confirm signup creates a tenant+usuario via the live trigger, the session persists across a real browser reload, and wrong-password shows the inline error. Verification only; no source modification.</action>
  <verify>
    <automated>MISSING — session-cookie persistence across a real browser reload and the live trigger firing from a UI signup require a running app + browser + Supabase project; verified by the human steps above (consistent with 01-VALIDATION.md Manual-Only Verifications)</automated>
  </verify>
  <done>Real signup created a tenant+usuario, browser reload kept the user logged in, and a failed login rendered the exact inline UI-SPEC error.</done>
  <resume-signal>Type "approved" once signup created a tenant+usuario, reload kept you logged in, and wrong-password showed the inline error; otherwise describe the failure.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser form -> Supabase Auth | User-supplied credentials; Supabase performs server-side bcrypt; no custom auth code |
| Auth error -> rendered message | Error detail must not reveal which field was wrong (account enumeration) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-06 | Information Disclosure | Login error message | mitigate | Single generic message "E-mail ou senha incorretos..." — never field-specific (UI-SPEC copywriting rule) |
| T-01-07 | Spoofing | Credential submission | accept (mitigated upstream) | Supabase Auth handles password hashing/rate limiting server-side; no hand-rolled auth (RESEARCH § Don't Hand-Roll) |
| T-01-08 | Tampering | Client-side form input | mitigate | zod schema validation (zod@3.25.76 pinned in Plan 01); Supabase enforces server-side too |
| T-01-SC | Tampering | npm installs | accept | No new packages installed in this plan (all from Plan 01 Approved set) |
</threat_model>

<verification>
- `npm run build` green
- /signup calls auth.signUp, pushes /dashboard/configuracoes; /login calls signInWithPassword, pushes /dashboard/overview
- Failed login renders the exact inline UI-SPEC error
- [BLOCKING] checkpoint: real signup creates tenant+usuario; browser reload keeps session
</verification>

<success_criteria>
- FOUND-01: owner can sign up with email/password, stays logged in across reloads, and can sign back in (Success Criterion 1)
- Auth screens match 01-UI-SPEC.md copy, color, and interaction contracts
</success_criteria>

<output>
Create `.planning/phases/01-foundation/02-SUMMARY.md` when done.
</output>
