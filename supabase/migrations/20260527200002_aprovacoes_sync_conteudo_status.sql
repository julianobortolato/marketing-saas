-- Migration 20260527200002: trigger que propaga aprovacoes.status → conteudos.status
-- Motivo: Fase 6-LITE — download endpoint precisa checar conteudos.status = 'aprovado'
-- mas a tela de aprovações só atualiza aprovacoes.status (actions.ts)
-- Resolve gap detectado no sprint-preview Fase 6-LITE

CREATE OR REPLACE FUNCTION public.fn_sync_conteudo_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Propaga apenas para registros de tipo conteudo com referencia_id preenchida
  IF NEW.tipo = 'conteudo' AND NEW.referencia_id IS NOT NULL
    AND (OLD.status IS DISTINCT FROM NEW.status)
    AND NEW.status IN ('aprovado', 'rejeitado')
  THEN
    UPDATE public.conteudos
      SET status = NEW.status
      WHERE id = NEW.referencia_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER aprovacoes_sync_conteudo_status
  AFTER UPDATE OF status ON public.aprovacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_conteudo_status();
