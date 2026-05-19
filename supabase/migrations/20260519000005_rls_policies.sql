-- Migration 0004: RLS Policies — PERMISSIVE + RESTRICTIVE dual-policy pattern
--
-- ARCHITECTURE: Every table gets:
--   1. PERMISSIVE policy set: grants capability (what roles can do what)
--   2. RESTRICTIVE policy set: hard tenant isolation (cannot be overridden by PERMISSIVE)
--
-- PostgreSQL evaluates: result = PERMISSIVE_result AND RESTRICTIVE_result
--
-- PERFORMANCE: fn_tenant_id() is always wrapped in (SELECT ...)
--   to prevent per-row function evaluation (~95% perf impact if unwrapped).
--   [CITED: supabase.com/docs/guides/database/postgres/row-level-security]
--
-- NOTE: Functions fn_tenant_id, fn_usuario_role are created in migration 0005.
-- Policies are evaluated at query time, not at creation time — referencing
-- functions defined in a later migration is valid because 0005 runs before any query.

-- ============================================================================
-- TENANTS TABLE
-- ============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE: owners can read their own tenant row
CREATE POLICY "tenants_select_own"
  ON public.tenants FOR SELECT
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = id);

-- PERMISSIVE: owners can update their own tenant row
CREATE POLICY "tenants_update_own"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.fn_tenant_id()) = id
    AND (SELECT public.fn_usuario_role()) = 'owner'
  )
  WITH CHECK (
    (SELECT public.fn_tenant_id()) = id
    AND (SELECT public.fn_usuario_role()) = 'owner'
  );

-- RESTRICTIVE: hard tenant boundary for SELECT — no cross-tenant reads
CREATE POLICY "tenants_isolation_select"
  ON public.tenants AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = id);

-- RESTRICTIVE: hard tenant boundary for ALL writes
CREATE POLICY "tenants_isolation_write"
  ON public.tenants AS RESTRICTIVE FOR ALL
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = id)
  WITH CHECK ((SELECT public.fn_tenant_id()) = id);

-- ============================================================================
-- USUARIOS TABLE
-- ============================================================================

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE: all authenticated users can read usuarios in their tenant
CREATE POLICY "usuarios_select_same_tenant"
  ON public.usuarios FOR SELECT
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

-- PERMISSIVE: owners can insert new users into their tenant
CREATE POLICY "usuarios_insert_owner"
  ON public.usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.fn_tenant_id()) = tenant_id
    AND (SELECT public.fn_usuario_role()) = 'owner'
  );

-- PERMISSIVE: owners can update users in their tenant
CREATE POLICY "usuarios_update_owner"
  ON public.usuarios FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.fn_tenant_id()) = tenant_id
    AND (SELECT public.fn_usuario_role()) = 'owner'
  )
  WITH CHECK (
    (SELECT public.fn_tenant_id()) = tenant_id
    AND (SELECT public.fn_usuario_role()) = 'owner'
  );

-- RESTRICTIVE: hard tenant boundary for SELECT
CREATE POLICY "usuarios_isolation_select"
  ON public.usuarios AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

-- RESTRICTIVE: hard tenant boundary for ALL writes
CREATE POLICY "usuarios_isolation_write"
  ON public.usuarios AS RESTRICTIVE FOR ALL
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.fn_tenant_id()) = tenant_id);

-- ============================================================================
-- ACADEMIA_CONFIG TABLE
-- ============================================================================

ALTER TABLE public.academia_config ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE: all roles can read their academy config
CREATE POLICY "academia_config_select_any_role"
  ON public.academia_config FOR SELECT
  TO authenticated
  USING (
    (SELECT public.fn_tenant_id()) = tenant_id
    AND (SELECT public.fn_usuario_role()) IN ('owner', 'manager', 'viewer')
  );

-- PERMISSIVE: owner/manager can insert config (viewer write blocked at DB — FOUND-04 basis)
CREATE POLICY "academia_config_insert_owner_manager"
  ON public.academia_config FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.fn_tenant_id()) = tenant_id
    AND (SELECT public.fn_usuario_role()) IN ('owner', 'manager')
  );

-- PERMISSIVE: owner/manager can update config
CREATE POLICY "academia_config_update_owner_manager"
  ON public.academia_config FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.fn_tenant_id()) = tenant_id
    AND (SELECT public.fn_usuario_role()) IN ('owner', 'manager')
  )
  WITH CHECK (
    (SELECT public.fn_tenant_id()) = tenant_id
    AND (SELECT public.fn_usuario_role()) IN ('owner', 'manager')
  );

-- RESTRICTIVE: hard tenant boundary for SELECT
CREATE POLICY "academia_config_isolation_select"
  ON public.academia_config AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

-- RESTRICTIVE: hard tenant boundary for ALL writes
CREATE POLICY "academia_config_isolation_write"
  ON public.academia_config AS RESTRICTIVE FOR ALL
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.fn_tenant_id()) = tenant_id);
