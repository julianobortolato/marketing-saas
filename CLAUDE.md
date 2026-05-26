# CLAUDE.md — Regras pro Code no `marketing-saas` (Prisma)

> **Versão:** 1.0 — 26/mai/2026
> **Para quem:** agente Code (Claude Code) trabalhando neste repo
> **Owner:** Juliano Bortolato (não-dev)
> **Localização canônica:** raiz do repo `marketing-saas/`

---

## 1. Identidade do projeto

- **Produto:** Prisma — SaaS multi-tenant de marketing autônomo
- **Vertical MVP:** fitness (preset, não identidade)
- **Cliente #1:** Fitness UNIC (cobaia, **não** é o produto — ADR-MKT-006 + DOMAIN.md §1)
- **Stack:** Next.js 14 + Supabase + GPT-4o + Vercel (Edge Runtime padrão)
- **Repo:** `~/marketing-saas`
- **Supabase ref:** `mdgdrevfpdvvjsccnecl`

---

## 1.5 Mapa de execução autônoma

Owner não é dev. Toda ação tem destinatário explícito declarado antes de executar (princípio 13 do perfil owner).

### 1.5.1 Quem executa o quê

| Ação | Quem executa | Como |
|---|---|---|
| Migrations SQL | **Code (autônomo)** | `supabase db push` no terminal local |
| Queries de inspeção (`SELECT * FROM ... LIMIT 5`) | **Code (autônomo) via MCP Supabase** | Tool MCP `supabase__sql` quando disponível; senão owner cola no SQL Editor |
| Criar arquivo / refatorar código | **Code (autônomo)** | filesystem + `git` |
| Smoke test via `curl` | **Code (autônomo)** | terminal local |
| Configurar variável de env na Vercel | **Owner (manual)** | Dashboard Vercel → Settings → Environment Variables |
| Configurar variável de env no Supabase | **Owner (manual)** | Dashboard Supabase → Settings → Edge Functions / Secrets |
| OAuth callback URLs (Meta, Google) | **Owner (manual)** | Dashboards Meta/Google |
| Conectar instância Evolution | **Owner (manual)** | Console Evolution self-hosted |
| Rotacionar secret antigo | **Owner (manual) + Code (executa via API se disponível)** | Coordenado |
| Aprovar PR / merge | **Owner (manual)** | GitHub web ou CLI |

### 1.5.2 MCP Supabase — execução autônoma de SQL

**Quando MCP está disponível:**
- Code roda inspeções, RPCs, e queries de leitura **sem pedir cópia-cola pro owner**
- Migrations destrutivas (DROP, ALTER COLUMN com perda) — Code **anuncia + pausa** antes
- Resultado da query volta inline no chat — owner não precisa abrir Supabase

**Quando MCP NÃO está disponível** (fallback):
- Code gera SQL pronto pra cópia-cola
- Declara destinatário: "No SQL Editor do Supabase, cole isto:"
- Owner cola, copia resultado, devolve no chat

**Regra:** Code **sempre tenta MCP primeiro**. Fallback pra cópia-cola só após confirmar MCP indisponível. Princípio 10 do perfil owner — MCP-first.

### 1.5.3 N8N / orquestradores externos — proibido

**N8N, Make, Zapier, Pipedream — NÃO entram neste projeto.** Documentado em ADR-MKT-005 + AP-MKT-005-001.

Execução autônoma neste repo é:
- **Code** (autônomo) — código, migrations, queries
- **Vercel Cron** (declarativo em `vercel.json`) — jobs periódicos do app
- **Supabase pg_cron** (opcional, declarativo em migration) — apenas para jobs SQL-only

Nenhum orquestrador externo. Toda lógica de fluxo vive no repo (auditável, versionável em Git).

### 1.5.4 Tests autônomos

| Tipo de teste | Executor | Onde |
|---|---|---|
| Smoke (`curl` em endpoint) | Code | `tests/smoke/*.sh` |
| Schema check (SELECT LIMIT 5) | Code via MCP | inline |
| RLS test inverso (acesso cross-tenant deve falhar) | Code | `tests/smoke/rls.sql` |
| Pre-commit `next build` | Husky local | `.husky/pre-commit` |
| Integration (Playwright, futuro) | CI Vercel | `.github/workflows/` ou Vercel |

---

## 2. Regras inegociáveis

### 2.1 ENGINE_VS_TENANT (princípio universal)

