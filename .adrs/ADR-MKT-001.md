# ADR-MKT-001 — Arquitetura síncrona prompt-first com tool use nativo

> **Status:** Ativo (v2 — substitui v1 integralmente)
> **Versão:** 2.0 — 26/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas` (v2)
> **Localização canônica:** `.adrs/ADR-MKT-001.md`
> **Princípios base:** `ENGINE_VS_TENANT.md`, síntese cross-projeto (V2 + Green + MKT v1)
> **Decisão pendente que esta ADR fecha:** D1 (onde prompts vivem)

---

## 1. Contexto

O marketing-saas v2 é um SaaS multi-tenant onde múltiplos agentes IA (bot WhatsApp CMO, gerador de copy, analista de redes, autotagueador de fotos) operam sobre dados de tenants distintos. A síntese cross-projeto consolidou 3 decisões que convergiram em V2, Green e MKT v1:

1. **Persistir antes de enviar** — banco antes de chamada externa
2. **Tool use nativo do GPT-4o** — sem FSM, sem máquina de estados em código
3. **Prompt-first sem orquestrador rígido** — o LLM decide o próximo passo via tool call

A v1 desta ADR (24/abr/2026, antes do pivot) descreveu uma arquitetura síncrona em API Route do Next.js sem detalhar onde os prompts vivem nem como o tool use é executado. O pivot do MKT v1→v2 (chat 25/mai) consolidou novas decisões: N8N OUT (ADR-MKT-005), Edge Runtime, prompts em tabela de banco. Esta v2 substitui a v1 inteira.

---

## 2. Decisão

O marketing-saas v2 adota arquitetura **síncrona, prompt-first, com tool use nativo**:

1. **Runtime:** Next.js 14 App Router em **Edge Runtime** para `/api/agents/cmo` (resolve cold start sem Vercel Pro).
2. **Modelo:** GPT-4o com tool use nativo. Sem FSM, sem máquina de estados, sem orquestrador externo.
3. **Persistência antes de envio:** toda mensagem entrante é gravada em `chat_messages` antes do round-trip com OpenAI. Toda resposta do bot é gravada antes do `evolution.send`.
4. **Prompts em tabela de banco** (`prompts_agentes`) — não em filesystem, não em repo `marketing-brain` separado, não em código TypeScript.
5. **Guardrails em código** (TS puro) — não no prompt. Validação pós-LLM por agente.
6. **Tools como funções TypeScript** que executam RPCs do Supabase. Cada tool é idempotente e auditada em `audit_log`.

---

## 3. Por que prompts em tabela de banco (D1)

Três alternativas foram consideradas:

| Opção | Prós | Contras |
|---|---|---|
| Repo separado `marketing-brain` | Versionamento Git, PR review | Sincronização banco↔repo, deploy duplo, custo cognitivo alto |
| Constantes em código TS | Tipagem, refactor fácil | Edit de prompt = redeploy; vaza tenant content em código (viola ENGINE_VS_TENANT se usado pra brand_manual) |
| **Tabela `prompts_agentes`** ✅ | Edit sem redeploy, histórico via coluna `version`, hot-reload, RLS por escopo | Sem PR review nativo (compensar com `audit_log`) |

**Decisão: tabela.** Prompts são **conteúdo operacional** (mudam por feedback do dogfooding, A/B de copy, ajuste de tom). Repo separado adiciona fricção que mata iteração. Constantes em código forçam redeploy a cada ajuste de uma vírgula.

**Schema canônico** (detalhe em ARCHITECTURE.md):

```sql
CREATE TABLE prompts_agentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente TEXT NOT NULL,           -- 'cmo_bot', 'gerador_copy', 'analista_redes'
  versao INTEGER NOT NULL,        -- incremental, nunca edita versão antiga
  prompt TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  escopo TEXT NOT NULL DEFAULT 'engine', -- 'engine' | 'tenant'
  tenant_id UUID NULL REFERENCES tenants(id),  -- NULL quando escopo='engine'
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_escopo_check CHECK (
    (escopo = 'engine' AND tenant_id IS NULL) OR
    (escopo = 'tenant' AND tenant_id IS NOT NULL)
  )
);
```

**Princípio:** prompt de engine (genérico, sem identidade de tenant) tem `escopo='engine'` e `tenant_id=NULL`. Prompt customizado por tenant tem `escopo='tenant'` e `tenant_id` preenchido. Engine carrega o de tenant se existir, senão usa o de engine. ENGINE_VS_TENANT preservado.

---

## 4. Por que síncrono (não fila / não worker)

Síncrono em API Route resolve até **~30s de latência total** (timeout do Edge Runtime). Cenário do bot CMO:

- HMAC + persist mensagem entrante: ~50ms
- GPT-4o tool use (1-3 rounds típicos): 2-8s
- Persist resposta + envio Evolution: ~300ms

**Total: 3-9s na maioria dos casos.** Bem dentro do limite.

Fila/worker entra **só se** houver evidência de >20% das chamadas excedendo 15s. Hoje não há. Reabrir com gatilho objetivo: P95 de latência >15s por 7 dias seguidos.

**Custo de fila prematura** (medido no V2): infraestrutura adicional (Inngest/Trigger.dev), debug duplicado (job retry vs request retry), perda de stack trace direto. Não vale antes da evidência.

---

## 5. Por que Edge Runtime

| Edge Runtime | Node Runtime (Vercel) |
|---|---|
| ✅ Zero cold start | ❌ Cold start 1-3s no plano Hobby |
| ✅ Global edge (latência baixa pra Evolution) | ❌ Single region |
| ❌ Sem `fs`, sem libs Node-only | ✅ Node API completa |
| ❌ Sem Puppeteer | ✅ Puppeteer roda |

**Trade-off resolvido:** o agente CMO não precisa de `fs` (prompts vêm do banco, ADR §3) nem Puppeteer (renderização HTML→PNG resolvida por Satori em outra rota, ADR-MKT-003).

**Gatilho de revisita:** se alguma lib essencial do bot exigir Node API (improvável — `openai` SDK e `@supabase/supabase-js` rodam em Edge), migrar `/api/agents/cmo` pra Node e reavaliar Vercel Pro pra cold start.

---

## 6. Tool use nativo (sem FSM)

Aprendizado do Green: FSM em N8N gerou 10 anti-padrões e 6 limitações. Aprendizado do V2: orquestrador rígido em TypeScript gerou débito de fronteira engine/tenant (ADR-V2-000).

**Padrão adotado:**

```typescript
// pseudo-código simplificado — detalhe em ARCHITECTURE.md
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [system, ...history, userMessage],
  tools: TOOLS,  // declaração de tools como JSON schema
  tool_choice: 'auto',
});

