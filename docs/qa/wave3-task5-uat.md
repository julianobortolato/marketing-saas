# QA — wave3-task5-uat

**Sprint:** wave3-task5-uat
**SHA:** 32192b1
**Data:** 2026-05-21
**Status:** Pendente de validação em produção (cutover Stage 1)

---

## Pré-requisitos

- Login como owner (julianobortolato@fitnessacademia.com.br)
- Conversa existente em `/dashboard/conversas` com pelo menos 1 mensagem
- `evolution_instances` row com `ativo=true` para o tenant (para campo manual)
- Servidor dev ou Vercel preview rodando

---

## Cenários

### C1 — Assumir conversa atualiza botão imediatamente

**Setup:**
- Conversa com `ia_ativa=true` aberta

**Passos:**
1. Abrir `/dashboard/conversas/<conversa_id>`
2. Verificar botão "Assumir conversa" (âmbar) visível
3. Clicar "Assumir conversa"
4. Aguardar sem recarregar a página

**Esperado:**
- Botão muda para "Reativar IA" imediatamente após o clique (sem reload)
- Subtitle do header muda para "Handoff — atendimento humano"

**Query de validação:**
```sql
SELECT ia_ativa, motivo_handoff FROM conversas WHERE id = '<conversa_id>';
-- Esperado: ia_ativa=false, motivo_handoff='pedido_explicito'
```

---

### C2 — Reativar IA atualiza botão imediatamente

**Setup:**
- Conversa com `ia_ativa=false` aberta

**Passos:**
1. Abrir `/dashboard/conversas/<conversa_id>` com conversa em handoff
2. Verificar botão "Reativar IA" (branco/outline) visível
3. Clicar "Reativar IA"
4. Aguardar sem recarregar a página

**Esperado:**
- Botão muda para "Assumir conversa" imediatamente
- Subtitle do header muda para "IA Ativa"
- Campo de resposta manual desaparece da tela

**Query de validação:**
```sql
SELECT ia_ativa, motivo_handoff FROM conversas WHERE id = '<conversa_id>';
-- Esperado: ia_ativa=true, motivo_handoff=null
```

---

### C3 — Campo de resposta manual só aparece em handoff

**Setup:**
- Duas conversas: uma com `ia_ativa=true`, outra com `ia_ativa=false`

**Passos:**
1. Abrir conversa com `ia_ativa=true`
2. Verificar rodapé da página
3. Abrir conversa com `ia_ativa=false`
4. Verificar rodapé da página

**Esperado:**
- `ia_ativa=true`: sem textarea no rodapé
- `ia_ativa=false`: textarea "Responder como atendente..." + botão "Enviar" visíveis

---

### C4 — Envio manual persiste no histórico

**Setup:**
- Conversa com `ia_ativa=false` e `evolution_instances` row configurado

**Passos:**
1. Abrir conversa em handoff
2. Digitar mensagem no textarea
3. Pressionar Enter (ou clicar Enviar)
4. Observar o histórico

**Esperado:**
- Mensagem aparece no histórico com direção "saída" (alinhada à direita)
- Badge "Enviada" ou "Falhou" aparece abaixo da mensagem
- Textarea limpa após envio
- Em dev sem Evolution API real: badge "Falhou" é esperado

**Query de validação:**
```sql
SELECT conteudo, direcao, status_envio, enviada_em
FROM chat_messages
WHERE conversa_id = '<conversa_id>'
ORDER BY enviada_em DESC LIMIT 3;
-- Esperado: row com direcao='saida' e conteudo igual ao digitado
```

---

### C5 — saveEditorialConfig salva sem erro

**Setup:**
- Academia com `academia_config` row existente (pós-onboarding Phase 1)

**Passos:**
1. Acessar `/dashboard/configuracoes/editorial`
2. Preencher campo "Tom de voz" com texto qualquer
3. Clicar Salvar
4. Recarregar a página

**Esperado:**
- Toast de sucesso após salvar
- Valor persiste após reload
- Sem erro "null value in column nome_academia"

---

## Casos de borda a testar

- Viewer tentando enviar mensagem manual → deve receber erro "Acesso negado"
- Conversa inexistente na URL → redirect para `/dashboard/conversas`
- UUID inválido na URL → redirect para `/dashboard/conversas`
- Envio com textarea vazio → botão deve ser inativo ou ignorar
- Tenant sem `evolution_instances` row → erro "Instância Evolution não configurada"

## Fora do escopo

- Testes de tráfego real WhatsApp (aguardam cutover Stage 1)
- Taxa de entrega Evolution API em produção
- Performance com muitas mensagens no histórico

---

## Validação de produção

- [ ] `GET /api/admin/saude-mkt` retorna 200 com campos corretos
- [ ] `npm test` (unit) passa 56/56
- [ ] SHA em produção confere: `git log -1 --format=%h` = `32192b1`
- [ ] Sem erros no Vercel logs relacionados a `enviarMensagemManual`
