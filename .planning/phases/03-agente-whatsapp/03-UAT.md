---
status: partial
phase: 03-agente-whatsapp
source:
  - 03-01-SUMMARY.md
  - 03-02-SUMMARY.md
  - 03-03-PLAN.md (verification + cutover tasks)
started: 2026-05-21T00:00:00.000Z
updated: 2026-05-21T00:00:00.000Z
---

## Current Test

[testing parcialmente completo — aguardando cutover Stage 1 para testes 9–11]

## Tests

### 1. Smoke suite — artefatos completos
expected: |
  tests/smoke/ contém 8 arquivos .smoke.test.ts (webhook-evolution, rls-inverse,
  kill-switch, handoff, idempotency, hmac, new-lead, identity-leak) + 3 helpers
  (seed.ts, sign.ts, webhook-payload.ts) + README.md. vitest.smoke.config.ts existe
  na raiz. package.json tem script "test:smoke". .env.smoke e
  tests/smoke/.identity-leak-report.json estão no .gitignore.
result: pass
verified_by: bash — ls tests/smoke/ confirmou 8 smoke files + 3 helpers; grep .gitignore confirmou ambas as entradas; ls vitest.smoke.config.ts existe; grep package.json confirmou test:smoke script

### 2. Unit tests — 56 testes verdes
expected: |
  vitest run passa com 56 testes em 8 suites (unit). Zero erros TypeScript e ESLint no build.
result: issue
reported: "56/56 unit tests pass. Porém: package.json NÃO tem script \"test\" — apenas \"test:smoke\". vitest sem config roda também os smoke tests (que falham com 'Missing required env var: SMOKE_SUPABASE_URL' quando .env.smoke está ausente). Comando correto para unit tests: npx vitest run. Faltou adicionar script \"test\": \"vitest run --config vitest.config.ts\" no package.json."
severity: minor

### 3. CUTOVER-CHECKLIST.md — estrutura
expected: |
  Arquivo .planning/phases/03-agente-whatsapp/CUTOVER-CHECKLIST.md tem 13 checkboxes
  não marcados cobrindo Pre-flight (6 itens), Stage 1 (2), Stage 2 (2), Stage 3 (3).
  Inclui bloco SQL para seed de evolution_instances. NÃO contém o valor real de
  EVOLUTION_WEBHOOK_SECRET (apenas placeholder).
result: pass
verified_by: bash — grep -c '\- \[ \]' retornou 13; arquivo existe; leitura confirmou Pre-flight + Stage sections + SQL block

### 4. /dashboard/conversas — lista visível
expected: |
  Navegando para /dashboard/conversas, aparece tabela com remotejid mascarado
  (...XXXX), coluna ia_ativa com badge "Ativo" ou "Em Handoff", status e timestamp.
  Se não houver conversas, exibe empty-state Card. Link "Conversas" visível no sidebar.
result: pass
note: "Lead 'ANA Test' visível com mensagens de entrada/saída e timestamp. Agente respondeu 'Temos planos mensais a partir de R.' — valor do plano truncado (seed sem planos configurados ou bug no system prompt template — registrado como issue separado)."

### 5. Handoff toggle — Assumir / Reativar
expected: |
  Abrindo uma conversa e clicando em "Assumir": ia_ativa = false, badge muda para
  "Em Handoff". Clicando "Reativar": ia_ativa = true, badge volta a "Ativo".
  Botões disponíveis apenas para roles owner/manager.
result: issue
reported: "Assumir funcionou (botão ficou amarelo e mudou para REATIVAR IA). Mas após clicar REATIVAR IA, o botão NÃO voltou para o estado ASSUMIR — permaneceu em Reativar. UI não reflete o estado atualizado após reativar."
severity: major

### 6. Editorial config — formulário e persistência
expected: |
  Navegando para /dashboard/configuracoes/editorial, aparece formulário com campos
  tom_de_voz, escopo, restrições, palavras_proibidas (tag input), gatilhos_handoff.
  Após salvar, toast de sucesso. Ao recarregar a página, valores persistem.
result: issue
reported: "Formulário aparece corretamente. Ao salvar: erro 'null value in column nome_academia of relation academia_config violates not-null constraint'. saveEditorialConfig faz upsert mas sem incluir nome_academia (NOT NULL) — falha quando academia_config row não existe para o tenant."
severity: major

### 7. /api/admin/saude-mkt — resposta correta
expected: |
  GET /api/admin/saude-mkt como owner retorna JSON com keys: agendamentos_hoje,
  handoffs_ativos, custo_usd_hoje, p50_webhook_ms, p95_webhook_ms. Nenhum campo
  com PII (remotejid, telefone, nome). GET como não-owner retorna 403.
