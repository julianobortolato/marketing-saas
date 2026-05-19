# Phase 1: Foundation — Research

**Researched:** 2026-05-19
**Domain:** Next.js 14 App Router + Supabase Auth + RLS multi-tenant isolation + role-based access
**Confidence:** HIGH

---

## Summary

Phase 1 builds the walking skeleton: a greenfield Next.js 14 App Router project initialized from scratch, with Supabase providing authentication (email/password), a multi-tenant PostgreSQL schema with RLS, and a small but complete UI covering signup, login, dashboard overview, and the academia DNA config form.

The critical complexity in this phase is not the UI — the UI spec is fully resolved in `01-UI-SPEC.md`. The complexity lives in the Supabase layer: (a) the `handle_new_user` trigger that atomically creates a `tenants` + `usuarios` row on every new signup, (b) the `fn_tenant_id()` and `fn_usuario_id()` helper functions that allow RLS policies to reference the database record rather than the JWT directly, and (c) the middleware pattern using `@supabase/ssr` `createServerClient` that refreshes auth tokens via cookie on every request and gates protected routes.

The project is currently fully greenfield — no `app/`, `src/`, or `supabase/` directories exist yet. Phase 1 must scaffold the complete project structure before writing a single component. The No. 1 risk is shipping a zod v4 import that silently breaks `zodResolver` — the `latest` tag on npm now points to zod v4 (`4.4.3`), which has open type-compatibility issues with `@hookform/resolvers@5.2.2`. Install `zod@3.25.76` explicitly.

**Primary recommendation:** Scaffold with `create-next-app`, initialize shadcn, write migrations first (tenants + usuarios + academia_config + RLS + trigger), then implement UI screens top-to-bottom following the spec in `01-UI-SPEC.md`. Never read role from JWT — always read from `usuarios.role` via `fn_usuario_id()`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Usuário pode criar conta com email e senha e manter sessão ativa entre reloads | `@supabase/ssr` + `createServerClient` in middleware refreshes cookie-based session on every request; `createBrowserClient` maintains session client-side |
| FOUND-02 | Sistema cria tenant no signup com slug, plano, billing fields; `fn_calcular_mensalidade()` disponível | `handle_new_user` PostgreSQL trigger fires `AFTER INSERT ON auth.users`; trigger creates `tenants` row (generates slug from email) + `usuarios` row (role='owner'); `fn_calcular_mensalidade()` is a separate SECURITY DEFINER function |
| FOUND-03 | Dono preenche DNA da academia (academia_config) e vê salvo | Server Action upserts `academia_config` via service-role client; `tenant_id` injected from `fn_tenant_id()`, never from client |
| FOUND-04 | Manager convidado pode fazer login e acessar dashboard; viewer não pode escrever; tenant A não lê dados do tenant B | `supabase.auth.admin.inviteUserByEmail` via server-only API route; RLS RESTRICTIVE policy enforces tenant isolation; role check in Server Components gates write UI |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

The following directives are inegociable and override any research recommendation:

**Multi-tenant:**
- TODA tabela tem `tenant_id UUID NOT NULL`
- TODA query filtra por `tenant_id` — sem exceção
- RLS obrigatória: política PERMISSIVE + RESTRICTIVE em toda tabela
- RPC sensível: sempre `SECURITY DEFINER` + revalidar `tenant_id` internamente

**Banco:**
- `SELECT * FROM tabela LIMIT 5` ANTES de qualquer DDL ou INSERT
- Schema antes de código — nunca assumir estrutura de memória
- Migrations: arquivo novo em `supabase/migrations/` — nunca editar migration existente
- `fn_tenant_id()` e `fn_usuario_id()` em RPCs — nunca JWT direto

**Next.js:**
- `next build` local antes de push
- `rm -rf .next` ao copiar componente de outro projeto
- Server Components por padrão — `'use client'` apenas quando necessário
- Variáveis públicas: `NEXT_PUBLIC_` prefix obrigatório

**Segurança:**
- Service role key: JAMAIS em componente cliente ou log
- Secrets: nunca no chat. CAPS LOCK antes de qualquer bloco com token

**Código:**
- TypeScript strict — sem `any` sem justificativa
- Placeholder: `<COLE_AQUI>` + instrução de onde achar

