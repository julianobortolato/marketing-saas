# ADR-MKT-005 — Evolution API direto sem N8N

> **Status:** Ativo
> **Versão:** 1.0 — 26/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas` (v2)
> **Localização canônica:** `.adrs/ADR-MKT-005.md`
> **Princípios base:** síntese cross-projeto §3, ADR-MKT-001 v2
> **Substitui:** decisão informal "N8N como orquestrador do bot" presente no Escopo v1.0 (23/mai)

---

## 1. Contexto

O Escopo v1.0 do MKT v2 (23/mai/2026) propôs N8N como camada de orquestração entre Evolution API e o backend Next.js:

```
Evolution → webhook → N8N → chama API do SaaS (/api/agents/cmo)
```

A motivação inicial era reuso do que funcionou no projeto **Green** (chatbot mono-tenant em produção via N8N). A síntese cross-projeto (chat 25/mai) revisitou essa decisão sob 4 lentes e identificou que N8N **repetiria 10 anti-padrões + 6 limitações documentadas** no Green:

**Anti-padrões herdados do Green:**
1. Lógica de negócio fragmentada entre N8N nodes e código (impossível auditar)
2. Sem versionamento Git de fluxo (export JSON é frágil)
3. Sem testes automatizados de fluxo
4. Debug por inspeção visual de nodes (não escala)
5. Variáveis de credencial em UI do N8N (não em env)
6. Cold start em N8N self-hosted (latência variável)
7. Erro de node = silêncio (sem Sentry nativo)
8. Mudança de fluxo = deploy manual via UI (sem PR review)
9. Dependência operacional do N8N rodando (mais um ponto de falha)
10. Custo cognitivo de manter 2 mentais (N8N + código)

**Limitações documentadas no Green:**
- Idempotência manual em cada fluxo
- Rate limit não nativo
- Multi-tenancy não suportado (cada tenant = instância separada de N8N)
- HMAC validação manual em cada webhook
- LGPD/consentimento ad-hoc por fluxo
- Logs dispersos entre N8N e Supabase

O Escopo v2.0 (25/mai) descontaminou parte do que estava errado, mas manteve N8N por inércia. **Esta ADR formaliza a remoção.**

---

## 2. Decisão

O marketing-saas v2 adota arquitetura **Evolution → Next.js direto**, sem camada de orquestração externa:

```
Evolution API (instância por tenant)
  ↓ webhook POST
/api/agents/cmo (Next.js Edge Runtime)
  ↓ HMAC + idempotência + rate limit
  ↓ persist mensagem entrante
  ↓ LLM (GPT-4o tool use)
  ↓ persist resposta
  ↓ evolution.send
```

N8N **não entra no MVP** e **não entra como dependência operacional do MKT v2**.

---

## 3. O que viabiliza essa decisão

A v1 deste produto não tinha 4 das peças que tornam Evolution→Next.js direto viável. A v2 tem:

| Peça | Resolve o quê | Onde fica |
|---|---|---|
| **Edge Runtime** | Cold start (resolvia 1 dos motivos do N8N) | ADR-MKT-001 v2 §5 |
| **HMAC + idempotência + rate limit em código** | Travas que o N8N implementava ad-hoc | ARCHITECTURE.md §Segurança webhook |
| **Tool use nativo do GPT-4o** | Orquestração de fluxo via LLM, não via FSM | ADR-MKT-001 v2 §6 |
| **Sentry + pre-commit `next build`** | Observabilidade que N8N não dá | ARCHITECTURE.md §Observabilidade |

Sem essas 4 peças, N8N seria atalho razoável. Com elas, vira fricção pura.

---

## 4. O que o Green ensina (e o que NÃO replicar)

O Green funciona **como piloto mono-tenant**. A síntese cross-projeto separou explicitamente:

| Do Green, **REPLICAR** (decisões) | Do Green, **NÃO REPLICAR** (infra) |
|---|---|
| Cenários de conversa que convertem | N8N como runtime |
| Heurísticas de qualificação de lead | Fluxo visual em nodes |
| Tom de voz adaptado ao mercado local | Credenciais em UI do N8N |
| Pontos de handoff humano | Multi-instância pra escalar tenants |
| Triggers de follow-up (2h, 24h) | Auditoria via inspeção de execução |

**Princípio:** o **prompt do Green** (system prompt + cenários + guardrails) vira input do `system-prompt.ts` e `guardrails.ts` do MKT v2. **A infra do Green não vem junto.**

---

## 5. Anti-padrão proibido

`AP-MKT-005-001 — Trazer N8N de volta sem evidência objetiva nova`

Qualquer proposta de reintroduzir N8N (ou ferramenta equivalente de orquestração visual: Make, Zapier, Pipedream) requer:

1. Limitação tecnicamente irresolvível em Next.js direto (não "seria mais fácil")
2. Evidência registrada de tentativa real de resolver via código primeiro
3. Custo total de propriedade comparado (não só "é gratuito no free tier")
4. ADR nova com gatilho objetivo de revisita

Sem os 4 → PR rejeitada.

---

## 6. Gatilhos de revisita (objetivos)

| Condição | Ação |
|---|---|
| Volume de fluxos não-conversacionais (cron complexo, fan-out multi-API) que não cabem em Next.js | Avaliar orquestrador, **mas separado do bot CMO** (CMO segue em Next.js direto) |
| Necessidade comercial de fluxo customizável por tenant não-técnico | Avaliar editor visual interno (não N8N self-hosted) |
| Edge Runtime esbarrar em limitação irresolvível | Migrar pra Node + reavaliar Vercel Pro **antes** de considerar orquestrador externo |

**Não é gatilho:**
- "Seria mais rápido prototipar em N8N"
- "Outro dev sugeriu"
- "Vi no YouTube"

---

## 7. Impacto em outros docs

- **PRD v2.4 §13** — Anti-padrões já lista "Trazer código OU infra do Green (N8N) sem evidência objetiva nova" ✅ alinhado
- **ESCOPO v2.1** — menciona N8N em §3 e §8; ARCHITECTURE.md vai sobrescrever
- **CLAUDE.md** — incorpora AP-MKT-005-001 como anti-padrão com enforcement
- **ROADMAP.md** — Sprint 0 NÃO inclui setup N8N; webhook Evolution aponta direto pra `/api/agents/cmo`

---

## 8. O que NÃO entra nesta ADR

- Schema de `chat_messages`, `evolution_instances` → ARCHITECTURE.md
- Detalhe de tools do bot → ARCHITECTURE.md
- Fluxo de OAuth Meta+Google → ARCHITECTURE.md
- Decisão sobre arquitetura síncrona/assíncrona → ADR-MKT-001 v2

---

*Fim do ADR-MKT-005.*