| Camada | O que é | Onde vive |
|---|---|---|
| Camada 1 — identidade de cliente individual | Nome, cor, fonte, tom de voz, slogan, lista de planos, vocabulário do tenant | **APENAS em `tenant_config.brand_manual`** |
| Camada 2 — léxico da vertical | Termos do segmento (modalidade, AE, anamnese...) | Pode estar em código **se** vertical do projeto está documentada e gatilho objetivo de revisita registrado |

**PR rejeitada se:**
- Hex hardcoded de tenant em código compartilhado (`bg-[#E30613]`)
- Nome de tenant em string literal de engine
- Constante "neutra" com valor do cliente (`const TIPOGRAFIA_PADRAO = 'Syne'` quando é a fonte da UNIC)
- Enum/tipo com nome de cliente (`enum Plano { UNIC_PERSONAL }`)
- Path/filename com nome de cliente

Leitura obrigatória: `docs/principles/ENGINE_VS_TENANT.md` + `.adrs/ADR-MKT-000.md` + `.adrs/ADR-MKT-006.md`.

### 2.2 Multi-tenant em toda tabela

```sql
-- Padrão obrigatório em CADA tabela tenant-scoped
CREATE TABLE <nome> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ...
);

ALTER TABLE <nome> ENABLE ROW LEVEL SECURITY;

-- DUAL: PERMISSIVE + RESTRICTIVE (sempre os dois)
CREATE POLICY <nome>_tenant_isolation ON <nome>
  AS PERMISSIVE FOR ALL TO authenticated
  USING (tenant_id = fn_tenant_id());

CREATE POLICY <nome>_tenant_restrictive ON <nome>
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = fn_tenant_id());
```

### 2.3 RPCs usam `fn_tenant_id()` — nunca JWT direto

```sql
-- ✅ CORRETO
CREATE FUNCTION rpc_foo() RETURNS ... AS $$
BEGIN
  RETURN QUERY SELECT * FROM tabela WHERE tenant_id = fn_tenant_id();
END $$;

-- ❌ PROIBIDO
CREATE FUNCTION rpc_foo() RETURNS ... AS $$
BEGIN
  RETURN QUERY SELECT * FROM tabela
    WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID;
END $$;
```

### 2.4 Migrations

- **Nunca editar migration existente.** Sempre arquivo novo.
- Padrão de nome: `YYYYMMDDHHMMSS_<descricao>.sql`
- Aplicar via `supabase db push` (nunca SQL Editor sem rastreamento)
- Antes de qualquer migration: `SELECT * FROM <tabela_alvo> LIMIT 5` pra confirmar schema atual

### 2.5 Secrets

- **Nunca em código.** Sempre em env.
- **Nunca exibir** valor de secret em mensagem do chat — referenciar pelo nome
- `vercel env pull` **não traz** sensitive (CRON_SECRET, OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY)
- Chaves com caracteres especiais: editor de texto, **nunca `echo`**
- Bloco com token/secret na mensagem: header CAPS LOCK obrigatório

### 2.6 Persistir antes de enviar

Padrão obrigatório em **toda rota** que toca API externa:

```
1. Receber payload
2. Validar HMAC + idempotência
3. PERSIST em banco (status 'pendente' ou 'recebida')
4. Chamar API externa
5. PERSIST resultado (atualiza status)
6. Retornar HTTP
```

API externa **antes** do persist = AP-PERSIST-001 (PR rejeitada).

### 2.7 Guardrails em código, nunca só no prompt

```typescript
// ❌ PROIBIDO: validação só no system prompt
const systemPrompt = `... Nunca proponha desconto. Nunca use mais de 2 emojis. ...`;

// ✅ CORRETO: validação determinística pós-LLM
const resposta = await openai.chat.completions.create({...});
if (contemPalavraProibida(resposta, brand_manual.tom_de_voz.palavras_proibidas)) {
  await audit('guardrail_violado', { motivo: 'palavra_proibida' });
  throw new GuardrailError('Resposta bloqueada');
}
```

### 2.8 HMAC em todo webhook externo