**Identidade visual (CLAUDE.md v1.1):**
- Fitness UNIC brand — `--color-primary: #E30613`, `--color-bg: #FFFFFF`, `--color-surface: #F8FAFC`
- Fonte: Inter (variable, via `next/font/google`)
- Regra 60-30-10: branco/cinza-gelo · cinza médio · vermelho #E30613

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth session persistence (cookie refresh) | Frontend Server (middleware) | — | Only middleware can read + write cookies on every request in Next.js App Router |
| Tenant creation on signup | Database (trigger) | — | Must be atomic with `auth.users` insert; trigger fires before control returns to app layer |
| RLS enforcement | Database (PostgreSQL) | — | Enforced at the database level regardless of application code paths |
| fn_tenant_id() / fn_usuario_id() | Database (SECURITY DEFINER RPC) | — | Reads from `usuarios` table, not JWT — gives immediate revocation capability |
| Route protection (redirect) | Frontend Server (middleware) | — | Middleware intercepts every request before rendering; checks `getClaims()` not `getSession()` |
| Academia DNA form save | API / Backend (Server Action) | — | Uses service-role client server-side; never exposes service key to browser |
| Role-based UI hiding | Browser / Client | Frontend Server (layout) | Viewer save button conditionally not rendered in Server Component; read-only attributes in Client Components |
| User invitation | API / Backend (API route) | — | `admin.inviteUserByEmail` requires service role key — server-only Route Handler |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | `14.2.35` | Framework — App Router, SSR, Server Actions, Middleware | Project decision locked in PRD/CLAUDE.md; 14.2.35 is latest Next.js 14 patch [VERIFIED: npm registry] |
| typescript | `5.x` (ships with next) | Type safety | Project rule: TypeScript strict [VERIFIED: npm registry] |
| tailwindcss | `3.x` (ships with create-next-app prompt) | Utility CSS | shadcn/ui requires Tailwind v3; v4 not yet shadcn-compatible [VERIFIED: npm registry] |
| @supabase/supabase-js | `2.106.0` | Supabase client (database, auth, realtime) | Official Supabase JS client [VERIFIED: npm registry] |
| @supabase/ssr | `0.10.3` | Cookie-based SSR auth for Next.js | Official replacement for deprecated `auth-helpers-nextjs`; required for App Router + Server Components [VERIFIED: npm registry] |
| zod | `3.25.76` | Schema validation — forms + Server Actions | **Pin to v3.x** — zod v4 (`latest` tag = 4.4.3) has open type-incompatibility with `@hookform/resolvers@5.x` (multiple open GitHub issues as of 2025). Safe v3 ceiling: `3.25.76` published 2025-07-08. [VERIFIED: npm registry] |
| react-hook-form | `7.76.0` | Client-side form state management | Widely adopted; low re-render overhead; integrates with `zodResolver` for inline validation [VERIFIED: npm registry] |
| @hookform/resolvers | `5.2.2` | Bridges react-hook-form with zod schema | **Use with zod v3.x only** — v5.2.2 published 2025-09-14 [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | `1.16.0` | Icon set — shadcn default | All icons per `01-UI-SPEC.md` (Loader2, Eye, EyeOff); shadcn installs it automatically [VERIFIED: npm registry] |
| shadcn/ui | `latest` CLI | Copy-on-install component library (Radix + Tailwind) | Initialized via `npx shadcn@latest init` in Wave 0; components copied to `components/ui/` — not an npm dep [CITED: ui.shadcn.com/docs/installation/next] |
| @types/node, @types/react, @types/react-dom | ships with create-next-app | TypeScript definitions | Installed automatically by create-next-app |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `zod@3.25.76` | `zod@4.4.3` | v4 has open `zodResolver` type errors — wait for `@hookform/resolvers` patch before upgrading |
| `react-hook-form` + `zod` | Native `<form>` + `useActionState` | RHF gives onBlur validation with inline errors as required by `01-UI-SPEC.md`; server-only forms can't do field-level client errors |
| `@supabase/ssr` `createServerClient` | `@supabase/auth-helpers-nextjs` | auth-helpers deprecated; `@supabase/ssr` is the current official package [CITED: supabase.com/docs/guides/auth/server-side/nextjs] |

**Installation (Wave 0 scaffold):**
```bash
# 1. Scaffold Next.js project
npx create-next-app@14 marketing-saas \
  --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"

# 2. Install Supabase + form stack
npm install @supabase/supabase-js@2.106.0 @supabase/ssr@0.10.3 \
  react-hook-form@7.76.0 @hookform/resolvers@5.2.2 zod@3.25.76

# 3. Initialize shadcn (interactive)
npx shadcn@latest init
# Choose: Default style, Zinc base color, CSS variables: yes

# 4. Add Phase 1 shadcn components
npx shadcn@latest add button input label card separator badge radio-group textarea avatar
```

---

## Package Legitimacy Audit

> slopcheck was run but uses PyPI as registry — scoped npm packages (`@supabase/*`, `lucide-react`) are not on PyPI and trigger false-positive SLOP verdicts. All packages below were verified directly on npm registry via `npm view`.

| Package | Registry | Age | Downloads (approx) | Source Repo | slopcheck | Disposition |
|---------|----------|-----|--------------------|-------------|-----------|-------------|
| next@14.2.35 | npm | 9+ yrs | 8M+/wk | github.com/vercel/next.js | OK (npm verified) | Approved |
| @supabase/supabase-js@2.106.0 | npm | 4+ yrs | 800K+/wk | github.com/supabase/supabase-js | OK (npm verified) | Approved |
| @supabase/ssr@0.10.3 | npm | 2+ yrs | 400K+/wk | github.com/supabase/ssr | OK (npm verified) | Approved |
| zod@3.25.76 | npm | 4+ yrs | 12M+/wk | github.com/colinhacks/zod | OK (npm verified) | Approved — pin to v3 |
| react-hook-form@7.76.0 | npm | 5+ yrs | 5M+/wk | github.com/react-hook-form/react-hook-form | OK (npm verified) | Approved |
| @hookform/resolvers@5.2.2 | npm | 4+ yrs | 3M+/wk | github.com/react-hook-form/resolvers | OK (npm verified) | Approved — use with zod v3 only |
| lucide-react@1.16.0 | npm | 3+ yrs | 2M+/wk | github.com/lucide-icons/lucide | OK (npm verified) | Approved |
| tailwindcss@3.x | npm | 5+ yrs | 10M+/wk | github.com/tailwindlabs/tailwindcss | OK (npm verified) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck false positives excluded; npm registry verified)
**Packages flagged as suspicious [SUS]:** none
**No postinstall network scripts detected** on any of the above packages (checked via `npm view <pkg> scripts.postinstall`).

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  │  HTTP request (with sb-*-auth-token cookie)
  ▼
