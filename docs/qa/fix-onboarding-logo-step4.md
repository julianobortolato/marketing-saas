# QA — fix-onboarding-logo-step4

**Sprint:** fix-onboarding-logo-step4  
**SHA:** 9005b42  
**Data:** 2026-05-29  
**Status:** Pendente de validação manual

---

## Pré-requisitos

- Login como usuário com tenant configurado (Fitness UNIC ou novo tenant)
- Onboarding não concluído (para acessar os passos)
- Arquivo de logo disponível localmente (PNG ou JPG, < 5 MB)

## Cenários

### C1 — Upload de logo retorna palette

**Setup:**
- Usuário autenticado em `/onboarding/3`

**Passos:**
1. Clicar no campo de upload de logo
2. Selecionar arquivo PNG ou JPG com cores distintas
3. Aguardar resposta (pode levar 2-5s para Vibrant processar)

**Esperado:**
- Resposta 200 com campo `palette` contendo array de strings hex (ex: `["#e30613","#1a2e4a","#ffffff"]`)
- `display_url` presente no response (signed URL)
- Sem erro 500 nos Vercel logs

**Query de validação:**
```sql
SELECT brand_manual->'visual'->'palette' FROM tenant_config
WHERE tenant_id = '2ab4c5b4-8555-4d4e-a406-b92d1b5b298f';
```

---

### C2 — Tom de voz: seleção persiste e valida

**Setup:**
- Usuário em `/onboarding/4`
- Campos público-alvo e diferencial preenchidos (mín. 10 chars)
- Pelo menos 1 tema selecionado

**Passos:**
1. Clicar no botão "formal"
2. Verificar visual: botão "formal" fica destacado (fundo escuro)
3. Clicar em "Analisar com IA →"

**Esperado:**
- Formulário avança sem mostrar "Required" ou "Invalid enum value" para tom de voz
- Se campo obrigatório faltando: erro aparece no campo correto, não em tom de voz

---

### C3 — Temas: erro some ao clicar

**Setup:**
- Usuário em `/onboarding/4`
- Nenhum tema selecionado

**Passos:**
1. Clicar em "Analisar com IA →" sem selecionar nenhum tema
2. Observar mensagem "Selecione ao menos 1 tema" aparecer
3. Clicar em qualquer tema (ex: "treino")

**Esperado:**
- Mensagem "Selecione ao menos 1 tema" desaparece imediatamente após o clique (sem precisar clicar em "avançar" novamente)
- Botão do tema fica destacado (fundo escuro)

---

### C4 — Upload de logo com formatos alternativos

**Setup:**
- Usuário em `/onboarding/3`

**Passos:**
1. Tentar upload de arquivo `.webp`
2. Tentar upload de arquivo `.gif`

**Esperado:**
- Ambos aceitos (content-type `image/webp` e `image/gif` estão em `allowedTypes`)
- Sem erro 500; palette pode ser menor ou vazia se Vibrant não suportar o formato

---

## Casos de borda a testar

- **Logo com arquivo > 5 MB:** deve retornar 400 `"arquivo muito grande (máx 5 MB)"`, não 500
- **Logo sem extensão ou extensão inválida (.pdf, .svg):** deve retornar 400 `"tipo inválido"`
- **Tom de voz com valor de sessão anterior inválido no banco (string vazia):** deve defaultar para "neutro" destacado ao abrir o formulário, sem erro de validação ao carregar
- **/tmp cheio no Vercel:** Vibrant falha silenciosamente (try/finally), `paletteHex` retorna `[]`, Vision é pulada — response ainda é 200 com `palette: []`

## Fora do escopo (não testar)

- Vision Analysis (`analyzeLogoVision`) — integração GPT-4o Vision, testada separadamente
- Passo 5 (banco de imagens) — não alterado nesta sessão
- Frequência de posts — campo não alterado (apenas refatorado)

---

## Validação de produção

- [ ] POST `/api/onboarding/logo` com logo real retorna 200 + `palette` não vazio
- [ ] Formulário step4 avança sem erro de validação ao selecionar tom + público + diferencial + 1 tema
- [ ] SHA em produção confere: `git log -1 --format=%h` → `9005b42`
- [ ] Sem erros 500 no Vercel logs relacionados a `onboarding/logo` ou `step4`
