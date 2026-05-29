-- Migration 20260528000003: remover constraint posts_status_check herdado do rename
-- posts → conteudos (migration 20260527100003) não renomeou os constraints da tabela posts.
-- Resultado: conteudos tem 2 constraints: posts_status_check (antigo, bloqueando)
--            e conteudos_status_check (novo, completo).
-- Solução: dropar o antigo.

ALTER TABLE public.conteudos
  DROP CONSTRAINT IF EXISTS posts_status_check;
