# Phase 3: Agente WhatsApp — Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Source:** ADR Ingest Express Path (.adrs/ADR-MKT-001-agente-whatsapp.md) + BRIEFING_SPRINT2_WEBHOOK.md

<domain>
## Phase Boundary

Phase 3 delivers a fully operational WhatsApp agent for lead conversion:
- Automatic < 5 min WhatsApp response to new leads (tenants with `iara_tenant_id IS NULL` only)
- Aula Experimental scheduling via tool-use, updating `leads.status = 'agendado'`
- Human handoff switch per lead (`conversas.ia_ativa = false`)
- Observability dashboard (usage, latency, handoff rates, kill switch alerts)
- Minimal conversation UI for owner (read-only + editorial config)
- Full E2E smoke test suite + gradual cutover to Fitness UNIC

**Sprint 1 (schema) is DONE** — migrations 20260520000006–0010 are applied:
- Tables: `evolution_instances`, `conversas`, `chat_messages`, `ai_usage_log`, `ai_usage_diario`
- `academia_config` ALTER (caderno editorial: 5 new columns)
- `tenants` ALTER (IA budget: 4 new columns)
- RPCs: `fn_tenant_id_by_evolution_instance`, `rpc_persistir_mensagem_entrada`,
  `rpc_persistir_resposta_bot`, `rpc_registrar_uso_ia`, `rpc_atualizar_score_lead`, `rpc_handoff_humano`

**Remaining work covers Sprints 2–4** (ADR §15 items 7–18).

</domain>

<decisions>
## Implementation Decisions

All decisions below are **LOCKED** per ADR-MKT-001 (owner approved). Do not reopen.

### Architecture — Webhook flow (§6)
- Synchronous processing in Next.js API Route (`app/api/webhooks/evolution/route.ts`)
- 14-step pipeline: validateSignature → rateLimitIP → fn_tenant_id_by_evolution_instance → rateLimitTenant → rpc_persistir_mensagem_entrada → ia_ativa check → ia_habilitada check → build system_prompt → OpenAI tool-use loop (max 5 iter) → guardrails → rpc_persistir_resposta_bot → Evolution API send → rpc_registrar_uso_ia → return 200
- Webhook always returns 200 when message is **persisted**, regardless of LLM result — prevents Evolution redelivery loop
- HMAC-SHA256 validation via `EVOLUTION_WEBHOOK_SECRET` env var **before** any processing

### LLM (§8.2)
- GPT-4o by default (OpenAI, not Anthropic) — aligned with ARCHITECTURE.md ADR-005
- Single LLM per turn, no multi-agent, no classifier upstream
- Prompt caching enabled (Blocks 1+2+3+4 stable per tenant, only Block 5 + response = variable)
- Tool use via OpenAI function calling — no simulated JSON in prompt

### Tool use loop (§7, §8)
- Max 5 iterations per turn; hard fallback on timeout: `"Um momento, vou verificar isso com a equipe"` + log alert + handoff
- 5 tools: `consultar_disponibilidade_ae`, `agendar_aula_experimental`, `salvar_perfil_lead`, `score_lead`, `handoff_humano`
- Schemas in Zod for validation
- `score_lead` receives explicit parametrized signals from LLM + deterministic SQL formula — not free-text scoring

### System prompt structure (§8.1)
- 5 blocks: [Persona CMO] [DNA academia from academia_config] [Caderno editorial] [Regras inegociáveis] [Últimas 20 mensagens]
- Dynamic assembly in `lib/agents/cmo/system-prompt.ts`

### Guardrails — deterministic code post-LLM (§9)
- In `lib/agents/cmo/guardrails.ts` — `applyGuardrails(response, context)` returns `{ texto, handoff_solicitado, motivo }`
- 7 guardrails: Horário, Desconto (regex → force handoff), Preço (>5% divergence → handoff), Palavras proibidas, Identidade, Loop tool-use, Resposta vazia/muito longa
- Order matters: handoff short-circuits remaining checks

### Rate limiting
- Per IP + per Tenant rate limits before any tenant lookup
- `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` env vars needed for Upstash Redis

### Routing instance → tenant (§4.1, §5.1)
- `evolution_instances` table: 1 tenant → N instances (multi-instance support pre-built for Enterprise tier)
- `fn_tenant_id_by_evolution_instance(instance_name)` resolves webhook to tenant
- Webhook secret per instance in `evolution_instances.webhook_secret` (not global env var for multi-tenant)
- Current staging instance: `iara_v2_staging` — webhook cutover is **manual** after owner approval

### Idempotency
- `evolution_message_id` is UNIQUE per tenant in `chat_messages` — redelivered webhooks are absorbed silently
- `rpc_persistir_mensagem_entrada` is the idempotent entry point

### Budget + kill switch (§4.5, §5.4)
- `tenants.ia_habilitada` flag — kill switch trigger
- `ai_usage_diario` accumulator + trigger vs `ia_limite_diario_usd`
- Daily reset: tenant re-enables automatically the next day
- Default: Starter = $5/day, Pro = $15/day

### File paths (Sprint 2 deliverables)
- `lib/agents/cmo/system-prompt.ts` — dynamic 5-block system prompt assembly
- `lib/agents/cmo/tools.ts` — handlers for 5 tools (Zod schemas + RPC calls)
- `lib/agents/cmo/guardrails.ts` — post-LLM guardrails
- `app/api/webhooks/evolution/route.ts` — synchronous webhook flow (§6)
- `lib/openai/client.ts` — OpenAI client + tool-use loop (max 5 iter) + usage logging

