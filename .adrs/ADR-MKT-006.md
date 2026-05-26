# ADR-MKT-006 — Prisma Design System v1

> **Status:** Ativo
> **Versão:** 1.0 — 26/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas` (v2)
> **Localização canônica:** `.adrs/ADR-MKT-006.md`
> **Princípios base:** `ENGINE_VS_TENANT.md` §Camada 1
> **Decisão pendente que esta ADR fecha:** identidade visual do produto separada da identidade dos tenants

---

## 1. Contexto

O marketing-saas v2 é um SaaS multi-tenant que renderiza dois universos visuais distintos no mesmo app:

1. **A interface do produto** (dashboard, login, configurações, aprovações, onboarding) — vista pelo `tenant_admin` enquanto opera o SaaS
2. **Conteúdo do tenant** (preview de posts, wizard de manual de marca, paleta carregada do `brand_manual`, logo do tenant no overlay) — renderizado dentro do produto mas usando identidade visual do cliente

Sem distinção formal, o risco é:
- Default Tailwind no dashboard (parece protótipo, mata percepção de produto)
- Cor da Fitness UNIC vazar pra header do dashboard (violação ENGINE_VS_TENANT Camada 1, ADR-V2-000 §3.1 documenta esse exato erro no V2)
- White-label futuro fica inviável (`--brand-*` ambíguo: do produto ou do tenant?)

Esta ADR fecha a decisão **agora**, antes de uma linha de UI do dashboard ser commitada com hex hardcoded ou token ambíguo.

---

## 2. Decisão

O marketing-saas v2 adota:

1. **Nome comercial do produto:** **Prisma**
2. **Logo canônico:** `public/Prisma_Azul_Midnight.png`
3. **Dois namespaces de tokens CSS** mutuamente excludentes:
   - `--prisma-*` → identidade do **SaaS Prisma** (engine). Hardcoded em CSS, vive em `app/globals.css`
   - `--tenant-*` → identidade do **tenant** (cliente). Injetado em **runtime** via JS a partir de `tenant_config.brand_manual`
4. **Paleta canônica do Prisma** (seção 3)
5. **Tipografia canônica do Prisma** (seção 4)
6. **Regras de componente** com enforcement (seção 5)

---

## 3. Paleta canônica

### 3.1 Tokens Prisma (engine — `app/globals.css`)

```css
:root {
  /* Identidade Prisma */
  --prisma-midnight: #1A2E4A;  /* headers, sidebar, botões primários */
  --prisma-ivory:    #F0EEE8;  /* fundo geral de páginas */
  --prisma-purple:   #7B61C4;  /* accent — badges, links ativos */

  /* Semântico */
  --prisma-success:  #22C55E;  /* feedback positivo, status publicado */
  --prisma-danger:   #EF4444;  /* erro, alerta crítico, status falhou */
  --prisma-warning:  #F59E0B;  /* atenção, status pendente */

  /* Texto */
  --text-main:       #1A2E4A;  /* texto padrão */
  --text-muted:      #64748B;  /* texto secundário, placeholders, helper */
}
```

**Nota:** `--text-main` e `--prisma-midnight` compartilham o mesmo valor hoje. Mantidos como tokens separados por **intenção semântica** — `--text-main` documenta "cor padrão de texto em fundo claro"; `--prisma-midnight` documenta "cor da marca Prisma". Divergem se um dia o texto exigir contraste diferente em fundo ivory.

### 3.2 Tokens de tenant (runtime — injetados via JS)

```css
:root {
  /* Carregados de tenant_config.brand_manual.visual.* */
  --tenant-primary:   <runtime>;  /* brand_manual.visual.cor_primaria */
  --tenant-secondary: <runtime>;  /* brand_manual.visual.cor_secundaria */
}
```

**Implementação canônica** (detalhe em ARCHITECTURE.md §Frontend):

```typescript
// app/layout.tsx ou provider equivalente
const brand = tenantConfig.brand_manual.visual;
return (
  <html style={{
    '--tenant-primary': brand.cor_primaria,
    '--tenant-secondary': brand.cor_secundaria,
  } as React.CSSProperties}>
    {children}
  </html>
);
```

### 3.3 Logo

| Asset | Localização | Uso |
|---|---|---|
| `public/Prisma_Azul_Midnight.png` | repo | Header do dashboard, login, emails transacionais, OG image |
| `tenant_config.brand_manual.identidade.logo_url` | Supabase Storage | Preview de post, wizard de marca, watermark em conteúdo gerado |

**Logo do Prisma em conteúdo de tenant: proibido.** Logo do tenant em chrome do dashboard: proibido (exceto preview de manual de marca).

---

## 4. Tipografia canônica

### 4.1 Fontes do Prisma

| Família | Peso | Uso |
|---|---|---|
| **Plus Jakarta Sans** | 700 | Display, headers de seção, KPIs grandes |
| **Inter** | 400 (regular), 500 (medium), 600 (semibold) | UI, corpo, labels, botões |

**Carregamento via `next/font`:**

```typescript
// app/layout.tsx
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-display',
});

