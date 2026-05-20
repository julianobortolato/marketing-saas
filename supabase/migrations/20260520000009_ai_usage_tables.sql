-- Migration 20260520000009: tabelas de uso de IA + trigger kill switch
-- ai_usage_log (ADR-MKT-001 §4.6) + ai_usage_diario (§4.7) + fn_acumular_uso_ia
-- Requer: migration 0008 (tenants.ia_habilitada, ia_limite_diario_usd)

-- ============================================================================
-- 4.6 ai_usage_log — auditoria de cada chamada OpenAI
-- ============================================================================
CREATE TABLE public.ai_usage_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversa_id     UUID        REFERENCES public.conversas(id),  -- NULL para chamadas sem conversa
  modelo          TEXT        NOT NULL,                         -- 'gpt-4o','claude-sonnet-4-6'
  tokens_entrada  INTEGER     NOT NULL,
  tokens_saida    INTEGER     NOT NULL,
  custo_usd       NUMERIC(10,6) NOT NULL,
  duracao_ms      INTEGER     NOT NULL,
  sucesso         BOOLEAN     NOT NULL,
  erro            TEXT,                                         -- mensagem de erro se sucesso=false
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_tenant_dia ON public.ai_usage_log(tenant_id, criado_em DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_log_select_permissive ON public.ai_usage_log
  FOR SELECT
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

CREATE POLICY ai_usage_log_tenant_restrictive ON public.ai_usage_log
  AS RESTRICTIVE FOR ALL
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

COMMENT ON TABLE public.ai_usage_log IS 'ADR-MKT-001 §4.6 — registro imutável por chamada. Trigger trg_acumular_uso_ia acumula em ai_usage_diario e aciona kill switch.';
COMMENT ON COLUMN public.ai_usage_log.custo_usd IS 'Custo calculado pelo API Route antes de inserir (tokens × preço do modelo). NUMERIC(10,6) = até 9999.999999.';

-- ============================================================================
-- 4.7 ai_usage_diario — acumulador diário para kill switch
-- ============================================================================
CREATE TABLE public.ai_usage_diario (
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data            DATE        NOT NULL,
  custo_total_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  chamadas_count  INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, data)
);

ALTER TABLE public.ai_usage_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_diario_select_permissive ON public.ai_usage_diario
  FOR SELECT
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

CREATE POLICY ai_usage_diario_tenant_restrictive ON public.ai_usage_diario
  AS RESTRICTIVE FOR ALL
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

COMMENT ON TABLE public.ai_usage_diario IS 'ADR-MKT-001 §4.7 — acumulador consultado pelo kill switch. PK (tenant_id, data) — 1 linha por tenant por dia.';

-- ============================================================================
-- Trigger: fn_acumular_uso_ia
-- Fires AFTER INSERT ON ai_usage_log.
-- 1. Upsert em ai_usage_diario (acumula custo e chamadas do dia)
-- 2. Kill switch: desabilita IA do tenant se custo_total_usd >= ia_limite_diario_usd
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_acumular_uso_ia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_custo_acumulado NUMERIC(10,2);
  v_limite          NUMERIC(10,2);
BEGIN
  -- 1. Upsert acumulador diário
  INSERT INTO public.ai_usage_diario (tenant_id, data, custo_total_usd, chamadas_count)
  VALUES (NEW.tenant_id, CURRENT_DATE, NEW.custo_usd::NUMERIC(10,2), 1)
  ON CONFLICT (tenant_id, data) DO UPDATE
    SET custo_total_usd = public.ai_usage_diario.custo_total_usd + EXCLUDED.custo_total_usd,
        chamadas_count  = public.ai_usage_diario.chamadas_count + 1
  RETURNING custo_total_usd INTO v_custo_acumulado;

  -- 2. Kill switch: desabilita IA se custo acumulado >= limite diário
  SELECT ia_limite_diario_usd INTO v_limite
  FROM public.tenants
  WHERE id = NEW.tenant_id AND ia_habilitada = true;

  IF FOUND AND v_custo_acumulado >= v_limite THEN
    UPDATE public.tenants
    SET ia_habilitada          = false,
        ia_desabilitada_em     = now(),
        ia_desabilitada_motivo = 'budget_diario_excedido'
    WHERE id = NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_acumular_uso_ia IS 'ADR-MKT-001 §4.6/4.7 — trigger AFTER INSERT ai_usage_log: acumula custo diário e aciona kill switch se >= ia_limite_diario_usd.';

CREATE TRIGGER trg_acumular_uso_ia
  AFTER INSERT ON public.ai_usage_log
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_acumular_uso_ia();
