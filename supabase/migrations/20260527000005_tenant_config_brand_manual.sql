-- Migration retroativa: rastreabilidade de brand_manual em tenant_config
-- IF NOT EXISTS: no-op se coluna já existia fora de migrations (schema drift)
-- Schema canônico: ARCHITECTURE.md §3.2
ALTER TABLE public.tenant_config
  ADD COLUMN IF NOT EXISTS brand_manual JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tenant_config_brand_vertical
  ON public.tenant_config ((brand_manual->>'vertical'));
