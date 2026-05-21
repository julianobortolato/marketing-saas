-- Migration 20260520000012: Table-level grants — WhatsApp tables
--
-- PostgREST checks GRANT before RLS. Without explicit GRANT SELECT, the session
-- client receives "permission denied for table X" even when authenticated and
-- RLS policies pass. Same pattern as migration 0004 for leads/aprovacoes.
--
-- evolution_instances, conversas, chat_messages: authenticated reads via dashboard.
-- Writes only via SECURITY DEFINER RPCs (rpc_persistir_mensagem_*, rpc_handoff_humano).
-- Direct INSERT/UPDATE from authenticated role blocked by RESTRICTIVE RLS policy,
-- but reativarAgente Server Action does a direct UPDATE on conversas — needs UPDATE grant.

GRANT SELECT ON public.evolution_instances TO authenticated;
GRANT SELECT, UPDATE ON public.conversas TO authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;

GRANT ALL ON public.evolution_instances TO service_role;
GRANT ALL ON public.conversas TO service_role;
GRANT ALL ON public.chat_messages TO service_role;