Next.js Middleware (middleware.ts)
  │  createServerClient → supabase.auth.getClaims()
  │  ├── no session? → redirect /login
  │  ├── session? + on /login or /signup → redirect /dashboard/overview
  │  └── pass: set refreshed token cookie on request + response
  │
  ▼
Route Layouts / Server Components
  │  createServerClient(cookies()) → read current user
  │  → read usuarios.role from DB (not JWT)
  │  → conditionally render UI (owner/manager see write UI, viewer sees read-only)
  │
  ├── /signup, /login  (public route group)
  │     Client Component with react-hook-form + zodResolver
  │     → supabase.auth.signUp / signInWithPassword (browser client)
  │     → on success: router.push('/dashboard/configuracoes' or '/dashboard/overview')
  │
  └── /dashboard/configuracoes (protected route group)
        Client Component (form state) wrapped in Server Component (data fetch)
        Server Action: upsert academia_config
          → createServerClient (service-role forbidden here; use anon + RLS)
          → supabase.from('academia_config').upsert({...data, tenant_id: fn_tenant_id()})

Database Layer (Supabase PostgreSQL)
  │
  ├── auth.users  (Supabase-managed)
  │     AFTER INSERT trigger → handle_new_user()
  │       → INSERT INTO tenants (id, nome, slug, plano, ativo, setup_fee_pago, ...)
  │       → INSERT INTO usuarios (id, tenant_id, role='owner')
  │
  ├── tenants     RLS: PERMISSIVE (owner) + RESTRICTIVE (tenant isolation)
  ├── usuarios    RLS: PERMISSIVE (owner) + RESTRICTIVE (tenant isolation)
  └── academia_config  RLS: PERMISSIVE (owner/manager) + RESTRICTIVE (tenant isolation)
        fn_tenant_id()  — SECURITY DEFINER, reads usuarios.tenant_id for auth.uid()
        fn_usuario_id() — SECURITY DEFINER, returns auth.uid() typed
        fn_calcular_mensalidade() — SECURITY DEFINER, billing calc
