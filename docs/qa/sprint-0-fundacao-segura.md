# QA — Sprint 0 (Fundação Segura)

**Sprint:** sprint-0-fundacao-segura  
**SHA:** 9984cf8  
**Data:** 2026-05-26  
**Status:** Pendente de validação manual (blocker: Evolution não dispara webhook)

---

## Pré-requisitos

- Instância Evolution `iara_v2_staging` disparando webhooks (blocker atual)
- `.env.local` com `EVOLUTION_WEBHOOK_SECRET`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`
- `NEXT_PUBLIC_SENTRY_DSN` configurado no Vercel
- Acesso ao SQL Editor do Supabase para queries de validação

## Cenários

### C1 — HMAC válido → 200 + mensagem persistida

**Setup:** instância Evolution ativa, `evolution_instances` com `instance_name` registrado

**Passos:**
1. Executar: `curl -s -X POST https://marketing-saas-nu.vercel.app/api/agents/cmo -H "Content-Type: application/json" -H "x-hub-signature-256: sha256=$(echo -n '<payload>' | openssl dgst -sha256 -hmac $EVOLUTION_WEBHOOK_SECRET | cut -d' ' -f2)" -d '<payload>'`
2. Verificar resposta HTTP 200

**Esperado:**
- Status 200 com `{ ok: true }` ou `{ ok: "unknown_instance" }`
- `SELECT * FROM chat_messages ORDER BY enviada_em DESC LIMIT 1` retorna nova linha

---

### C2 — HMAC inválido → 401

**Setup:** qualquer payload

**Passos:**
1. `curl -s -X POST https://marketing-saas-nu.vercel.app/api/agents/cmo -H "x-hub-signature-256: sha256=invalido" -d '{}'`
2. Verificar resposta

**Esperado:**
- Status 401 com `{ "error": "invalid_signature" }`
- Nada persistido em `chat_messages`

**Query de validação:**
```sql
SELECT COUNT(*) FROM chat_messages WHERE enviada_em > NOW() - INTERVAL '1 min';
-- Deve retornar 0 após chamada com HMAC inválido
```

---

### C3 — Idempotência: mesma mensagem 3x → 1 registro

**Passos:**
1. Enviar webhook com `evolution_message_id = 'TEST_IDEMPOTENCY_001'` via curl (com HMAC válido) — 3 vezes
2. Checar banco

**Esperado:**
- `callOpenAIWithTools` chamado exatamente 1 vez (não 3)
- `SELECT COUNT(*) FROM chat_messages WHERE evolution_message_id = 'TEST_IDEMPOTENCY_001'` = 1

---

### C4 — Rate limit: >10 msgs/min mesmo remotejid → 429

**Passos:**
1. Enviar 11 webhooks em sequência rápida com mesmo `remoteJid` e HMAC válido
2. Verificar que a 11ª retorna erro

**Esperado:**
- Chamadas 1–10: status 200
- Chamada 11+: status 429 com `{ "error": "rate_limit_tenant" }`

---

### C5 — LGPD aceite em `conversas`

**Passos:**
1. Enviar primeira mensagem de um `remoteJid` novo
2. Verificar campo na tabela

**Query de validação:**
```sql
SELECT remotejid, lgpd_aceito FROM conversas
WHERE remotejid = '<numero_testado>'
ORDER BY criado_em DESC LIMIT 1;
-- lgpd_aceito deve ser false antes do aceite explícito
```

---

### C6 — Sentry captura erro forçado

**Passos:**
1. No terminal local: forçar erro em rota de agente (ex: remover temporariamente env var)
2. Verificar Sentry dashboard

**Esperado:**
- Evento aparece em Sentry com tags `tenant_id`, `route`, `runtime`
- Nenhum PII de lead visível no payload do evento

---

## Casos de borda a testar

- `remotejid` nulo no payload → deve retornar 200 (absorver silenciosamente, não 500)
- `instance_name` desconhecido → 200 com `{ ok: "unknown_instance" }`, nada persistido
- `ia_habilitada = false` no tenant → 200 + fallback enviado, OpenAI NÃO chamado
- `iara_tenant_id IS NOT NULL` → 200 com `{ ok: "bridge_tenant_skipped" }`
- Tenant com budget zerado (`ia_limite_diario_usd = 0.01`) → kill switch dispara na 2ª chamada

## Fora do escopo (não testar agora)

- Geração de conteúdo Satori (Fase 5)
- OAuth Meta/Google (Fase 4/6)
- Dashboard ROI (Fase 7)
- Sprint 0.5 dogfood flows (próximo sprint)

---

## Validação de produção

- [ ] `GET https://marketing-saas-nu.vercel.app/api/admin/saude-mkt` retorna 200
- [ ] `/api/agents/cmo` aparece no Vercel deployment output como Edge route
- [ ] `SELECT * FROM chat_messages WHERE enviada_em > NOW() - INTERVAL '5 min'` retorna linhas após teste real
- [ ] SHA em produção confere: `git log -1 --format=%h` = `9984cf8`
- [ ] Nenhum erro relacionado a `academia_config` nos logs Vercel (tabela renomeada para `tenant_config`)
- [ ] View compat `academia_config` ainda responde (consulta via SQL Editor): `SELECT COUNT(*) FROM academia_config`
