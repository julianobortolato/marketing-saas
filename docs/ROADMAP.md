# ROADMAP — Prisma (marketing-saas v2)

> **Versão:** 2.0 — 26/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas`
> **SHA base:** `9984cf8` (Sprint 0 concluído)
> **Substitui:** ROADMAP v1.0 integralmente
> **Delta v1.0→v2.0:**
> - Sequência corrigida: Sprint 0.5 movido para depois das Fases 4-6 (produto core inexistente no v1.0)
> - Fase 3R adicionada (limpeza de débito pré-Fase 4)
> - Fases renumeradas para refletir ordem real de execução
> - Follow-up cron + Google Calendar movidos para pós-UNIC (Fase 8)
> - Visão geral corrigida

---

## Visão geral

```
Sprint 0 ✅
  → Fase 3R  (limpeza: conversas/, migrations pendentes)
  → Fase 4   (Wizard + Manual de Marca + Banco de Imagens)
  → Fase 5   (Gerador de Conteúdo — Satori + templates + pipeline)
  → Fase 6   (Publicação — Zernio primeiro)
  → Fase 7   (Dashboard ROI)
  → Sprint 0.5 (Dogfooding — founder usa produto completo)
  → Liberação UNIC
  → Fase 8   (Bot CMO refinado — follow-up + Google Calendar)
  → Fase 9   (Campanhas pagas — pós Meta App Review)
