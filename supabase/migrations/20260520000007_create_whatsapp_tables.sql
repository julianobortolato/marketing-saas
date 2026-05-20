-- Migration 20260520000007: tabelas WhatsApp — ADR-MKT-001 §4.1, 4.2, 4.3
-- evolution_instances, conversas, chat_messages
-- RLS: PERMISSIVE (SELECT) + RESTRICTIVE (ALL) — writes via SECURITY DEFINER RPCs.

-- ============================================================================
-- 4.1 evolution_instances — roteamento instance_name → tenant_id
-- ============================================================================
CREATE TABLE public.evolution_instances (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  instance_name     TEXT        NOT NULL UNIQUE,         -- identificador na Evolution API V2
  numero_whatsapp   TEXT        NOT NULL,                -- E.164: +5567...
  api_key_encrypted TEXT        NOT NULL,                -- chave cifrada via Supabase Vault
  webhook_secret    TEXT        NOT NULL,                -- HMAC sha256 secret por instância (Manifesto P8)
  ativo             BOOLEAN     NOT NULL DEFAULT true,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evolution_instances_tenant ON public.evolution_instances(tenant_id);
-- Índice único parcial: apenas 1 número ativo por instância (antecipa Enterprise multi-instance)
CREATE UNIQUE INDEX idx_evolution_instances_numero_ativo ON public.evolution_instances(numero_whatsapp) WHERE ativo = true;

ALTER TABLE public.evolution_instances ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE: owner do tenant lê suas instâncias no dashboard
CREATE POLICY evolution_instances_select_permissive ON public.evolution_instances
  FOR SELECT
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

-- RESTRICTIVE: fail-closed — nenhum authenticated cross-tenant
CREATE POLICY evolution_instances_tenant_restrictive ON public.evolution_instances
  AS RESTRICTIVE FOR ALL
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

CREATE TRIGGER trg_evolution_instances_atualizado_em
  BEFORE UPDATE ON public.evolution_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_atualizado_em();

COMMENT ON TABLE public.evolution_instances IS 'ADR-MKT-001 §4.1 — 1:N tenant→instâncias. Roteamento webhook instance_name→tenant_id. api_key_encrypted via Supabase Vault.';
COMMENT ON COLUMN public.evolution_instances.webhook_secret IS 'HMAC sha256 secret por instância — valida assinatura do webhook antes de processar (Manifesto P8).';

-- ============================================================================
-- 4.2 conversas — estado da conversa por lead (1 por remotejid por tenant)
-- ============================================================================
CREATE TABLE public.conversas (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id               UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  evolution_instance_id UUID        NOT NULL REFERENCES public.evolution_instances(id),
  remotejid             TEXT        NOT NULL,            -- WhatsApp JID do lead
  ia_ativa              BOOLEAN     NOT NULL DEFAULT true, -- false = handoff humano ativo
  motivo_handoff        TEXT,                            -- desconto|loop|pedido_explicito|outro
  ultima_mensagem_em    TIMESTAMPTZ,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, remotejid)                         -- 1 conversa ativa por número por tenant
);

CREATE INDEX idx_conversas_lead ON public.conversas(lead_id);
-- Índice parcial: lista de conversas em handoff para o dashboard
CREATE INDEX idx_conversas_handoff ON public.conversas(tenant_id, ia_ativa) WHERE ia_ativa = false;

ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversas_select_permissive ON public.conversas
  FOR SELECT
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

CREATE POLICY conversas_tenant_restrictive ON public.conversas
  AS RESTRICTIVE FOR ALL
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

COMMENT ON TABLE public.conversas IS 'ADR-MKT-001 §4.2 — 1 registro por (tenant, remotejid). ia_ativa=false desativa LLM; reativação só por ação humana.';
COMMENT ON COLUMN public.conversas.ia_ativa IS 'false = mensagens continuam sendo persistidas em chat_messages mas não disparam LLM. Reativação manual via dashboard.';

-- ============================================================================
-- 4.3 chat_messages — log imutável de mensagens (entrada e saída)
-- ============================================================================
CREATE TABLE public.chat_messages (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversa_id          UUID        NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  evolution_message_id TEXT,                             -- NULL para mensagens do bot; idempotência de entrada
  direcao              TEXT        NOT NULL CHECK (direcao IN ('entrada','saida')),
  tipo                 TEXT        NOT NULL CHECK (tipo IN ('texto','audio','imagem','outro')),
  conteudo             TEXT        NOT NULL,             -- texto ou transcrição (Manifesto P5: persistir antes de enviar)
  enviada_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_envio         TEXT        CHECK (status_envio IN ('pendente','enviada','falhou')), -- somente 'saida'
  UNIQUE (tenant_id, evolution_message_id)              -- absorve reentrega idempotente do Evolution
);

CREATE INDEX idx_chat_messages_conversa ON public.chat_messages(conversa_id, enviada_em DESC);
-- Índice parcial: retry de mensagens pendentes (background worker futuro)
CREATE INDEX idx_chat_messages_pendentes ON public.chat_messages(tenant_id, status_envio) WHERE status_envio = 'pendente';

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_select_permissive ON public.chat_messages
  FOR SELECT
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

CREATE POLICY chat_messages_tenant_restrictive ON public.chat_messages
  AS RESTRICTIVE FOR ALL
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

COMMENT ON TABLE public.chat_messages IS 'ADR-MKT-001 §4.3 — log imutável. evolution_message_id UNIQUE por tenant absorve reentrega sem cobrar token OpenAI duas vezes.';
COMMENT ON COLUMN public.chat_messages.status_envio IS 'Relevante apenas para direcao=saida. pendente→enviada ou falhou após resposta da Evolution API.';
