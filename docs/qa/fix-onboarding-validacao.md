# QA — fix-onboarding-validacao

**Sprint:** fix-onboarding-validacao
**SHA:** 283c0e7
**Data:** 2026-05-29
**Status:** Pendente de validação manual

---

## Pré-requisitos

- Login como owner do tenant Fitness UNIC em `marketing-saas-nu.vercel.app`
- Navegar para `/onboarding/1` (ou testar cada passo diretamente pela URL)
- Para testes de step4: brand_manual do tenant pode estar com `frequencia: ''` ou sem dados (testar com banco limpo e com dados existentes)

---

## Cenários

### C1 — Step4: submit vazio mostra erros em todos os campos obrigatórios

**Setup:**
- Step4 carregado com brand_manual sem dados (tenant novo ou limpo)

**Passos:**
1. Acessar `/onboarding/4`
2. Não preencher nenhum campo
3. Clicar em "Analisar com IA →"

**Esperado:**
- Erro "Descreva seu público (mín. 10 caracteres)" aparece abaixo do campo Público-alvo
- Erro "Descreva o diferencial (mín. 10 caracteres)" aparece abaixo do campo Diferencial
- Erro "Selecione ao menos 1 tema" aparece abaixo dos botões de tema
- Formulário NÃO avança para o passo 5

---

### C2 — Step4: digitar em público-alvo limpa o erro em tempo real

**Setup:**
- Reproduzir o estado de erro: submit vazio conforme C1

**Passos:**
1. Após erros aparecerem (C1), clicar no campo "Público-alvo"
2. Digitar 10 caracteres ou mais (ex: "Mulheres ativas 25-40")
3. Observar se o erro some SEM precisar clicar em submit novamente

**Esperado:**
- Erro "Descreva seu público..." some enquanto o usuário digita (ao atingir 10 chars)
- Campo não precisa de novo submit para limpar o erro

---

### C3 — Step4: mesmo comportamento para "Diferencial da empresa"

**Setup:**
- Estado de erro do C1 ainda visível

**Passos:**
1. Clicar no campo "Diferencial da empresa"
2. Digitar 10+ caracteres (ex: "Studio exclusivo de pilates")
3. Observar se erro some em tempo real

**Esperado:**
- Erro "Descreva o diferencial..." some ao digitar (ao atingir 10 chars)

---

### C4 — Step1: campo "Seu nome" valida e limpa erro corretamente

**Setup:**
- Acessar `/onboarding/1` com tenant novo

**Passos:**
1. Não preencher o campo "Seu nome"
2. Preencher todos os outros campos corretamente
3. Clicar em "Continuar →"
4. Observar mensagem de erro
5. Digitar nome (mín. 2 chars) no campo "Seu nome"
6. Clicar em "Continuar →" novamente

**Esperado:**
- Erro "Nome obrigatório" aparece abaixo do campo "Seu nome" após primeiro submit
- Após preencher e submeter novamente, formulário avança para o passo 2

---

## Casos de borda a testar

- `frequencia` com valor inválido no banco (ex: definir manualmente `UPDATE tenant_config SET brand_manual = jsonb_set(brand_manual, '{tom_de_voz,frequencia}', '"mensal"')`) → step4 deve carregar com frequência `'3x_semana'` (fallback da whitelist), não com valor inválido selecionado
- Campo `publico_descricao` com exatamente 9 chars: erro deve permanecer. Com 10 chars: erro deve sumir
- Adicionar e remover tags de "palavras preferidas": não deve afetar estado de erro de outros campos

## Fora do escopo (não testar)

- Upload de logo (step3) — testado em sessão anterior (fix-onboarding-logo-step4)
- Fluxo completo de onboarding end-to-end (step1 → step8) — futura sessão de smoke
- Geração de posts no step8 — coberta pelo sprint diagnostico-autonomo

---

## Validação de produção

- [ ] URL pública sem SSO: `https://marketing-saas-nu.vercel.app/onboarding/4`
- [ ] SHA em produção confere: `git log -1 --format=%h` deve retornar `283c0e7`
- [ ] Sem erros no Vercel logs relacionados a `step4` ou `onboarding` nas últimas 24h
- [ ] C2 e C3 passam (regressão principal desta sessão)