### File paths (Sprint 3 deliverables)
- `app/api/admin/saude-mkt/route.ts` — diagnostics endpoint (tenant status, usage, handoff count) — no credentials, no lead PII
- `app/(dashboard)/[tenant_slug]/conversas/page.tsx` — read-only conversation list + detail
- `app/(dashboard)/[tenant_slug]/configuracoes/editorial/page.tsx` — CRUD for `academia_config` editorial columns

### File paths (Sprint 4 deliverables)
- Smoke test suite per §11 (RLS inverse, webhook smoke, kill switch, handoff, idempotency, HMAC)
- Gradual cutover: 10% → 50% → 100% of `iara_v2_staging` traffic

### Env vars — new in Phase 3
- `EVOLUTION_WEBHOOK_SECRET` — HMAC secret (generate: `openssl rand -hex 32`, add to Vercel + .env.local)
- `UPSTASH_REDIS_URL` — Upstash Redis for rate limiting
- `UPSTASH_REDIS_TOKEN` — Upstash Redis

### Claude's Discretion
- Exact rate limit thresholds per IP and per tenant
- Internal retry logic if Evolution API fails to send (at most 1 retry suggested)
- Specific observability alert channels in Sprint 3 (email hook or dashboard ping)
- Test file structure and testing library choice for smoke tests

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and Decisions
- `.adrs/ADR-MKT-001-agente-whatsapp.md` — Full architecture ADR with schema DDL, tool contracts, prompt strategy, guardrails, flow diagram, test suite, scope fence. Primary source of truth for Phase 3.
- `CLAUDE.md` — Project rules: multi-tenant (tenant_id on all tables), RLS, RPC patterns, TypeScript strict, security rules
- `ARCHITECTURE.md` — ADRs 001-005 baseline (multi-tenant RLS, cérebro separado, bridge IARA, Evolution V2, OpenAI)

### Existing patterns to follow
- `app/api/webhooks/leads/route.ts` — existing webhook pattern (HMAC, validation, 200-always philosophy)
- `lib/webhooks/verify-signature.ts` — signature validation utility (adapt for Evolution HMAC)
- `lib/supabase/admin.ts` — service_role Supabase client (use in webhook route, not anon client)
- `lib/supabase/server.ts` — server-side Supabase client pattern

### Schema (already applied)
- `supabase/migrations/20260520000006_academia_config_fase3.sql` — editorial columns on academia_config
- `supabase/migrations/20260520000007_create_whatsapp_tables.sql` — evolution_instances, conversas, chat_messages
- `supabase/migrations/20260520000008_tenants_ia_budget.sql` — ia_habilitada, ia_limite_diario_usd
- `supabase/migrations/20260520000009_ai_usage_tables.sql` — ai_usage_log, ai_usage_diario + kill switch trigger
- `supabase/migrations/20260520000010_whatsapp_functions.sql` — all 6 RPCs (fn_ and rpc_)

</canonical_refs>

<specifics>
## Specific Ideas

### From ADR §11 — Required smoke tests (Sprint 4 gate)
- Migrations clean on empty DB + idempotent on re-run
- RLS inverse suite: `evolution_instances`, `conversas`, `chat_messages`, `ai_usage_log`, `ai_usage_diario` — cross-tenant SELECT/INSERT/UPDATE/DELETE = 0 rows
- Smoke: message mock → 200 + chat_messages persisted
- Smoke: kill switch → force `ia_limite_diario_usd = 0.01` → second call returns fallback + `ia_habilitada = false`
- Smoke: handoff → input "desconto" → `conversas.ia_ativa = false`
- Smoke: idempotency → webhook redelivered 3x → 1 row in chat_messages
- Smoke: invalid HMAC → 401, nothing persisted
- Smoke: new lead → creates leads + conversas + chat_messages
- **Anti-leak gate**: create fictitious tenant "Academia Premium Vértice" in staging (formal tone, navy/white palette, senhor/senhora treatment) — run 10 test conversations — zero messages that sound like Fitness UNIC = blocker

### From ADR §13 — New env vars checklist
- `EVOLUTION_WEBHOOK_SECRET` — per ADR, generate with `openssl rand -hex 32`
- `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` — if not already present

### Cutover protocol (Sprint 4)
- Webhook endpoint must exist at deploy time but Evolution instance webhook is NOT pointed until owner approves in staging
- Current instance: `iara_v2_staging` (+556796884451) — still pointing to IARA V2
</specifics>

<deferred>
## Deferred Items (not in Phase 3)

Per ADR §12 — explicitly out of scope:

- Bridge IARA via `iara_tenant_id` (when first tenant buys both products)
- Multi-instance Evolution per tenant in UI (Enterprise tier — schema already supports it)
- Audio transcription via Whisper (Phase 3.1 — validate text-first hypothesis)
- Automatic lead re-engagement cron (Phase 4)
- Strong anonymization of OpenAI payload (when health data is collected)
- Real-time conversation dashboard (Phase 3.2 — owner uses WhatsApp Web in MVP)
- Multi-language support (Phase 5+)
- `tenants.modelo_ia` column for Sonnet 4.6 opt-in (Phase 3.1 if demand)
</deferred>

---

*Phase: 03-agente-whatsapp*
*Context gathered: 2026-05-20 via ADR Ingest Express Path (ADR-MKT-001)*