```typescript
import crypto from 'crypto';

function validarHMAC(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expected}`)
  );
}
```

Aplicado em: `/api/agents/cmo`, `/api/webhooks/leads`. OAuth callbacks usam `state` param (CSRF).

### 2.9 Idempotência + rate limit

- Idempotência: `evolution_message_id UNIQUE` por tenant em `chat_messages`
- Rate limit: Upstash Redis sliding window, chave `<remotejid>:<tenant_id>`, 10 msg/min

### 2.10 Identidade visual (ADR-MKT-006)

```tsx
// ✅ Chrome do dashboard (sidebar, header, footer)
<div className="bg-[var(--prisma-midnight)] text-[var(--prisma-ivory)]">

// ✅ Componente que renderiza conteúdo de tenant (preview, wizard)
<div style={{ background: 'var(--tenant-primary)' }}>

// ❌ Hex hardcoded (PR rejeitada)
<div className="bg-[#1A2E4A]">

// ❌ Namespace --brand-* (descontinuado, ambíguo)
<div className="bg-[var(--brand-primary)]">

// ❌ --tenant-* em chrome genérico do dashboard (viola Camada 1)
function Sidebar() {
  return <div className="bg-[var(--tenant-primary)]">...</div>;
}
```

**Heurística:** o componente seria diferente entre 2 tenants? → pode usar `--tenant-*`. Senão → só `--prisma-*`.

---

## 3. Anti-padrões com enforcement automatizado

### 3.1 Detecção via grep (pre-commit ou code review)

```bash
# Hex hardcoded em código compartilhado
grep -rE 'bg-\[#[0-9a-fA-F]{3,8}\]|text-\[#[0-9a-fA-F]{3,8}\]' app/ components/ \
  --exclude-dir=node_modules

# Namespace --brand-* descontinuado
grep -rE '\-\-brand\-' app/ components/

# auth.jwt() direto em RPC (sem fn_tenant_id)
grep -rE "auth\.jwt\(\)\s*->>\s*'tenant_id'" supabase/migrations/

# fs.readFileSync em rotas de produção
grep -rE "fs\.readFileSync" app/api/

# Token em texto plano em migration ou código
grep -rE "(sk-|fb-|EAA[a-zA-Z0-9])" app/ lib/ supabase/migrations/
```

Cada hit = PR bloqueada até resolver.

### 3.2 Pre-commit `next build` (AP-011 V2)

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"
pnpm next build || (echo "❌ next build falhou — commit bloqueado" && exit 1)
```

Custo: ~30s por commit. **Não pular nunca**, mesmo "commit pequeno".

### 3.3 Lista canônica de anti-padrões

#### Técnicos (não fazer)

| Anti-padrão | Onde | Custo registrado |
|---|---|---|
| Identidade de tenant em código compartilhado | qualquer | 3-5 dias de débito (V2) |
| `auth.jwt() ->> 'tenant_id'` em RPC | `supabase/migrations/` | Vaza tenant cross-policy |
| Migration existente editada | `supabase/migrations/` | Schema drift inrastreável |
| Query sem `tenant_id` no WHERE | `lib/queries/` | Vaza dado entre tenants |
| `fs.readFileSync` em rota de produção | `app/api/` | Não roda em Edge; viola ENGINE_VS_TENANT no V2 |
| `vercel env pull` após `.env.local` completo | local | Sobrescreve sensitive |
| `echo` pra gravar chave com `$` ou `!` | local | Caractere especial vira shell expansion |
| Token em mensagem de chat | chat | Vazamento de credencial |
| Loop de 404 sem mudar abordagem | qualquer | >60min por violação (Green) |
| Secret novo configurado antes do antigo ser rotacionado | env | Janela de exposição |
| Deploy declarado ✅ sem evidência observável | qualquer | Bug em produção sem detecção |
| Patch em prompt sem GET do estado atual | `prompts_agentes` | Sobrescreve mudança recente |
| Endpoint novo sem `curl` isolado primeiro | `app/api/` | ~60min/violação (Green) |
| Schema assumido sem `SELECT * FROM tabela LIMIT 5` | qualquer | Coluna inexistente em produção |

#### Estratégicos (não fazer)

| Anti-padrão | Por quê |
|---|---|
| Trazer N8N de volta sem evidência objetiva | AP-MKT-005-001 (ADR-MKT-005 §5) |
| Trazer código do Green (não só infra) | Mesma origem do anti-padrão acima |
| Chat interno no dashboard | 3 tentativas, 0 funcionando |
| Geração de imagem por IA do zero | Inconsistente com marca real do tenant |
| Romantizar feature sem validar viabilidade técnica | Débito acumulado |
| Prometer automação total sem progressão de confiança | UX rompida |
| Pipeline multi-agente sem error handling entre etapas | Falha silenciosa |
| Score/fórmula usada pra decisão sem validar empiricamente (30 dias) | Decisão baseada em fórmula errada |

