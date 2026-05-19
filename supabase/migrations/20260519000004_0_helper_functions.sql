-- Migration 0004_0: Helper functions required by RLS policies (migration 0004)
--
-- Must run AFTER tables exist (0001-0003) and BEFORE policies (0004_rls_policies).
-- Migration 0005 recreates these with CREATE OR REPLACE — idempotent, no conflict.
--
-- SECURITY DEFINER: runs with creator privileges, bypasses RLS for internal reads.
-- SET search_path = '': prevents search_path injection attacks.

-- ============================================================================
-- fn_usuario_id()
-- Typed wrapper around auth.uid(). Used in RLS policies.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_usuario_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

-- ============================================================================
-- fn_tenant_id()
-- Returns tenant_id for the current user. Reads from public.usuarios (bypasses
-- RLS via SECURITY DEFINER). Never reads from JWT — claims are stale on refresh.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tenant_id FROM public.usuarios WHERE id = auth.uid();
$$;

-- ============================================================================
-- fn_usuario_role()
-- Returns role for the current user. Reads from public.usuarios (bypasses RLS).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_usuario_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.usuarios WHERE id = auth.uid();
$$;
