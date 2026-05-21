-- Migration 20260520000011: academia_config — colunas caderno editorial
-- Completa ADR-MKT-001 §4.4: campos de caderno editorial para o agente CMO.
-- migration 0006 adicionou argumentos_venda, objecoes_comuns, palavras_proibidas,
-- gatilhos_handoff, persona_cmo. Esta migration adiciona os campos de texto livre
-- do caderno editorial que alimentam os Blocos 2 e 3 do buildSystemPrompt.

ALTER TABLE public.academia_config
  ADD COLUMN IF NOT EXISTS caderno_editorial_escopo      TEXT,
  ADD COLUMN IF NOT EXISTS caderno_editorial_tom         TEXT,
  ADD COLUMN IF NOT EXISTS caderno_editorial_restricoes  TEXT,
  ADD COLUMN IF NOT EXISTS caderno_editorial_objetivos   TEXT[],
  ADD COLUMN IF NOT EXISTS caderno_editorial_exemplos    TEXT;

COMMENT ON COLUMN public.academia_config.caderno_editorial_escopo IS 'ADR-MKT-001 §4.4 — Tipo de conteúdo que o agente deve produzir e abordar. Injetado no Bloco 2 do buildSystemPrompt.';
COMMENT ON COLUMN public.academia_config.caderno_editorial_tom IS 'ADR-MKT-001 §4.4 — Tom de voz do agente para comunicação com leads. Injetado no Bloco 2.';
COMMENT ON COLUMN public.academia_config.caderno_editorial_restricoes IS 'ADR-MKT-001 §4.4 — O que o agente NÃO deve falar ou fazer. Injetado no Bloco 2.';
COMMENT ON COLUMN public.academia_config.caderno_editorial_objetivos IS 'ADR-MKT-001 §4.4 — Objetivos do agente na conversa (array de strings). Injetado no Bloco 3.';
COMMENT ON COLUMN public.academia_config.caderno_editorial_exemplos IS 'ADR-MKT-001 §4.4 — Exemplos de resposta ideal para calibrar o LLM. Injetado no Bloco 3.';