#### Produto (regras do bot CMO — em código, não no prompt)

| Regra | Onde |
|---|---|
| Máx 2 propostas de AE por conversa | Contador em `chat_messages` |
| Nunca menu numerado (1, 2, 3) | Regex pós-LLM `/^\s*\d+[\.\)]/m` |
| Insights com threshold fixo hardcoded | Sempre relativo ao histórico do tenant |
| Bot assinar como "Prisma" | NUNCA — bot fala como tenant (ADR-MKT-006 §6) |

---

## 4. Comunicação com owner

### 4.1 Owner não é dev

Toda instrução com **destino explícito**:

- "No terminal do Mac: `cd ~/marketing-saas && ...`"
- "No SQL Editor do Supabase: ..."
- "No browser, abrir https://..."
- "No Code (este chat): vou executar ..."

### 4.2 Padrões obrigatórios

- Comandos bash: sempre incluir `cd ~/marketing-saas` antes
- Sem placeholders soltos: usar `<COLE_AQUI>` + onde achar o valor
- Ser direto, sem bajular
- Nunca declarar métrica sem fonte (linhas, custos, latência) — usar "~X (estimativa)"
- Recomendar lib/serviço: 1 linha de explicação acessível **antes** da recomendação (princípio 27 do perfil owner)

### 4.3 Confirmação prévia

Pausar **antes** de:
- Migrations destrutivas (DROP, ALTER COLUMN com perda de dado)
- Mudanças em RLS de tabelas em produção
- Refactor que toca >5 arquivos
- Decisões com bifurcação estratégica

**Não pausar** pra:
- Smoke tests, DRY_RUN, validação de schema
- Build errors, lint fixes, seed data
- Escolha entre libs equivalentes (escolher + 1 linha)

---

## 5. Paralelismo de chats Code

### 5.1 Regras gerais

**Paralelizar quando:**
- Arquivos diferentes
- Sem dependência de schema
- Frontend vs backend
- Docs vs código

**Não paralelizar quando:**
- Mesmo arquivo
- Ambos fazem DDL
- Um depende do output do outro

**Regra fixa:** 1 chat Code = 1 sprint. Renovar a cada sprint fechado ou 2h.

### 5.2 Matriz de paralelização autorizada por sprint

| Sprint | Pode paralelizar | Tem que ser serial | Por quê |
|---|---|---|---|
| **Sprint 0** | (a) Rename SQL + Sentry setup + Meta App Review (owner) — 3 trilhas independentes | HMAC + idempotência + rate limit no `/api/agents/cmo` — mesmo arquivo | App Review é owner manual (sem chat Code); Rename só DDL; Sentry só lib/config |
| **Sprint 0.5 (dogfood)** | Nenhum — owner usando produto | Tudo serial | Feedback loop precisa ser linear |
| **Liberação UNIC** | Nenhum — operação | Tudo serial | Produção, sem refactor |
| **Fase 1** (onboarding refinado + /ajuda) | Wizard refactor + página /ajuda | — | Páginas independentes, sem schema |
| **Fase 2** (manual editável) | Não — toca brand_manual e validação Zod no mesmo fluxo | Tudo serial | Mesmo JSONB schema |
| **Fase 3** (banco imagens) | Galeria UI + bulk upload backend | RLS Storage | UI lê do mesmo endpoint, mas devs distintos |
| **Fase 4** (bot refinado) | Follow-up cron + heurística degenerada + Google Calendar tool | Schema chat_messages | 3 áreas (cron, lib/agents, OAuth) isoladas |
| **Fase 5** (gerador conteúdo) | Templates Satori + Tools do bot CMO + pipeline de seleção foto | Schema `posts` | Templates não dependem de tools |
| **Fase 6** (publicação) | Zernio integration + Meta API direto + manual export | Schema `posts` | 3 camadas independentes |
| **Fase 7** (dashboard ROI) | KPI components + cálculo ROI + relatório Resend | Schema `audit_log` queries | Frontend vs backend separados |

### 5.3 Como abrir paralelo