result: pass
note: "Retornou JSON com status_ia, usage_diario, conversas (total/em_handoff/ia_ativa), mensagens (entrada/saida/falhas 24h), latencia_24h (p50/p95 null por falta de dados reais). Zero PII. conversas.em_handoff=1 reflete o assumir da ANA Test — coerente."

### 8. Anti-leak gate — revisão semântica aprovada (Task 3)
expected: |
  O Task 3 checkpoint do 03-03-PLAN.md foi aprovado: tests/smoke/.identity-leak-report.json
  contém 10 entradas com agent_response da "Academia Premium Vértice". Todas as 10
  passam na revisão semântica: tom formal, senhor/senhora, sem vocabulário da Fitness
  UNIC (sem "bora", "beleza", "top"), sem menção de bairros/modalidades/preços da UNIC.
result: pass

### 9. WHATS-01 — Reply automático em < 5 min (gate live)
expected: |
  Após completar o Pre-flight do CUTOVER-CHECKLIST e ativar Stage 1 (10% do tráfego),
  uma mensagem inbound real no iara_v2_staging gera uma row chat_messages tipo='saida'
  com enviada_em dentro de 5 minutos do criado_em da mensagem de entrada.
  Verificável em: SELECT tipo, criado_em, enviada_em FROM chat_messages ORDER BY criado_em DESC LIMIT 5.
result: skipped
reason: "Cutover pendente — iara_v2_staging ainda aponta para IARA V2. Retomar após Stage 1 do CUTOVER-CHECKLIST."

### 10. WHATS-02 — AE proposto + lead agendado (gate live)
expected: |
  Pelo menos 1 lead em /dashboard/conversas mostra status='agendado' após interação
  com o agente. ai_usage_log registra tool_call agendar_aula_experimental para essa
  conversa. O lead pode confirmar o horário e o status muda de 'novo' para 'agendado'.
result: skipped
reason: "Cutover pendente — iara_v2_staging ainda aponta para IARA V2. Retomar após Stage 1 do CUTOVER-CHECKLIST."

### 11. WHATS-03 — Assumir em produção para o agente em conversa real (gate live)
expected: |
  Owner clica "Assumir" em uma conversa real de produção. O agente NÃO envia novas
  mensagens para esse remotejid. Clicar "Reativar" re-habilita o agente para aquele
  lead. Verificável em conversas.ia_ativa=false e ausência de novas rows chat_messages
  tipo='saida' para esse remotejid após o handoff.
result: skipped
reason: "Cutover pendente. Nota: bug no Reativar UI (Test 5) deve ser corrigido antes do cutover para WHATS-03 ser verificável."

## Summary

total: 11
passed: 5
issues: 3 (todos corrigidos — SHA ba1138f)
pending: 0
skipped: 3 (aguardando cutover Stage 1)
blocked: 0

## Gaps

- truth: "package.json deve ter script \"test\" para rodar unit tests sem smoke tests"
  status: failed
  reason: "User reported: package.json tem apenas test:smoke. Rodar npx vitest sem config roda smoke tests junto, que falham sem .env.smoke. Falta script \"test\": \"vitest run --config vitest.config.ts\"."
  severity: minor
  test: 2
  artifacts:
    - package.json
    - vitest.config.ts
  missing:
    - '"test": "vitest run --config vitest.config.ts" no package.json scripts'

- truth: "saveEditorialConfig deve funcionar mesmo quando academia_config row não existe ainda para o tenant"
  status: failed
  reason: "User reported: erro 'null value in column nome_academia violates not-null constraint'. Causa: upsert em academia_config sem incluir nome_academia (NOT NULL). Fix: mudar para UPDATE-only (academia_config row sempre existe após onboarding) OU incluir fallback no upsert com nome_academia do tenant."
  severity: major
  test: 6
  artifacts:
    - app/dashboard/configuracoes/editorial/actions.ts
  missing:
    - "Query deve ser UPDATE das colunas editorial apenas (.eq('tenant_id', tenantId)) sem INSERT path, OU upsert com nome_academia incluído como fallback"

- truth: "Após clicar Reativar IA, o botão deve voltar ao estado Assumir e o badge deve indicar agente ativo"
  status: failed
  reason: "User reported: após clicar REATIVAR IA, o botão permaneceu em REATIVAR — UI não atualizou. Provável causa: conversa-actions.tsx usa useTransition mas não força router.refresh() ou revalidatePath após a Server Action reativarAgente completar."
  severity: major
  test: 5
  artifacts:
    - app/dashboard/conversas/[conversa_id]/conversa-actions.tsx
    - app/dashboard/conversas/actions.ts
  missing:
    - "router.refresh() ou revalidatePath após reativarAgente() completar com sucesso"
