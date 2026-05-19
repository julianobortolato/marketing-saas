-- Migration 0003: Create public.academia_config
-- DNA of each academy. One row per tenant (UNIQUE on tenant_id).
-- CLAUDE.md: tenant_id NOT NULL + RLS required (see migration 0004).

CREATE TABLE public.academia_config (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome_academia TEXT        NOT NULL,
  bairro        TEXT,
  cidade        TEXT,
  -- Default 5km radius for local ad targeting (core value)
  raio_km       SMALLINT    NOT NULL DEFAULT 5 CHECK (raio_km >= 1 AND raio_km <= 200),
  -- formal / neutro / coloquial — drives AI content tone
  tom_de_voz    TEXT        CHECK (tom_de_voz IN ('formal', 'neutro', 'coloquial')),
  -- Array of differentiators e.g. {'Musculação','CrossFit','Personal Trainer'}
  diferenciais  TEXT[],
  -- Operating hours stored as JSONB, e.g. {"text": "Seg-Sex 06h-22h / Sab 08h-18h"}
  horarios      JSONB,
  -- Plans/pricing stored as JSONB, e.g. {"text": "Mensal R$120, Trimestral R$300"}
  planos        JSONB,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.academia_config IS 'Academy DNA — one row per tenant. Drives AI content generation and ad targeting.';
COMMENT ON COLUMN public.academia_config.raio_km IS 'Local ad targeting radius in km. Default 5km (core value: hyperlocal campaigns).';
COMMENT ON COLUMN public.academia_config.horarios IS 'Operating hours as JSONB {"text": "..."}. Free-text in Phase 1; structured in future migration.';
COMMENT ON COLUMN public.academia_config.planos IS 'Academy plans/pricing as JSONB {"text": "..."}. Free-text in Phase 1.';
