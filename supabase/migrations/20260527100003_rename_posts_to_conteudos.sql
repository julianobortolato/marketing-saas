-- Migration 20260527100003: unificar tabelas de conteúdo
-- Resolve conflito detectado na review dev-sênior (Fase 5.3):
--   migration 0007 criou `conteudos` (schema mínimo de wizard)
--   migration 0009 criou `posts` (schema rico de Fase 5)
-- Decisão B7: manter schema de posts, renomear para conteudos,
-- adicionar colunas do wizard que estavam no schema antigo.

-- 1. Remover tabela antiga (pre-produção, sem dados reais)
DROP TABLE IF EXISTS public.conteudos;

-- 2. Normalizar nome da coluna: copy → copy_principal
ALTER TABLE public.posts RENAME COLUMN copy TO copy_principal;

-- 3. Adicionar colunas usadas pelo wizard (app/api/onboarding/posts)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS copy_legenda TEXT,
  ADD COLUMN IF NOT EXISTS foto_url     TEXT,
  ADD COLUMN IF NOT EXISTS fonte        TEXT NOT NULL DEFAULT 'cmo'
    CONSTRAINT conteudos_fonte_check CHECK (fonte IN ('wizard', 'cmo', 'manual'));

-- 4. Renomear tabela
ALTER TABLE public.posts RENAME TO conteudos;

-- 5. Renomear índices
ALTER INDEX IF EXISTS idx_posts_tenant_status    RENAME TO idx_conteudos_tenant_status;
ALTER INDEX IF EXISTS idx_posts_tenant_criado_em RENAME TO idx_conteudos_tenant_criado_em;

-- 6. Renomear trigger
ALTER TRIGGER posts_atualizado_em ON public.conteudos RENAME TO conteudos_atualizado_em;

-- 7. Renomear políticas RLS
ALTER POLICY posts_tenant_isolation   ON public.conteudos RENAME TO conteudos_tenant_isolation;
ALTER POLICY posts_tenant_restrictive ON public.conteudos RENAME TO conteudos_tenant_restrictive;