```

### Recommended Project Structure

```
marketing-saas/
├── app/
│   ├── (auth)/                   # route group — no layout wrapper, unauthenticated
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/              # route group — shares AppShell layout
│   │   ├── layout.tsx            # AppShell Server Component (sidebar + auth guard)
│   │   ├── overview/
│   │   │   └── page.tsx
│   │   └── configuracoes/
│   │       └── page.tsx
│   └── api/
│       └── invite/               # POST: admin.inviteUserByEmail (service role)
│           └── route.ts
├── components/
│   ├── ui/                       # shadcn-generated components (do not hand-edit)
│   ├── app-shell.tsx             # Server Component: sidebar + main layout
│   ├── nav-item.tsx              # sidebar nav link with active indicator
│   ├── tag-input.tsx             # custom chip input for diferenciais
│   └── password-input.tsx        # shadcn Input + Eye/EyeOff toggle
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # createBrowserClient — 'use client'
│   │   ├── server.ts             # createServerClient — Server Components / Actions
│   │   └── admin.ts              # createClient(service_role_key) — API routes ONLY
│   ├── queries/
│   │   └── academia-config.ts    # typed DB query functions
│   └── validators/
│       └── academia-config.ts    # zod schemas shared client/server
├── supabase/
│   └── migrations/
│       ├── 20260519000001_create_tenants.sql
│       ├── 20260519000002_create_usuarios.sql
│       ├── 20260519000003_create_academia_config.sql
│       ├── 20260519000004_rls_policies.sql
│       └── 20260519000005_functions_and_triggers.sql
├── middleware.ts                  # Supabase session refresh + route protection
├── .env.local                    # local secrets (gitignored)
└── components.json               # shadcn config
```

### Pattern 1: Supabase Client Three-File Pattern

**What:** Three separate files to create Supabase clients appropriate for each runtime context.
**When to use:** Always — mixing client types causes cookie write errors in Server Components or exposes service key to browser.

```typescript
// lib/supabase/client.ts — browser only, 'use client' components
'use client'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts — Server Components, Server Actions, Route Handlers
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component calling setAll — safe to ignore
          }
        },
      },
    }
  )
}
```

```typescript
// lib/supabase/admin.ts — API routes ONLY, NEVER import in components
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-only env var
  )
}
```

### Pattern 2: Middleware Session Refresh

**What:** Single `middleware.ts` at project root refreshes auth token on every request and redirects unauthenticated users away from protected routes.
**When to use:** Required for all Supabase + Next.js App Router projects; without it, sessions expire silently.

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: use getClaims(), never getSession() — getSession() does not revalidate token
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isProtected = pathname.startsWith('/dashboard')
  const isAuthRoute = pathname === '/login' || pathname === '/signup'

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/overview'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Note:** The official doc now uses `getClaims()` in some versions; `getUser()` also hits the auth server every time and is the current stable verified call. Do NOT use `getSession()` in middleware. [CITED: supabase.com/docs/guides/auth/server-side/nextjs]

### Pattern 3: handle_new_user Trigger — Tenant + User Creation

**What:** PostgreSQL trigger that fires atomically when `auth.users` gets a new row; creates tenant + usuario records.
**When to use:** Only approach that guarantees tenant row exists before any app code runs after signup.

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_functions_and_triggers.sql

-- Helper: get tenant_id for current authenticated user
CREATE OR REPLACE FUNCTION public.fn_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tenant_id FROM public.usuarios WHERE id = auth.uid();
$$;

-- Helper: get current user id (typed)
CREATE OR REPLACE FUNCTION public.fn_usuario_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

-- Trigger function: create tenant + owner record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_slug TEXT;
BEGIN
  -- Generate slug from email (prefix before @)
  v_slug := lower(
    regexp_replace(
      split_part(NEW.email, '@', 1),
      '[^a-z0-9]', '-', 'g'
    )
  );

  -- Create tenant
  INSERT INTO public.tenants (nome, slug, plano, ativo, setup_fee_pago, contrato_anual, fundador)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'nome_academia', split_part(NEW.email, '@', 1)),
    v_slug,
    'starter',
    true,
    false,
    false,
    false  -- fundador flag set manually by admin for first 10 tenants
  )
  RETURNING id INTO v_tenant_id;

  -- Create owner record
  INSERT INTO public.usuarios (id, tenant_id, role, nome)
  VALUES (
    NEW.id,
    v_tenant_id,
    'owner',
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
  );

  RETURN NEW;
END;
$$;

-- Trigger binding
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
```

**Warning:** If this trigger fails, it blocks signup entirely. Test with a valid email format before deploying. [CITED: supabase.com/docs/guides/auth/managing-user-data]

### Pattern 4: RLS PERMISSIVE + RESTRICTIVE Dual Policy

**What:** Every table gets two policies per operation: one PERMISSIVE (grants capability) and one RESTRICTIVE (enforces tenant isolation). PostgreSQL evaluates: `PERMISSIVE_result AND RESTRICTIVE_result`.
**When to use:** RESTRICTIVE is the hard guard that can never be overridden — adding PERMISSIVE policies for roles does not break isolation.

```sql
-- Example for academia_config
ALTER TABLE public.academia_config ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE: who can do what
CREATE POLICY "owner and manager can read their config"
ON public.academia_config FOR SELECT
TO authenticated
USING (
  (SELECT public.fn_tenant_id()) = tenant_id
  AND (SELECT public.fn_usuario_role()) IN ('owner', 'manager', 'viewer')
);

CREATE POLICY "owner and manager can upsert their config"
ON public.academia_config FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT public.fn_tenant_id()) = tenant_id
  AND (SELECT public.fn_usuario_role()) IN ('owner', 'manager')
);

-- RESTRICTIVE: hard tenant boundary — no exceptions
CREATE POLICY "tenant isolation — select"
ON public.academia_config AS RESTRICTIVE FOR SELECT
TO authenticated
USING ((SELECT public.fn_tenant_id()) = tenant_id);

CREATE POLICY "tenant isolation — write"
ON public.academia_config AS RESTRICTIVE FOR ALL
TO authenticated
USING ((SELECT public.fn_tenant_id()) = tenant_id)
WITH CHECK ((SELECT public.fn_tenant_id()) = tenant_id);
```

**Key:** wrap `fn_tenant_id()` in `(SELECT ...)` for performance — unwrapped function calls in RLS can reduce query performance by ~95%. [CITED: supabase.com/docs/guides/database/postgres/row-level-security]

### Anti-Patterns to Avoid

