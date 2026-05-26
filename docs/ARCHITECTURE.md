# ARCHITECTURE — Prisma (marketing-saas v2)

> **Versão:** 1.0 — 26/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas`
> **Substitui:** —
> **Base:** PRD v2.4, ESCOPO v2.1, INVENTARIO_MKT_V1, ENGINE_VS_TENANT, ADR-MKT-001/003/005/006

---

## 1. Stack canônica

| Camada | Tecnologia | Runtime |
|---|---|---|
| Framework | Next.js 14 App Router + TypeScript | Edge (rotas de agente) / Node (rotas com fs/lib externa) |
| Banco | Supabase PostgreSQL 15 + RLS | — |
| Auth | Supabase Auth (JWT com `tenant_id` claim) | — |
| Storage | Supabase Storage (buckets por tenant) | — |
| IA texto | OpenAI GPT-4o via tool use nativo | API externa |
| IA visão | OpenAI GPT-4o Vision | API externa |
| Renderização HTML→PNG | Vercel Satori + @resvg/resvg-js | Edge |
| WhatsApp | Evolution API (instância por tenant) | API externa |
| Publicação social | Zernio (camada 1) → Meta API direto (camada 2) → manual (camada 3) | API externa |
| Email transacional | Resend | API externa |
| Observabilidade | Sentry + Vercel logs | — |
| Cripto secrets | pgsodium (Supabase native) | — |
| Rate limit | Upstash Redis | API externa |
| Deploy | Vercel (Hobby — gatilho Pro: ver ADR-MKT-001 §11) | — |

**Princípios de seleção:**
- Edge Runtime por padrão em rotas de agente (zero cold start — ADR-MKT-001 §5)
- Node Runtime só onde necessário (lib externa sem suporte Edge, fs em scripts)
- Sem orquestrador externo (N8N, Make, Zapier) — ADR-MKT-005

---

## 2. Mapa de runtime por rota

| Rota | Runtime | Por quê |
|---|---|---|
| `/api/agents/cmo` | Edge | Cold start zero, webhook crítico |
| `/api/posts/render` | Edge | Satori roda em Edge |
| `/api/webhooks/leads` | Edge | Webhook crítico |
| `/api/cron/follow-up` | Node | Vercel Cron exige Node |
| `/api/cron/kill-switch` | Node | Acesso a libs Node |
| `/api/oauth/meta/callback` | Node | OAuth library Node-only |
| `/api/oauth/google/callback` | Node | googleapis Node-only |
| `/dashboard/*` (RSC) | Node | Server Components do App Router |

---

## 3. Modelo de dados — schemas canônicos

### 3.1 Núcleo multi-tenant (já existente — rename pendente)

```sql
-- Migration: 20260527000001_rename_academia_to_tenant.sql
ALTER TABLE public.academia_config RENAME TO tenant_config;

-- Cria view de compatibilidade temporária (sunset: Sprint 1 concluído)
CREATE VIEW public.academia_config AS SELECT * FROM public.tenant_config;
```

`tenants`, `usuarios`, `tenant_config` (renomeada), `leads`, `aprovacoes`, `chat_messages`, `ai_usage_log`, `ai_usage_diario` — **mantidos do MKT v1**. Inventário canônico: `INVENTARIO_MKT_V1.md`.

### 3.2 Brand manual (extensão de `tenant_config`)

```sql
-- Migration: 20260527000002_brand_manual.sql
ALTER TABLE public.tenant_config ADD COLUMN IF NOT EXISTS brand_manual JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX idx_tenant_config_brand_vertical ON public.tenant_config ((brand_manual->>'vertical'));
```

**Schema canônico do JSONB** (validado em runtime por Zod):

```typescript
{
  identidade: { nome, slogan, logo_url },
  vertical: 'fitness' | 'gastronomia' | 'beleza' | 'generico',
  visual: {
    cor_primaria, cor_secundaria, cor_fundo,
    fonte_titulo, fonte_corpo
  },
  tom_de_voz: { estilo, tratamento, emojis, palavras_proibidas[], vocabulario_preferido[] },
  publico_alvo: { idade, perfil, dor_principal },
  diretrizes_plataforma: { instagram, facebook, tiktok },
  regras_ads: { budget_max_diario_brl, raio_km, objetivo_padrao }
}
```

**Regra ENGINE_VS_TENANT:** o conteúdo do `brand_manual` é Camada 1 (identidade do cliente). Engine nunca lê valor específico de tenant em código compartilhado.

### 3.3 Banco de imagens

```sql
CREATE TABLE banco_imagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url_publica TEXT NOT NULL,
  categoria TEXT NOT NULL,  -- do preset da vertical
  tags TEXT[] NOT NULL DEFAULT '{}',
  largura INT, altura INT,
  vision_metadata JSONB,  -- output do GPT-4o Vision (auto-tag)
  aprovada BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT banco_imagens_tenant_check CHECK (tenant_id IS NOT NULL)
);

CREATE INDEX idx_banco_imagens_tenant_cat ON banco_imagens(tenant_id, categoria);
CREATE INDEX idx_banco_imagens_tags ON banco_imagens USING GIN(tags);

ALTER TABLE banco_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY banco_imagens_tenant_isolation ON banco_imagens
  AS PERMISSIVE FOR ALL TO authenticated
  USING (tenant_id = fn_tenant_id());

CREATE POLICY banco_imagens_tenant_restrictive ON banco_imagens
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = fn_tenant_id());
```

**Bucket Supabase Storage:** `banco-imagens/<tenant_id>/<uuid>.<ext>`. RLS no Storage espelha RLS da tabela.

### 3.4 Prompts dos agentes (ADR-MKT-001 §3)

```sql
CREATE TABLE prompts_agentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente TEXT NOT NULL,           -- 'cmo_bot', 'gerador_copy', 'analista_redes', 'autotag_imagens'
  versao INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  escopo TEXT NOT NULL DEFAULT 'engine',  -- 'engine' | 'tenant'
  tenant_id UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_escopo_check CHECK (
    (escopo = 'engine' AND tenant_id IS NULL) OR
    (escopo = 'tenant' AND tenant_id IS NOT NULL)
  ),
  CONSTRAINT prompt_versao_unica UNIQUE (agente, versao, escopo, tenant_id)
);

CREATE INDEX idx_prompts_ativos ON prompts_agentes(agente, escopo, tenant_id) WHERE ativo = true;
```

**RLS:** prompts de `escopo='engine'` são lidos por todos os tenants (read-only). Prompts de `escopo='tenant'` seguem isolamento por `tenant_id`.

```sql
CREATE POLICY prompts_engine_read ON prompts_agentes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (escopo = 'engine' AND ativo = true);

CREATE POLICY prompts_tenant_isolation ON prompts_agentes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (escopo = 'tenant' AND tenant_id = fn_tenant_id());

CREATE POLICY prompts_restrictive ON prompts_agentes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (escopo = 'engine' AND tenant_id IS NULL) OR
    (escopo = 'tenant' AND tenant_id = fn_tenant_id())
  );
```

**Carregamento em runtime:** engine resolve prompt via fallback `tenant → engine`:

```typescript
async function getPrompt(agente: string, tenantId: string): Promise<string> {
  const { data } = await supabase
    .from('prompts_agentes')
    .select('prompt, escopo')
    .eq('agente', agente).eq('ativo', true)
    .in('escopo', ['engine', 'tenant'])
    .order('escopo', { ascending: false })  // 'tenant' antes de 'engine'
    .limit(1).single();
  return data.prompt;
}
```

### 3.5 Credenciais OAuth — Meta e Google

**Princípio:** tokens nunca em texto plano. Criptografia simétrica via **pgsodium** (extensão nativa Supabase).

```sql
CREATE EXTENSION IF NOT EXISTS pgsodium;

CREATE TABLE meta_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  page_id TEXT NOT NULL,
  instagram_business_id TEXT,
  ad_account_id TEXT,
  access_token_encrypted BYTEA NOT NULL,   -- pgsodium encrypted
  refresh_token_encrypted BYTEA,
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ,
  conectado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_refresh TIMESTAMPTZ
);

CREATE TABLE google_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  google_account_email TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA NOT NULL,
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ,
  conectado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS dual em ambas
ALTER TABLE meta_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_credentials ENABLE ROW LEVEL SECURITY;

-- Padrão repetido para cada: PERMISSIVE + RESTRICTIVE por fn_tenant_id()
```

**Helper de descriptografia (Edge Runtime):**

```typescript
// lib/credentials/meta.ts
async function getMetaToken(tenantId: string): Promise<string> {
  const { data } = await supabase.rpc('rpc_decrypt_meta_token', { p_tenant_id: tenantId });
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return await refreshMetaToken(tenantId);
  }
  return data.access_token;
}
```

A RPC `rpc_decrypt_meta_token` valida `fn_tenant_id() = p_tenant_id` antes de descriptografar.

### 3.6 Audit log

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,         -- 'post_aprovado', 'campanha_ativada', 'kill_switch_disparado'
  entidade TEXT NOT NULL,     -- 'post', 'campanha', 'lead'
  entidade_id UUID,
  payload JSONB,
  ip_origem INET,
  user_agent TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_data ON audit_log(tenant_id, criado_em DESC);
CREATE INDEX idx_audit_acao ON audit_log(acao);
```

**Ações que obrigatoriamente geram audit:**
- `post_aprovado`, `post_publicado`, `post_rejeitado`
- `campanha_criada_pausada`, `campanha_ativada`, `campanha_pausada`
- `kill_switch_disparado`
- `oauth_conectado`, `oauth_revogado`
- `prompt_alterado` (alteração em `prompts_agentes`)
- `tenant_config_alterado` (qualquer write em `tenant_config.brand_manual`)
- `lead_handoff_humano`

### 3.7 Post templates (ADR-MKT-003)

```sql
CREATE TABLE post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical TEXT NOT NULL,
  formato TEXT NOT NULL,  -- 'feed_1080', 'story_1920', 'carousel_slide'
  nome TEXT NOT NULL,
  jsx_template TEXT NOT NULL,
  variaveis_obrigatorias TEXT[] NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Engine-wide (não por tenant no MVP). Gatilho de revisita: 3+ tenants pedindo template customizado → criar `tenant_post_templates`.

### 3.8 Concorrentes (Bloco 3 — pós-MVP imediato)

```sql
CREATE TABLE concorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  facebook_page_id TEXT,
  instagram_handle TEXT,
  site_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE analises_competitivas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  concorrente_id UUID REFERENCES concorrentes(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,  -- output do GPT-4o sobre anúncios ativos
  fonte TEXT NOT NULL,     -- 'serpapi', 'meta_ad_library', 'manual'
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Não MVP** — entra na Fase 6+ do ROADMAP. Listado aqui pra reserva de nome de tabela e RLS pattern.

---

## 4. Arquitetura do bot CMO

### 4.1 Fluxo síncrono (ADR-MKT-001 §2)

```
Evolution API (instância tenant)
  ↓ POST /api/agents/cmo (HMAC header)
Edge Runtime:
  1. Valida HMAC → 401 se inválido
  2. Idempotência: SELECT em chat_messages WHERE evolution_message_id = $1
     ↓ se já existe: 200 OK (no-op)
  3. Rate limit Upstash: remotejid + tenant_id (10 msg/min)
  4. Consentimento LGPD: primeira mensagem? → envia opt-in e aguarda
  5. PERSIST chat_messages (status='recebida')
  6. Pre-LLM handoff gate: keyword "desconto", "pagamento", "cancelar" → handoff direto
  7. Carrega contexto:
     - Histórico (últimas N msgs do remotejid)
     - tenant_config.brand_manual
     - prompts_agentes (agente='cmo_bot', resolve engine vs tenant)
  8. GPT-4o tool use (1-3 rounds típicos)
     ↓ executa tools: agendar_aula_experimental, qualificar_lead, propor_ae,
       handoff_humano, atualizar_score, etc.
  9. Guardrails pós-LLM (TS):
     - Output contém palavra proibida do brand_manual?
     - >2 propostas de conversão na conversa?
     - Resposta cita preço fora do range autorizado?
  10. PERSIST resposta + audit_log
  11. evolution.send → 200 OK
```

**Timeout total:** 25s (Edge Runtime limit). Latência típica 3-9s.

### 4.2 Tools canônicas do bot CMO

```typescript
// lib/agents/cmo/tools.ts
export const TOOLS = [
  {
    name: 'qualificar_lead',
    description: 'Registra dados do lead (nome, objetivo, urgência)',
    parameters: { /* JSON Schema */ }
  },
  {
    name: 'agendar_aula_experimental',
    description: 'Agenda AE no Google Calendar do tenant',
    parameters: { /* ... */ }
  },
  {
    name: 'propor_ae',
    description: 'Propõe agendamento de AE ao lead (máx 2x por conversa)',
    parameters: { /* ... */ }
  },
  {
    name: 'handoff_humano',
    description: 'Encaminha conversa pra atendimento humano via WhatsApp do dono',
    parameters: { /* ... */ }
  },
  {
    name: 'atualizar_score',
    description: 'Atualiza score do lead baseado em sinais da conversa',
    parameters: { /* ... */ }
  }
];
```

Tools chamam RPCs do Supabase (todas com `fn_tenant_id()`). Idempotência em cada tool (mesmo argumento = mesmo resultado).

### 4.3 Heurística de conversa degenerada

```typescript
// Em código (não no prompt)
const TURNOS_SEM_PROGRESSO_LIMITE = 5;

