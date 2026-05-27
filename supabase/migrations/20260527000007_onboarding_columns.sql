-- Migration 0007: Wizard de onboarding — colunas, vertical_presets, conteudos, storage
-- Fase 4 (Wizard + Manual de Marca + Banco de Imagens)

-- ============================================================================
-- TENANTS: colunas para rastrear progresso do wizard e dados coletados no passo 1
-- ============================================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarding_passo SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_owner TEXT;

COMMENT ON COLUMN public.tenants.onboarding_passo IS '1-8 = passo atual; 9 = wizard concluído';
COMMENT ON COLUMN public.tenants.cidade IS 'Cidade da sede, coletado no passo 1 do wizard';
COMMENT ON COLUMN public.tenants.whatsapp_owner IS 'WhatsApp do dono (E.164), coletado no passo 1';

-- ============================================================================
-- VERTICAL_PRESETS: tabela ENGINE (sem tenant_id) — preset de categorias por vertical
-- ============================================================================
CREATE TABLE public.vertical_presets (
  vertical      TEXT        PRIMARY KEY,
  categorias    TEXT[]      NOT NULL,
  exemplos_tom  JSONB       NOT NULL DEFAULT '{}',
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.vertical_presets (vertical, categorias) VALUES
  ('fitness',     ARRAY['treino','bastidores','equipe','espaco','depoimento','equipamento']),
  ('gastronomia', ARRAY['pratos','ambiente','equipe','bastidores','eventos']),
  ('beleza',      ARRAY['procedimentos','antes-depois','equipe','ambiente','produtos']),
  ('generico',    ARRAY['produto','equipe','espaco','bastidores','cliente','evento']);

-- Sem RLS: tabela de configuração read-only do engine
GRANT SELECT ON public.vertical_presets TO authenticated;
GRANT ALL    ON public.vertical_presets TO service_role;

-- ============================================================================
-- CONTEUDOS: armazenamento de posts (schema mínimo — extendido na Fase 5 com Satori)
-- ============================================================================
CREATE TABLE public.conteudos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  formato        TEXT        NOT NULL
                             CHECK (formato IN ('feed_1080','story_1920','carousel_slide')),
  copy_principal TEXT        NOT NULL,
  copy_legenda   TEXT,
  hashtags       TEXT[]      NOT NULL DEFAULT '{}',
  foto_url       TEXT,
  status         TEXT        NOT NULL DEFAULT 'rascunho'
                             CHECK (status IN ('rascunho','pendente_aprovacao','aprovado','rejeitado','publicado')),
  fonte          TEXT        NOT NULL DEFAULT 'wizard'
                             CHECK (fonte IN ('wizard','cmo','manual')),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conteudos_tenant_status ON public.conteudos (tenant_id, status);

ALTER TABLE public.conteudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY conteudos_tenant_isolation ON public.conteudos
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

CREATE POLICY conteudos_tenant_restrictive ON public.conteudos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND (SELECT public.fn_tenant_id()) = tenant_id);

GRANT ALL ON public.conteudos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conteudos TO authenticated;

-- ============================================================================
-- STORAGE: buckets privados para logos e banco de imagens
-- Signed URLs (TTL 1h) para Vision e galeria — nunca URL pública permanente
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('logos',
   'logos',
   false,
   5242880,   -- 5 MB
   ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('banco-imagens',
   'banco-imagens',
   false,
   20971520,  -- 20 MB
   ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- RLS storage.objects: logos — isolamento por tenant_id como primeiro segmento do path
CREATE POLICY "logos_tenant_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (SELECT public.fn_tenant_id())::text
  );

CREATE POLICY "logos_tenant_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (SELECT public.fn_tenant_id())::text
  );

CREATE POLICY "logos_tenant_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (SELECT public.fn_tenant_id())::text
  );

-- RLS storage.objects: banco-imagens
CREATE POLICY "banco_imagens_tenant_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'banco-imagens'
    AND (storage.foldername(name))[1] = (SELECT public.fn_tenant_id())::text
  );

CREATE POLICY "banco_imagens_tenant_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'banco-imagens'
    AND (storage.foldername(name))[1] = (SELECT public.fn_tenant_id())::text
  );

CREATE POLICY "banco_imagens_tenant_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'banco-imagens'
    AND (storage.foldername(name))[1] = (SELECT public.fn_tenant_id())::text
  );
