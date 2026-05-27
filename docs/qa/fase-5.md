# QA Checklist — Fase 5 (Render + Pipeline + Aprovações)
> Sprint: Fase 5.1→5.4 | SHA: 1125fbe | Data: 2026-05-27

---

## Fase 5.1 — Rota de renderização

### Cenário 1 — Render modo html (legado)
1. POST `/api/posts/render` com `{"modo":"html","html":"Teste"}`
2. Esperado: HTTP 200 + body com magic bytes `89504e470d0a1a0a` (PNG válido)
3. Verificar header `X-Render-Duration-Ms` presente

### Cenário 2 — Payload inválido
1. POST `/api/posts/render` com `{}` (sem modo)
2. Esperado: HTTP 400 com JSON contendo `detalhe` (erros Zod)

### Cenário 3 — Latência
1. 5 chamadas warm consecutivas ao modo html
2. Esperado: média < 500ms após cold start inicial

### Borda
- `html` vazio (`""`) → 400
- `largura` = 0 → 400
- `fontes` com nome inexistente → fallback aplicado, não crash

---

## Fase 5.2 — Templates JSX

### Cenário 4 — Template feed
1. POST `/api/posts/render` modo `template`, formato `feed`, slots completos com `foto_url` válida
2. Esperado: HTTP 200 + PNG 1080×1080

### Cenário 5 — Template story
1. Mesmo, formato `story`
2. Esperado: HTTP 200 + PNG 1080×1920

### Cenário 6 — Template carousel
1. Mesmo, formato `carousel_slide`
2. Esperado: HTTP 200 + PNG 1080×1080

### Cenário 7 — Slots obrigatórios ausentes
1. POST modo `template` sem `copy_principal`
2. Esperado: HTTP 400 com detalhe Zod

### Cenário 8 — cor_primaria do tenant aplicada
1. POST com `cor_primaria: "#FF0000"`
2. Esperado: PNG com CTA em vermelho (verificar visualmente)

### Borda
- `foto_url` inacessível (URL 404) → render não crasha (placeholder ou área vazia)
- `copy_principal` com 120 chars exatos → aceita
- `copy_principal` com 121 chars → rejeita com 400

---

## Fase 5.3 — Pipeline cron

### Cenário 9 — Auth
1. POST `/api/cron/gerar-posts` sem header Authorization
2. Esperado: HTTP 401 `{"erro":"nao_autorizado"}`

### Cenário 10 — Auth errada
1. POST com `Authorization: Bearer valor_errado`
2. Esperado: HTTP 401

### Cenário 11 — Pipeline completo
1. POST com `Authorization: Bearer <CRON_SECRET>` correto
2. Esperado: HTTP 200 com JSON `{processados: N, ok: N, erros: 0}`
3. Verificar no Supabase: `SELECT * FROM conteudos WHERE status='pendente_aprovacao'` retorna ≥1 row
4. Verificar: `imagem_composta_url` da row aponta para PNG acessível via browser

### Cenário 12 — Tenant pausado
1. Setar `ia_pausado=true` para tenant de teste no Supabase
2. Rodar pipeline
3. Esperado: tenant não aparece em `processados` ou aparece com status `ok: 0`

### Borda
- `banco_imagens` vazio para tenant → pipeline não crasha, `foto_id` = null, usa placeholder
- `brand_manual` ausente para tenant → pipeline lança erro tratado, registra em `erros`, continua para próximo tenant
- GPT-4o retorna JSON malformado → erro tratado, não 500

---

## Fase 5.4 — Dashboard aprovações

### Cenário 13 — Fila visual
1. Acessar `/dashboard/aprovacoes` com tenant que tem conteúdos `pendente_aprovacao`
2. Esperado: grid de PostCard com preview PNG, copy, hashtags visíveis

### Cenário 14 — Aprovar individual
1. Clicar "Aprovar" em 1 PostCard
2. Esperado: feedback "Aprovado." na UI
3. Verificar Supabase: `aprovacoes.status = 'aprovado'` e `conteudos.status = 'aprovado'`

### Cenário 15 — Rejeitar individual
1. Clicar "Rejeitar" em 1 PostCard
2. Esperado: feedback "Rejeitado." na UI
3. Verificar Supabase: ambas tabelas com `status = 'rejeitado'`

### Cenário 16 — Editar copy
1. Clicar no texto do copy → textarea abre
2. Editar texto e clicar "Salvar"
3. Esperado: feedback "Copy salva.", textarea fecha, novo texto visível
4. Verificar Supabase: `conteudos.copy` atualizado

### Cenário 17 — Copy > 120 chars
1. Digitar 121 chars no textarea e salvar
2. Esperado: erro "Copy excede 120 caracteres"

### Cenário 18 — BatchApproval mantido
1. Clicar "Aprovar lote"
2. Esperado: todos os posts pendentes aprovados de uma vez

### Cenário 19 — Role viewer
1. Acessar com usuário de role `viewer`
2. Esperado: posts visíveis, botões de aprovar/rejeitar/editar ausentes

### Borda
- Fila vazia → card "Nenhum post aguardando aprovação"
- `imagem_composta_url` null → PostCard renderiza sem imagem, não crasha
- `conteudo` null (aprovacao sem referencia_id) → PostCard renderiza sem crash
