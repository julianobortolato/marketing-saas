---
plan: "02-02"
status: complete
completed_at: "2026-05-19"
commit: 9c33add
---

# Plan 02-02 Summary — Webhook POST /api/webhooks/leads

## What was built

| File | Purpose |
|------|---------|
| `lib/webhooks/verify-signature.ts` | HMAC-SHA256 verification via `timingSafeEqual` (timing-safe, never throws) |
| `lib/webhooks/parse-lead.ts` | Normalizes Meta Lead Form + WhatsApp payloads into a lead insert shape |
| `app/api/webhooks/leads/route.ts` | POST handler: verify → resolve tenant → parse → insert via admin client |
| `.env.local.example` | Documents `LEADS_WEBHOOK_SECRET` + `WEBHOOK_TENANT_MAP` (no real values) |

## Blocking checkpoint: passed

- Signed Meta-form POST → 201 + lead row `origem='meta_form', status='novo', telefone=digits-only`
- Signed WhatsApp POST → 201 + lead row `origem='whatsapp', remotejid` set
- Wrong signature → 401 `invalid_signature`, no DB insert
- Unknown token → 401 `unknown_tenant`, no DB insert
- No secret leaked to logs

## Key decisions

- `runtime = 'nodejs'` required for `node:crypto` (not Edge)
- `request.text()` before any JSON parse — HMAC must be computed on raw bytes
- `timingSafeEqual` wrapped in try/catch — length mismatch throws, never leaks via timing branch
- tenant_id from `WEBHOOK_TENANT_MAP[token]`, never from request body

## Requirements covered

LEAD-01: webhook creates correctly-tenanted lead.