function isConversaDegenerada(mensagens: ChatMessage[]): boolean {
  const ultimas = mensagens.slice(-TURNOS_SEM_PROGRESSO_LIMITE);
  const semToolCall = ultimas.every(m => !m.tool_calls?.length);
  return semToolCall && ultimas.length >= TURNOS_SEM_PROGRESSO_LIMITE;
}

if (isConversaDegenerada(historico)) {
  await handoffHumano(tenantId, remotejid, 'conversa_sem_progresso');
  return;
}
```

### 4.4 Follow-up automatizado

Vercel Cron (Node Runtime) roda a cada 30min:

```typescript
// /api/cron/follow-up
// Busca conversas com última msg do bot >2h sem resposta do lead
// Estado 1: 2h → "retomada" (1 msg amigável)
// Estado 2: 24h → "msg final" (1 msg de fechamento)
// Estado 3: 48h → marca lead como 'frio', remove da fila ativa
```

Idempotência via flag em `chat_messages.follow_up_estado`.

---

## 5. Onboarding (8 passos)

Detalhado no PRD v2.4 §7 Bloco 2. Arquitetura:

```
/onboarding/[passo]
  ├─ 1. Cadastro mínimo (server action → cria tenant + usuario)
  ├─ 2. Vertical (carrega preset de vertical_presets seed table)
  ├─ 3. Upload logo
  │    ├─ node-vibrant: extrai paleta hex
  │    └─ GPT-4o Vision: nomeia cores, sugere fonte similar
  ├─ 4. Análise de redes
  │    ├─ Scraping Instagram (URL pública) + site
  │    └─ GPT-4o destila briefing → preenche brand_manual.tom_de_voz
  ├─ 5. Banco de imagens (upload em lote + Vision auto-tag)
  ├─ 6. OAuth Meta + Google (skippable — pode configurar depois)
  ├─ 7. WhatsApp (cria instância Evolution + msg de teste)
  └─ 8. Momento "uau" (gera 3 posts iniciais com brand_manual + fotos)
