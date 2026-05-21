-- Migration 20260521000013: Table-level grants — ai_usage_log + ai_usage_diario
--
-- Migration 0012 covered evolution_instances/conversas/chat_messages but missed
-- the ai_usage tables. Same pattern: PostgREST checks GRANT before RLS.
-- Without GRANT SELECT TO authenticated, queries return "permission denied" even
-- when the user is authenticated and RLS policies are correct.
--
-- Authenticated users: read-only (dashboard observability + handoff UI).
-- Writes only via SECURITY DEFINER RPCs (rpc_registrar_uso_ia) and trigger.

GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT SELECT ON public.ai_usage_diario TO authenticated;

GRANT ALL ON public.ai_usage_log TO service_role;
GRANT ALL ON public.ai_usage_diario TO service_role;
