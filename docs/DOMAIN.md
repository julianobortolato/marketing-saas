# DOMAIN — Vocabulário canônico do Prisma

> **Versão:** 1.0 — 26/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas`
> **Para quem:** owner, Code, futuro time, qualquer doc oficial do projeto

---

## 1. Os 3 níveis de identidade

A confusão entre estes 3 é a raiz dos débitos do IARA V2. Distinção formal:

| Termo | O que é | Exemplo concreto |
|---|---|---|
| **Prisma** | O produto SaaS. Marca comercial. Identidade visual em `--prisma-*`. | Nome do produto que o owner vende. Logo `public/Prisma_Azul_Midnight.png`. |
| **Tenant** | Um cliente do Prisma. Linha em `tenants`. Tem seu próprio `brand_manual`. | "Academia X em São Paulo", "Restaurante Y em Curitiba". |
| **Fitness UNIC** | **Primeiro tenant** do Prisma. Cobaia do MVP. Empresa real do owner. | UUID em `tenants`. Não é o produto. Não é a marca. |

**Princípio (ENGINE_VS_TENANT):**
- Prisma é engine — código compartilhado, identidade visual hardcoded em CSS
- Tenant é content — `brand_manual` em JSONB, isolado por RLS
- Fitness UNIC é uma instância de tenant — sem privilégio especial no código

**Anti-padrão proibido:** referir-se ao Prisma como "o SaaS da UNIC" ou usar Fitness UNIC como sinônimo de produto.

---

## 2. Glossário operacional

### Termos de domínio

| Termo | Significado | Onde vive |
|---|---|---|
| **brand_manual** | DNA de marca do tenant. Cores, fontes, tom de voz, público, regras de ads. | `tenant_config.brand_manual` (JSONB) |
| **manual de marca** | Sinônimo coloquial de `brand_manual`. Usado na UI (português). | UI / wizard |
| **banco de imagens** | Biblioteca de fotos reais do tenant. Tagueadas, com Vision metadata. | `banco_imagens` (tabela) + Supabase Storage |
| **categoria de tag** | Classificação de foto vinda do preset da vertical (treino, equipe, espaço…). | `banco_imagens.categoria` |
| **vertical** | Segmento do tenant (fitness, gastronomia, beleza, genérico). Define preset de categorias e vocabulário. | `tenant_config.brand_manual.vertical` |
| **preset de vertical** | Seed data com categorias, perguntas de público e vocabulário sugerido por vertical. | `vertical_presets` (seed table) |
| **prompt do agente** | System prompt do GPT-4o por agente. Versionado, com escopo engine ou tenant. | `prompts_agentes` |
| **escopo engine** | Prompt genérico, sem identidade de tenant. Usado por default. | `prompts_agentes.escopo='engine'` |
| **escopo tenant** | Prompt customizado por tenant. Override do engine. | `prompts_agentes.escopo='tenant'` |
| **post** | Unidade de conteúdo gerada pelo Prisma. Foto + copy + CTA + branding. | `posts` (tabela) |
| **post template** | JSX renderizado por Satori com slots de conteúdo. Por vertical + formato. | `post_templates` |
| **campanha sugerida** | Pacote Meta gerado pelo Prisma (copy + público + budget + duração). Criada PAUSADA. | `campanhas` |
| **kill switch** | Pausa automática de IA quando custo diário > limite. | `tenants.ia_pausado` + cron |
| **handoff humano** | Transferência da conversa do bot pro owner via notificação WhatsApp. | `rpc_handoff_humano` |
| **conversa degenerada** | Conversa do bot com N turnos sem progresso (sem tool call). Dispara handoff. | Heurística em `lib/agents/cmo/` |
| **audit log** | Registro imutável de ações sensíveis (post aprovado, campanha ativada, kill switch…). | `audit_log` |

### Termos comerciais / lead

| Termo | Significado |
|---|---|
| **lead** | Pessoa que iniciou conversa via WhatsApp ou formulário. Pode virar aluno ou ser arquivada. |
| **aluno** | (Vocabulário do tenant fitness) — lead convertido. **No engine, é apenas `lead.status='convertido'`**. Outras verticais usam outro termo (cliente, paciente, etc.). |
| **AE** | Aula Experimental (vocabulário fitness). Outras verticais: visita, consulta, degustação. **Engine não conhece o termo "AE"** — está em `brand_manual.diretrizes_plataforma` ou prompt do tenant. |
| **score do lead** | Pontuação automática baseada em sinais da conversa (urgência, objetivo, ICP fit). |
| **lead frio** | Lead sem resposta após 48h de follow-up. Removido da fila ativa. |
| **handoff por keyword** | Pre-LLM gate: palavras como "desconto", "pagamento", "cancelar" disparam handoff antes de chamar OpenAI. |

### Termos técnicos

| Termo | Significado |
|---|---|
| **fn_tenant_id()** | Função SQL que lê `tenant_id` do JWT do usuário autenticado. Usada em toda RPC. |
| **RLS dual** | Política PERMISSIVE + RESTRICTIVE. PERMISSIVE garante acesso; RESTRICTIVE bloqueia bypass. |
| **Edge Runtime** | Runtime serverless da Vercel sem cold start. Sem `fs`, sem libs Node-only. |
| **pgsodium** | Extensão Postgres pra criptografia simétrica. Usada em tokens OAuth. |
| **HMAC** | Validação criptográfica de origem de webhook. Header `x-hub-signature-256`. |
| **idempotência** | Mesma mensagem processada 2x = mesmo resultado. Via UNIQUE em `evolution_message_id`. |
| **rate limit** | Trava de frequência por `remotejid` + `tenant_id`. Upstash Redis sliding window. |
| **tool use** | Funcionalidade nativa do GPT-4o pra chamar funções TypeScript declaradas como JSON Schema. |
| **guardrail** | Validação determinística pós-LLM em código TS. Não no prompt. |
| **dogfooding** | Owner usa o próprio produto antes do cliente real. Sprint 0.5. |

---

## 3. Roles e usuários

### 3.1 Roles canônicas

| Role | O que pode | Onde |
|---|---|---|
| **super_admin** | Anthropic do Prisma. Acesso cross-tenant. Apenas owner do Prisma. | `usuarios.role='super_admin'` |
| **tenant_admin** | Owner de um tenant. Acesso total ao seu próprio tenant. Aprova posts, ativa campanhas, gerencia brand manual. | `usuarios.role='tenant_admin'` |

**Não existe role `operador`** — atendimento WhatsApp acontece **fora do app** (WhatsApp Web direto do owner ou Chatwoot externo). Decidido pra evitar repetir os 3 fracassos de chat interno (PRD v2.4 §8).

### 3.2 Convite de tenant_admin

Owner de tenant convida outro usuário do mesmo tenant via `/api/invite`. Email com token assinado (Resend). Aceitar = criar `usuarios` com `tenant_id` herdado + role `tenant_admin`.

### 3.3 Trial

| Campo | Valor MVP |
|---|---|
| Duração padrão | 14 dias |
| Coluna | `tenants.trial_ends_at TIMESTAMPTZ` |
| Cobrança | Manual pós-trial (Pix/boleto). Stripe não MVP. |
| Fim do trial | Tenant não bloqueia hard; flag visual no dashboard + email Resend |

---

## 4. Estados de entidades

### 4.1 Lead

```
novo → qualificando → quente → convertido
                          ↓        ↑
                        frio   (manual via dashboard)
