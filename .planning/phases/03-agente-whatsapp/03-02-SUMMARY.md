---
phase: 03-agente-whatsapp
plan: 02
status: complete
completed_tasks: [1, 2, 3, 4]
pending_tasks: []
checkpoint_approved_by: owner (julianobortolato@fitnessacademia.com.br)
checkpoint_approved_at: 2026-05-21
---

# Plan 03-02 Summary

## Files Created / Modified

### Task 1 — Conversas views + handoff + sidebar
| File | Status | Notes |
|---|---|---|
| `supabase/migrations/20260520000011_academia_config_editorial_columns.sql` | **NEW** | Adds caderno_editorial_* columns missing from 0006 |
| `lib/queries/conversas.ts` | NEW | `getConversas()` + `getConversaWithMessages()` via session client |
| `app/dashboard/conversas/page.tsx` | NEW | Server Component, Promise.all, empty-state Card |
| `app/dashboard/conversas/conversas-table.tsx` | NEW | 'use client', useTransition, handoff badge, masked remotejid |
| `app/dashboard/conversas/[conversa_id]/page.tsx` | NEW | Read-only thread, UUID validation, entrada=left/saida=right |
| `app/dashboard/conversas/[conversa_id]/conversa-actions.tsx` | NEW | Isolated Client Component for Assumir/Reativar buttons |
| `app/dashboard/conversas/actions.ts` | NEW | `assumirConversa` (rpc_handoff_humano) + `reativarAgente` (direct update) |
| `components/app-shell.tsx` | MODIFIED | +NavItem Conversas between Aprovacoes and Conteudo |
| `lib/queries/__tests__/conversas.test.ts` | NEW | 5 vitest tests |
| `app/dashboard/conversas/__tests__/actions.test.ts` | NEW | 5 vitest tests |

### Task 2 — Editorial CRUD
| File | Status | Notes |
|---|---|---|
| `lib/validators/editorial-config.ts` | NEW | `editorialConfigSchema` — 8 fields, all optional |
| `lib/queries/academia-config.ts` | MODIFIED | Extended `AcademiaConfigRow` + new `getEditorialConfig()` |
| `app/dashboard/configuracoes/editorial/page.tsx` | NEW | Server Component |
| `app/dashboard/configuracoes/editorial/editorial-form.tsx` | NEW | 'use client', react-hook-form + zodResolver, TagInput |
| `app/dashboard/configuracoes/editorial/actions.ts` | NEW | `saveEditorialConfig` — fn_tenant_id → upsert |
| `lib/validators/__tests__/editorial-config.test.ts` | NEW | 6 vitest tests |
| `app/dashboard/configuracoes/editorial/__tests__/actions.test.ts` | NEW | 4 vitest tests |

### Task 3 — Diagnostics endpoint
| File | Status | Notes |
|---|---|---|
| `lib/queries/saude-mkt.ts` | NEW | `buildSaudeMktPayload()` — 5 parallel queries, JS p50/p95 |
| `app/api/admin/saude-mkt/route.ts` | NEW | `GET` handler — role gate owner-only |
| `app/api/admin/saude-mkt/__tests__/route.test.ts` | NEW | 7 vitest tests |

## RPCs Used
- `rpc_handoff_humano(p_tenant_id, p_conversa_id, p_motivo)` — in `assumirConversa`
- `fn_tenant_id()` — in `saveEditorialConfig` and `reativarAgente`

## Role Gates
| Action | Allowed roles |
|---|---|
| `assumirConversa` | owner, manager |
| `reativarAgente` | owner, manager |
| `saveEditorialConfig` | owner, manager |
| GET `/api/admin/saude-mkt` | **owner only** |

## PII Suppression
- `conversas-table.tsx`: remotejid masked to last 4 digits (`...XXXX`)
- `saude-mkt.ts` / `route.ts`: zero PII fields — only counters and aggregates
- Grep gate confirmed: no `telefone`, `remotejid`, `nome`, `email` in saude-mkt files

## Defense-in-Depth
- `reativarAgente`: `.eq('id').eq('tenant_id', usuario.tenant_id)` on direct UPDATE
- `buildSaudeMktPayload`: 4× `.eq('tenant_id', tenantId)` across parallel queries
- `assumirConversa`: passes `p_tenant_id` explicitly to SECURITY DEFINER RPC

## Deviations from Plan
1. **Migration 0011 created** — plan's done criteria referenced `caderno_editorial_*` columns in migration 0006, but migration 0006 only added `argumentos_venda`, `objecoes_comuns`, `palavras_proibidas`, `gatilhos_handoff`, `persona_cmo`. Migration 0011 adds the missing `caderno_editorial_*` fields. Column names in validator match migration 0011 exactly.
2. **`conversa-actions.tsx` extracted** — detail page required an interactive button; extracted to a separate Client Component to keep the page itself a Server Component.
3. **`rpc_handoff_humano` requires `p_tenant_id`** — plan action description omitted `p_tenant_id` from the RPC call args, but the migration signature requires it. Added `p_tenant_id: usuario.tenant_id` to the call.

## Test Results
```
Test Files  5 passed (5)
Tests       28 passed (28)
```

## Build
`next build` clean — no TypeScript errors, no ESLint errors.

## Manual Checkpoint (Task 4) — APPROVED 2026-05-21

| Step | Check | Result |
|------|-------|--------|
| Seed | conversa `eb24f0bc` + 3 chat_messages (entrada/saida/entrada) inserted for tenant | ✅ |
| DB: conversa aparece | `conversas` row exists — `ia_ativa=true`, `motivo_handoff=null` pré-handoff | ✅ |
| RPC assumir | `rpc_handoff_humano(p_tenant_id, p_conversa_id, 'pedido_explicito')` → `{ok:true}` | ✅ |
| DB pós-assumir | `ia_ativa=false`, `motivo_handoff='pedido_explicito'` | ✅ |
| Reativar | `UPDATE conversas SET ia_ativa=true, motivo_handoff=null` (defense-in-depth `.eq('tenant_id')`) | ✅ |
| DB pós-reativar | `ia_ativa=true`, `motivo_handoff=null` | ✅ |
| Webhook guard | `route.ts:139` — `if (!persistData.ia_ativa)` skippa agent quando em handoff | ✅ |
| Identity gate | grep `Fitness UNIC\|#E30613\|fitnessacademia` em conversas/ + queries/conversas.ts → 0 matches | ✅ |

Steps 7–10 (editorial form, saude-mkt curl, viewer 403, sidebar) verificados pelo owner no browser.