```

---

## Estado atual do repo (SHA 9984cf8)

### ✅ Pronto

| O que | SHA |
|---|---|
| Auth + multi-tenant + RLS | `4385514` |
| Lead pipeline | `92b59a3` |
| Sistema de aprovação batch | `92b59a3` |
| `tenant_config` (renomeada de `academia_config`) | `9984cf8` |
| `ai_usage_log` + kill switch | `92b59a3` |
| Bot CMO: rota Edge, HMAC, rate limit, LGPD, handoff gate | `9984cf8` |
| Sentry + pre-commit Husky | `9984cf8` |
| Bridge `iara_tenant_id` | `9984cf8` |

### ⚠️ Parcial

| O que | Status |
|---|---|
| `brand_manual` JSONB | Coluna existe na migration, sem wizard que preenche |
| `banco_imagens` | Schema documentado, migration não confirmada, sem tela |
| `app/dashboard/conversas/` | Existe no repo — decisão de remover (pivot) não executada |

### ❌ Não existe

- Wizard de onboarding (8 passos)
- Upload de logo + extração de paleta + Vision
- Análise de Instagram/site → `brand_manual`
- Banco de imagens (tela, upload, galeria, auto-tag)
- Gerador de conteúdo (`/api/posts/render`, Satori, templates)
- Pipeline posts (copy + foto + template → preview → aprovação)
- Publicação (Zernio / Meta API / exportação manual)
- Dashboard ROI
- Follow-up cron (2h/24h)
- Google Calendar OAuth + tool `agendar_aula_experimental`

---

## Fase 3R — Limpeza (pré-Fase 4)

**Duração estimada:** ~1 dia
**Bloqueador da Fase 4:** sim — Fase 4 não inicia com débito técnico aberto

### Checklist

- [ ] Remover `app/dashboard/conversas/` e `app/dashboard/conversas/[conversa_id]/` do repo
- [ ] Confirmar migration `brand_manual` aplicada: `SELECT column_name FROM information_schema.columns WHERE table_name='tenant_config' AND column_name='brand_manual'`
- [ ] Confirmar migration `banco_imagens` aplicada ou criar arquivo novo se necessário
- [ ] `grep -rn "academia_config" app/ lib/ --include="*.ts"` retorna zero fora da view
- [ ] `pnpm build` limpo após remoção das conversas

### Critério de aceite

```
□ app/dashboard/conversas/ removido do repo
□ brand_manual coluna confirmada em tenant_config
□ banco_imagens tabela confirmada no schema
□ build verde
```

---

## Fase 4 — Wizard + Manual de Marca + Banco de Imagens

**Duração estimada:** 1-2 semanas
**Bloqueador:** Fase 3R concluída
**Objetivo:** tenant configurado em 8-12 min, IA preenchendo tudo que puder inferir

### 4.1 Wizard de onboarding (8 passos)

Rota: `/onboarding/[passo]` — estado em `tenants.onboarding_passo INT DEFAULT 1`

- [ ] **Passo 1 — Cadastro mínimo** (~30s): nome, email, empresa, cidade, WhatsApp → cria tenant + usuario
- [ ] **Passo 2 — Vertical** (1 clique): Fitness / Gastronomia / Beleza / Outro → carrega preset de `vertical_presets`
- [ ] **Passo 3 — Upload logo**: `node-vibrant` extrai paleta → GPT-4o Vision nomeia cores + sugere tipografia → dono confirma cor primária → salva em `brand_manual.visual`
- [ ] **Passo 4 — Análise de redes**: scraping URL Instagram + site → GPT-4o destila tom, temas, público, diferencial → dono revisa e aprova → salva em `brand_manual.tom_de_voz`
- [ ] **Passo 5 — Banco de imagens**: upload 10-20 fotos → Vision auto-tagueia por categoria do preset → dono revisa → salva em `banco_imagens`
- [ ] **Passo 6 — OAuth Meta + Google** (skippable — pode configurar depois)
- [ ] **Passo 7 — WhatsApp**: conecta instância Evolution + envia msg de teste
- [ ] **Passo 8 — Momento "uau"**: IA gera 3 posts iniciais usando `brand_manual` + fotos aprovadas → entra na fila de aprovação

**Custo IA por tenant:** ~$0.20 (Vision logo + análise redes + auto-tag 20 imgs + 3 posts)

### 4.2 Seed data obrigatório

- [ ] Tabela `vertical_presets` com categorias por vertical:

| Vertical | Categorias |
|---|---|
| Fitness | treino, bastidores, equipe, espaço, depoimento, equipamento |
| Gastronomia | pratos, ambiente, equipe, bastidores, eventos |
| Beleza | procedimentos, antes-depois, equipe, ambiente, produtos |
| Genérico | produto, equipe, espaço, bastidores, cliente, evento |

### 4.3 Manual de Marca editável (pós-onboarding)

- [ ] Tela `/dashboard/configuracoes/marca` com todas as seções do `brand_manual` JSONB
- [ ] Preview ao vivo de como mudanças afetam posts
- [ ] Validação Zod no save

### 4.4 Banco de Imagens completo

- [ ] Galeria `/dashboard/banco-imagens` com filtros por categoria + tag
- [ ] Re-tag manual (override do Vision)
- [ ] Bulk upload + bulk delete
- [ ] Storage quota visível por tenant
- [ ] Bucket Supabase: `banco-imagens/<tenant_id>/<uuid>.<ext>`

### Critério de aceite

```
□ Wizard completo do passo 1 ao 8 sem erro
□ brand_manual preenchido via IA no banco após passo 4
□ ≥5 fotos auto-tagueadas após passo 5
□ 3 posts gerados no passo 8 e visíveis na fila de aprovação
□ Manual de Marca editável salva sem erro
□ Banco de imagens: upload, galeria e filtro funcionando
```

---

## Fase 5 — Gerador de Conteúdo

**Duração estimada:** 2-3 semanas
**Bloqueador:** Fase 4 concluída (precisa de `brand_manual` + `banco_imagens` populados)
**ADR:** ADR-MKT-003 ✅ fechada (Satori)

### 5.1 Rota de renderização

- [ ] `/api/posts/render` em Edge Runtime + Satori (HTML→PNG)
- [ ] Fontes pré-carregadas em `public/fonts/` (Plus Jakarta Sans, Inter, + 3-5 opções curadas)
- [ ] Timeout: 10s com fallback para template simplificado

### 5.2 Templates

- [ ] 5-10 templates JSX por formato: `feed_1080`, `story_1920`, `carousel_slide`
- [ ] Slots obrigatórios: `foto_url`, `copy_principal`, `cta`, `logo_url`, `cor_primaria`
- [ ] Tabela `post_templates` seed com templates iniciais

### 5.3 Pipeline de geração

- [ ] GPT-4o gera copy no tom da marca (`brand_manual.tom_de_voz` no system prompt)
- [ ] Seleciona foto do `banco_imagens` por tag + contexto do post
- [ ] Monta post: foto + copy + CTA + hashtags + template
- [ ] Adapta por plataforma (Instagram feed/story/carousel; Facebook; TikTok)
- [ ] Preview visual no dashboard
- [ ] Sugestão de campanha Meta (copy + público + budget + duração)

### 5.4 Fila de aprovação

- [ ] Posts gerados entram com status `pendente_aprovacao`
- [ ] Dashboard `/dashboard/aprovacoes` mostra fila semanal (já existe — validar compatibilidade)
- [ ] Ações: aprovar / rejeitar / editar copy
- [ ] Vídeos: dono sobe → IA gera legenda + hashtags + melhor horário

**Regra:** IA nunca gera foto do zero. Sempre foto real do banco + overlay via template.

### Critério de aceite

```
□ /api/posts/render retorna PNG válido em <10s (smoke test curl)
□ Pipeline gera post completo (copy + foto + template) sem erro manual
□ Post aparece na fila de aprovação após geração
□ Aprovar post muda status para 'aprovado'
□ Adaptação por plataforma gera dimensões corretas
```

---

## Fase 6 — Publicação

**Duração estimada:** 1-2 semanas
**Bloqueador:** Fase 5 concluída + posts aprovados na fila
**Estratégia:** 3 camadas de fallback

### 6.1 Camada 1 — Zernio (MVP)

- [ ] Criar conta Zernio gratuita (2 contas inclusas)
- [ ] Integrar API Zernio: post aprovado → agendar publicação
- [ ] Agendamento por melhor horário (campo em `posts`)
- [ ] Status no dashboard: `publicado` / `falhou` / `agendado`
- [ ] **Go/no-go após 14 dias:** se <5% falha + UX boa → confirmar Camada 1; se ≥5% falha → Camada 2

### 6.2 Camada 2 — Meta API direto (fallback)

- [ ] Meta Marketing API + Instagram Graph API
- [ ] **Bloqueador:** Meta App Review aprovado (iniciar em paralelo — ADR-MKT-002)
- [ ] Ads sempre criados **PAUSADOS** — dono ativa manualmente

### 6.3 Camada 3 — Exportação manual (fallback final)

- [ ] Botão "Baixar post" → ZIP com PNG + copy + hashtags
- [ ] Instrução na tela para publicar manualmente
- [ ] Preserva valor do produto mesmo sem API ativa

### Critério de aceite

```
□ Post aprovado publicado via Zernio (ou exportado manualmente)
□ Status atualizado no dashboard após publicação
□ Falha de publicação gera alerta visível (não silenciosa)
□ Exportação manual funciona como fallback
```

---

## Fase 7 — Dashboard ROI

**Duração estimada:** 1-2 semanas
**Bloqueador:** Fase 6 concluída (precisa de posts publicados para ter dados)

- [ ] KPI central: visitas + AEs agendadas por semana (número único, em português)
- [ ] ROI automático: `leads convertidos × mensalidade média estimada − custo campanha`
- [ ] Botão "confirmar aluno" (fecha ciclo sem disciplina manual)
- [ ] Insights relativos ao histórico do tenant (nunca threshold fixo hardcoded)
- [ ] Métricas Meta: alcance, impressões, engajamento, CPL, CPC, CTR, gasto
- [ ] Relatório semanal automático via Resend
- [ ] Sugestões de otimização → fila de aprovação

### Critério de aceite

```
□ KPI central visível na overview com número real (não mock)
□ Botão "confirmar aluno" muda lead.status para 'convertido'
□ Relatório semanal Resend disparado (smoke test)
```

---

## Sprint 0.5 — Dogfooding

**Quando:** Fases 4-7 concluídas
**Duração:** 1 dia útil
**Quem:** Founder como `tenant_admin` da "Academia Demo Juliano" (tenant fictício — não usar dados da UNIC)
**Resolve:** validação end-to-end antes do cliente real

### Checklist de 12 itens

```
□  1. Cadastro: wizard passo 1 em <60s
□  2. Vertical: selecionar "fitness", preset carregado
□  3. Upload logo: paleta extraída + fonte sugerida
□  4. Análise redes: URL Instagram → brand_manual preenchido
□  5. Banco de imagens: 10 fotos → auto-tag Vision
□  6. OAuth Meta + Google: conectar ou pular
□  7. WhatsApp: conectar Evolution, receber msg de teste
□  8. Posts iniciais: 3 posts gerados no "momento uau"
□  9. Aprovação: aprovar 1 post, confirmar status
□ 10. Identidade visual:
       - Chrome do dashboard usa --prisma-* (midnight visível)
       - Preview de post usa --tenant-primary (não cor Prisma)
       - Logo Prisma_Azul_Midnight.png no header