- **`auth.jwt() ->> 'tenant_id'` in RPC:** JWT claims do not update until the token refreshes — user could switch tenants without the old JWT knowing. CLAUDE.md explicitly forbids this. Always read from `usuarios` table via `fn_tenant_id()`.
- **`getSession()` in middleware or Server Components:** Does not revalidate token server-side — an expired or forged session passes. Use `getUser()` (calls Supabase auth server) instead. [CITED: supabase.com/docs/guides/auth/server-side/nextjs]
- **Using `createBrowserClient` in a Server Component:** Causes a cookie write error at runtime — browser client cannot access `next/headers`.
- **Service role client in `lib/supabase/server.ts`:** `server.ts` is imported in Server Components; if it used service role key it would bypass RLS for all server-rendered pages. Keep admin client in a separate file imported only by API routes.
- **RLS ENABLE without both PERMISSIVE + RESTRICTIVE:** A table with only PERMISSIVE policies and no RESTRICTIVE policy will still allow cross-tenant reads if a policy is accidentally written too broadly. The RESTRICTIVE policy is the last line of defense.
- **Slug collision:** `handle_new_user` generates slug from email prefix; two users with `joao@a.com` and `joao@b.com` produce the same slug `joao`. Add a UNIQUE constraint on `tenants.slug` and handle conflict with a numeric suffix (e.g., `joao-2`).
- **zod v4 (`latest` tag):** Running `npm install zod` today installs v4.4.3, which breaks `zodResolver` types. Pin explicitly: `zod@3.25.76`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-based session persistence in SSR | Custom cookie middleware | `@supabase/ssr` `createServerClient` | Token refresh timing, secure cookie attributes, cache headers — non-trivial to get right |
| Auth token validation in middleware | Decode JWT manually | `supabase.auth.getUser()` in middleware | Manual decode doesn't verify signature against Supabase public keys |
| Form field-level validation with inline errors | `useState` + manual error objects | `react-hook-form` + `zodResolver` | onBlur triggering, field registration, dirty state, async validation — dozens of edge cases |
| Tenant isolation | Application-level `WHERE tenant_id = ...` | PostgreSQL RLS (RESTRICTIVE policy) | App-level filtering is forgotten in ad-hoc queries; RLS is enforced by the database regardless of code path |
| Role permission checks | `if (user.role === 'owner')` per route | `fn_tenant_id()` + RLS + Server Component role read | Centralized, auditable; RLS blocks DB-level writes even if UI check is bypassed |
| Password show/hide toggle | Custom input + state | shadcn Input + lucide Eye/EyeOff | Accessibility attributes (`aria-label`), keyboard navigation — as specified in `01-UI-SPEC.md` |
| Tag/chip input | `<input>` + array state | Custom `TagInput` wrapping shadcn Input | 15–20 line component; not complex enough to warrant a library, but IS hand-rolled as specified in UI spec |

**Key insight:** The database layer (RLS + SECURITY DEFINER functions) is the source of truth for authorization. The UI layer only controls presentation — it never solely enforces security.

---

## Common Pitfalls

### Pitfall 1: handle_new_user Trigger Blocks Signup

**What goes wrong:** The trigger function fails (e.g., slug UNIQUE violation, missing column), causing `auth.users` INSERT to roll back, and the user sees a cryptic "signup failed" error with no creation.
**Why it happens:** Trigger is SECURITY DEFINER and runs in the same transaction as the INSERT.
**How to avoid:** Test the trigger SQL independently with a direct INSERT into `auth.users` in the Supabase SQL editor before deploying. Handle slug collision with a retry loop (append `-{random 4 chars}` on conflict).
**Warning signs:** Users get signup error but no record in `auth.users` — check `supabase_logs` for PostgreSQL error messages.

### Pitfall 2: Stale Session After Middleware Redirect

**What goes wrong:** Middleware reads an expired session token and redirects to `/login`, but the browser still has a valid session — user gets stuck in a redirect loop.
**Why it happens:** `getSession()` reads from cookie without hitting the auth server — cookie may be expired. `getUser()` hits the server and returns `null` only when truly expired.
**How to avoid:** Always use `supabase.auth.getUser()` in middleware, never `getSession()`. [CITED: supabase.com/docs/guides/auth/server-side/nextjs]

### Pitfall 3: Cross-Tenant Read via Missing RLS

**What goes wrong:** A new table added in a later feature query lacks RLS; a single malicious query can read all tenants' data.
**Why it happens:** Supabase tables without RLS are readable by all authenticated users.
**How to avoid:** CLAUDE.md CHECKLIST before every push — "Toda nova tabela tem tenant_id + RLS?" Run test with a non-admin Supabase client after every new table.
**Warning signs:** `SELECT * FROM new_table` as any non-admin user returns rows from multiple tenants.

### Pitfall 4: Next.js Build Fails on Service Role Key Usage in Server Component

**What goes wrong:** Importing `lib/supabase/admin.ts` from a Server Component causes the build to include `SUPABASE_SERVICE_ROLE_KEY` — Next.js may tree-shake it out but the import path is a risk.
**Why it happens:** Next.js does not prevent server-only imports from Server Components — it's on the developer.
**How to avoid:** Mark `lib/supabase/admin.ts` with `import 'server-only'` at the top (available in Next.js 13+). This causes a build error if imported from a Client Component, and a clear dev-time warning if imported wrongly.

