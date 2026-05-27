# QA — wave3-cutover-auth

**Sprint:** wave3-cutover-auth
**SHA:** 319f543
**Data:** 2026-05-23
**Status:** Parcialmente validado — auth paths 1 e 3 confirmados via smoke; Evolution delivery ainda bloqueada

---

## Pré-requisitos

- `EVOLUTION_WEBHOOK_SECRET` configurado em Vercel Production
- `.env.smoke` com `SMOKE_EVOLUTION_WEBHOOK_SECRET` igual ao valor Vercel
- `evolution_instances` row com `webhook_secret` igual ao valor Vercel
- `evolution_instances` row com `ativo=true` para tenant Fitness UNIC

---

## Cenários

### C1 — Path HMAC (smoke tests)

**Setup:**
- `.env.smoke` com `SMOKE_EVOLUTION_WEBHOOK_SECRET` correto

**Passos:**
1. Rodar `npm run test:smoke`
2. Verificar resultado

**Esperado:**
- 8/8 test files, 25/25 tests PASS
- Nenhum 401 no output

**Status:** ✅ PASS (confirmado SHA 319f543)

---

### C2 — Path Bearer token rejeitado sem secret correto

**Setup:**
- Token errado no header Authorization

**Passos:**
1. `curl -s -o /dev/null -w "%{http_code}" -X POST https://marketing-saas-nu.vercel.app/api/webhooks/evolution -H "Content-Type: application/json" -H "Authorization: Bearer token_errado" -d '{"instance":"iara_v2_staging","data":{}}'`

**Esperado:**
- HTTP 401

---

### C3 — Path ?secret= query param aceito

**Setup:**
- `EVOLUTION_WEBHOOK_SECRET` correto disponível

**Passos:**
1. Montar payload Evolution mínimo como JSON
2. POST para `https://marketing-saas-nu.vercel.app/api/webhooks/evolution?secret=<EVOLUTION_WEBHOOK_SECRET>`
3. Verificar HTTP code e row em chat_messages

**Esperado:**
- HTTP 200
- Row `entrada` criada em chat_messages (ou absorvida por idempotência se message_id repetido)

---

### C4 — Evolution V2 entrega webhook end-to-end

**Setup:**
- Instância `iara_v2_staging` configurada com URL `https://marketing-saas-nu.vercel.app/api/webhooks/evolution?secret=<secret>`
- Evento `MESSAGES_UPSERT` ativo
- Instância conectada (verde)

**Passos:**
1. Enviar mensagem WhatsApp real para `+556796884451` de número diferente
2. Aguardar até 60s
3. Verificar Vercel logs: `vercel logs https://marketing-saas-nu.vercel.app`
4. Verificar banco:

```sql
SELECT direcao, conteudo, enviada_em, status_envio
FROM chat_messages
WHERE tenant_id = '2ab4c5b4-8555-4d4e-a406-b92d1b5b298f'
ORDER BY enviada_em DESC LIMIT 5;
```

**Esperado:**
- POST em `/api/webhooks/evolution` visível nos Vercel logs com status 200
- Row `entrada` criada em chat_messages
- Row `saida` criada em chat_messages dentro de 30s (reply do agente)
- Resposta recebida no WhatsApp

**Status:** ❌ BLOQUEADO — Evolution não dispara webhook (causa raiz: desconhecida)

---

## Casos de borda

- `?secret=` ausente na URL → 401
- `?secret=` com valor errado → 401
- Mesmo `evolution_message_id` entregue 2x → segunda row absorvida (idempotência)
- `fromMe=true` no payload → handler retorna 200 mas não processa (eco de saída)

## Fora do escopo

- WHATS-01/02/03 live traffic (aguardam C4 passar)
- Comportamento com múltiplos eventos simultâneos
- Reconexão automática da instância Evolution

---

## Validação de produção

- [x] SHA em produção: `git log -1 --format=%h` = `319f543`
- [x] Smoke 25/25 PASS
- [ ] `POST /api/webhooks/evolution?secret=<secret>` retorna 200 com payload real Evolution
- [ ] Row `entrada` + `saida` criadas após mensagem WhatsApp real
