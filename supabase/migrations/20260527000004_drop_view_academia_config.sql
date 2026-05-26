-- SUNSET Sprint 1: remove compat view academia_config → tenant_config
-- Condição: grep-zero de "academia_config" em app/ lib/ verificado em Fase 3R
-- Ref: migration 20260527000001 (COMMENT ON VIEW)
DROP VIEW IF EXISTS public.academia_config;
