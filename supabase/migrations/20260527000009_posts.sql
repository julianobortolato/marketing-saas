-- Migration 20260527000009: tabela posts (Fase 5.1 — infra de renderização)
-- Naming: português (criado_em / atualizado_em) — consistente com banco_imagens, academia_config

CREATE TABLE public.posts (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  copy                 TEXT,
  hashtags             TEXT[]      NOT NULL DEFAULT '{}',
  foto_id              UUID        REFERENCES public.banco_imagens(id) ON DELETE SET NULL,
  plataforma           TEXT,
  formato              TEXT,
  template_id          TEXT,
  imagem_composta_url  TEXT,
  campanha_sugerida    JSONB,
  status               TEXT        NOT NULL DEFAULT 'rascunho'
    CONSTRAINT posts_status_check CHECK (
      status IN ('rascunho','pendente_aprovacao','aprovado','rejeitado','publicado','falhou')
    ),
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_tenant_status   ON public.posts(tenant_id, status);
CREATE INDEX idx_posts_tenant_criado_em ON public.posts(tenant_id, criado_em DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- RLS dual: PERMISSIVE + RESTRICTIVE (CLAUDE.md §2.2 — padrão banco_imagens)
CREATE POLICY posts_tenant_isolation ON public.posts
  AS PERMISSIVE FOR ALL TO authenticated
  USING (tenant_id = fn_tenant_id());

CREATE POLICY posts_tenant_restrictive ON public.posts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = fn_tenant_id());

GRANT ALL ON public.posts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;

-- Trigger: manter atualizado_em sincronizado (reutiliza fn_set_atualizado_em da migration 0006)
CREATE TRIGGER posts_atualizado_em
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_atualizado_em();