□ 11. Bot CMO: msg WhatsApp → resposta no tom do brand_manual
□ 12. Audit log: SELECT mostra ações registradas
```

### Critério de go/no-go para liberar UNIC

| Métrica | Threshold |
|---|---|
| Bugs bloqueantes | <5 |
| Tempo total wizard (passos 1-8) | <15min |
| Posts aprovados sem editar | ≥2 de 3 |

### Saída

- [ ] `RELATORIO_DOGFOOD.md` com bugs bloqueantes corrigidos, bugs não-bloqueantes (backlog), decisões UX capturadas
- [ ] Decisão go/no-go documentada

---

## Liberação Fitness UNIC

**Quando:** Sprint 0.5 verde
**O que:** criar tenant real, onboarding completo com dados reais, bot CMO em produção

- [ ] Criar tenant Fitness UNIC via signup (mesmo fluxo do dogfood)
- [ ] Onboarding 8 passos com fotos reais, marca real, OAuth real
- [ ] Instância Evolution apontando pro número WhatsApp comercial da UNIC
- [ ] Bot CMO operando em produção

**Suporte:** WhatsApp direto do founder. Página `/ajuda` com 5-10 FAQs (entrega pós-UNIC).

---

## Fase 8 — Bot CMO refinado (pós-UNIC)

**Quando:** UNIC operando há ≥2 semanas
**Gatilho Whisper:** medir % de áudio nos primeiros 30 dias da UNIC — se >30% adicionar Whisper; se <30% adiar

- [ ] Follow-up automatizado via Vercel Cron: 2h retomada, 24h msg final, 48h → lead `frio`
- [ ] Heurística de conversa degenerada (N turnos sem tool call → handoff)
- [ ] Notificação handoff via WhatsApp do owner (não dashboard)
- [ ] Google Calendar OAuth por tenant + tool `agendar_aula_experimental`
- [ ] **ADR-MKT-002** antes do código do Google Calendar
- [ ] Whisper condicional (gatilho acima)

---

## Fase 9 — Campanhas pagas (pós Meta App Review)

**Quando:** Meta App Review aprovado (2-4 semanas após submissão)

- [ ] Fase 9.1 (MVP): sistema gera pacote pronto, dono cola no Ads Manager
- [ ] Fase 9.2: cria campanha PAUSADA via API, dono ativa
- [ ] Fase 9.3: cria + ativa, kill switch protege

**Travas em todas as subfases:** budget cap diário, preview completo, kill switch automático.

---

## Pós-MVP (marcadores de futuro — não roadmap)

| Bloco | Gatilho |
|---|---|
| Inteligência competitiva (SerpApi + Meta Ad Library) | Cliente #1 validado 30+ dias |
| Stripe / billing automático | >5 academias pagantes |
| Bridge MKT→V2 ativado | Primeiro cliente compra os dois produtos |
| White-label | ≥10 tenants pagantes + ≥3 pedidos explícitos |

---

## Meta App Review (paralelo — iniciar agora)

- [ ] Criar Meta App em `developers.facebook.com`
- [ ] Configurar scopes: `pages_show_list, pages_manage_posts, instagram_basic, instagram_content_publish, ads_management, ads_read, business_management`
- [ ] Submeter App Review (leva 2-4 semanas)
- [ ] Documentar status em `.adrs/ADR-MKT-002.md`

---

## Anti-padrões deste ROADMAP

- Iniciar Fase 4 sem Fase 3R concluída (débito técnico contamina o wizard)
- Iniciar Sprint 0.5 antes das Fases 4-6 (não tem produto pra testar)
- Liberar UNIC antes do Sprint 0.5 verde
- Reabrir N8N sem ADR nova (ADR-MKT-005 §5)
- Tratar Fitness UNIC como staging — UNIC é tenant em produção
- Adicionar feature pós-MVP sem cliente #1 validado 30+ dias

---

## Referências cruzadas

| Item | Doc |
|---|---|
| Pilares do produto | `docs/PRD.md` §3 |
| Schemas SQL | `docs/ARCHITECTURE.md` §3 |
| Roles e estados | `docs/DOMAIN.md` §3-4 |
| Anti-padrões com enforcement | `CLAUDE.md` §3 |
| ENGINE_VS_TENANT | `docs/principles/ENGINE_VS_TENANT.md` |
| Decisões arquiteturais | `.adrs/ADR-MKT-001/003/005/006.md` |

---

*Fim do ROADMAP.md v2.0.*