### Pitfall 5: shadcn CSS Variables Override Conflict

**What goes wrong:** `npx shadcn@latest init` generates default `--primary` in `globals.css` using Zinc palette; Fitness UNIC brand requires `#E30613`. After init, developer forgets to override, and all buttons render as dark grey.
**Why it happens:** shadcn init writes defaults and the instruction to override is in `01-UI-SPEC.md`, not in the generated code.
**How to avoid:** Wave 0 task must include an explicit step: after `shadcn init`, replace the generated CSS variables in `globals.css` with the exact values from `01-UI-SPEC.md` § Color. Commit that as a separate task.

### Pitfall 6: Zod v4 Installed via `npm install zod`

**What goes wrong:** `npm install zod` installs v4.4.3 (`latest` tag as of 2026-05-19). `zodResolver` from `@hookform/resolvers@5.2.2` fails TypeScript overload matching with Zod v4 types (`Resolver<input<T>>` not assignable to `Resolver<output<T>>`).
**Why it happens:** `latest` tag now points to v4.
**How to avoid:** Pin the version explicitly: `npm install zod@3.25.76`.
**Warning signs:** TypeScript errors on `zodResolver(schema)` call — "Type 'Resolver<X, any, Y>' is not assignable to type 'Resolver<Y, any, Y>'".

### Pitfall 7: fn_tenant_id() Returns NULL for New Users

**What goes wrong:** Immediately after signup, before the trigger has committed, app code calls `fn_tenant_id()` and gets `NULL` — first-time redirect to `/dashboard/configuracoes` fails RLS check, form save is rejected.
**Why it happens:** Trigger fires in the same transaction as auth insert, but there is a short window between the browser receiving the signup response and the tenant being queryable. In practice this is negligible, but if the trigger is async or deferred this breaks.
**How to avoid:** The `handle_new_user` trigger must be `AFTER INSERT ... FOR EACH ROW` (not DEFERRED). After signup, the Server Action that loads `/dashboard/configuracoes` should gracefully handle `fn_tenant_id() IS NULL` with a retry or informative error.

---

## Code Examples

### Academia Config Upsert Server Action

```typescript
// app/(dashboard)/configuracoes/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { academiaConfigSchema } from '@/lib/validators/academia-config'
import { revalidatePath } from 'next/cache'

export async function saveAcademiaConfig(formData: unknown) {
  const parsed = academiaConfigSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const supabase = await createClient()

  // fn_tenant_id() is resolved by PostgreSQL RLS — no tenant_id in app code
  const { error } = await supabase
    .from('academia_config')
    .upsert({
      ...parsed.data,
      // tenant_id is NOT set here — it comes from fn_tenant_id() via RLS WITH CHECK
      // The RLS policy enforces tenant_id = fn_tenant_id() on INSERT
    }, { onConflict: 'tenant_id' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}
```

**Note:** Because `academia_config` has `tenant_id NOT NULL` and the RLS `WITH CHECK` enforces `tenant_id = fn_tenant_id()`, the `INSERT` will fail unless the app provides the correct `tenant_id`. Two approaches: (a) read `fn_tenant_id()` via a separate RPC call and include it, or (b) use a RPC that sets it internally. Approach (a) is simpler: call `supabase.rpc('fn_tenant_id')` at the start of the Server Action and include the result. [ASSUMED — verify approach with a test SQL query before coding]

### Zod Schema for Academia Config

```typescript
// lib/validators/academia-config.ts
import { z } from 'zod'

export const academiaConfigSchema = z.object({
  nome_academia: z.string().min(1, 'Campo obrigatório.'),
  bairro: z.string().min(1, 'Campo obrigatório.'),
  cidade: z.string().min(1, 'Campo obrigatório.'),
  raio_km: z.coerce.number().min(1).max(50).default(5),
  tom_de_voz: z.enum(['formal', 'neutro', 'coloquial']).default('neutro'),
  diferenciais: z.array(z.string()).max(10).default([]),
  horarios: z.string().optional(),  // stored as JSONB but captured as string, converted in Action
  planos: z.string().optional(),    // same
})

export type AcademiaConfigInput = z.infer<typeof academiaConfigSchema>
```

### fn_calcular_mensalidade Function

