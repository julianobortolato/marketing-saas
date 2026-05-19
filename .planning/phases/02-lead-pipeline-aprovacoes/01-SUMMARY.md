---
plan: "02-01"
status: complete
completed_at: "2026-05-19"
commit: fb07883
---

# Plan 02-01 Summary — Schema: leads + aprovacoes

## What was built

5 migration files creating the Phase 2 data foundation:

| File | Purpose |
|------|---------|
| `20260520000001_create_leads.sql` | `public.leads` — 9 columns, origen/status CHECK enums, 2 tenant-scoped indexes |
| `20260520000002_create_aprovacoes.sql` | `public.aprovacoes` — 5 columns, tipo/status CHECK enums, 1 index, no FK on referencia_id |
| `20260520000003_leads_aprovacoes_rls.sql` | PERMISSIVE (select/insert/update) + RESTRICTIVE (isolation_select/isolation_write) for both tables |
| `20260520000004_leads_aprovacoes_grants.sql` | `authenticated` DML + `service_role` ALL on both tables |
| `20260520000005_reload_pgrst_schema_p2.sql` | `NOTIFY pgrst` cache reload |

## Blocking checkpoint: passed

`supabase db push` applied all 5 migrations:
- `public.leads` exists, empty, `relrowsecurity = true`
- `public.aprovacoes` exists, empty, `relrowsecurity = true`
- Both tables: PERMISSIVE select + insert/update (owner/manager) + RESTRICTIVE isolation_select + isolation_write
- Grants: `authenticated` has SELECT/INSERT/UPDATE/DELETE; `service_role` has all privileges

## Key decisions

- No FK on `aprovacoes.referencia_id` — `conteudos`/`campanhas` tables arrive in Phases 4/5
- `leads.remotejid` and `leads.score` present now for Phase 3 forward-compat
- Webhook (Plan 02) uses service_role client (RLS bypass) — tenant_id MUST come from token, not body
- RESTRICTIVE dual-policy pattern mirrors Phase 1 migration 0004 exactly

## Requirements covered (schema layer)

LEAD-01, LEAD-02, LEAD-03, APROV-01, APROV-02 — schema prerequisites complete.
