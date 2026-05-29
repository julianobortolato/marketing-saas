-- Migration 20260528000001: novos statuses + colunas de agendamento Zernio
-- Fase 6: publicação via Zernio
-- Valores existentes: rascunho, pendente_aprovacao, aprovado, rejeitado, publicado, exportado, falhou
-- Novos: agendado, falhou_publicacao, rejeitado_reformular

ALTER TABLE public.conteudos
  DROP CONSTRAINT IF EXISTS conteudos_status_check;

ALTER TABLE public.conteudos
  ADD CONSTRAINT conteudos_status_check CHECK (
    status IN (
      'rascunho',
      'pendente_aprovacao',
      'aprovado',
      'rejeitado',
      'publicado',
      'exportado',
      'falhou',
      'agendado',
      'falhou_publicacao',
      'rejeitado_reformular'
    )
  );

ALTER TABLE public.conteudos
  ADD COLUMN IF NOT EXISTS zernio_post_id  TEXT,
  ADD COLUMN IF NOT EXISTS agendado_para   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conteudos_tenant_agendado
  ON public.conteudos(tenant_id, agendado_para)
  WHERE status = 'agendado';