```

**Estado do onboarding:** coluna `tenants.onboarding_passo INTEGER NOT NULL DEFAULT 1`. Permite retomar de onde parou.

**Custo IA por tenant:** ~$0.20 (Vision logo + análise redes + auto-tag 20 imgs + 3 posts).

---

## 6. OAuth — Meta e Google

### 6.1 Fluxo Meta (Facebook + Instagram + Ads)

```
1. Owner clica "Conectar Meta" no onboarding passo 6
2. Redirect → https://www.facebook.com/v18.0/dialog/oauth?...
   scopes: pages_show_list, pages_manage_posts, instagram_basic,
           instagram_content_publish, ads_management, ads_read,
           business_management
3. Callback: /api/oauth/meta/callback?code=...
4. Exchange code → access_token (long-lived, 60 dias)
5. Lista páginas → owner escolhe página + Instagram Business + Ad Account
6. PGSODIUM encrypt(access_token) → meta_credentials
7. audit_log: oauth_conectado
8. Redirect → /onboarding/7
```

**App Review obrigatório:** scopes acima exigem aprovação Meta (2-4 semanas). Iniciar **no Sprint 0** em paralelo (PRD v2.4 §7 Bloco 0).

**Refresh:** Meta long-lived token dura 60 dias. Cron diário (`/api/cron/refresh-tokens`) renova tokens com `expires_at < NOW() + 7 days`.

### 6.2 Fluxo Google (Calendar)

```
scopes: https://www.googleapis.com/auth/calendar.events
        https://www.googleapis.com/auth/calendar.readonly