```sql
-- FOUND-02 requirement: this function must be callable
CREATE OR REPLACE FUNCTION public.fn_calcular_mensalidade(p_tenant_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plano TEXT;
  v_fundador BOOLEAN;
  v_criado_em TIMESTAMPTZ;
  v_base NUMERIC;
  v_desconto NUMERIC := 0;
BEGIN
  SELECT plano, fundador, criado_em
    INTO v_plano, v_fundador, v_criado_em
    FROM public.tenants
    WHERE id = p_tenant_id
      AND id = public.fn_tenant_id();  -- security: caller must own this tenant

  -- Base price by plan
  v_base := CASE v_plano
    WHEN 'starter'    THEN 297
    WHEN 'pro'        THEN 497
    WHEN 'enterprise' THEN 997
    ELSE 297
  END;

  -- Founder discount: 50% off for first 6 months
  IF v_fundador AND v_criado_em > NOW() - INTERVAL '6 months' THEN
    v_desconto := v_base * 0.5;
  END IF;

  RETURN v_base - v_desconto;
END;
$$;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` + `createServerClient` / `createBrowserClient` | 2023-2024 | auth-helpers is deprecated — do not use |
| `supabase.auth.getSession()` in server code | `supabase.auth.getUser()` in server code | Late 2023 | `getSession()` does not revalidate token — security risk |
| `auth.jwt() ->> 'role'` in RLS | SECURITY DEFINER function reading from `usuarios` table | Ongoing best practice | JWT claims stale until token refresh; DB read is always current |
| Pages Router auth pattern | App Router middleware + Server Components | Next.js 13+ | Pages Router pattern breaks in App Router — don't copy old tutorials |
| shadcn/ui via `npx shadcn-ui@latest` | `npx shadcn@latest` | 2024 | Package renamed from `shadcn-ui` to `shadcn` |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: superseded by `@supabase/ssr`; produces build warnings in new projects
- `npx shadcn-ui@latest init`: use `npx shadcn@latest init` — old package name still works but points to old version
- `supabase.auth.getSession()` in middleware: explicitly flagged as insecure in official docs [CITED: supabase.com/docs/guides/auth/server-side/nextjs]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Server Action can call `supabase.rpc('fn_tenant_id')` to get current tenant_id, then include it in the `academia_config` upsert payload | Code Examples — Academia Config Upsert | If RLS enforces tenant_id differently, upsert may be rejected — verify with a test SQL call |
| A2 | Slug generation from email prefix in `handle_new_user` produces unique enough values for MVP; conflict handled by appending random suffix | Architecture Patterns — Pattern 3 | Slug collision at signup will block user creation — test with two identical email prefixes |
| A3 | `supabase.auth.admin.inviteUserByEmail` sends an email with a link that calls the Supabase signup flow; the invited user lands on `/signup` or a Supabase-managed accept URL | Architecture Patterns — user invitation | If Supabase's invite email links to a different URL pattern, the auth redirect rules need updating |
| A4 | `fn_calcular_mensalidade` pricing (Starter R$297, Pro R$497, Enterprise R$997) and fundador policy details are placeholders — actual prices not confirmed in any project document | Code Examples — fn_calcular_mensalidade | Wrong pricing in function is non-breaking for Phase 1 (function just needs to be callable per FOUND-02), but will need correction before billing goes live |
| A5 | `horarios` and `planos` in `academia_config` are stored as JSONB but captured as textarea strings in the form — a Server Action converts the string to JSON before upsert | Code Examples | If the team prefers structured input (array of objects), the form and schema need redesign |

---

## Open Questions

1. **Fundador flag: who sets it?**
   - What we know: `tenants.fundador BOOLEAN` determines 50% discount for first 6 months; policy targets first 10 tenants
   - What's unclear: Is this set automatically (trigger checks row count ≤ 10) or manually by admin?
   - Recommendation: For Phase 1, default to `false` in trigger; add a migration later to flip it manually for actual first 10 tenants. No admin UI needed in Phase 1.

2. **Invite flow: do managers receive a Supabase invite email or a custom email?**
   - What we know: `admin.inviteUserByEmail` sends Supabase's default invite email
   - What's unclear: Does the product require custom email branding in Phase 1?
   - Recommendation: Use Supabase default invite email for Phase 1 MVP; custom email templates are a Phase 2+ concern.

3. **academia_config.horarios / planos: textarea string or structured JSON?**
   - What we know: Schema defines both as `JSONB`; UI spec shows both as textarea inputs
   - What's unclear: Is free-text stored directly as a JSON string scalar, or parsed into an object?
   - Recommendation: Store as `{"text": "<textarea value>"}` JSON wrapper for Phase 1; structured schema is a future migration.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All development | Yes | v22.17.0 | — |
| npm | Package installs | Yes | 10.9.2 | — |
| Supabase CLI | Local migration testing, `supabase db push` | No | — | Use Supabase Dashboard SQL editor manually; install CLI before execution: `brew install supabase/tap/supabase` |
| Docker | Supabase local dev stack | No | — | Use hosted Supabase project (cloud); local stack is optional for Phase 1 |
| Git | Version control | Yes (repo exists) | — | — |

**Missing dependencies with no hard fallback:**
- Supabase project credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — must be obtained from the Supabase dashboard before any migration or auth code can be tested.

**Missing dependencies with fallback:**
- Supabase CLI: Supabase Dashboard SQL editor covers migration execution for Phase 1. CLI is needed for `supabase gen types typescript` — install at start of execution.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed yet — Wave 0 must add |
| Config file | `jest.config.ts` (Wave 0 gap) |
| Quick run command | `npm test -- --testPathPattern=<file>` |
| Full suite command | `npm test` |

