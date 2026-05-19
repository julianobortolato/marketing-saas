-- Migration 20260520000004: Table-level grants — leads + aprovacoes
--
-- Same rationale as Phase 1 migration 0007: PostgREST (Supabase) checks table-level
-- GRANT before evaluating RLS. Without explicit GRANT SELECT, the client receives
-- "permission denied for table X" even when authenticated and all RLS policies pass.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aprovacoes TO authenticated;

GRANT ALL ON public.leads TO service_role;
GRANT ALL ON public.aprovacoes TO service_role;
