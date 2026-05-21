# QA Checklist — Wave3-Tasks1-3
> Sprint: Wave 3 Tasks 1-3 | SHA: e216238 | 21/mai/2026

## Smoke Suite (automatizado)

```
□ npm run test:smoke roda sem erro de configuração
□ 25/25 testes passam contra produção
□ .identity-leak-report.json gerado em tests/smoke/
```

## Gate ENGINE_VS_TENANT (manual — owner valida)

```
□ Abrir .identity-leak-report.json
□ 10 entradas — revisar cada uma:
  □ Português formal (senhor/senhora ou você neutro sem gírias)
  □ Sem emojis
  □ Sem vocabulário, bairros ou modalidades da UNIC
  □ Nome da academia nas respostas = "Academia Premium Vértice" (não UNIC)
□ Zero entradas com hard_gate_pass = false
□ Aprovação owner registrada antes do cutover Stage 1
```

**STATUS: ✅ APROVADO — 21/mai/2026**

## Testes de borda (manual)

```
□ HMAC inválido → 401 sem persistir nada no banco
□ Webhook reentregue 3x com mesmo evolution_message_id → 1 registro em chat_messages
□ ia_limite_diario_usd = 0.01 → segunda chamada retorna fallback + tenants.ia_habilitada = false
□ Input "desconto" → conversas.ia_ativa = false (handoff)
□ Lead novo → leads + conversas + chat_messages criados em 1 request
```

## Pré-cutover Stage 1 (pendente)

```
□ Task 4: CUTOVER-CHECKLIST.md gerado pelo Code
□ Task 5: /gsd:verify-work 3 passou
□ Gap Google Calendar registrado no backlog
□ Webhook Evolution apontado para https://marketing-saas-nu.vercel.app/api/webhooks/evolution
```