// LLM decide qual tool chamar; código apenas executa
for (const call of response.tool_calls) {
  const result = await executeTool(call.name, call.arguments, tenantId);
  // result volta pro LLM no próximo round
}
```

**O LLM decide o fluxo.** Código executa tools, persiste, valida guardrails. Sem `if (estado === 'qualificando') ...`. Sem máquina de estados.

**Limite rígido em código** (não no prompt): máx 2 propostas de conversão por conversa. Implementado como contador em `chat_messages` consultado antes do round-trip.

---

## 7. Guardrails em código, não no prompt

Aprendizado consolidado nos 3 projetos: prompt-only guardrail falha silenciosamente. Validação pós-LLM em TS é determinística.

**Categorias de guardrail:**

| Categoria | Onde valida | Exemplo |
|---|---|---|
| Output proibido | TS pós-LLM | Resposta contém palavra proibida do `brand_manual.tom_de_voz.palavras_proibidas` |
| Limite de ação | TS pré-tool | Tool `propor_ae` chamada >2x na conversa |
| Conteúdo sensível | TS pós-LLM | Promessa de desconto fora do range autorizado |
| Handoff humano | TS pré-LLM | Keyword "pagamento", "cancelar" → handoff antes do round-trip |

**Falha de guardrail** = mensagem não enviada + log em `audit_log` + alerta Sentry. Não é exceção silenciosa.

---

## 8. Persistir antes de enviar

Padrão obrigatório em toda rota que toca Evolution, OpenAI ou Meta API:

```
1. Receber payload
2. Validar HMAC + idempotência
3. PERSIST em banco (com status 'recebida' / 'pendente')
4. Chamar API externa
5. PERSIST resultado (atualiza status pra 'enviada' / 'falhou')
6. Retornar resposta HTTP
```

Reentrega da Evolution não duplica ação (idempotência via `evolution_message_id` UNIQUE por tenant). Falha de API externa fica auditável em banco. Debug não depende de log da Vercel.

---

## 9. Anti-padrões proibidos (consequência direta)

- `fs.readFileSync` em runtime de produção (Edge Runtime nem permite; em Node, proibido por princípio)
- Prompt hardcoded em string literal em código compartilhado
- FSM/orquestrador em TypeScript decidindo fluxo do agente
- Tool call sem persist antes do envio
- Guardrail apenas no system prompt sem validação pós-LLM
- API externa chamada sem timeout + retry policy explícitos
- Bot operando com >2 propostas de conversão na mesma conversa

---

## 10. O que NÃO entra nesta ADR

- Schemas SQL completos (vão pra ARCHITECTURE.md)
- Lista exaustiva de tools do bot CMO (vai pra ARCHITECTURE.md + DOMAIN.md)
- Decisão sobre Evolution direto vs N8N → **ADR-MKT-005**
- Decisão sobre renderização HTML→PNG → **ADR-MKT-003**
- Bridge MKT→V2 (`iara_tenant_id`) → ARCHITECTURE.md §Bridge
- Pricing, billing, Stripe → fora do escopo arquitetural

---

## 11. Gatilhos de revisita

| Condição | Ação |
|---|---|
| P95 de latência do `/api/agents/cmo` >15s por 7 dias | Avaliar fila assíncrona |
| Edge Runtime esbarra em lib essencial sem alternativa | Migrar rota pra Node + avaliar Vercel Pro |
| 3+ tenants reportarem dificuldade em editar prompts via SQL | Construir UI de edição de prompts (não MVP) |
| Tool use nativo produzir loop infinito >3x em produção | Adicionar circuit breaker explícito (hoje só timeout) |
| Volume de prompts customizados por tenant >10 por tenant | Avaliar versionamento via Git side-by-side |

---

## 12. Substituição da v1

A v1 desta ADR (24/abr/2026) descrevia:
- Arquitetura síncrona em API Route ✅ mantida
- GPT-4o como modelo padrão ✅ mantida
- Stack Next.js + Supabase ✅ mantida

A v1 **não cobria**: Edge Runtime, prompts em tabela, separação engine/tenant em prompts, tool use nativo como padrão, guardrails em código. Esta v2 absorve e fecha esses pontos.

---

*Fim do ADR-MKT-001 v2.*
