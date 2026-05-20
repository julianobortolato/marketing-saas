# ADR-MKT-000 — Fronteira engine vs tenant no marketing-saas

> **Status:** Ativo
> **Versão:** 1.0 — 20/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas`
> **Localização canônica:** `.adrs/ADR-MKT-000.md`
> **Princípio base:** `docs/principles/ENGINE_VS_TENANT.md`

---

## 1. Contexto

O `marketing-saas` é um greenfield iniciado em mai/2026, sem débito histórico de código. O primeiro tenant em produção é a Fitness UNIC (academia do fundador), que também forneceu referência de identidade visual durante a fase de prototipação.

Esse fato criou um risco específico de greenfield: **o primeiro cliente virar a identidade do produto**. O `CLAUDE.md` v1.1 prescreveu os tokens visuais da UNIC (`#E30613`, fontes, regra 60-30-10) como design system do SaaS — replicando exatamente o padrão que gerou débitos críticos no IARA V2.

Esta ADR formaliza a aplicação do princípio ENGINE_VS_TENANT ao MKT, lista as exceções aceitas conscientemente e registra a violação ativa que precisa ser corrigida antes do segundo tenant.

---

## 2. Decisão

O `marketing-saas` segue o princípio ENGINE_VS_TENANT na íntegra: nenhum código, prompt ou configuração de repositório conhece nenhum tenant específico.

**Modelo de produto adotado: B parcial**

- Dashboard interno tem marca do SaaS (engine controla visual)
- Toda saída que o lead vê (WhatsApp, conteúdo gerado, posts, anúncios) reflete a identidade do tenant, lida de `academia_config`

---

## 3. Exceções aceitas

### 3.1 Léxico fitness genérico em enum de parâmetro de tool

**O quê:** `modalidade: z.enum(['musculacao','funcional','pilates','yoga','spinning'])` em `lib/agents/tools/marketing-cmo.ts`

**Por quê aceito:** MKT é produto vertical fitness. Qualquer academia fitness usa esse léxico. Não é léxico de um tenant — é contrato do vertical.

**Por quê não é drift:** serve qualquer tenant do vertical, não um tenant específico. Academia Vértice usaria o mesmo enum sem modificação.

**Gatilho de remoção (objetivo):** primeiro prospect não-fitness (dentista, salão, estúdio de dança, etc.) chega ao pipeline de vendas → reabrir esta ADR → migrar para `vertical_modalidades` tabela com `vertical_id` em `tenants` → enum vira query.

**Critério de aceite no código:** todo enum de vertical em `lib/` deve ter comentário `// vertical fitness — ver ADR-MKT-000 §3.1` imediatamente acima.

---

### 3.2 Tom CMO base no Bloco 1 do system prompt

**O quê:** Tom consultivo padrão ("você consulta, entende e propõe, não vende") no `[BLOCO 1 — Persona CMO]` do system prompt.

**Por quê aceito:** É posicionamento do produto, não identidade de tenant. Todo tenant que contratar o CMO IA está comprando esse tom base.

**Por quê não é drift:** Overridável por `academia_config.persona_cmo` — tenant que quiser tom diferente sobrescreve. O padrão não aprisiona.

**Gatilho de remoção:** nenhum — tom base é produto. Se tenant precisar de tom radicalmente diferente, ele configura `persona_cmo`.

---

### 3.3 Fallbacks neutros de UI sem tema configurado

**O quê:** Cores neutras (`#000000`, `#FFFFFF`, cinzas) como fallback quando `academia_config.tema` for null.

**Por quê aceito:** Toda UI precisa de fallback. Neutro não prescreve identidade de ninguém.

**Critério:** fallback nunca pode ser cor de tenant real. `#E30613` como fallback viola esta exceção.

---

## 4. Violação ativa — CLAUDE.md v1.1

**Arquivo:** `CLAUDE.md` — seção "Identidade visual"

**O que diz hoje:**
```
O SaaS usa a identidade visual da Fitness UNIC — não há marca separada
--color-primary: #E30613   (CTA, botões, bordas de destaque)
Regra 60-30-10: 60% branco/cinza-gelo · 30% cinza médio · 10% vermelho #E30613
```

