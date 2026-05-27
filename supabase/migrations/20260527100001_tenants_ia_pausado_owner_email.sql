-- Migration 20260527100001: tenants — ia_pausado + owner_email
-- Fase 5.3: cron handler filtra tenants com ia_pausado=false
-- e envia email de notificação via Resend para owner_email.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ia_pausado  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_email TEXT;

COMMENT ON COLUMN public.tenants.ia_pausado  IS 'Kill switch de geração autônoma: true = cron não processa este tenant';
COMMENT ON COLUMN public.tenants.owner_email IS 'Email do dono para notificações Resend (preenche no wizard passo 1)';
