-- Migration: rename academia_config → tenant_config (ROADMAP Sprint 0 §0.2)
-- View de compatibilidade temporária — SUNSET: Sprint 1 (remover antes do aceite de Sprint 1)

ALTER TABLE public.academia_config RENAME TO tenant_config;

-- Compat view: permite que referências old-style continuem funcionando durante Sprint 1
-- SUNSET: remover esta view no Sprint 1 após grep-zero verificado
CREATE VIEW public.academia_config AS
  SELECT * FROM public.tenant_config;

COMMENT ON VIEW public.academia_config IS
  'SUNSET Sprint 1: remover esta view após todas as referências .from(''academia_config'') serem migradas para tenant_config. Verificar com grep -rn "academia_config" lib/ app/.';
