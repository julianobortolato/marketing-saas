-- Migration 20260520000008: tenants — colunas de budget OpenAI (ADR-MKT-001 §4.5)
-- ia_habilitada + ia_limite_diario_usd + kill switch fields
-- Kill switch automático gerenciado pelo trigger fn_acumular_uso_ia (migration 0009).

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ia_habilitada          BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ia_limite_diario_usd   NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS ia_desabilitada_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ia_desabilitada_motivo TEXT;

COMMENT ON COLUMN public.tenants.ia_habilitada IS 'Kill switch — false bloqueia chamadas OpenAI para o tenant. Reset manual via dashboard ou automático no início do dia.';
COMMENT ON COLUMN public.tenants.ia_limite_diario_usd IS 'Budget diário OpenAI em USD. Defaults: Starter=5.00, Pro=15.00, Enterprise=configurável. Setado no provisionamento.';
COMMENT ON COLUMN public.tenants.ia_desabilitada_em IS 'Timestamp do último kill switch automático. NULL = nunca acionado.';
COMMENT ON COLUMN public.tenants.ia_desabilitada_motivo IS 'Motivo do kill switch. Ex: budget_diario_excedido.';
