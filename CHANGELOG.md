## [2026-05-20] Fase 3 Sprint 1 — Schema WhatsApp + IA (migrations 0006–0010)

### Added
- `supabase/migrations/20260520000006_academia_config_fase3.sql`: ALTER TABLE academia_config — colunas caderno editorial (`argumentos_venda`, `objecoes_comuns`, `palavras_proibidas`, `gatilhos_handoff`, `persona_cmo`), tema visual (`tema JSONB`) e `atualizado_em` com trigger
- `supabase/migrations/20260520000007_create_whatsapp_tables.sql`: tabelas `evolution_instances`, `conversas`, `chat_messages` com RLS PERMISSIVE+RESTRICTIVE e índices parciais
- `supabase/migrations/20260520000008_tenants_ia_budget.sql`: ALTER TABLE tenants — colunas IA budget (`ia_habilitada`, `ia_limite_diario_usd`, `ia_desabilitada_em`, `ia_desabilitada_motivo`)
- `supabase/migrations/20260520000009_ai_usage_tables.sql`: tabelas `ai_usage_log`, `ai_usage_diario` e trigger `fn_acumular_uso_ia` com kill switch automático por tenant
- `supabase/migrations/20260520000010_whatsapp_functions.sql`: RPCs SECURITY DEFINER — `fn_tenant_id_by_evolution_instance`, `rpc_persistir_mensagem_entrada` (idempotente), `rpc_persistir_resposta_bot`, `rpc_registrar_uso_ia`, `rpc_atualizar_score_lead`, `rpc_handoff_humano`

### Gates passados
- ✅ Todas as 5 migrations aplicadas via `supabase db push`
- ✅ RLS habilitada em todas as 5 tabelas novas
- ✅ PERMISSIVE (SELECT) + RESTRICTIVE (ALL) em cada tabela
- ✅ 7 colunas novas em academia_config confirmadas
- ✅ 4 colunas IA em tenants confirmadas
- ✅ 8 funções/RPCs SECURITY DEFINER confirmadas

---

## [2026-05-20] canônicos pós ENGINE_VS_TENANT — SHA a7b37f8

### Added
- `.adrs/ADR-MKT-001-agente-whatsapp.md`: ADR completo da Fase 3 commitado no repo (schema DDL, RPCs, tools, guardrails, observability)

### Changed
- `DOMAIN.md`: DNA da academia registra `tema` JSONB como tenant content — nunca em código
- `ARCHITECTURE.md`: estrutura de pastas documenta `docs/principles/` e `.adrs/`; ADR-006 engine vs tenant adicionada; schema `academia_config` ganha coluna `tema JSONB`

---

## [2026-05-20] ENGINE_VS_TENANT principle + ADR-MKT-000 — SHA 7f066b7

### Added
- `docs/principles/ENGINE_VS_TENANT.md`: princípio universal de separação engine vs tenant — regras mecânicas, exemplos de código, anti-padrões históricos, critérios de exceção
- `.adrs/ADR-MKT-000.md`: aplicação do princípio ao marketing-saas — modelo B parcial, exceções aceitas com gatilho objetivo, violação ativa documentada

### Changed
- `CLAUDE.md` seção "Identidade visual": prescrição de tokens UNIC como design system do engine removida; substituída por modelo B parcial com `academia_config.tema` como fonte de verdade em runtime

---

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
