-- Migration 20260520000006: academia_config — colunas Fase 3
-- Caderno editorial (ADR-MKT-001 §4.4) + tema visual + atualizado_em
-- Nunca editar migrations anteriores.

ALTER TABLE public.academia_config
  ADD COLUMN IF NOT EXISTS tema               JSONB,          -- identidade visual do tenant {primary,secondary,font,logo_url}
  ADD COLUMN IF NOT EXISTS argumentos_venda   JSONB,          -- [{contexto, argumento, evidencia}, ...]
  ADD COLUMN IF NOT EXISTS objecoes_comuns    JSONB,          -- [{objecao, resposta_padrao}, ...]
  ADD COLUMN IF NOT EXISTS palavras_proibidas TEXT[],         -- palavras que o agente não pode usar
  ADD COLUMN IF NOT EXISTS gatilhos_handoff   JSONB,          -- {desconto: true, pagamento: true, ...}
  ADD COLUMN IF NOT EXISTS persona_cmo        TEXT,           -- override do tom padrão do CMO por tenant
  ADD COLUMN IF NOT EXISTS atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.academia_config.tema IS 'Visual identity per tenant — ENGINE_VS_TENANT: consumed via CSS vars, never hardcoded.';
COMMENT ON COLUMN public.academia_config.argumentos_venda IS 'ADR-MKT-001 §4.4 — editorial notebook. Array of {contexto, argumento, evidencia}.';
COMMENT ON COLUMN public.academia_config.objecoes_comuns IS 'ADR-MKT-001 §4.4 — objection handling. Array of {objecao, resposta_padrao}.';
COMMENT ON COLUMN public.academia_config.palavras_proibidas IS 'ADR-MKT-001 §9 guardrail — checked post-LLM; words the CMO agent must never use.';
COMMENT ON COLUMN public.academia_config.gatilhos_handoff IS 'ADR-MKT-001 §4.4 — conditions that force handoff_humano tool call.';
COMMENT ON COLUMN public.academia_config.persona_cmo IS 'Per-tenant CMO persona override injected in system_prompt Block 1.';
COMMENT ON COLUMN public.academia_config.atualizado_em IS 'Auto-updated by trg_academia_config_atualizado_em on every UPDATE.';

-- ============================================================================
-- Trigger: manter atualizado_em sincronizado em todo UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_set_atualizado_em IS 'Generic BEFORE UPDATE trigger: sets atualizado_em = now().';

CREATE TRIGGER trg_academia_config_atualizado_em
  BEFORE UPDATE ON public.academia_config
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_atualizado_em();