refresh_token guardado (offline access)
```

OAuth library: `googleapis` (Node Runtime apenas na callback). Token uso no Edge: descriptografa via RPC.

### 6.3 Padrão de descriptografia em RPC

```sql
CREATE OR REPLACE FUNCTION rpc_decrypt_meta_token(p_tenant_id UUID)
RETURNS TABLE(access_token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Trava: só descriptografa se chamador é do tenant
  IF fn_tenant_id() <> p_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado: tenant mismatch';
  END IF;

  RETURN QUERY
  SELECT
    pgsodium.crypto_secretbox_open(access_token_encrypted, ...)::TEXT,
    mc.expires_at
  FROM meta_credentials mc
  WHERE mc.tenant_id = p_tenant_id;
END;
$$;
```

---

## 7. Renderização de posts (ADR-MKT-003)

### 7.1 Stack

- `satori` (JSX → SVG)
- `@resvg/resvg-js` (SVG → PNG, WASM)
- Edge Runtime
- Storage: bucket `posts-renderizados/<tenant_id>/<post_id>.png`

### 7.2 Fluxo

```
POST /api/posts/render { post_id }
  ↓
1. Carrega post + brand_manual + foto do banco_imagens
2. Resolve template (post_templates por vertical + formato)
3. Compõe JSX hidratando: {foto}, {titulo}, {corpo}, {cta}, {logo}, {cor_primaria}
4. satori(jsx, { width, height, fonts: [...] })  → SVG
5. resvg(svg).render() → PNG buffer
6. Upload Supabase Storage
7. UPDATE posts.png_url + audit_log
8. Retorna { png_url }
```

### 7.3 Fontes pré-carregadas

`public/fonts/`:
- **Plus Jakarta Sans 700** (também chrome Prisma — ADR-MKT-006 §4.1)
- **Inter 400/500/600** (também chrome Prisma)
- Poppins, Montserrat, Playfair Display, Bebas Neue (para tenants)

Tenant escolhe `fonte_titulo` e `fonte_corpo` no onboarding passo 3 a partir desta lista curada.

---

## 8. Frontend — chrome Prisma (ADR-MKT-006)

### 8.1 globals.css canônico

```css
/* app/globals.css */
:root {
  /* Identidade Prisma — engine */
  --prisma-midnight: #1A2E4A;
  --prisma-ivory:    #F0EEE8;
  --prisma-purple:   #7B61C4;
  --prisma-success:  #22C55E;
  --prisma-danger:   #EF4444;
  --prisma-warning:  #F59E0B;
  --text-main:       #1A2E4A;
  --text-muted:      #64748B;

  /* Tenant — injetado em runtime em app/layout.tsx */
  /* --tenant-primary, --tenant-secondary */
}
```

### 8.2 next/font canônico

```typescript
// app/layout.tsx
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';

const display = Plus_Jakarta_Sans({
  subsets: ['latin'], weight: ['700'], variable: '--font-display',
});
const body = Inter({
  subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body',
});

export default function RootLayout({ children, params }) {
  const brand = await getTenantBrandManual(); // null se rota pública
  return (
    <html className={`${display.variable} ${body.variable}`}
          style={brand ? {
            '--tenant-primary': brand.visual.cor_primaria,
            '--tenant-secondary': brand.visual.cor_secundaria,
          } as React.CSSProperties : undefined}>
      <body className="font-body bg-[var(--prisma-ivory)]">{children}</body>
    </html>
  );
}
```

### 8.3 Componentes — regras de uso

Detalhado em ADR-MKT-006 §5 + CLAUDE.md anti-padrões.

**Resumo:**
- Chrome do dashboard (header, sidebar, footer): apenas `--prisma-*`
- Componentes de preview de tenant (post, wizard, brand manual): podem usar `--tenant-*`
- Hex hardcoded em CSS ou JSX: proibido em código compartilhado (PR rejeitada)

---

## 9. Bridge MKT → V2 (`iara_tenant_id` + sunset)

### 9.1 Decisão

Adicionar **agora** coluna `iara_tenant_id` em `tenants` do MKT, com **sunset condition objetiva**. Custo de adicionar agora: ~5min de migration. Custo de adicionar depois (com dados em produção): retrabalho de schema + script de backfill.

### 9.2 Schema

```sql
-- Migration: 20260527000003_bridge_iara_v2.sql
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS iara_tenant_id UUID NULL;
CREATE INDEX idx_tenants_iara_bridge ON public.tenants(iara_tenant_id) WHERE iara_tenant_id IS NOT NULL;

COMMENT ON COLUMN public.tenants.iara_tenant_id IS
  'Bridge MKT→V2. NULL = tenant só MKT. UUID = mesmo tenant também tem conta IARA V2.
   Sunset: remover esta coluna se em 12 meses 0 tenant tiver o bridge preenchido.';
```

### 9.3 Sunset condition (objetiva)

| Métrica avaliada em 26/mai/2027 | Ação |
|---|---|
| ≥1 tenant com `iara_tenant_id IS NOT NULL` | Manter coluna, formalizar contrato em ADR nova |
| 0 tenants com bridge | Remover coluna na próxima migration |

### 9.4 Contrato (não MVP)

Quando bridge for ativado por algum tenant:
- `pessoas.id` do V2 é **master** (lead vira `pessoa` no V2 → `pessoa.id` linka leads do MKT)
- ADR nova (MKT-007) define direção do sync (MKT→V2 unidirecional no MVP)
- Sem write do MKT em tabelas do V2 antes de ADR

---

## 10. Segurança — webhooks e endpoints

### 10.1 HMAC em todo webhook externo

```typescript
// lib/webhooks/hmac.ts
function validarHMAC(req: Request, secret: string): boolean {
  const sig = req.headers.get('x-hub-signature-256');
  const body = await req.text();
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(`sha256=${expected}`));
}
```

Aplicado em: `/api/agents/cmo`, `/api/webhooks/leads`, callbacks OAuth (CSRF via `state` param).

### 10.2 Rate limit (Upstash Redis)

Chave: `ratelimit:<remotejid>:<tenant_id>` — 10 msg/min sliding window.
Chave secundária: `ratelimit:tenant:<tenant_id>` — 1000 msg/dia (kill switch de abuso).

### 10.3 Idempotência

`evolution_message_id` UNIQUE por tenant em `chat_messages`. Reentrega da Evolution = no-op.

### 10.4 Consentimento LGPD

Primeira mensagem do bot CMO envia opt-in. Flag `chat_messages.lgpd_aceito` por `remotejid`+`tenant_id`. Sem aceite → bot não opera, apenas insiste no opt-in.

### 10.5 Kill switch de budget

Cron diário (`/api/cron/kill-switch`):

```typescript
// Se ai_usage_diario.custo_usd > tenants.ia_limite_diario_usd
//   1. SET tenants.ia_pausado = true
//   2. audit_log: kill_switch_disparado
//   3. Notifica owner via Resend (email) + WhatsApp do dono
```

Pre-LLM check em `/api/agents/cmo`: `tenants.ia_pausado` → handoff direto.

---

## 11. Observabilidade

### 11.1 Sentry

- DSN em env: `SENTRY_DSN`
- Integração com Next.js: `@sentry/nextjs`
- Captura: erros em API Routes, RSC errors, client errors
- Tags obrigatórias: `tenant_id`, `usuario_id`, `route`, `runtime`

### 11.2 Pre-commit `next build`

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"
pnpm next build || (echo "❌ build falhou — commit bloqueado" && exit 1)
```

