-- Migration 20260527100002: prompts_agentes — tabela + RLS + seed gerador_copy v1
-- ADR-MKT-001 §3: prompts são conteúdo operacional — vivem em banco, não em código.
-- escopo='engine': genérico, tenant_id=NULL. escopo='tenant': override por tenant.

CREATE TABLE IF NOT EXISTS public.prompts_agentes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agente     TEXT        NOT NULL,
  versao     INTEGER     NOT NULL,
  prompt     TEXT        NOT NULL,
  ativo      BOOLEAN     NOT NULL DEFAULT false,
  escopo     TEXT        NOT NULL DEFAULT 'engine'
               CONSTRAINT prompts_escopo_check CHECK (escopo IN ('engine', 'tenant')),
  tenant_id  UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompts_escopo_tenant_check CHECK (
    (escopo = 'engine' AND tenant_id IS NULL) OR
    (escopo = 'tenant' AND tenant_id IS NOT NULL)
  )
);

-- Partial indexes evitam NULL != NULL nos UNIQUEs compostos
CREATE UNIQUE INDEX prompts_engine_unico
  ON public.prompts_agentes (agente, versao)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX prompts_tenant_unico
  ON public.prompts_agentes (agente, versao, tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_prompts_agente_ativo ON public.prompts_agentes (agente, ativo, escopo);

ALTER TABLE public.prompts_agentes ENABLE ROW LEVEL SECURITY;

-- engine: qualquer authenticated lê (cron usa service_role, bypassa RLS de qualquer forma)
CREATE POLICY prompts_select_engine ON public.prompts_agentes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (escopo = 'engine');

-- tenant: só o próprio tenant lê seus overrides
CREATE POLICY prompts_select_tenant ON public.prompts_agentes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    escopo = 'tenant'
    AND tenant_id IS NOT NULL
    AND tenant_id = public.fn_tenant_id()
  );

-- RESTRICTIVE: garante isolamento mesmo com políticas permissivas futuras
CREATE POLICY prompts_restrict ON public.prompts_agentes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    escopo = 'engine'
    OR (escopo = 'tenant' AND tenant_id IS NOT NULL AND tenant_id = public.fn_tenant_id())
  );

GRANT SELECT ON public.prompts_agentes TO authenticated;
GRANT ALL    ON public.prompts_agentes TO service_role;

-- Seed: prompt engine para gerador_copy v1
INSERT INTO public.prompts_agentes (agente, versao, prompt, ativo, escopo, tenant_id)
VALUES (
  'gerador_copy',
  1,
  'Você é o CMO autônomo de uma pequena empresa de fitness.
Sua tarefa é gerar o conteúdo de marketing semanal para Instagram e Facebook.

Contexto da marca será fornecido no user message como JSON com os campos:
- brand_manual.tom_de_voz: como a marca fala
- brand_manual.publico_alvo: para quem
- brand_manual.diferenciais: o que torna único
- historico_recente: textos dos últimos 3 posts (evitar repetição de tema)
- fotos_disponiveis: lista de fotos com tags [{id, tags}]

Gere EXATAMENTE 1 post com este JSON e nada mais:
{
  "tema": "<tema do post em 1 frase>",
  "copy_principal": "<texto principal, max 120 chars, tom da marca>",
  "cta": "<call-to-action, max 40 chars>",
  "hashtags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>", "<tag5>"],
  "foto_id": "<id da foto mais adequada ao tema, da lista fotos_disponiveis>",
  "formato": "feed",
  "justificativa_foto": "<1 frase explicando por que essa foto>"
}

Regras:
- Nunca inventar foto — usar apenas ids da lista fotos_disponiveis
- Se fotos_disponiveis estiver vazia: foto_id = null
- Não repetir tema do historico_recente
- Copy deve soar como humano, não como IA
- Não usar emojis no copy_principal
- CTA deve ser imperativo: "Agende", "Venha", "Conheça", nunca "Saiba mais"',
  true,
  'engine',
  NULL
);
