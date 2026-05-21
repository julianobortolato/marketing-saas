---
phase: 03-agente-whatsapp
plan: "01"
subsystem: whatsapp-agent
tags:
  - webhook
  - openai
  - guardrails
  - tool-use
  - rate-limiting
dependency_graph:
  requires:
    - 02-01 (autenticação/dashboard foundation)
    - migrations 0006-0010 (schema WhatsApp + IA budget)
  provides:
    - POST /api/webhooks/evolution (14-step pipeline)
    - callOpenAIWithTools (GPT-4o tool-use loop)
    - applyGuardrails (7 deterministic post-LLM checks)
    - dispatchTool (5 CMO agent tools)
    - buildSystemPrompt (5-block dynamic prompt)
  affects:
    - Evolution API (inbound webhook receiver)
    - ai_usage_log + ai_usage_diario (kill switch accounting)
    - chat_messages (persist before send)
    - conversas (ia_ativa flag via handoff_humano)
    - leads (status='agendado' via agendar_aula_experimental)
tech_stack:
  added:
    - openai@latest (GPT-4o chat completions + function calling)
    - "@upstash/redis@latest" (rate limit backend)
    - "@upstash/ratelimit@latest" (sliding window rate limiter)
    - vitest@latest (test runner + coverage)
  patterns:
    - TDD RED/GREEN/REFACTOR per task
    - never-throws discriminated union returns
    - singleton injection for testability (__setOpenAIClient)
    - vi.mock + vi.fn for Next.js route integration tests
key_files:
  created:
    - lib/validators/cmo-tools.ts
    - lib/openai/types.ts
    - lib/agents/cmo/system-prompt.ts
    - lib/agents/cmo/tools.ts
    - lib/agents/cmo/guardrails.ts
    - lib/openai/client.ts
    - lib/rate-limit/upstash.ts
    - app/api/webhooks/evolution/route.ts
    - lib/agents/cmo/__tests__/guardrails.test.ts
    - lib/openai/__tests__/client.test.ts
    - app/api/webhooks/evolution/__tests__/route.test.ts
    - vitest.config.ts
  modified: []
decisions:
  - "Preço guardrail uses conservative v1 proxy (literal R$ match vs planos JSON) rather than ADR §9 fuzzy >5% — always safer, never under-protective (TODO comment added)"
  - "api_key_encrypted read as plaintext in v1 — Supabase Vault decryption deferred (TODO comment added)"
  - "idempotente=true from rpc_persistir_mensagem_entrada causes immediate 200 return before LLM — prevents double billing on Evolution redelivery"
  - "Test injection via __setOpenAIClient export on OpenAI client singleton — avoids complex module mocking across test files"
  - "Vitest added as test runner (no prior test runner configured in project)"
metrics:
  duration: "~75 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  tests_total: 28
  files_created: 12
---

# Phase 3 Plan 1: WhatsApp Agent Core — Summary

**One-liner:** End-to-end WhatsApp agent pipeline: Evolution webhook HMAC validation + GPT-4o tool-use loop (max 5 iter) + 7 deterministic guardrails + persist-before-send pattern, covering WHATS-01 and WHATS-02.

## Files Created and Their Exports

### lib/validators/cmo-tools.ts
- `consultarDisponibilidadeSchema` — Zod schema for availability check tool
- `agendarAulaExperimentalSchema` — Zod schema for AE scheduling tool
- `salvarPerfilLeadSchema` — Zod schema for lead profile update tool
- `scoreLeadSchema` — Zod schema for lead scoring tool (sinais 1..5)
- `handoffHumanoSchema` — Zod schema for human handoff tool

### lib/openai/types.ts
- `UsageStats` — interface: tokens_entrada, tokens_saida, custo_usd, duracao_ms
- `ToolCallResult` — discriminated union: `{ resultado: unknown } | { erro: string }`

### lib/agents/cmo/system-prompt.ts
- `buildSystemPrompt(params)` — pure function, assembles 5-block prompt
  - Block 1: Persona CMO (stable, cache-eligible)
  - Block 2: DNA academia from academia_config (stable, cache-eligible)
  - Block 3: Caderno editorial (stable, cache-eligible)
  - Block 4: Regras inegociáveis (static, cache-eligible)
  - Block 5: Last 20 chat_messages (variable, not cached)

### lib/agents/cmo/tools.ts
- `cmoTools` — `ChatCompletionTool[]` array for 5 tools
- `dispatchTool(name, args, context)` — routes to handler, validates args via Zod .safeParse, never throws

### lib/agents/cmo/guardrails.ts
- `applyGuardrails(texto, context)` — 7 guards in ADR §9 order, never throws
- `FALLBACK_DESCONTO` — exported constant for desconto handoff message

### lib/openai/client.ts
- `callOpenAIWithTools(params)` — GPT-4o tool-use loop (max 5 iter), never throws
- `FALLBACK_OPENAI_ERROR` — hard fallback string constant
- `__setOpenAIClient(client)` — test injection (not for production)
- Pricing: `COST_INPUT_PER_1K = 0.0025`, `COST_OUTPUT_PER_1K = 0.01` (GPT-4o, 2026-05)

### lib/rate-limit/upstash.ts
- `rateLimitByIP(ip)` — 30 req/60s sliding window
- `rateLimitByTenant(tenantId)` — 100 req/60s sliding window
- Dev fallback: `{ success: true, remaining: 999 }` when env vars absent (warns once)