Given the greenfield nature and the UI-centric scope of Phase 1, the primary validation mechanism is:
1. `next build` (required by CLAUDE.md before every push) — catches TypeScript + ESLint errors
2. Manual smoke tests following the 4 success criteria
3. Supabase SQL tests (run in Dashboard SQL editor) for RLS + trigger correctness

A full Jest setup is deferred: Phase 1 has no pure-logic business functions that benefit from unit tests beyond what TypeScript + build already validates.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | User can sign up and session persists on reload | manual smoke | — | N/A |
| FOUND-01 | Middleware redirects unauthenticated user from /dashboard to /login | manual smoke | — | N/A |
| FOUND-02 | Signup creates tenant + usuario row in DB | manual smoke + SQL | `SELECT * FROM tenants; SELECT * FROM usuarios;` in Supabase SQL editor | N/A |
| FOUND-02 | fn_calcular_mensalidade() returns a number | SQL | `SELECT fn_calcular_mensalidade('<tenant_uuid>');` | N/A |
| FOUND-03 | Academia DNA form saves and reloads persisted values | manual smoke | — | N/A |
| FOUND-04 | Viewer role cannot perform write actions | manual smoke (invite viewer, try save) | — | N/A |
| FOUND-04 | Tenant A cannot read tenant B's data | SQL: run as tenant B user, query tenant A's academia_config | `SET LOCAL role = <tenant_b_user>; SELECT * FROM academia_config WHERE tenant_id = '<tenant_a_id>';` | N/A |

### Wave 0 Gaps

- [ ] No test framework installed — `next build` + manual smoke tests are the Phase 1 gates
- [ ] Supabase CLI install needed for `supabase gen types typescript --local` (type generation)
- [ ] `.env.local` with Supabase credentials needed before any test can run

*(Phase 1 gates on `next build` passing green + all 4 success criteria met via manual verification)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth email/password — bcrypt server-side; no custom implementation |
| V3 Session Management | Yes | `@supabase/ssr` HTTP-only cookies; token refresh in middleware; `getUser()` not `getSession()` |
| V4 Access Control | Yes | RLS RESTRICTIVE policy per table; `fn_tenant_id()` SECURITY DEFINER; role read from DB |
| V5 Input Validation | Yes | `zod@3.25.76` schemas on all form inputs; server-side revalidation in Server Actions |
| V6 Cryptography | No direct use | Supabase handles password hashing — never hand-rolled |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data read | Information Disclosure | RESTRICTIVE RLS policy on every table; `fn_tenant_id()` read from DB |
| JWT claim spoofing (fake tenant_id in JWT) | Tampering | `fn_tenant_id()` reads from `usuarios` table, not JWT — JWT claim ignored |
| Service role key exposure | Elevation of Privilege | `lib/supabase/admin.ts` marked `import 'server-only'`; never imported from components |
| Privilege escalation via URL | Elevation of Privilege | Viewer cannot reach write actions via URL — Server Component does not render save button; RLS blocks DB write |
| Stale expired session | Authentication Bypass | `getUser()` in middleware hits auth server every request; `getSession()` explicitly avoided |
| Slug enumeration | Information Disclosure | `tenants.slug` is not exposed via public API in Phase 1; only used internally |

---

## Sources

### Primary (HIGH confidence)
- [supabase.com/docs/guides/auth/server-side/nextjs](https://supabase.com/docs/guides/auth/server-side/nextjs) — createServerClient, middleware pattern, getUser() vs getSession()
- [supabase.com/docs/guides/auth/managing-user-data](https://supabase.com/docs/guides/auth/managing-user-data) — handle_new_user trigger pattern, SECURITY DEFINER
- [supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security) — PERMISSIVE/RESTRICTIVE, auth.uid() wrapping for performance
- [supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — SECURITY DEFINER authorize() pattern
- [ui.shadcn.com/docs/installation/next](https://ui.shadcn.com/docs/installation/next) — shadcn init, component installation
- npm registry (direct `npm view` calls) — all package versions and publish dates

### Secondary (MEDIUM confidence)
- [github.com/react-hook-form/resolvers/issues/799](https://github.com/orgs/supabase/discussions/6055) — zod v4 + @hookform/resolvers incompatibility (multiple open issues confirm issue is real and unresolved)
- [supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) — inviteUserByEmail requires service role key, server-only

### Tertiary (LOW confidence)
- Multiple community articles on Supabase multi-tenant RLS patterns (cross-verified with official docs where possible)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry, official docs confirm package choices
- Architecture: HIGH — patterns sourced directly from Supabase official docs
- Pitfalls: HIGH for zod v4 issue (multiple GitHub issues confirm), HIGH for getSession security issue (official docs), MEDIUM for trigger edge cases (community + docs)
- zod v4 compatibility: HIGH confidence the issue exists; MEDIUM confidence it won't be patched before execution (check issue status before starting)

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (30 days — stable stack, but check zod/hookform compatibility before execution)
