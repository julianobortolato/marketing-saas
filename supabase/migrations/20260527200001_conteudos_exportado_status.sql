-- Migration 20260527200001: adicionar 'exportado' ao CHECK de conteudos.status
-- Motivo: Fase 6-LITE — status após download do ZIP pelo dono
-- Safe: additive (sem dados existentes com valor 'exportado')

ALTER TABLE public.conteudos
  DROP CONSTRAINT IF EXISTS conteudos_status_check;

ALTER TABLE public.conteudos
  ADD CONSTRAINT conteudos_status_check CHECK (
    status IN ('rascunho','pendente_aprovacao','aprovado','rejeitado','publicado','exportado','falhou')
  );