```

| Estado | Significado | Quem muda |
|---|---|---|
| `novo` | Primeira mensagem recebida | Bot CMO (criação) |
| `qualificando` | Bot coletando informações | Bot CMO (tool `qualificar_lead`) |
| `quente` | Lead demonstrou intenção (agendou AE, pediu informações sobre planos) | Bot CMO ou tenant_admin |
| `frio` | 48h+ sem resposta após follow-up | Cron follow-up |
| `convertido` | Virou aluno/cliente | tenant_admin via botão "confirmar" no dashboard |

### 4.2 Post

```
rascunho → pendente_aprovacao → aprovado → publicado
                ↓                    ↓
            rejeitado          falhou_publicacao
```

### 4.3 Campanha (Meta)

```
rascunho → pendente_aprovacao → aprovada_pausada → ativada
                                       ↓
                                kill_switch_disparado
```

**Sempre criada PAUSADA na Meta**. tenant_admin ativa via dashboard. Kill switch automático se custo diário > limite.

### 4.4 Conversa (bot)

```
ativa → handoff_solicitado → encerrada
   ↓
sem_resposta_2h → sem_resposta_24h → frio
```

---

## 5. Vocabulário do bot CMO (regras duras)

### 5.1 O bot fala como o tenant — não como Prisma

System prompt do bot CMO **NÃO menciona "Prisma"**. O lead que conversa com o bot precisa achar que está falando com a empresa-tenant. ADR-MKT-006 §6 documenta esta regra.

**Exemplo correto** (vertical fitness, tenant "Academia X"):
> "Oi! Aqui é da Academia X 💪 Que bom que você tem interesse em treinar com a gente!"

**Exemplo proibido:**
> "Oi! Eu sou o assistente Prisma da Academia X."

### 5.2 Limites duros (não no prompt — em código)

| Regra | Onde |
|---|---|
| Máx 2 propostas de AE por conversa | Contador em `chat_messages` + check pré-tool |
| Nunca prometer desconto fora de range autorizado | Guardrail pós-LLM contra `brand_manual.regras_comerciais` |
| Keyword "pagamento", "cancelar", "reclamação" → handoff direto | Pre-LLM gate em `/api/agents/cmo` |
| Nunca menu numerado (1, 2, 3) — sempre 1 caminho com convicção | Validação pós-LLM regex `/^\s*\d+[\.\)]/m` |
| Nunca emoji em excesso (>2 por mensagem) | Guardrail pós-LLM + `brand_manual.tom_de_voz.emojis` |

---

## 6. Convenções de nomenclatura

### 6.1 Tabelas e colunas

- `snake_case`, sempre português pra termos de negócio (`brand_manual`, `tenant_config`, `aprovacoes`)
- Inglês permitido pra termos técnicos universais (`audit_log`, `chat_messages`)
- Toda tabela tenant-scoped: coluna `tenant_id UUID NOT NULL` + RLS dual
- Timestamps: `criado_em`, `atualizado_em`, `expires_at` (técnico). Nunca `created_at` em tabelas de negócio.

### 6.2 RPCs

- Prefixo `rpc_` (consumida pelo PostgREST/cliente)
- Prefixo `fn_` (helper interno, não exposta diretamente)
- Sempre usar `fn_tenant_id()` para resolver tenant, **nunca `auth.jwt() ->> 'tenant_id'` direto**

### 6.3 CSS tokens (ADR-MKT-006)

- `--prisma-*` → identidade do produto (engine). Hardcoded em `globals.css`.
- `--tenant-*` → identidade do cliente. Injetado em runtime via JS.
- `--brand-*` → **proibido** (namespace descontinuado, ambíguo).
- `--text-*`, `--font-*` → tokens semânticos auxiliares.

### 6.4 Rotas

- `/api/agents/<agente>` → endpoints de agente IA
- `/api/webhooks/<origem>` → webhooks de origem externa
- `/api/oauth/<provedor>/callback` → OAuth callbacks
- `/api/cron/<job>` → Vercel Cron jobs
- `/dashboard/<modulo>` → UI protegida

---

## 7. Termos a evitar

| Termo | Por quê | Use |
|---|---|---|
| "Academia" como entidade do sistema | Vertical-specific; viola ENGINE_VS_TENANT | "Tenant" |
| "Cliente Prisma" | Ambíguo (tenant ou lead do tenant?) | "Tenant" |
| "Aluno" no engine | Vertical fitness; engine não conhece | "Lead convertido" |
| "AE" no engine | Vertical fitness | "Agendamento experimental" (genérico) ou termo do `brand_manual` |
| "Bot" no marketing externo | Pejorativo; lead se sente mal atendido | "Assistente", "atendimento automatizado" |
| "IA" como sujeito do produto | Buzzword; cliente quer resultado | "Prisma" (o produto) ou ação concreta |
| "marketing-saas" (codinome interno) | Não é nome comercial | "Prisma" |

---

## 8. Notificações

### 8.1 Canais

| Canal | Uso |
|---|---|
| **Email (Resend)** | Welcome, invite, recovery, kill switch alert, weekly report |
| **WhatsApp do owner (via Evolution)** | Handoff humano, alerta crítico de produção, lead quente |
| **Dashboard (UI badge)** | Posts pendentes de aprovação, campanhas aguardando ativação, leads novos |

**Regra:** **não há dashboard de handoff humano** — chega direto no WhatsApp do owner (decisão D4 da memória / PRD v2.4 §7 Bloco 5).

### 8.2 Eventos que disparam notificação WhatsApp ao owner

- Handoff humano por keyword ou conversa degenerada
- Kill switch disparado (paralelo ao email)
- Falha consecutiva em publicação (>3 tentativas)

---

## 9. Audit log — eventos que registram

Lista canônica (mantida em sync com ARCHITECTURE.md §3.6):

- `post_aprovado` / `post_publicado` / `post_rejeitado` / `post_falhou_publicacao`
- `campanha_criada_pausada` / `campanha_ativada` / `campanha_pausada` / `campanha_kill_switch`
- `kill_switch_disparado`
- `oauth_conectado` / `oauth_revogado`
- `prompt_alterado`
- `tenant_config_alterado`
- `brand_manual_alterado` (subset de `tenant_config_alterado` mas merece destaque)
- `lead_handoff_humano`
- `lead_convertido`
- `usuario_convidado` / `usuario_ativado` / `usuario_removido`

**Imutável:** linhas em `audit_log` nunca são editadas nem deletadas. Compliance + debug.

---

## 10. Referências cruzadas

| Termo desta lista | Documento canônico |
|---|---|
| ENGINE_VS_TENANT | `ENGINE_VS_TENANT.md` |
| Camada 1 / Camada 2 | `ENGINE_VS_TENANT.md` §"Duas camadas de conteúdo de tenant" |
| Prisma Design System | `ADR-MKT-006` |
| Bridge MKT→V2 (`iara_tenant_id`) | `ARCHITECTURE.md` §9 + ADR-MKT-007 (futura) |
| Tools do bot CMO | `ARCHITECTURE.md` §4.2 |
| Schema completo das tabelas | `ARCHITECTURE.md` §3 |

---

*Fim do DOMAIN.md v1.0.*
