# QA — webhook-zernio-registro

**Sprint:** webhook-zernio-registro
**SHA:** de48ba8
**Data:** 2026-05-28
**Status:** Pendente de validação manual (push + Vercel env ainda pendentes)

---

## Pré-requisitos

- Push feito (`git push`) e deploy Vercel concluído
- `ZERNIO_WEBHOOK_SECRET` configurado no Vercel (Settings → Environment Variables)
- `zernio_account_id` preenchido em `tenant_config` para Fitness UNIC

---

## Cenários

### C1 — Webhook sem assinatura retorna 401

**Setup:**
- Deploy ativo em `marketing-saas-nu.vercel.app`

**Passos:**
1. Executar no terminal:
   ```bash
   curl -s -X POST https://marketing-saas-nu.vercel.app/api/webhooks/zernio \
     -H "Content-Type: application/json" \
     -d '{"event":"post.published","post":{"id":"test-id"}}' \
     -w "\nHTTP %{http_code}"
   ```

**Esperado:**
- Resposta `{"error":"invalid_signature"}` com HTTP 401
- Confirma que o receptor está ativo e validando HMAC

---

### C2 — Evento post.published atualiza status do conteúdo

**Setup:**
- Conteúdo com `status = 'agendado'` e `zernio_post_id` preenchido existente no banco

**Passos:**
1. Anotar o `zernio_post_id` de um conteúdo agendado (via SQL Editor):
   ```sql
   SELECT id, zernio_post_id, status FROM conteudos
   WHERE tenant_id = '2ab4c5b4-8555-4d4e-a406-b92d1b5b298f'
     AND zernio_post_id IS NOT NULL LIMIT 1;
   ```
2. No painel Zernio, disparar um webhook de teste para `post.published` com o `post.id` desse registro (ou aguardar publicação real)
3. Verificar no banco:
   ```sql
   SELECT status, publicado_em FROM conteudos WHERE zernio_post_id = '<id_anotado>';
   ```

**Esperado:**
- `status = 'publicado'`
- `publicado_em` preenchido com a data de publicação

---

### C3 — Evento post.failed atualiza status e grava reason em audit_log

**Setup:**
- Conteúdo com `zernio_post_id` existente no banco

**Passos:**
1. No painel Zernio, disparar webhook de teste `post.failed` (ou simular falha real)
2. Verificar no banco:
   ```sql
   SELECT status FROM conteudos WHERE zernio_post_id = '<id>';
   SELECT metadata FROM audit_log
   WHERE acao = 'post_falhou_publicacao'
     AND referencia_id = '<conteudo_id>'
   ORDER BY criado_em DESC LIMIT 1;
   ```

**Esperado:**
- `status = 'falhou_publicacao'`
- `audit_log.metadata` contém `zernio_post_id` e `reason` (concatenação dos erros por plataforma, ou null se sem erro)

---

### C4 — postId desconhecido absorvido silenciosamente (200)

**Setup:**
- `zernio_post_id` inexistente no banco

**Passos:**
1. Disparar callback com HMAC válido e `post.id = 'id-que-nao-existe'`

**Esperado:**
- HTTP 200 com body `{"ok":"unknown_post"}`
- Nenhum erro nos logs Vercel

---

## Casos de borda a testar

- Conteúdo com `zernio_post_id = null` — não deve ser encontrado (UNIQUE constraint)
- Webhook com `post.platforms = []` (array vazio) — `reason` deve ser `undefined`, não string vazia
- Segundo callback `post.published` para o mesmo post (retentativa Zernio) — deve sobrescrever `status` sem erro
- Tenant diferente do Fitness UNIC — RLS via admin client (service role) deve permitir update normalmente

## Fora do escopo (não testar)

- Notificação Evolution em caso de falha (depende de `owner_whatsapp` em `brand_manual` — não configurado)
- Evento `post.partial` (não subscrito — absorvido como unknown_event)

---

## Validação de produção

- [ ] `curl` sem assinatura retorna 401 (C1 smoke)
- [ ] `ZERNIO_WEBHOOK_SECRET` configurado no Vercel
- [ ] `zernio_account_id` preenchido em `tenant_config`
- [ ] Webhook ID `6a189ee88fd02c0071c7d8a5` ativo no painel Zernio
- [ ] SHA em produção confere: `git log -1 --format=%h` deve incluir de48ba8 (ou posterior)
- [ ] Sem erros `[webhook/zernio]` nos logs Vercel nas últimas 24h após deploy
