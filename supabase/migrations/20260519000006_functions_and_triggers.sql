-- Migration 0005: Helper functions, handle_new_user trigger, billing function
--
-- SECURITY DEFINER: all functions run with creator privileges (bypasses RLS).
-- SET search_path = '': prevents search_path injection attacks.
-- NEVER reads tenant_id from JWT claims — always reads from public.usuarios.
--   [CLAUDE.md anti-pattern: JWT tenant_id claims return null silently on token refresh]

-- ============================================================================
-- HELPER: fn_usuario_id()
-- Returns the authenticated user's UUID (typed wrapper around auth.uid())
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_usuario_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

COMMENT ON FUNCTION public.fn_usuario_id IS 'Returns auth.uid() typed as UUID. Use in RLS policies and RPCs.';

-- ============================================================================
-- HELPER: fn_tenant_id()
-- Returns the tenant_id for the current authenticated user.
-- Reads from public.usuarios, NEVER from JWT (JWT claims are stale until refresh).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tenant_id FROM public.usuarios WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.fn_tenant_id IS 'Returns current user tenant_id from public.usuarios. Never reads from JWT. Used in RLS policies.';

-- ============================================================================
-- HELPER: fn_usuario_role()
-- Returns the role for the current authenticated user.
-- Reads from public.usuarios — always current (not stale JWT claim).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_usuario_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.usuarios WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.fn_usuario_role IS 'Returns current user role (owner|manager|viewer) from public.usuarios.';

-- ============================================================================
-- TRIGGER FUNCTION: handle_new_user()
-- Fires AFTER INSERT ON auth.users.
-- Creates: 1 tenants row + 1 usuarios row (role=owner) per signup.
-- Slug collision handled: appends random 4-char suffix on UNIQUE conflict.
--
-- WARNING: trigger runs in the SAME TRANSACTION as auth.users INSERT.
-- Any unhandled exception blocks signup entirely (RESEARCH Pitfall 1).
-- Test in SQL editor before deploying.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_slug      TEXT;
  v_slug_base TEXT;
  v_attempt   INT := 0;
BEGIN
  -- Generate slug base from email prefix (before @), lowercase, non-alphanum → '-'
  v_slug_base := lower(
    regexp_replace(
      split_part(NEW.email, '@', 1),
      '[^a-z0-9]', '-', 'g'
    )
  );
  v_slug := v_slug_base;

  -- Insert tenant row; retry with random suffix on slug UNIQUE conflict (Pitfall 1)
  LOOP
    BEGIN
      INSERT INTO public.tenants (nome, slug, plano, ativo, setup_fee_pago, contrato_anual, fundador)
      VALUES (
        COALESCE(NEW.raw_user_meta_data->>'nome_academia', split_part(NEW.email, '@', 1)),
        v_slug,
        'starter',
        TRUE,
        FALSE,
        FALSE,
        FALSE  -- fundador flag set manually by admin for first ~10 tenants; default FALSE
      )
      RETURNING id INTO v_tenant_id;

      EXIT;  -- success — exit loop

    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 10 THEN
        RAISE EXCEPTION 'handle_new_user: could not generate unique slug after 10 attempts for email %', NEW.email;
      END IF;
      -- Append 4 random alphanumeric chars
      v_slug := v_slug_base || '-' || lower(substring(md5(random()::text) FOR 4));
    END;
  END LOOP;

  -- Insert owner record linking auth.users to the new tenant
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

COMMENT ON FUNCTION public.handle_new_user IS 'Trigger function: atomically creates tenants + usuarios rows on new auth.users insert. Slug collision retried with random suffix.';

-- Bind trigger — fires synchronously (not DEFERRED) to guarantee rows exist before app code runs
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- BILLING: fn_calcular_mensalidade(p_tenant_id uuid)
-- Returns monthly fee for the given tenant.
-- Security: revalidates caller owns the tenant via fn_tenant_id().
-- Pricing values are Phase 1 placeholders (RESEARCH Assumption A4);
-- FOUND-02 only requires this function be callable.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_calcular_mensalidade(p_tenant_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plano     TEXT;
  v_fundador  BOOLEAN;
  v_criado_em TIMESTAMPTZ;
  v_base      NUMERIC;
  v_desconto  NUMERIC := 0;
BEGIN
  -- Security: caller must own this tenant (prevents cross-tenant billing reads)
  SELECT plano, fundador, criado_em
    INTO v_plano, v_fundador, v_criado_em
    FROM public.tenants
    WHERE id = p_tenant_id
      AND id = public.fn_tenant_id();

  IF NOT FOUND THEN
    RETURN NULL;  -- caller does not own this tenant or tenant does not exist
  END IF;

  -- Base price by plan (placeholder values — update before billing goes live)
  v_base := CASE v_plano
    WHEN 'starter'    THEN 297
    WHEN 'pro'        THEN 497
    WHEN 'enterprise' THEN 997
    ELSE 297
  END;

  -- Founder discount: 50% off for the first 6 months
  IF v_fundador AND v_criado_em > NOW() - INTERVAL '6 months' THEN
    v_desconto := v_base * 0.5;
  END IF;

  RETURN v_base - v_desconto;
END;
$$;

COMMENT ON FUNCTION public.fn_calcular_mensalidade IS 'Returns monthly fee for tenant. Security: caller must own tenant. Pricing are Phase 1 placeholders (RESEARCH Assumption A4).';
