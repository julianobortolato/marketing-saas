-- Migration 0008: meta_credentials — armazenamento de tokens OAuth Meta (Facebook/Instagram)
-- Tokens armazenados CRIPTOGRAFADOS na camada de aplicação (AES-256-GCM em lib/crypto.ts).
-- expires_at: Meta tokens expiram em ~60 dias. Refresh rotation implementado na Fase 8.
-- Schema registrado agora para não bloquear Fase 4 OAuth passo 6.

CREATE TABLE public.meta_credentials (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Tokens cifrados no app layer — nunca texto plano no banco
  access_token_encrypted  TEXT        NOT NULL,
  refresh_token_encrypted TEXT,
  -- expires_at: tracked para Fase 8 (refresh rotation automático, 60 dias TTL Meta)
  expires_at              TIMESTAMPTZ,
  scope                   TEXT,
  -- IDs Meta para chamadas de API nas Fases 6-9
  meta_user_id            TEXT,
  page_id                 TEXT,
  ig_user_id              TEXT,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.meta_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY meta_credentials_tenant_isolation ON public.meta_credentials
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((SELECT public.fn_tenant_id()) = tenant_id);

CREATE POLICY meta_credentials_tenant_restrictive ON public.meta_credentials
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND (SELECT public.fn_tenant_id()) = tenant_id);

GRANT ALL ON public.meta_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_credentials TO authenticated;

COMMENT ON TABLE public.meta_credentials IS 'OAuth Meta por tenant. access_token_encrypted = AES-256-GCM via lib/crypto.ts. expires_at rastreado para refresh rotation na Fase 8 (60 dias TTL Meta).';
COMMENT ON COLUMN public.meta_credentials.expires_at IS 'TTL do access token Meta (~60 dias). Fase 8 implementa refresh rotation automático quando expires_at - NOW() < 7 dias.';
