-- Migration 0007: Table-level grants + fix academia_config SELECT policy
--
-- WHY GRANTS:
--   PostgREST (Supabase) checks table-level GRANT before evaluating RLS.
--   Without explicit GRANT SELECT, the client receives "permission denied for table X"
--   even when the user is authenticated and all RLS policies would pass.
--   Supabase ALTER DEFAULT PRIVILEGES applies only to tables created by the same
--   role that set up the defaults — migrations pushed via CLI may miss this.
--
-- WHY POLICY FIX (academia_config SELECT):
--   The previous PERMISSIVE USING clause checked fn_usuario_role() IN ('owner','manager','viewer').
--   All three values are the full set of valid roles — the check was redundant and a
--   potential silent failure point if fn_usuario_role() returned NULL for any reason.
--   Tenant isolation is already enforced by the RESTRICTIVE policy; the PERMISSIVE
--   policy only needs to grant capability (fn_tenant_id() = tenant_id).

-- ============================================================================
-- TABLE-LEVEL GRANTS — authenticated (RLS still applies) + service_role (bypasses RLS)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academia_config TO authenticated;

GRANT ALL ON public.tenants         TO service_role;
GRANT ALL ON public.usuarios        TO service_role;
GRANT ALL ON public.academia_config TO service_role;

-- ============================================================================
-- FIX: academia_config SELECT PERMISSIVE policy
-- Remove redundant fn_usuario_role() check — all three roles can read config.
-- Tenant isolation is fully covered by the RESTRICTIVE policy below.
-- ============================================================================

DROP POLICY IF EXISTS "academia_config_select_any_role" ON public.academia_config;

CREATE POLICY "academia_config_select_any_role"
  ON public.academia_config FOR SELECT
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id);
