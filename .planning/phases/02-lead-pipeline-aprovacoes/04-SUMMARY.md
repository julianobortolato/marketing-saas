---
plan: "02-04"
status: complete
completed_at: "2026-05-19"
commit: 92b59a3
---

# Plan 02-04 Summary — /dashboard/aprovacoes

## What was built

| File | Purpose |
|------|---------|
| `lib/validators/aprovacao.ts` | `batchDecisionSchema` — ids uuid array max(10) + decision enum |
| `lib/queries/aprovacoes.ts` | `getWeeklyOrganicBatch()` — pending conteudo, last 7d, LIMIT 10 |
| `lib/aprovacoes/campaign-gate.ts` | `assertCampaignApproved()` — fails closed; Phase 5 MUST call before paid publish |
| `app/dashboard/aprovacoes/actions.ts` | `approveBatch` + `rejectBatch` — guarded by `.eq('tipo','conteudo')` |
| `app/dashboard/aprovacoes/page.tsx` | Async Server Component: batch list + "X de 10" badge + role gate |
| `app/dashboard/aprovacoes/batch-approval.tsx` | "Aprovar lote" (red CTA) + "Rejeitar lote" (outline) with useTransition |
| `components/app-shell.tsx` | Aprovacoes NavItem added after Leads; Leads not regressed |

## Blocking checkpoint: passed

- 12 seeded rows → queue shows exactly 10 (cap enforced)
- "Aprovar lote" → inline green "Lote aprovado." → 10 rows status=aprovado in DB
- "Rejeitar lote" → 3 rows status=rejeitado
- Batch action never touched tipo=campanha rows
- Viewer: no batch buttons in DOM
- assertCampaignApproved throws for unapproved campaignId, passes for aprovado row

## Requirements covered

APROV-01: weekly organic batch ≤10, one-action approve/reject.
APROV-02: assertCampaignApproved gate enforced — consumable by Phase 5.
