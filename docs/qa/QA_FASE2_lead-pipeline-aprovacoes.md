# QA Checklist — Fase 2: Lead Pipeline + Aprovacoes
> Sprint SHA: 92b59a3 · 19/mai/2026

## Plan 02-02 — Webhook /api/webhooks/leads

### Cenário 1 — Webhook válido cria lead
1. Computar HMAC-SHA256 do body com `LEADS_WEBHOOK_SECRET`
2. POST `/api/webhooks/leads` com headers `x-webhook-token` e `x-hub-signature-256`
3. **Esperado:** HTTP 201 + `{ "id": "<uuid>" }`
4. **SQL:** `SELECT origem, status, telefone FROM public.leads ORDER BY criado_em DESC LIMIT 1`
5. **Esperado:** `meta_form | novo | 5511988887777`

### Cenário 2 — Webhook com assinatura inválida é rejeitado
1. POST com `x-hub-signature-256: sha256=invalido`
2. **Esperado:** HTTP 401

### Cenário 3 — Webhook com token de tenant inexistente
1. POST com `x-webhook-token: token-inexistente`
2. **Esperado:** HTTP 401 ou 403 (não 500)

### Borda — tenant_id não vaza pelo payload
1. POST com body contendo `tenant_id` adulterado
2. **Esperado:** lead criado com tenant do token, não do payload

---

## Plan 02-03 — /dashboard/leads

### Cenário 4 — Criar lead manual
1. Login como owner → `/dashboard/leads`
2. Clicar "Novo lead" → preencher Nome, Telefone, Canal="manual" → Submit
3. **Esperado:** mensagem verde inline + row aparece na tabela sem reload

### Cenário 5 — Mudar status persiste
1. Selecionar lead → mudar status para "contatado"
2. Hard refresh (`Cmd+Shift+R`)
3. **Esperado:** status ainda "contatado"
4. **SQL:** `SELECT status, tenant_id FROM public.leads WHERE nome='<nome>';`
5. **Esperado:** `contatado | <tenant_id_correto>`

### Cenário 6 — Filtros funcionam
1. Filtrar por status="novo" → leads convertidos somem
2. "Limpar filtros" → todos voltam

### Borda — Viewer sem ações
1. Login como viewer → `/dashboard/leads`
2. **Esperado:** sem botão "Novo lead", sem dropdown de status

### Borda — Isolamento de tenant
1. Lead criado por tenant A não aparece para tenant B
2. **SQL:** `SELECT count(*) FROM public.leads WHERE tenant_id != '<tenant_a>';` retornado para tenant A = 0

---

## Plan 02-04 — /dashboard/aprovacoes

### Cenário 7 — Cap de 10 na fila
1. Seed 12 rows `tipo='conteudo'` `status='pendente'`
2. Abrir `/dashboard/aprovacoes`
3. **Esperado:** badge "10 de 10" (não 12)

### Cenário 8 — Aprovar lote
1. Clicar "Aprovar lote"
2. **Esperado:** mensagem verde inline
3. **SQL:** `SELECT status, count(*) FROM public.aprovacoes WHERE tipo='conteudo' GROUP BY status;`
4. **Esperado:** `aprovado | 10`, `pendente | 2`

### Cenário 9 — Rejeitar lote
1. Seed 3 rows novas `pendente`
2. Clicar "Rejeitar lote"
3. **SQL:** confirmar `rejeitado | 3`

### Borda — Viewer sem botões de lote
1. Login viewer → `/dashboard/aprovacoes`
2. **Esperado:** sem "Aprovar lote" / "Rejeitar lote"

### Borda — Lote não toca tipo='campanha'
1. Seed rows `tipo='campanha'` `status='pendente'`
2. Executar "Aprovar lote"
3. **SQL:** `SELECT status FROM public.aprovacoes WHERE tipo='campanha';`
4. **Esperado:** ainda `pendente` — gate APROV-02 isolado

---

## Smoke final

```sql
-- Ambas tabelas existem com RLS ativo
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('leads','aprovacoes');
-- Esperado: relrowsecurity = true para ambas

-- GRANTs corretos
SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='leads';
-- Esperado: authenticated com SELECT/INSERT/UPDATE/DELETE
```
