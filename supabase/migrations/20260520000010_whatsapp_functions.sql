-- Migration 20260520000010: funções e RPCs do agente WhatsApp (ADR-MKT-001 §5)
-- Todas SECURITY DEFINER + SET search_path = '' (prevenção search_path injection).
-- Chamadas vindas de service_role (webhook) re-validam tenant por PK — nunca via JWT.
--
-- DO $$ inicial dropa TODOS os overloads das funções gerenciadas aqui, independente
-- de assinatura. Necessário porque RPCs criadas via SQL Editor sem rastreamento podem
-- ter assinaturas diferentes (CREATE OR REPLACE falha com SQLSTATE 42P13 ao renomear
-- parâmetros; COMMENT ON falha com SQLSTATE 42725 quando há múltiplos overloads).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fn_tenant_id_by_evolution_instance',
        'rpc_persistir_mensagem_entrada',
        'rpc_persistir_resposta_bot',
        'rpc_registrar_uso_ia',
        'rpc_atualizar_score_lead',
        'rpc_handoff_humano'
      )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END;
$$;

-- ============================================================================
-- 5.1 fn_tenant_id_by_evolution_instance(p_instance_name TEXT) → UUID
-- Resolve instance_name recebido no webhook → tenant_id.
-- Retorna NULL se instância não encontrada ou inativa.
-- ============================================================================
CREATE FUNCTION public.fn_tenant_id_by_evolution_instance(
  p_instance_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.evolution_instances
  WHERE instance_name = p_instance_name AND ativo = true;
  RETURN v_tenant_id;  -- NULL se não achar ou inativa
END;
$$;

COMMENT ON FUNCTION public.fn_tenant_id_by_evolution_instance(TEXT) IS 'ADR-MKT-001 §5.1 — resolve instance_name→tenant_id. Retorna NULL se não encontrada. Chamada antes de qualquer processamento no webhook.';

-- ============================================================================
-- 5.2 rpc_persistir_mensagem_entrada(...) → JSONB
-- Entry-point do webhook. Idempotente por (tenant_id, evolution_message_id).
-- Cria lead e conversa se for primeiro contato.
-- Retorna: { ok, idempotente, conversa_id, lead_id, ia_ativa }
-- ============================================================================
CREATE FUNCTION public.rpc_persistir_mensagem_entrada(
  p_instance_name        TEXT,
  p_remotejid            TEXT,
  p_evolution_message_id TEXT,
  p_conteudo             TEXT,
  p_tipo                 TEXT DEFAULT 'texto'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id             UUID;
  v_evolution_instance_id UUID;
  v_lead_id               UUID;
  v_conversa_id           UUID;
  v_ia_ativa              BOOLEAN;
BEGIN
  -- Resolve instância → tenant (re-valida por PK — skill-seguranca §9.4)
  SELECT id, tenant_id INTO v_evolution_instance_id, v_tenant_id
  FROM public.evolution_instances
  WHERE instance_name = p_instance_name AND ativo = true;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'instance_not_found');
  END IF;

  -- Idempotência: absorve reentrega do Evolution sem duplicar (ADR-MKT-001 §4.3)
  IF p_evolution_message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.chat_messages
    WHERE tenant_id = v_tenant_id
      AND evolution_message_id = p_evolution_message_id
  ) THEN
    SELECT c.id, c.ia_ativa, c.lead_id
      INTO v_conversa_id, v_ia_ativa, v_lead_id
    FROM public.chat_messages cm
    JOIN public.conversas c ON c.id = cm.conversa_id
    WHERE cm.tenant_id = v_tenant_id
      AND cm.evolution_message_id = p_evolution_message_id;

    RETURN jsonb_build_object(
      'ok',          true,
      'idempotente', true,
      'conversa_id', v_conversa_id,
      'lead_id',     v_lead_id,
      'ia_ativa',    v_ia_ativa
    );
  END IF;

  -- Get-or-create lead pelo remotejid (sem UNIQUE em leads — insert condicional)
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE tenant_id = v_tenant_id AND remotejid = p_remotejid
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    INSERT INTO public.leads (tenant_id, remotejid, origem, status)
    VALUES (v_tenant_id, p_remotejid, 'whatsapp', 'novo')
    RETURNING id INTO v_lead_id;
  END IF;

  -- Upsert conversa — UNIQUE (tenant_id, remotejid) garante idempotência
  INSERT INTO public.conversas (
    tenant_id, lead_id, evolution_instance_id, remotejid, ultima_mensagem_em
  )
  VALUES (v_tenant_id, v_lead_id, v_evolution_instance_id, p_remotejid, now())
  ON CONFLICT (tenant_id, remotejid) DO UPDATE
    SET ultima_mensagem_em = now()
  RETURNING id, ia_ativa INTO v_conversa_id, v_ia_ativa;

  -- Persistir mensagem ANTES de qualquer chamada externa (Manifesto P5)
  INSERT INTO public.chat_messages (
    tenant_id, conversa_id, evolution_message_id, direcao, tipo, conteudo
  )
  VALUES (
    v_tenant_id, v_conversa_id, p_evolution_message_id, 'entrada', p_tipo, p_conteudo
  );

  RETURN jsonb_build_object(
    'ok',          true,
    'idempotente', false,
    'conversa_id', v_conversa_id,
    'lead_id',     v_lead_id,
    'ia_ativa',    v_ia_ativa
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_persistir_mensagem_entrada(TEXT, TEXT, TEXT, TEXT, TEXT) IS 'ADR-MKT-001 §5.2 — webhook entry-point. Idempotente por evolution_message_id. Cria lead+conversa no primeiro contato. Retorna ia_ativa para o caller decidir se dispara LLM.';

-- ============================================================================
-- 5.3 rpc_persistir_resposta_bot(...) → JSONB
-- Persiste mensagem de saída com status_envio='pendente' ANTES do envio.
-- Caller atualiza status_envio para 'enviada'|'falhou' após resposta Evolution.
-- Retorna: { ok, message_id }
-- ============================================================================
CREATE FUNCTION public.rpc_persistir_resposta_bot(
  p_tenant_id   UUID,
  p_conversa_id UUID,
  p_conteudo    TEXT,
  p_tipo        TEXT DEFAULT 'texto'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- Re-valida que a conversa pertence ao tenant (skill-seguranca §9.4)
  IF NOT EXISTS (
    SELECT 1 FROM public.conversas
    WHERE id = p_conversa_id AND tenant_id = p_tenant_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'conversa_not_found_or_wrong_tenant');
  END IF;

  INSERT INTO public.chat_messages (
    tenant_id, conversa_id, direcao, tipo, conteudo, status_envio
  )
  VALUES (p_tenant_id, p_conversa_id, 'saida', p_tipo, p_conteudo, 'pendente')
  RETURNING id INTO v_message_id;

  RETURN jsonb_build_object('ok', true, 'message_id', v_message_id);
END;
$$;

COMMENT ON FUNCTION public.rpc_persistir_resposta_bot(UUID, UUID, TEXT, TEXT) IS 'ADR-MKT-001 §5.3 — persiste saída com status_envio=pendente antes do envio Evolution (Manifesto P5). Caller atualiza para enviada|falhou.';

-- ============================================================================
-- 5.4 rpc_registrar_uso_ia(...) → JSONB
-- Insere em ai_usage_log; trigger fn_acumular_uso_ia faz o resto.
-- Retorna: { ok, ia_habilitada } — caller verifica se kill switch foi acionado.
-- ============================================================================
CREATE FUNCTION public.rpc_registrar_uso_ia(
  p_tenant_id      UUID,
  p_conversa_id    UUID,
  p_modelo         TEXT,
  p_tokens_entrada INTEGER,
  p_tokens_saida   INTEGER,
  p_custo_usd      NUMERIC,
  p_duracao_ms     INTEGER,
  p_sucesso        BOOLEAN,
  p_erro           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ia_habilitada BOOLEAN;
BEGIN
  INSERT INTO public.ai_usage_log (
    tenant_id, conversa_id, modelo,
    tokens_entrada, tokens_saida, custo_usd,
    duracao_ms, sucesso, erro
  )
  VALUES (
    p_tenant_id, p_conversa_id, p_modelo,
    p_tokens_entrada, p_tokens_saida, p_custo_usd,
    p_duracao_ms, p_sucesso, p_erro
  );
  -- Trigger fn_acumular_uso_ia rodou sincronicamente acima — ler estado atual
  SELECT ia_habilitada INTO v_ia_habilitada
  FROM public.tenants WHERE id = p_tenant_id;

  RETURN jsonb_build_object('ok', true, 'ia_habilitada', v_ia_habilitada);
END;
$$;

COMMENT ON FUNCTION public.rpc_registrar_uso_ia(UUID, UUID, TEXT, INTEGER, INTEGER, NUMERIC, INTEGER, BOOLEAN, TEXT) IS 'ADR-MKT-001 §5.4 — insere em ai_usage_log; trigger fn_acumular_uso_ia acumula e aciona kill switch. Retorna ia_habilitada para o caller detectar budget esgotado.';

-- ============================================================================
-- 5.5 rpc_atualizar_score_lead(p_tenant_id, p_lead_id, p_score, p_motivo) → JSONB
-- Re-valida tenant por PK (skill-seguranca §9.4).
-- Retorna: { ok, lead_id, score }
-- ============================================================================
CREATE FUNCTION public.rpc_atualizar_score_lead(
  p_tenant_id UUID,
  p_lead_id   UUID,
  p_score     SMALLINT,
  p_motivo    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Re-valida tenant por PK — previne cross-tenant score write
  UPDATE public.leads
  SET score = p_score
  WHERE id = p_lead_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'lead_not_found_or_wrong_tenant');
  END IF;

  RETURN jsonb_build_object('ok', true, 'lead_id', p_lead_id, 'score', p_score);
END;
$$;

COMMENT ON FUNCTION public.rpc_atualizar_score_lead(UUID, UUID, SMALLINT, TEXT) IS 'ADR-MKT-001 §5.5 — atualiza leads.score. Re-valida tenant por PK (skill-seguranca §9.4). score não controla fluxo de conversa (Manifesto P2).';

-- ============================================================================
-- 5.6 rpc_handoff_humano(p_tenant_id, p_conversa_id, p_motivo) → JSONB
-- Seta ia_ativa=false + motivo_handoff. Irrevogável até ação humana no dashboard.
-- Retorna: { ok, conversa_id }
-- ============================================================================
CREATE FUNCTION public.rpc_handoff_humano(
  p_tenant_id   UUID,
  p_conversa_id UUID,
  p_motivo      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Re-valida tenant por PK antes de mudar estado
  UPDATE public.conversas
  SET ia_ativa       = false,
      motivo_handoff = p_motivo
  WHERE id = p_conversa_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'conversa_not_found_or_wrong_tenant');
  END IF;

  -- TODO Fase 3.2: notificação ao owner (e-mail / Slack) após handoff

  RETURN jsonb_build_object('ok', true, 'conversa_id', p_conversa_id);
END;
$$;

COMMENT ON FUNCTION public.rpc_handoff_humano(UUID, UUID, TEXT) IS 'ADR-MKT-001 §5.6 — seta conversas.ia_ativa=false. Irrevogável até ação humana. Notificação ao owner implementada na Fase 3.2.';