Custo: ~30s por commit. Benefício: erro de tipo / import quebrado não vai pro repo (anti-padrão AP-011 V2).

### 11.3 Logs estruturados

```typescript
// lib/logger.ts — wrap Sentry + console
logger.info({ tenant_id, route, action }, 'Mensagem');
logger.error({ tenant_id, error }, 'Falha em tool');
```

Nunca log de token, secret, ou PII de lead em texto plano.

---

## 12. Email transacional (Resend)

Templates canônicos (`emails/` via `react-email`):
- `WelcomeOnboarding` — após cadastro mínimo (passo 1)
- `InviteTenantAdmin` — convite pra usuário adicional
- `PasswordRecovery` — recovery flow
- `KillSwitchAlert` — disparado pelo cron
- `WeeklyReport` — relatório semanal de KPI (Fase 7+)

**Identidade visual:** Plus Jakarta Sans (header) + Inter (body) + paleta `--prisma-*` (ADR-MKT-006 §6).

**Assinatura:** "Prisma — CMO autônomo para pequenas empresas". **Bot CMO via WhatsApp NÃO assina como Prisma** (regra ADR-MKT-006 §6).

---

## 13. Variáveis de ambiente

| Var | Onde achar | Runtime |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard (server-only) | Server |
| `OPENAI_API_KEY` | platform.openai.com | Server |
| `EVOLUTION_API_KEY` | self-hosted Evolution | Server |
| `EVOLUTION_WEBHOOK_SECRET` | gerar via `openssl rand -hex 32` | Server |
| `LEADS_WEBHOOK_SECRET` | gerar via `openssl rand -hex 32` | Server |
| `UPSTASH_REDIS_REST_URL` | console.upstash.com | Edge + Server |
| `UPSTASH_REDIS_REST_TOKEN` | console.upstash.com | Edge + Server |
| `SENTRY_DSN` | sentry.io | All |
| `RESEND_API_KEY` | resend.com | Server |
| `META_APP_ID` | developers.facebook.com | Server |
| `META_APP_SECRET` | developers.facebook.com | Server |
| `GOOGLE_CLIENT_ID` | console.cloud.google.com | Server |
| `GOOGLE_CLIENT_SECRET` | console.cloud.google.com | Server |
| `PGSODIUM_KEY_ID` | Supabase pgsodium config | Server |
| `CRON_SECRET` | gerar via `openssl rand -hex 32` | Server |
| `WEBHOOK_TENANT_MAP` | JSON `{ "instance_name": "tenant_uuid" }` | Server |

