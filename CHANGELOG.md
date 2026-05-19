## [2026-05-19] Fase 2 — Lead Pipeline + Aprovacoes — SHA 92b59a3

### Added
- Tabela `leads` com RLS dual-policy (PERMISSIVE + RESTRICTIVE) e GRANTs explícitos
- Tabela `aprovacoes` com RLS dual-policy e GRANTs explícitos
- Webhook `POST /api/webhooks/leads` com validação HMAC-SHA256 e mapeamento tenant por token
- `/dashboard/leads` — pipeline visual com filtros por status/canal/data, criação manual e mudança de status inline
- `/dashboard/aprovacoes` — fila semanal com cap de 10 posts orgânicos, aprovação/rejeição em lote
- Gate `assertCampaignApproved` para campanhas pagas (APROV-02)
- Viewer role: sem botão "Novo lead" e sem dropdowns de ação em `/dashboard/leads` e `/dashboard/aprovacoes`

### Security
- Webhook valida assinatura antes de processar payload (anti-padrão do CLAUDE.md respeitado)
- `tenant_id` derivado do token de webhook — nunca do payload externo