**Por que é violação:**
- Prescreve tokens visuais de um tenant como design system do engine
- Instrui o agente Code a tratar UNIC como identidade do produto
- Quebra o gate de contraste do ADR-MKT-001 §11: se o produto "é" UNIC, tenant Vértice com paleta azul-marinho viola o produto por definição

**Classificação:** violação ativa — não é débito técnico, é prescrição incorreta em documento canônico. Risco: toda PR executada pelo Code enquanto esse texto existir pode propagar a violação.

**Correção obrigatória (Etapa 2 — antes de qualquer sprint de código):**

Substituir a seção "Identidade visual" do `CLAUDE.md` por:

```markdown
## Identidade visual

**Modelo:** B parcial — dashboard com marca do SaaS, saída externa (WhatsApp, conteúdo)
com identidade do tenant.

**Dashboard (engine):** design system neutro — tokens em `tailwind.config` sem cor de tenant.
Paleta base: branco, cinzas, 1 cor de acento do SaaS (a definir quando SaaS tiver marca própria).

**Saída externa (tenant content):** lida de `academia_config.tema` em runtime.
Estrutura esperada:
{
  "primary": "#E30613",      ← exemplo UNIC — cada tenant configura o seu
  "secondary": "#0F172A",
  "font": "Inter",
  "logo_url": "https://..."
}

**Seed da UNIC:** inserir como registro em `academia_config.tema` no script de seed,
não como constante em código.

**Princípio:** ENGINE_VS_TENANT.md — ver docs/principles/
**ADR local:** ADR-MKT-000 §3
```

**Quem executa:** chat Code, Etapa 2, depois que ADR-MKT-000 e ENGINE_VS_TENANT.md forem commitados.

---

## 5. Gate de contraste — referência ao ADR-MKT-001 §11

O ADR-MKT-001 §11 define o teste padrão de aderência a este princípio:

> Criar tenant fictício "Academia Premium Vértice" em staging — tom formal (sem "bora!", sem emoji em mensagem pós-aceite), paleta azul-marinho/branco (não vermelho), regra editorial específica (tratamento "senhor/senhora"). Rodar 10 conversas de teste. UMA mensagem que soe UNIC = blocker.

**Posição no workflow de revisão:**

| Quando rodar | Onde | Quem |
|---|---|---|
| Toda PR que toca `lib/agents/` | CI (GitHub Actions) | Robô — automático |
| Antes de toda release pra produção | Staging | Code executa, owner valida resultado |
| Antes de onboarding do segundo tenant real | Staging com dados do segundo tenant | Owner valida manualmente |

**Critério de falha:** qualquer mensagem gerada pelo agente no contexto do tenant Vértice que contenha vocabulário, tom ou referência visual identificável como UNIC = PR bloqueada.

---

## 6. Acceptance criteria para sprints futuros

Toda PR de sprint do `marketing-saas` passa nestes critérios antes de merge:

```
□ Nenhum token visual de tenant em lib/, components/ ou tailwind.config
□ Nenhum nome próprio de academia em string literal de código ou prompt
□ Nenhum arquivo com nome de tenant no repositório
□ Enum de vertical tem comentário apontando pra ADR-MKT-000 §3.1
□ Gate de contraste (tenant Vértice) passou no CI
□ CLAUDE.md não foi editado para re-introduzir tokens UNIC como default
```

---

## 7. Gatilhos de revisita

| Condição | Ação |
|---|---|
| Primeiro prospect não-fitness no pipeline | Reabrir §3.1 — migrar enum para `vertical_modalidades` |
| Segundo tenant real onboarding | Validar gate de contraste manualmente antes do onboarding |
| SaaS ganhar marca própria (nome + identidade) | Atualizar §3.3 — fallback pode ganhar cor da marca do SaaS |
| Produto evoluir para white-label total (modelo B puro) | Estender ENGINE_VS_TENANT §5 para tokens de dashboard |
| Novo anti-padrão de identidade detectado em PR | Adicionar em ENGINE_VS_TENANT §7 + atualizar esta ADR |