**Regras (princípio universal .env):**
- `vercel env pull` **não traz**: `CRON_SECRET`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (sensitive). Configurar via dashboard.
- Nunca colar secret em chat ou commit
- `echo` ❌ pra gravar chaves com caracteres especiais (usar editor de texto)

---

## 14. Estrutura de pastas

```
marketing-saas/
├── app/
│   ├── (auth)/                 # login, signup
│   ├── api/
│   │   ├── agents/cmo/         # Edge — webhook Evolution
│   │   ├── posts/render/       # Edge — Satori
│   │   ├── webhooks/leads/     # Edge
│   │   ├── oauth/meta/         # Node
│   │   ├── oauth/google/       # Node
│   │   └── cron/               # Node — follow-up, kill-switch, refresh-tokens
│   ├── dashboard/              # RSC — protected
│   ├── onboarding/             # RSC — wizard 8 passos
│   ├── globals.css             # tokens --prisma-* (ADR-MKT-006)
│   └── layout.tsx              # next/font + injeção --tenant-*
├── components/
│   ├── ui/                     # shadcn/ui base
│   ├── chrome/                 # header, sidebar, footer (só --prisma-*)
│   ├── marca/                  # wizard, preview brand_manual (--tenant-*)
│   ├── posts/                  # editor, preview (--tenant-*)
│   └── leads/                  # kanban, filtros (só --prisma-*)
├── lib/
│   ├── agents/cmo/             # prompt loader, tools, guardrails
│   ├── supabase/               # client (server/client/edge)
│   ├── credentials/            # meta, google (descriptografia)
│   ├── webhooks/               # HMAC, idempotência
│   ├── rate-limit/             # Upstash
│   ├── validators/             # Zod schemas
│   └── logger.ts               # Sentry wrapper
├── supabase/
│   └── migrations/             # SQL files (supabase db push)
├── public/
│   ├── Prisma_Azul_Midnight.png
│   └── fonts/                  # fontes de tenant pra Satori
└── tests/
    └── smoke/
```

---

## 15. ADRs vinculadas

| ADR | Decisão |
|---|---|
| ADR-MKT-000 | Aplicação ENGINE_VS_TENANT ao MKT (greenfield) |
| ADR-MKT-001 v2 | Síncrono prompt-first em Edge Runtime, prompts em tabela |
| ADR-MKT-003 | Satori para renderização HTML→PNG |
| ADR-MKT-005 | Evolution direto sem N8N |
| ADR-MKT-006 | Prisma Design System v1 |
| ADR-MKT-007 (futura) | Contrato bridge MKT→V2 quando ativado |

---

*Fim do ARCHITECTURE.md v1.0. Base para DOMAIN.md, CLAUDE.md, ROADMAP.md.*