### app/api/webhooks/evolution/route.ts
- `export const runtime = 'nodejs'` (node:crypto for HMAC)
- `export async function POST(request: NextRequest)` — 14-step pipeline

## RPCs Called by the Webhook Route

| RPC | When Called | Why |
|-----|-------------|-----|
| `fn_tenant_id_by_evolution_instance` | Step 5 | Resolve instance_name → tenant_id |
| `rpc_persistir_mensagem_entrada` | Step 7 (atomic anchor) | Idempotent message persist + lead/conversa upsert |
| `rpc_persistir_resposta_bot` | Step 17 (before Evolution send) | Persist outbound before sending — Manifesto P5 |
| `rpc_registrar_uso_ia` | Via callOpenAIWithTools after every LLM turn | Kill switch accounting |
| `rpc_handoff_humano` | If guardrails force handoff | Set conversas.ia_ativa=false |

## Env Vars Required

| Var | Purpose | Note |
|-----|---------|------|
| `EVOLUTION_WEBHOOK_SECRET` | HMAC-SHA256 webhook signature verification | NEW — generate with `openssl rand -hex 32` |
| `UPSTASH_REDIS_URL` | Upstash Redis for rate limiting | NEW — from Upstash dashboard |
| `UPSTASH_REDIS_TOKEN` | Upstash Redis authentication | NEW — from Upstash dashboard |
| `OPENAI_API_KEY` | GPT-4o API calls | Existing — confirm in .env.local |
| `EVOLUTION_API_URL` | Evolution API base URL for sending messages | Existing |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Existing |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin client | Existing |

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| lib/agents/cmo/__tests__/guardrails.test.ts | 13 | PASS |
| lib/openai/__tests__/client.test.ts | 6 | PASS |
| app/api/webhooks/evolution/__tests__/route.test.ts | 9 | PASS |
| **Total** | **28** | **PASS** |

`next build` also passes with 0 TypeScript or ESLint errors.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Intentional Conservative Deviations (per plan spec)

**1. [Plan spec] Preço guardrail: conservative v1 proxy**
- ADR §9 specifies fuzzy >5% divergence comparison
- v1 implementation: any R$ value in LLM response not literally present in planos JSON → handoff
- This is stricter (never less safe than the spec)
- `// TODO: implement fuzzy >5% comparison per ADR §9` comment present in guardrails.ts
- `grep -n 'TODO.*5%'` returns 1 match (done criteria confirmed)

**2. [Plan spec] api_key_encrypted read as plaintext**
- Supabase Vault decryption deferred to follow-up plan
- v1 reads `evolution_instances.api_key_encrypted` column directly
- `// TODO: replace plaintext read with Supabase Vault decryption` comment present in route.ts (2 locations)
- `grep -n 'TODO.*Vault'` returns 2 matches (done criteria confirmed)

**3. [Rule 2 - Auto-add] Idempotency guard added to route**
- Plan specified idempotency via `rpc_persistir_mensagem_entrada` returning existing data
- Route now checks `persistData.idempotente === true` and returns 200 immediately before LLM call
- This prevents double billing on Evolution API redelivery (test behavior #8 verified)

**4. [Rule 3 - Vitest] Added vitest as test runner**
- No test runner was configured in package.json
- Added `vitest@latest`, `@vitest/coverage-v8`, `vite-tsconfig-paths`
- Created `vitest.config.ts` with `@/*` alias matching tsconfig paths

## Known Stubs

None that prevent plan goals from being achieved. The two TODO comments are conservative v1 implementations that are safe and correct, not stubs that return empty/placeholder data.

## Threat Flags

No new threat surface beyond what is documented in the PLAN.md threat model (T-03-01 through T-03-13). All mitigations implemented:
- HMAC: first gate before any DB (T-03-01)
- tenant_id from fn_tenant_id_by_evolution_instance, never from body (T-03-02)
- Zod .safeParse on all tool args + explicit .eq('tenant_id', tenantId) (T-03-03, T-03-11)
- rpc_registrar_uso_ia after every LLM turn (T-03-04, T-03-09)
- catch block logs only { errCode } — no PII, no exception message (T-03-05)
- rate limiting IP 30/60s + tenant 100/60s (T-03-08)
- max 5 iterations hard cap (T-03-10)
- desconto regex guardrail forces handoff (T-03-12)

## Self-Check: PASSED

Files exist:
- [x] lib/validators/cmo-tools.ts
- [x] lib/openai/types.ts
- [x] lib/agents/cmo/system-prompt.ts
- [x] lib/agents/cmo/tools.ts
- [x] lib/agents/cmo/guardrails.ts
- [x] lib/openai/client.ts
- [x] lib/rate-limit/upstash.ts
- [x] app/api/webhooks/evolution/route.ts

Commits exist:
- f120975: test(03-01): add failing guardrails, dispatchTool, buildSystemPrompt tests (RED)
- e03ab25: feat(03-01): Task 1 — pure modules: validators, types, guardrails, tools, system-prompt
- 5bd53ba: test(03-01): add failing OpenAI client + rate-limiter tests (RED)
- 5136fb4: feat(03-01): Task 2 — OpenAI client + Upstash rate limiter + usage logging
- faf2ba9: test(03-01): add failing webhook route tests — 9 behaviors (RED)
- 43b4c2d: feat(03-01): Task 3 — POST /api/webhooks/evolution 14-step pipeline + 9 tests

Tests: 28/28 pass (vitest)
Build: next build passes without TypeScript or ESLint errors
