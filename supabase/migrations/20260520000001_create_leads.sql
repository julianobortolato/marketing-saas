-- Migration 20260520000001: Create public.leads
-- Lead pipeline foundation for Phase 2 (LEAD-01, LEAD-02, LEAD-03).
-- origem: meta_form | whatsapp | google | manual (Phase 2 ingestion sources).
-- status pipeline: novo -> contatado -> agendado -> convertido | perdido.
-- remotejid: WhatsApp phone JID — populated by Phase 3 agent; nullable in Phase 2.
-- score: future AI scoring field; present now for forward-compat with Phase 3.
-- CLAUDE.md: tenant_id NOT NULL + RLS required (see migration 20260520000003).

CREATE TABLE public.leads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome        TEXT,
  telefone    TEXT,
  origem      TEXT        NOT NULL DEFAULT 'manual'
                          CHECK (origem IN ('meta_form','whatsapp','google','manual')),
  status      TEXT        NOT NULL DEFAULT 'novo'
                          CHECK (status IN ('novo','contatado','agendado','convertido','perdido')),
  remotejid   TEXT,
  score       SMALLINT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes scoped to tenant — Plan 03 lead panel filters by status and orders by criado_em.
CREATE INDEX idx_leads_tenant_status ON public.leads (tenant_id, status);
CREATE INDEX idx_leads_tenant_criado ON public.leads (tenant_id, criado_em DESC);

COMMENT ON TABLE public.leads IS 'Captured leads. origem: meta_form|whatsapp|google|manual. status pipeline: novo->contatado->agendado->convertido|perdido. remotejid populated by Phase 3 WhatsApp agent.';
COMMENT ON COLUMN public.leads.remotejid IS 'WhatsApp phone JID — populated by Phase 3 agent; nullable in Phase 2.';
COMMENT ON COLUMN public.leads.score IS 'AI lead score (0-100); populated by future Phase 3 agent. Nullable in Phase 2.';
