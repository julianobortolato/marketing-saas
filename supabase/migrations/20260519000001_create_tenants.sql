-- Migration 0001: Create public.tenants
-- Multi-tenant foundation — every tenant is an academy account.
-- tenant_id in all other tables references tenants.id.
-- CLAUDE.md: tenant_id NOT NULL + RLS required (see migration 0004).

CREATE TABLE public.tenants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT        NOT NULL,
  -- Unique, URL-safe identifier generated from email prefix at signup (handle_new_user trigger)
  slug            TEXT        UNIQUE NOT NULL,
  -- Bridge column for future IARA Systems integration (ADR-003); NULL = standalone
  iara_tenant_id  UUID        NULL,
  -- Billing plan — starter (default) / pro / enterprise
  plano           TEXT        NOT NULL DEFAULT 'starter'
                              CHECK (plano IN ('starter', 'pro', 'enterprise')),
  ativo           BOOLEAN     NOT NULL DEFAULT TRUE,
  -- FOUND-02 billing fields
  setup_fee_pago  BOOLEAN     NOT NULL DEFAULT FALSE,
  contrato_anual  BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Founder flag: first ~10 tenants get 50% discount for 6 months (fn_calcular_mensalidade)
  fundador        BOOLEAN     NOT NULL DEFAULT FALSE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tenants IS 'One row per academy account. All other tables reference tenant_id.';
COMMENT ON COLUMN public.tenants.slug IS 'URL-safe unique identifier. Generated from email prefix at signup; collision handled with random suffix.';
COMMENT ON COLUMN public.tenants.iara_tenant_id IS 'Nullable bridge to IARA Systems. NULL = standalone product (ADR-003).';
COMMENT ON COLUMN public.tenants.fundador IS 'Founder discount flag — set manually by admin for first 10 tenants; defaults FALSE.';