1. Owner declara: "Vou abrir 3 chats Code em paralelo: A, B, C"
2. Para cada chat, briefing inclui:
   - Sprint atual (referência ao ROADMAP)
   - Arquivos que **este chat** vai tocar
   - Arquivos que **outros chats em paralelo** estão tocando (não tocar)
   - Critério de aceite isolado
3. Cada chat só fecha quando seu critério de aceite passa
4. Owner faz merge mental quando todos fecham (sequência: o que tem schema vai primeiro no `git push`)

### 5.4 Anti-padrões de paralelização

| Anti-padrão | Por quê |
|---|---|
| 2 chats fazendo migration ao mesmo tempo | Ordem de aplicação imprevisível, `supabase db push` falha |
| 2 chats editando mesmo arquivo TS | Merge conflict garantido |
| Chat B começa antes do chat A entregar dependência declarada | Chat B fica esperando, contexto satura |
| Mais de 3 chats Code abertos simultaneamente | Custo cognitivo do owner explode |
| Paralelo em Sprint 0.5 (dogfood) | Quebra feedback loop linear |

---

## 6. Estrutura de pastas (canônica)

Vide `ARCHITECTURE.md` §14. Resumo:

```
app/             # Next.js App Router
components/      # UI (chrome=prisma, marca/posts=tenant)
lib/             # Lógica de domínio (agents, supabase, validators)
supabase/        # Migrations
public/          # Assets (logo Prisma, fonts/)
.adrs/           # ADRs do projeto
docs/            # PRD, DOMAIN, ROADMAP, principles
tests/           # Smoke tests
```

---

## 7. Variáveis de ambiente

Lista canônica em `ARCHITECTURE.md` §13. Onde achar cada uma:

| Categoria | Onde |
|---|---|
| Supabase | dashboard Supabase → Settings → API |
| OpenAI | platform.openai.com → API keys |
| Evolution | self-hosted, gerar via console Evolution |
| Upstash | console.upstash.com → Redis → REST |
| Sentry | sentry.io → projeto → SDK setup |
| Meta App | developers.facebook.com → app → Settings → Basic |
| Google OAuth | console.cloud.google.com → APIs & Services → Credentials |
| Webhooks secrets | gerar local: `openssl rand -hex 32` |

---

## 8. Fluxo padrão de sprint

1. **Sprint definido** — owner abre chat Code com briefing (objetivo + arquivos esperados + critério de aceite)
2. **Inventário antes** — Code roda `git status`, lê `INVENTARIO_*` se existir
3. **Schema check** — `SELECT * FROM <tabela> LIMIT 5` antes de qualquer query nova
4. **Migration** — arquivo novo, `supabase db push`, RLS dual obrigatório
5. **Implementação** — TypeScript com Zod nos boundaries
6. **Smoke test** — `curl` isolado ou test em `tests/smoke/`
7. **Pre-commit `next build`** — bloqueia commit com erro
8. **Critério de aceite** — checklist binário (passa / não passa)
9. **Sprint encerrado** — chat Code é descartado

---

## 9. Glossário

- **Prisma** = produto
- **Tenant** = cliente
- **Fitness UNIC** = primeiro tenant (não é o produto, não é a marca)
- **brand_manual** = JSONB de identidade do tenant em `tenant_config`
- **fn_tenant_id()** = função SQL canônica
- **RLS dual** = PERMISSIVE + RESTRICTIVE em toda tabela
- **Edge Runtime** = runtime padrão pra rotas de agente (sem cold start)

Glossário completo: `docs/DOMAIN.md`.

---

## 10. Referências cruzadas

| Doc | O que tem |
|---|---|
| `docs/PRD.md` | O quê + por quê do produto |
| `docs/ARCHITECTURE.md` | Stack, schemas SQL, fluxos técnicos |
| `docs/DOMAIN.md` | Vocabulário, roles, estados, convenções |
| `docs/ROADMAP.md` | Sequência de sprints |
| `docs/principles/ENGINE_VS_TENANT.md` | Princípio universal |
| `.adrs/ADR-MKT-000.md` | ENGINE_VS_TENANT aplicado ao Prisma |
| `.adrs/ADR-MKT-001.md` | Arquitetura síncrona prompt-first |
| `.adrs/ADR-MKT-003.md` | Satori HTML→PNG |
| `.adrs/ADR-MKT-005.md` | Evolution direto sem N8N |
| `.adrs/ADR-MKT-006.md` | Prisma Design System v1 |

---

*Fim do CLAUDE.md v1.0.*