const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});
```

**Não usar:**
- `@import` direto via CSS (perde optimization do Next.js)
- CDN externo (latência + LCP penalizado)
- Fontes adicionais sem ADR (cada fonte custa 30-80KB no LCP)

### 4.2 Fontes do tenant

`brand_manual.visual.fonte_titulo` e `fonte_corpo` são escolhidas pelo tenant durante onboarding (passo 3 — análise de logo via Vision sugere fonte similar). Lista curada de 5-10 fontes pré-carregadas em `public/fonts/` (detalhe em ADR-MKT-003 §6).

**Plus Jakarta Sans e Inter entram nessa lista**, mas para uso em renderização Satori (posts do tenant) — independente do uso no chrome do Prisma. Tenant pode escolher tipografia do Prisma para sua própria marca, mas isso é coincidência operacional, não regra.

---

## 5. Regras de componente

### 5.1 Permitido ✅

```tsx
// Componente do dashboard usando identidade Prisma
<header className="bg-[var(--prisma-midnight)] text-[var(--prisma-ivory)]">

// Componente que renderiza preview de conteúdo do tenant
<PostPreview style={{ background: 'var(--tenant-primary)' }}>

// Status semântico (independente de tenant)
<StatusBadge className="bg-[var(--prisma-success)]">Publicado</StatusBadge>
```

### 5.2 Proibido ❌

```tsx
// Hex hardcoded — PR rejeitada
<header className="bg-[#1A2E4A]">
//                    ^^^^^^^ violação: hex fora de CSS var

// Namespace --brand-* — descontinuado
<div className="bg-[var(--brand-primary)]">
//                  ^^^^^^^^^^^^^^^^^^^^^ violação: ambíguo entre Prisma e tenant

