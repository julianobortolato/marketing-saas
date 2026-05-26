-- Migration: bridge MKT→V2 — índice parcial + comment (ROADMAP Sprint 0 §0.5)
-- Coluna iara_tenant_id já existe em 20260519000001_create_tenants.sql
-- Esta migration adiciona o índice parcial e atualiza o comment com sunset condition.

CREATE INDEX IF NOT EXISTS idx_tenants_iara_bridge
  ON public.tenants(iara_tenant_id)
  WHERE iara_tenant_id IS NOT NULL;

COMMENT ON COLUMN public.tenants.iara_tenant_id IS
  'Bridge MKT→V2. Sunset: remover se em 12 meses 0 tenant tiver o bridge. Avaliação: 26/mai/2027 (ARCHITECTURE.md §9.3). Tenant com bridge ativo pula o agente CMO (webhook route §step-10).';
