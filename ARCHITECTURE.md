# ARCHITECTURE — marketing-saas
> Versão 1.0 — 18/mai/2026

## Estrutura de pastas

```
marketing-saas/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # login, signup
│   ├── (dashboard)/              # rotas protegidas por tenant
│   │   ├── overview/             # hub principal
│   │   ├── campanhas/            # gestão de campanhas
│   │   ├── conteudo/             # criação de conteúdo
│   │   ├── leads/                # pipeline de leads
│   │   └── configuracoes/        # perfil da academia
│   └── api/                      # API Routes
│       ├── webhooks/             # Evolution API, Meta, Google
│       ├── cron/                 # jobs agendados
│       └── public/               # endpoints sem auth
├── components/                   # componentes React reutilizáveis
├── lib/
│   ├── supabase/                 # client, server, admin
│   ├── queries/                  # queries por domínio
│   ├── agents/                   # orquestração de agentes IA
│   └── utils/
├── .planning/                    # GSD — estado do projeto
│   ├── config.json
│   ├── STATE.md
│   └── ROADMAP.md
├── scripts/                      # seeds, migrations, utilitários
├── docs/
│   └── principles/               # princípios universais por arquivo
│       └── ENGINE_VS_TENANT.md
├── .adrs/                        # ADRs locais do repo
│   ├── ADR-MKT-000.md            # fronteira engine vs tenant
│   └── ADR-MKT-001-agente-whatsapp.md  # agente WhatsApp Fase 3
├── CLAUDE.md                     # instruções para o agente Code
├── PRD.md
├── ARCHITECTURE.md (este)
├── DOMAIN.md
└── CHANGELOG.md
```

## Decisões arquiteturais (ADRs)

### ADR-001 — Multi-tenant via RLS (não via schemas separados)
**Decisão:** Um único schema PostgreSQL com `tenant_id` em todas as tabelas + políticas RLS.
**Motivo:** Mais simples de operar, migrations únicas, sem overhead de provisionamento por cliente.
**Trade-off aceito:** RLS mal configurada silencia queries sem erro — sempre testar com usuário não-admin.

### ADR-002 — Cérebro separado (marketing-brain)
**Decisão:** Prompts, templates e memória de agentes ficam no repo `marketing-brain`, não aqui.
**Motivo:** Permite atualizar editorial sem deploy de código. Separa o "o que dizer" do "como entregar".
**Trade-off aceito:** Requer sincronização entre os dois repos em mudanças de schema de prompts.

### ADR-003 — Bridge futura com IARA Systems
**Decisão:** Campo `iara_tenant_id UUID NULL` na tabela `tenants`. Null = produto standalone.
**Motivo:** Integração futura é extensão, não refatoração. Custo de preparação: 1 coluna.
**Ativa quando:** cliente compra IARA + marketing-saas e autoriza compartilhamento de dados.

### ADR-004 — Evolution API para WhatsApp (mesma decisão do IARA)
**Decisão:** Evolution API V2, instância por tenant.
**Motivo:** Já validado em produção no IARA Systems. Reduz curva de aprendizado.

### ADR-005 — Agentes via OpenAI diretamente (sem middleware)
**Decisão:** Next.js API Routes → OpenAI diretamente. Sem LangChain, sem framework de agentes.
**Motivo:** Menos abstração = menos bugs. Orquestração simples em MVP não justifica overhead.
**Revisão:** quando número de agentes > 5 ou contexto > 32k tokens por operação.

### ADR-006 — Fronteira engine vs tenant
**Decisão:** Código, prompts e configurações de repositório não conhecem nenhum tenant específico. Tudo que varia por tenant vive em `academia_config` ou `tenants`.
**Motivo:** Evita que o primeiro cliente vire identidade do produto — padrão que gerou débitos críticos no IARA V2.
**Documento canônico:** `docs/principles/ENGINE_VS_TENANT.md`
**Aplicação local:** `.adrs/ADR-MKT-000.md`

## Schema — tabelas core

```sql
-- Fundação multi-tenant
tenants (
  id              UUID PK,
  nome            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  iara_tenant_id  UUID NULL,          -- bridge futura
  plano           TEXT NOT NULL,      -- starter / pro / enterprise
  ativo           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT now()
)

-- Usuários da academia (donos, gestores)
usuarios (
  id          UUID PK REFERENCES auth.users,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  role        TEXT NOT NULL,          -- owner / manager / viewer
  nome        TEXT,
  criado_em   TIMESTAMPTZ DEFAULT now()
)

-- Leads capturados
leads (
  id              UUID PK,
  tenant_id       UUID NOT NULL,
  nome            TEXT,
  telefone        TEXT,
  origem          TEXT,               -- meta_form / whatsapp / google / manual
  status          TEXT,               -- novo / contatado / agendado / convertido / perdido
  remotejid       TEXT,               -- WhatsApp
  score           SMALLINT,
  criado_em       TIMESTAMPTZ DEFAULT now()
)

-- Campanhas
campanhas (
  id          UUID PK,
  tenant_id   UUID NOT NULL,
  nome        TEXT NOT NULL,
  canal       TEXT NOT NULL,          -- google / meta / whatsapp / instagram
  status      TEXT NOT NULL,          -- rascunho / ativa / pausada / encerrada
  budget_mes  NUMERIC,
  inicio      DATE,
  fim         DATE,
  criado_em   TIMESTAMPTZ DEFAULT now()
)

-- Conteúdo gerado
conteudos (
  id              UUID PK,
  tenant_id       UUID NOT NULL,
  tipo            TEXT,               -- post / story / reels / anuncio
  canal           TEXT,
  texto_gerado    TEXT,
  status          TEXT,               -- rascunho / aprovado / publicado
  publicado_em    TIMESTAMPTZ NULL,
  criado_em       TIMESTAMPTZ DEFAULT now()
)

-- Configuração da academia (DNA)
academia_config (
  id              UUID PK,
  tenant_id       UUID NOT NULL UNIQUE,
  nome_academia   TEXT NOT NULL,
  bairro          TEXT,
  cidade          TEXT,
  raio_km         SMALLINT DEFAULT 5,
  tom_de_voz      TEXT,               -- formal / neutro / coloquial
  diferenciais    TEXT[],
  horarios        JSONB,
  planos          JSONB,
  tema            JSONB,              -- identidade visual do tenant
                                      -- {primary, secondary, font, logo_url}
  criado_em       TIMESTAMPTZ DEFAULT now()
)
```

## Regras de segurança inegociáveis

- Toda tabela: `tenant_id NOT NULL` + política RLS PERMISSIVE + RESTRICTIVE
- RPCs com dados sensíveis: `SECURITY DEFINER` + revalidação de `tenant_id`
- Service role key: nunca em componente cliente
- Webhooks externos (Meta, Google, Evolution): validar assinatura antes de processar
- Rate limit: 10 req/min por `tenant_id` em endpoints de IA (custo)