// --tenant-* em componente genérico do dashboard
function DashboardHeader() {
  return <div className="bg-[var(--tenant-primary)]">...</div>;
  //                       ^^^^^^^^^^^^^^^^^^^^^^^^ violação ENGINE_VS_TENANT Camada 1
}
```

### 5.3 Onde `--tenant-*` é permitido

Apenas em componentes que **renderizam conteúdo do tenant**:

- `components/marca/wizard-passo-3-cores.tsx` (preview da paleta escolhida)
- `components/posts/preview.tsx` (preview do post final)
- `components/marca/manual-overview.tsx` (visualização do brand_manual)
- Rotas de renderização Satori (`/api/posts/render`)

**Heurística para code review:**
- O componente seria diferente entre dois tenants distintos? → pode usar `--tenant-*`
- O componente é igual para qualquer tenant logado? → só `--prisma-*`

### 5.4 Anti-padrões com enforcement (CLAUDE.md)

| Anti-padrão | Detecção | Ação |
|---|---|---|
| Hex hardcoded em código compartilhado | `grep -rE 'bg-\[#[0-9a-fA-F]{3,8}\]' app/ components/` | PR rejeitada |
| `--brand-*` em qualquer caminho | `grep -rE '\-\-brand\-' app/ components/` | PR rejeitada (namespace descontinuado) |
| `--tenant-*` em componente sem contexto de tenant | Code review manual + auditoria periódica | PR revisada caso a caso |
| Fonte externa via `@import` | `grep -rE "@import.*fonts" app/` | PR rejeitada |

---

## 6. Aplicação no chrome do Prisma

Pontos do produto que carregam identidade Prisma (não tenant):

| Superfície | Tokens / Assets |
|---|---|
| Página de login (`/login`) | `--prisma-ivory` bg, logo Prisma |
| Página de signup (`/signup`) | idem login |
| Dashboard shell (sidebar, header, footer) | `--prisma-midnight` header, `--prisma-ivory` bg |
| Página de erro 404 / 500 | Identidade Prisma + tom de voz do produto |
| Favicon | derivado do logo Prisma |
| OG image (compartilhamento) | template fixo com logo Prisma + tagline |
| Emails transacionais (welcome, recover password, invite) | Plus Jakarta Sans header + Inter body, paleta Prisma |
| Loading states / splash | logo Prisma + spinner em `--prisma-purple` |

**Assinatura de email do bot CMO:** *NÃO carrega identidade Prisma* — o bot fala como representante do tenant, não do Prisma. Esta é a regra dura de ENGINE_VS_TENANT aplicada ao canal WhatsApp.

---

## 7. White-label futuro (gatilho de revisita)

PRD v2.4 §8 lista white-label como "após 10+ clientes". Esta ADR mantém a porta aberta:

- Tokens `--prisma-*` poderiam ser sobrescritos por tenant pagante de plano white-label
- Logo Prisma poderia ser substituído por logo do tenant em chrome do dashboard
- Emails transacionais poderiam usar paleta do tenant

**Pré-requisitos pra revisitar (gatilho objetivo):**
1. ≥10 tenants pagantes
2. ≥3 leads pedirem white-label explicitamente
3. ADR nova (MKT-XXX) declarando o modelo comercial e técnico

**Sem os 3:** white-label não entra. Identidade Prisma é fixa.

---

## 8. Impacto em outros docs

| Doc | Onde entra |
|---|---|
| **ARCHITECTURE.md** §Frontend | `globals.css` canônico, setup `next/font`, injeção runtime de `--tenant-*` |
| **DOMAIN.md** | Glossário: "Prisma" (produto), "tenant" (cliente), "Fitness UNIC" (tenant #1, não o produto) |
| **CLAUDE.md** | Anti-padrões 5.4 com enforcement automatizado |
| **ROADMAP.md** Sprint 0.5 | Checklist: confirmar tokens aplicados em dashboard + favicon + OG image + email transacional |
| **PRD v2.4** | Já fala "Prisma" implicitamente — atualizar próxima revisão pra usar nome no lugar de "marketing-saas v2" |

---

## 9. Anti-padrões proibidos (consolidados)

- Hex hardcoded fora de CSS var em código compartilhado
- Namespace `--brand-*` em qualquer caminho (descontinuado nesta ADR)
- `--tenant-*` em componente genérico do dashboard (viola ENGINE_VS_TENANT Camada 1)
- Logo do Prisma em conteúdo renderizado de tenant (posts, watermark, preview)
- Logo de tenant em chrome do dashboard (header, footer, login)
- Fonte adicional sem ADR
- Carregamento de fonte via `@import` CSS ou CDN externo
- Tom de voz do bot WhatsApp assinando como "Prisma" (bot é representante do tenant)

---

## 10. O que NÃO entra nesta ADR

- Design das telas em si (entregável de execução)
- Pictograma / variantes do logo (decisão futura quando designer entrar)
- Modo escuro do dashboard (não-MVP — gatilho: pedido explícito de tenant)
- Sistema de spacing / sizing (Tailwind default cobre MVP)
- Iconografia (lucide-react canônico no Next.js — escolha de stack, não de design system)

---

## 11. Gatilhos de revisita

| Condição | Ação |
|---|---|
| Designer profissional entrar no projeto | Revisar paleta + tipografia + spacing como sistema completo (não só esta ADR) |
| Tenant pagante exigir white-label | Ver §7 |
| LCP penalizado pela tipografia (>2.5s consistentemente) | Avaliar font subset / system fonts |
| Acessibilidade: contraste insuficiente em algum token | Ajustar valor mantendo o nome do token |

---

*Fim do ADR-MKT-006.*
