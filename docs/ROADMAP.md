# ROADMAP — Prisma (marketing-saas v2)

> **Versão:** 1.0 — 26/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas`
> **Base:** PRD v2.4 §7, ESCOPO v2.1 §8, ADR-MKT-001/003/005/006

---

## Visão geral

```
Sprint 0   →  Sprint 0.5 (dogfood)  →  Liberação UNIC  →  Fases 1-7
   ↓              ↓                          ↓                ↓
segurança    founder usa                tenant real      MVP completo
fundação     como tenant                cobaia
             fictício
```

---

## Sprint 0 — Segurança e fundação

**Duração estimada:** 1-2 dias úteis
**Critério de avanço:** todos os checks da §0.7 verdes
**Bloqueador:** Sprint 0.5 não inicia sem Sprint 0 concluído

### 0.1 Inventário do MKT v1
- [x] Gerado em `INVENTARIO_MKT_V1.md` (snapshot 26/mai)
- [ ] Validar com `git status` que SHA atual ainda é `319f543`

### 0.2 Rename `academia_config` → `tenant_config`

```sql
-- Migration: 20260527000001_rename_academia_to_tenant.sql
ALTER TABLE public.academia_config RENAME TO tenant_config;

-- View de compatibilidade temporária (sunset: fim do Sprint 1)
CREATE VIEW public.academia_config AS SELECT * FROM public.tenant_config;
```

Atualizar referências no código:
- [ ] `lib/queries/*` — busca por `academia_config`
- [ ] `app/api/**` — busca por `academia_config`
- [ ] `app/dashboard/configuracoes/**`
- [ ] RPCs em migrations anteriores que façam `SELECT` da tabela (verificar via grep)

### 0.3 Segurança do webhook bot

- [ ] Refactor `app/api/webhooks/evolution/route.ts` → `app/api/agents/cmo/route.ts`
- [ ] Mover runtime para Edge: `export const runtime = 'edge'`
- [ ] HMAC validação (header `x-hub-signature-256` + `EVOLUTION_WEBHOOK_SECRET`)
- [ ] Idempotência: `evolution_message_id UNIQUE` por tenant em `chat_messages`
- [ ] Rate limit Upstash: chave `<remotejid>:<tenant_id>`, 10 msg/min
- [ ] Consentimento LGPD: flag `chat_messages.lgpd_aceito` por (remotejid, tenant_id); primeira msg envia opt-in
- [ ] Pre-LLM handoff gate (keyword "desconto", "pagamento", "cancelar")

### 0.4 Observabilidade

- [ ] Instalar `@sentry/nextjs` + DSN em env
- [ ] Tags obrigatórias: `tenant_id`, `usuario_id`, `route`, `runtime`
- [ ] Pre-commit hook `next build`:

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"
pnpm next build || (echo "❌ next build falhou — commit bloqueado" && exit 1)
```

### 0.5 Bridge MKT→V2 (preventivo)

```sql
-- Migration: 20260527000003_bridge_iara_v2.sql
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS iara_tenant_id UUID NULL;
CREATE INDEX idx_tenants_iara_bridge ON public.tenants(iara_tenant_id) WHERE iara_tenant_id IS NOT NULL;
COMMENT ON COLUMN public.tenants.iara_tenant_id IS
  'Bridge MKT→V2. Sunset: remover se em 12 meses 0 tenant tiver o bridge.';
```

Sunset condition: avaliar 26/mai/2027 (ARCHITECTURE.md §9.3).

### 0.6 Meta App Review (paralelo)

- [ ] Criar Meta App em developers.facebook.com
- [ ] Configurar scopes: `pages_show_list, pages_manage_posts, instagram_basic, instagram_content_publish, ads_management, ads_read, business_management`
- [ ] Submeter App Review (leva 2-4 semanas — iniciar no Sprint 0 mesmo sem código pronto)
- [ ] Documentar status em `.adrs/ADR-MKT-002.md` (Meta Marketing API)

### 0.7 Webhook Evolution validado

- [ ] `webhook.site` recebendo payload da instância de teste (Fitness UNIC)
- [ ] HMAC validado em ambiente local com `curl`
- [ ] Smoke test: msg de teste → `chat_messages` com status `recebida`
- [ ] Sentry capturando erro forçado em rota de agente

### 0.8 Checklist binário de aceite — Sprint 0

```
□ supabase db push executou sem erro em todas as 3 migrations novas
□ academia_config → tenant_config rename concluído + view de compat
□ /api/agents/cmo retorna 200 OK em mensagem válida (smoke test curl)
□ /api/agents/cmo retorna 401 em HMAC inválido (smoke test curl)
□ /api/agents/cmo retorna 200 + no-op em mensagem duplicada (idempotência)
□ Rate limit Upstash bloqueia >10 msg/min do mesmo remotejid (smoke test)
□ Consentimento LGPD: bot insiste em opt-in até receber aceite
□ Pre-LLM handoff gate dispara em keyword "pagamento"
□ Pre-commit next build bloqueia commit com erro de tipo (teste forçado)
□ Sentry recebe evento de erro forçado
□ iara_tenant_id existe em tenants (SELECT confirma)
□ Meta App Review submetido (screenshot do status)
□ grep -rn "academia_config" lib/ app/ retorna zero ocorrências fora da view
```

---

## Sprint 0.5 — Dogfooding (obrigatório antes da UNIC)

**Duração:** 1 dia útil
**Quem usa:** Juliano (founder) como `tenant_admin` da "Academia Demo Juliano" (tenant fictício)
**Resolve:** Gap #3 da síntese cross-projeto (nenhum dos 3 projetos teve feedback loop real)
**Critério de avanço:** <5 bugs bloqueantes encontrados pelo founder

### 0.5.1 Setup do tenant fictício

- [ ] Criar tenant "Academia Demo Juliano" via fluxo de signup normal
- [ ] **Não usar dados reais da Fitness UNIC** — separar mentalmente owner vs cliente
- [ ] Tenant ID gerado vai em `WEBHOOK_TENANT_MAP` apontando pra instância Evolution de teste

### 0.5.2 Checklist de 12 itens (PRD v2.4 §10.1)

Founder executa cada item **como tenant_admin sem privilégio especial** (sem atalho de super_admin):

```
□  1. Cadastro mínimo: completar wizard passo 1 em <60s
□  2. Vertical: selecionar "fitness", confirmar que preset carregou
□  3. Upload logo: subir logo, confirmar paleta extraída + fonte sugerida
□  4. Análise de redes: colar URL Instagram, confirmar brand_manual preenchido
□  5. Banco de imagens: subir 10 fotos, confirmar auto-tag via Vision
□  6. OAuth Meta + Google: conectar ambos OU pular pra próximo passo
□  7. WhatsApp: conectar instância Evolution, receber msg de teste
□  8. Posts iniciais: confirmar que 3 posts foram gerados no momento "uau"
□  9. Aprovação: aprovar 1 post no dashboard, confirmar status
□ 10. Identidade visual:
       - Chrome do dashboard usa --prisma-* (cor midnight visível)
       - Logo Prisma_Azul_Midnight.png aparece no header
       - Preview de post mostra cor do tenant (--tenant-primary), não Prisma
       - Favicon, OG image, email de welcome estilizados
□ 11. Bot CMO: enviar msg de teste via WhatsApp para a instância,
       confirmar resposta no tom do brand_manual configurado
□ 12. Audit log: SELECT em audit_log mostra ações registradas
       (post_aprovado, oauth_conectado, brand_manual_alterado)
```

### 0.5.3 Critérios de avanço

| Métrica | Threshold |
|---|---|
| Bugs bloqueantes (não passa do passo) | <5 |
| Tempo total do wizard (passos 1-8) | <15min |
| Posts gerados aprovados pelo founder sem editar | ≥2 de 3 |
| Erros não-bloqueantes (visuais, copy, UX) | Listar pra Sprint 1, não bloqueia avanço |

### 0.5.4 Saída do Sprint 0.5

- [ ] `RELATORIO_DOGFOOD.md` em `~/Downloads/` com:
  - Lista de bugs bloqueantes corrigidos
  - Lista de bugs não-bloqueantes (vai pro backlog)
  - Decisões de UX/copy capturadas durante o uso
- [ ] Decisão go/no-go pra liberar Fitness UNIC

---

## Liberação Fitness UNIC

**Quando:** Sprint 0.5 verde
**O quê:** criar tenant real Fitness UNIC, fazer onboarding completo com dados reais, ativar bot CMO em produção

### Setup
- [ ] Criar tenant Fitness UNIC via signup (mesmo fluxo do dogfood)
- [ ] Onboarding 8 passos com fotos reais, marca real, OAuth real
- [ ] Instância Evolution apontando pra número WhatsApp comercial da UNIC
- [ ] Bot CMO operando em produção

### Suporte
- Canal direto: WhatsApp do founder pra UNIC
- FAQ in-app: `/ajuda` (Fase 1 deste roadmap)

---

## Fases 1-7 — MVP completo

### Fase 1 — Onboarding refinado + ajuda
**Duração estimada:** 1 semana
**Depende de:** Liberação UNIC

- [ ] Refinar wizard 8 passos com feedback do dogfood + UNIC primeira semana
- [ ] Página `/ajuda` com 5-10 FAQs (PRD v2.4 §10.3)
- [ ] Audit log surface no dashboard (super_admin only)

### Fase 2 — Manual de marca editável
- [ ] Tela completa de edição do `brand_manual` (todas as seções do JSONB)
- [ ] Preview ao vivo de como mudanças afetam posts
- [ ] Validação Zod no save

### Fase 3 — Banco de imagens completo
- [ ] Galeria com filtros (categoria, tag, aprovação)
- [ ] Re-tag manual (override do Vision)
- [ ] Bulk upload + bulk delete
- [ ] Storage quota visível por tenant

### Fase 4 — Bot CMO refinado
- [ ] Follow-up automatizado (2h retomada, 24h msg final) via Vercel Cron
- [ ] Heurística conversa degenerada (N turnos sem tool call → handoff)
- [ ] Notificação handoff via WhatsApp do owner (não dashboard — D4)
- [ ] Tool `agendar_aula_experimental` (Google Calendar OAuth)
- [ ] **ADR-MKT-002** registrar Google Calendar integration

**Decisão Whisper (PRD v2.4 §7 Bloco 5):**
- [ ] Medir % de áudio na instância UNIC nos primeiros 30 dias
- [ ] Se >30% → adicionar Whisper (Fase 4.1)
- [ ] Se <30% → adiar

### Fase 5 — Gerador de conteúdo
**Bloqueador:** ADR-MKT-003 fechada ✅ (Satori)

- [ ] Implementar `/api/posts/render` em Edge + Satori
- [ ] 5-10 templates por formato (feed, story, carousel)
- [ ] Pipeline: brand_manual + foto + copy → post renderizado
- [ ] Preview no dashboard + fila de aprovação
- [ ] Adaptação por plataforma (Instagram, Facebook, TikTok)
- [ ] Vídeos: dono sobe, IA gera legenda + hashtags + horário

### Fase 6 — Publicação
**Estratégia:** 3 camadas (PRD v2.4 §7 Bloco 4)

- [ ] Camada 1 — Zernio (testar com 2 contas grátis primeiro)
- [ ] Camada 2 — Meta API direto (Instagram Graph + Marketing) — depende Meta App Review aprovado
- [ ] Camada 3 — Exportação manual (fallback final)
- [ ] Agendamento via Vercel Cron
- [ ] Status no dashboard: publicado / falhou / agendado

**Decisão Zernio go/no-go:**
- [ ] 14 dias de teste com plano free (2 contas)
- [ ] Se <5% falha + UX boa → camada 1
- [ ] Se ≥5% falha ou outage → pular pra camada 2

### Fase 7 — Dashboard ROI
- [ ] KPI central: visitas + AEs/semana (número único, português)
- [ ] ROI automático: leads convertidos × mensalidade média − custo campanha
- [ ] Botão "confirmar aluno" (fecha ciclo sem disciplina manual)
- [ ] Insights relativos ao histórico (nunca threshold fixo)
- [ ] Métricas Meta: alcance, impressões, engajamento, CPL, CPC, CTR, gasto
- [ ] Relatório semanal automático via Resend
- [ ] Sugestões de otimização → fila de aprovação

### Fase 8 — Campanhas pagas (progressão de confiança)
**MVP termina aqui. Progressão depende de Meta App Review aprovado.**

- [ ] Fase 8.1 (MVP): sistema gera pacote pronto, dono cola no Ads Manager
- [ ] Fase 8.2: cria campanha PAUSADA via API, dono ativa
- [ ] Fase 8.3: cria + ativa, kill switch protege

---

## Pós-MVP (não roadmap, marcador de futuro)

### Bloco — Inteligência competitiva
- Cadastro de concorrentes
- SerpApi + Meta Ad Library
- GPT-4o análise + relatório de brechas

**Gatilho:** cliente #1 validado 30+ dias.

### Bloco — Stripe / billing automático
**Gatilho:** >5 academias pagantes.

### Bloco — Bridge MKT→V2 ativado
**Gatilho:** primeiro cliente compra os dois produtos.
**ADR-MKT-007** (futura) define contrato.

### Bloco — White-label
**Gatilho:** ≥10 tenants pagantes + ≥3 pedidos explícitos.
ADR-MKT-006 §7 documenta o gatilho.

---

## Validação cliente #1 (Fitness UNIC) — 12 semanas

PRD v2.4 §10.2:

| Semana | Milestone | Métrica |
|---|---|---|
| 1-2 | Onboarding + Manual + 20 fotos | Wizard completo |
| 3-4 | 10 posts gerados | ≥7/10 aprovados sem edição |
| 5-6 | Posts publicados | No ar, engajamento real |
| 7-8 | 2 campanhas Meta sugeridas | 1 gerou leads |
| 9-10 | Bot + Google Calendar | Lead respondido <5min, AE no calendar |
| 11-12 | Dashboard ROI | Founder vê KPI + ROI |

**Validado se:** UNIC usa toda semana sem pedir ajuda, aprova >60% sem editar, 1 campanha gerou leads, founder pagaria R$297/mês se não fosse o dono.

**Pivot se:** edita >70%, qualidade visual rejeitada, publicação falha >20%, prefere Canva + Ads Manager direto.

---

## Decisões fora desta rodada (não bloqueiam ROADMAP)

| Decisão | Quando entra |
|---|---|
| Pricing definitivo UNIC | Após validação 12 semanas |
| Stripe billing | >5 academias pagantes |
| Whisper (transcrição áudio WhatsApp) | Se ≥30% das msgs UNIC forem áudio em 30 dias |
| ADR-MKT-007 (bridge MKT→V2) | Quando primeiro cliente comprar os dois |
| Inteligência competitiva | Cliente #1 validado 30+ dias |

---

## Anti-padrões deste ROADMAP

- Pular Sprint 0.5 ("já testei mentalmente") — gap #3 da síntese cross-projeto não se resolve sem dogfood
- Liberar UNIC antes do Sprint 0 estar 100% nos 12 checks
- Reabrir N8N em qualquer fase sem ADR nova (ADR-MKT-005 §5)
- Adicionar feature de pós-MVP sem cliente #1 validado 30+ dias
- Tratar Fitness UNIC como teste interno do Prisma — UNIC é tenant em produção, não staging

---

## Referências cruzadas

| Item | Doc |
|---|---|
| Pilares do produto | `PRD.md` §3 |
| Schemas SQL | `ARCHITECTURE.md` §3 |
| Roles | `DOMAIN.md` §3 |
| Anti-padrões com enforcement | `CLAUDE.md` §3 |
| ENGINE_VS_TENANT | `docs/principles/ENGINE_VS_TENANT.md` |
| Decisões arquiteturais | `.adrs/ADR-MKT-001/003/005/006.md` |

---

*Fim do ROADMAP.md v1.0.*
