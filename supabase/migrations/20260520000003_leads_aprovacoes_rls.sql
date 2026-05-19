-- Migration 20260520000003: RLS Policies — leads + aprovacoes
--
-- Replicates the PERMISSIVE + RESTRICTIVE dual-policy pattern from Phase 1 (migration 0004).
-- PostgreSQL evaluates: result = PERMISSIVE_result AND RESTRICTIVE_result
--
-- PERMISSIVE policies: grant capability (what roles can do what operations).
--   SELECT: all roles in the tenant can read leads/aprovacoes.
--   INSERT/UPDATE: only owner/manager (viewer write-blocked at DB — security_requirements).
--
-- RESTRICTIVE policies: hard tenant boundary — cannot be overridden by any PERMISSIVE policy.
--   FOR SELECT: USING only (no rows visible outside the tenant).
--   FOR ALL:    USING + WITH CHECK (no writes outside the tenant, even via service_role path).
--
-- NOTE: The webhook (Plan 02) writes via the service-role admin client which bypasses RLS.
-- These authenticated policies govern dashboard users only. The service_role's insert is
-- trusted because tenant_id is derived from WEBHOOK_TENANT_MAP, not the request body.
--
-- PERFORMANCE: All helper calls wrapped as (SELECT public.fn_...) to prevent per-row
-- function evaluation. See Phase 1 migration 0004 header for citation.

-- ============================================================================
-- LEADS TABLE
-- ============================================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE: all tenant roles can read leads
CREATE POLICY "leads_select_same_tenant"
  ON public.leads FOR SELECT
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

-- PERMISSIVE: owner/manager can create leads (viewer write-blocked — LEAD-02 basis)
CREATE POLICY "leads_insert_owner_manager"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.fn_tenant_id()) = tenant_id
    AND (SELECT public.fn_usuario_role()) IN ('owner', 'manager')
  );

-- PERMISSIVE: owner/manager can update leads (manual status change in Plan 03)
CREATE POLICY "leads_update_owner_manager"
  ON public.leads FOR UPDATE
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
CREATE POLICY "leads_isolation_select"
  ON public.leads AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

-- RESTRICTIVE: hard tenant boundary for ALL writes
CREATE POLICY "leads_isolation_write"
  ON public.leads AS RESTRICTIVE FOR ALL
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.fn_tenant_id()) = tenant_id);

-- ============================================================================
-- APROVACOES TABLE
-- ============================================================================

ALTER TABLE public.aprovacoes ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE: all tenant roles can read the approval queue
CREATE POLICY "aprovacoes_select_same_tenant"
  ON public.aprovacoes FOR SELECT
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

-- PERMISSIVE: owner/manager can create approval records (viewer write-blocked — APROV-01 basis)
CREATE POLICY "aprovacoes_insert_owner_manager"
  ON public.aprovacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.fn_tenant_id()) = tenant_id
    AND (SELECT public.fn_usuario_role()) IN ('owner', 'manager')
  );

-- PERMISSIVE: owner/manager can update approvals (batch approve/reject in Plan 04)
CREATE POLICY "aprovacoes_update_owner_manager"
  ON public.aprovacoes FOR UPDATE
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
CREATE POLICY "aprovacoes_isolation_select"
  ON public.aprovacoes AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

-- RESTRICTIVE: hard tenant boundary for ALL writes
CREATE POLICY "aprovacoes_isolation_write"
  ON public.aprovacoes AS RESTRICTIVE FOR ALL
  TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.fn_tenant_id()) = tenant_id);
