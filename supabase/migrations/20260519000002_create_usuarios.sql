-- Migration 0002: Create public.usuarios
-- Maps auth.users to tenants. One row per user per tenant (no cross-tenant users in Phase 1).
-- Cascades on auth.users DELETE to avoid orphan rows.
-- CLAUDE.md: tenant_id NOT NULL + RLS required (see migration 0004).

CREATE TABLE public.usuarios (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Role determines UI capabilities and RLS write permissions
  role        TEXT        NOT NULL DEFAULT 'owner'
                          CHECK (role IN ('owner', 'manager', 'viewer')),
  nome        TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.usuarios IS 'Academy users. Joins auth.users (Supabase Auth) to tenants.';
COMMENT ON COLUMN public.usuarios.role IS 'owner: full access | manager: no billing | viewer: read-only.';
