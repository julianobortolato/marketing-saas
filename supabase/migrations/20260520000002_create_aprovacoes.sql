-- Migration 20260520000002: Create public.aprovacoes
-- Approval queue for Phase 2 (APROV-01, APROV-02).
-- tipo conteudo = weekly organic batch (APROV-01, batch up to 10, no individual approval).
-- tipo campanha = per-campaign paid approval (APROV-02, mandatory before any paid publish).
-- referencia_id points at conteudos.id or campanhas.id — tables arrive in Phases 4/5.
--   NO FK constraint on referencia_id in Phase 2 (target tables do not exist yet).
-- CLAUDE.md: tenant_id NOT NULL + RLS required (see migration 20260520000003).

CREATE TABLE public.aprovacoes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo          TEXT        NOT NULL CHECK (tipo IN ('conteudo','campanha')),
  referencia_id UUID,
  status        TEXT        NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente','aprovado','rejeitado')),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the weekly organic batch query (Plan 04) and campaign gate (APROV-02 assertCampaignApproved).
CREATE INDEX idx_aprovacoes_tenant_tipo_status ON public.aprovacoes (tenant_id, tipo, status);

COMMENT ON TABLE public.aprovacoes IS 'Approval records. tipo conteudo = weekly organic batch (APROV-01, batch up to 10). tipo campanha = per-campaign paid approval (APROV-02, no paid campaign without an aprovado row). referencia_id points at conteudos.id or campanhas.id (those tables arrive in later phases — nullable / unconstrained FK in Phase 2).';
COMMENT ON COLUMN public.aprovacoes.referencia_id IS 'Points at conteudos.id (tipo=conteudo) or campanhas.id (tipo=campanha). No FK constraint — target tables arrive in Phases 4/5.';
