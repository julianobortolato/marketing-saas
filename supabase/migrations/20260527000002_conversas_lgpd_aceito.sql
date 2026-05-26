-- Migration: lgpd_aceito em conversas (ROADMAP Sprint 0 §0.3)
-- Consentimento armazenado por conversa (por remotejid×tenant_id), não por mensagem.
-- Decisão: conversas já tem UNIQUE(tenant_id, remotejid) — é o ponto correto para consentimento.
-- Primeira mensagem de um remotejid: bot envia opt-in; flag muda para true após aceite explícito.

ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS lgpd_aceito BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.conversas.lgpd_aceito IS
  'Consentimento LGPD por conversa (remotejid×tenant). false = opt-in pendente; true = aceito. Nunca por mensagem individual.';
