-- gerador.ts faz .select('brand_manual, logo_url') mas a coluna nunca foi criada.
-- PostgREST retorna 400, config fica null, throw 'brand_manual ausente' mesmo com brand_manual preenchido.
ALTER TABLE public.tenant_config
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
