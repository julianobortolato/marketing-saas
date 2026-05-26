# ADR-MKT-003 — Renderização HTML→PNG via Satori

> **Status:** Ativo
> **Versão:** 1.0 — 26/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas` (v2)
> **Localização canônica:** `.adrs/ADR-MKT-003.md`
> **Bloqueia:** Fase 5 (Gerador de Conteúdo) do ROADMAP
> **Substitui:** Puppeteer/Playwright proposto no Escopo v2.1 §10

---

## 1. Contexto

O MKT v2 monta posts visuais (Instagram feed/story/carousel, Facebook, TikTok) compondo **foto real do banco de imagens** + **overlay com copy + CTA + branding do tenant**. A geração é:

1. Foto do banco (URL Supabase Storage)
2. Template HTML/CSS com slots: `{foto}`, `{titulo}`, `{corpo}`, `{cta}`, `{logo}`, `{cor_primaria}`
3. Renderização em PNG nas dimensões da plataforma (1080x1080, 1080x1920, etc.)

A decisão é **com que biblioteca/serviço renderizar HTML→PNG**.

O Escopo v2.1 §10 propôs Puppeteer/Playwright (Chromium headless). Análise dev sênior em 25/mai identificou que Puppeteer **não roda no Edge Runtime** e exigiria runtime Node + plano Vercel Pro (cold start) ou serviço externo (custo + outage).

---

## 2. Decisão

O marketing-saas v2 adota **Vercel Satori** como motor de renderização HTML→PNG.

**O que é Satori:** biblioteca open-source da Vercel que converte JSX/HTML+CSS em SVG diretamente, sem Chromium. Roda em Edge Runtime, Node, browser. Zero dependência externa, zero custo de infra adicional. Conversão SVG→PNG via `@resvg/resvg-js` (binding WASM).

```
JSX/HTML+CSS → satori() → SVG → resvg() → PNG buffer
```

---

## 3. Comparativo

| Critério | **Satori** ✅ | Browserless.io | Cloud Run próprio | Puppeteer/Vercel Pro |
|---|---|---|---|---|
| Custo extra/mês | **$0** | ~$30 (plano starter) | ~$10-50 (uso) | ~$20 (Pro) |
| Runtime | **Edge nativo** | HTTP externo | HTTP externo | Node (cold start) |
| Cold start | **Zero** | Variável | Médio (warm-up) | 1-3s |
| Dependência externa | **Nenhuma** | Browserless infra | GCP | Vercel infra |
| CSS suportado | Subset (flex, text, image, cores, border-radius) | Full Chromium | Full Chromium | Full Chromium |
| Fontes customizadas | Carregadas em runtime | Sim | Sim | Sim |
| Volume cap | Limite Vercel function | Plano-dependente | Sem limite | Limite Vercel function |
| Manutenção | Lib Vercel ativa | Serviço terceiro | Próprio | Lib Google + Vercel |

**Decisão: Satori.** Templates de post fitness/PME (foto + texto + CTA + logo + cor) não exigem CSS avançado — exigem composição confiável, sem cold start, sem custo extra. Satori entrega isso e roda na mesma rota Edge que serve o resto do app.

---

## 4. Limitações conhecidas do Satori (gatilhos de revisita)

Satori suporta subset de CSS. Não suporta nativamente:

- `box-shadow` complexo (suporta básico)
- `filter` (blur, brightness)
- Gradientes radiais complexos
- `animation` / `transition` (irrelevante pra PNG)
- Pseudo-elementos avançados (`::before`/`::after` parcial)
- Algumas fontes com peso customizado fora dos pesos comuns
- `clip-path` arbitrário

**Implicação:** templates de post precisam ser projetados dentro do subset. Designers devem validar com `satori-playground` antes de adicionar template novo.

**Gatilho de revisita (objetivo):**

| Condição | Ação |
|---|---|
| Template essencial requer CSS fora do subset Satori sem workaround | Adicionar Browserless **como fallback opcional** para templates marcados (não substituir Satori) |
| Volume gera erro de timeout em function Vercel (>10s) | Avaliar Cloud Run próprio para batch render |
| Bug recorrente em renderização (>2% de falha) por 7 dias | Avaliar Browserless ou Cloud Run |

**Não é gatilho:**
- "Designer queria gradient mais sofisticado uma vez"
- "Outra ferramenta tem mais opções"

---

## 5. Implementação canônica

**Stack:**
- `satori` (Vercel) — JSX→SVG
- `@resvg/resvg-js` — SVG→PNG (WASM)
- Storage: Supabase Storage bucket `posts-renderizados/<tenant_id>/<post_id>.png`

**Rota:** `/api/posts/render` em Edge Runtime.

**Schema mínimo** (detalhe em ARCHITECTURE.md):

```sql
-- Já existe brand_manual em tenant_config
-- Já existe banco_imagens

CREATE TABLE post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical TEXT NOT NULL,
  formato TEXT NOT NULL,  -- 'feed_1080', 'story_1920', 'carousel_slide'
  jsx_template TEXT NOT NULL,  -- JSX serializado com placeholders
  variaveis_obrigatorias TEXT[] NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Tenant não edita template (gatilho de revisita: se demanda real surgir, criar tabela `tenant_post_templates` com escopo análogo a `prompts_agentes` ADR-MKT-001 §3).

---

## 6. Fontes customizadas (caso de uso comum)

Tenant define `brand_manual.visual.fonte_titulo` e `fonte_corpo`. Satori precisa do arquivo da fonte carregado em runtime.

**Estratégia:**
- 5-10 fontes curadas pré-carregadas no projeto (Inter, Poppins, Montserrat, Playfair, Bebas Neue, etc.)
- Tenant escolhe da lista durante onboarding (passo 3 — análise de logo via Vision sugere fonte similar)
- Fontes adicionais: gatilho de revisita se 3+ tenants pedirem font upload customizado

**Anti-padrão:** carregar fonte via URL externa em runtime (latência + dependência). Fontes do projeto vão no repo em `public/fonts/`.

---

## 7. Anti-padrões proibidos

- Adicionar Puppeteer/Playwright como dependência sem ADR nova
- Chamar serviço externo de renderização em rota crítica sem fallback local
- Tenant subindo template HTML customizado (vetor de XSS + complexidade não-MVP)
- Renderização pesada (>3s) sem timeout + retry policy

---

## 8. Impacto em outros docs

- **PRD v2.4 §7 Bloco 3** — diz "Templates HTML/CSS com slots → renderizados (solução em ADR-MKT-003)" ✅ esta ADR fecha
- **ESCOPO v2.1 §3** — menciona "Puppeteer/Playwright" → sobrescrito por esta ADR
- **ARCHITECTURE.md §Renderização** — vai detalhar implementação
- **ROADMAP.md Fase 5** — desbloqueada por esta ADR

---

## 9. O que NÃO entra nesta ADR

- Design dos templates iniciais (entregável de Fase 5 do ROADMAP)
- Curadoria da lista de fontes pré-carregadas (entregável de Fase 4 — onboarding)
- Pipeline de A/B test de template (não MVP)

---

*Fim do ADR-MKT-003.*
