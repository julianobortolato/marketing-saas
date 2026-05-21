# Smoke Test Suite — ADR-MKT-001 §11 Gate

End-to-end smoke tests for Phase 3 (Agente WhatsApp). Run **manually** before cutover — not in CI.

## When to run

- Before switching the Evolution webhook URL to production (CUTOVER-CHECKLIST.md pre-flight step 3)
- After any change to `app/api/webhooks/evolution/route.ts`, `lib/agents/cmo/`, or migrations 0007-0012
- After Vercel re-deployment to verify the new build is healthy

## Prerequisites

1. A deployed Vercel preview (or production) with all Phase 3 env vars set
2. A `.env.smoke` file at project root (never commit — already in `.gitignore`)
3. Supabase migrations 0006–0012 applied

## .env.smoke required contents

```bash
# Target Vercel deployment
SMOKE_BASE_URL=https://<your-preview>.vercel.app

# Supabase — use the SAME project as the deployment targets
SMOKE_SUPABASE_URL=https://<your-project-id>.supabase.co
SMOKE_SERVICE_ROLE_KEY=<service_role_key>     # NEVER commit
SMOKE_SUPABASE_ANON_KEY=<anon_key>           # needed for RLS inverse tests

# Must match EVOLUTION_WEBHOOK_SECRET on the Vercel deployment
SMOKE_EVOLUTION_WEBHOOK_SECRET=<hex_secret>  # NEVER commit

# Optional: comma-separated real production tenant UUIDs to protect from cleanup
# SMOKE_PRODUCTION_TENANT_IDS=uuid1,uuid2
```

> **NEVER commit .env.smoke.** It contains the service role key (full DB access) and the webhook HMAC secret.

## Running

```bash
npm run test:smoke
```

Each test file seeds its own isolated test tenant in `beforeAll` and cleans up in `afterAll`. Second runs from a clean state pass identically (idempotent harness).

## Cost

~$0.10–$0.50 in OpenAI tokens per full run (includes 10 identity-leak turns against the fictitious Vértice tenant).

## Tests included

| File | ADR §11 item |
|---|---|
| `hmac.smoke.test.ts` | Invalid HMAC → 401, nothing persisted |
| `webhook-evolution.smoke.test.ts` | Valid payload → 200 + message persisted + bot reply |
| `new-lead.smoke.test.ts` | First contact → leads + conversas + chat_messages created |
| `idempotency.smoke.test.ts` | Same `evolution_message_id` 3× → 1 row, 1 AI call |
| `handoff.smoke.test.ts` | "desconto" → `conversas.ia_ativa = false` |
| `kill-switch.smoke.test.ts` | Budget exhausted → `ia_habilitada = false` + fallback response |
| `rls-inverse.smoke.test.ts` | Cross-tenant SELECT/INSERT/UPDATE/DELETE blocked |
| `identity-leak.smoke.test.ts` | 10 Vértice turns — zero UNIC-tone vocabulary leak |

## Identity-leak report

After `identity-leak.smoke.test.ts` runs, open `tests/smoke/.identity-leak-report.json` and manually verify each of the 10 entries:

1. Formal Portuguese (senhor/senhora treatment or neutral without slang)
2. No emojis sprayed (conservative formal use only)
3. No UNIC-specific bairros, modalities, or vocabulary leak
4. Offer matches Vértice planos (Premium R$599, avaliação física presencial)

All 10 must pass for the anti-leak gate to be considered green.

## Cleanup after crash

If tests crash mid-run and `afterAll` doesn't execute, clean up manually:

```sql
-- In Supabase SQL editor
-- Find stuck smoke tenants
SELECT id, nome, slug FROM tenants WHERE slug LIKE 'smoke-%';

-- Clean one by ID (run for each stuck tenant)
DELETE FROM chat_messages WHERE tenant_id = '<stuck-tenant-id>';
DELETE FROM ai_usage_log WHERE tenant_id = '<stuck-tenant-id>';
DELETE FROM ai_usage_diario WHERE tenant_id = '<stuck-tenant-id>';
DELETE FROM conversas WHERE tenant_id = '<stuck-tenant-id>';
DELETE FROM evolution_instances WHERE tenant_id = '<stuck-tenant-id>';
DELETE FROM academia_config WHERE tenant_id = '<stuck-tenant-id>';
DELETE FROM leads WHERE tenant_id = '<stuck-tenant-id>';
DELETE FROM usuarios WHERE tenant_id = '<stuck-tenant-id>';
DELETE FROM tenants WHERE id = '<stuck-tenant-id>';
```
