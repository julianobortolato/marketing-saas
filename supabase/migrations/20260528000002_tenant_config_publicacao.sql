-- Migration 20260528000002: colunas de publicação Zernio em tenant_config
-- Fase 6: agenda, horário e timezone por tenant

ALTER TABLE public.tenant_config
  ADD COLUMN IF NOT EXISTS zernio_account_id    TEXT,
  ADD COLUMN IF NOT EXISTS publicacao_dias       TEXT[] NOT NULL DEFAULT '{"monday","thursday"}',
  ADD COLUMN IF NOT EXISTS publicacao_horario    TIME   NOT NULL DEFAULT '18:00:00',
  ADD COLUMN IF NOT EXISTS publicacao_timezone   TEXT   NOT NULL DEFAULT 'America/Campo_Grande';
