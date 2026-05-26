-- Schema canônico: ARCHITECTURE.md §3.3
CREATE TABLE public.banco_imagens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  storage_path    TEXT        NOT NULL,
  url_publica     TEXT        NOT NULL,
  categoria       TEXT        NOT NULL,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  largura         INT,
  altura          INT,
  vision_metadata JSONB,
  aprovada        BOOLEAN     NOT NULL DEFAULT false,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT banco_imagens_tenant_check CHECK (tenant_id IS NOT NULL)
);

CREATE INDEX idx_banco_imagens_tenant_cat ON public.banco_imagens(tenant_id, categoria);
CREATE INDEX idx_banco_imagens_tags       ON public.banco_imagens USING GIN(tags);

ALTER TABLE public.banco_imagens ENABLE ROW LEVEL SECURITY;

-- RLS dual: PERMISSIVE + RESTRICTIVE (CLAUDE.md §2.2)
CREATE POLICY banco_imagens_tenant_isolation ON public.banco_imagens
  AS PERMISSIVE FOR ALL TO authenticated
  USING (tenant_id = fn_tenant_id());

CREATE POLICY banco_imagens_tenant_restrictive ON public.banco_imagens
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = fn_tenant_id());

-- service_role acessa sem RLS (padrão Supabase)
GRANT ALL ON public.banco_imagens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banco_imagens TO authenticated;
