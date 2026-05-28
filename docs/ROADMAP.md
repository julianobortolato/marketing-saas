# ROADMAP — Prisma (marketing-saas v2)

> **Versão:** 3.0 — 27/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas`
> **Substitui:** ROADMAP v2.0 integralmente
> **Delta v2.0→v3.0:**
> - **Removida seção de "Estado atual do repo"** — vive em `ESTADO_ATUAL.md` (princípio de separação por velocidade de envelhecimento)
> - **Fases 3R, 4, 5 marcadas concluídas** (1 linha cada, sem detalhe — quem quiser detalhe vai no ESTADO_ATUAL ou git log)
> - **Reordenação 80/20:** Fase 6-LITE (export manual) antes de 6-FULL (Zernio/Meta API)
> - **Sprint 0.5 antecipado** — entra após Fase 6-LITE, não depois de toda Fase 7
> - Princípio operacional: **roadmap só descreve futuro**. Passado vive no ESTADO_ATUAL e git log.

---

## Visão geral

```
═══ JÁ ENTREGUE ═══
Sprint 0     ✅  (SHA base v1.0)
Fase 3R      ✅  (rename tenant + brand_manual + banco_imagens + onboarding)
Fase 4       ✅  (render Edge + Satori + templates feed/story/carousel)
Fase 5       ✅  (gerador GPT-4o + cron semanal + conteudos + prompts_agentes)

═══ PRÓXIMO ═══
Fase 6-LITE  →  Publicação manual (export PNG + copy)         ~1 sprint
Sprint 0.5   →  Dogfooding UNIC                                ~1-2 dias
Liberação UNIC

═══ APÓS VALIDAÇÃO COM TENANT REAL ═══
[decidir com base no aprendizado]
Fase 6-FULL  →  Zernio + Meta API direto
Fase 7       →  Dashboard ROI
Fase 8       →  Bot CMO refinado (follow-up + Google Calendar)
Fase 9       →  Campanhas pagas (após Meta App Review)
```

> Para estado atual do repo (SHAs, migrations, rotas existentes) → ver `ESTADO_ATUAL.md`.

---

## Princípio 80/20 aplicado

**O 20% que entrega 80% do valor:** Fase 6-LITE + Sprint 0.5 + Liberação UNIC.

**Por quê:**
- Fase 6-LITE entrega o produto **funcionando end-to-end** (dono baixa post, posta manual). Sem dependência de Zernio, sem espera Meta App Review.
- Sprint 0.5 é o teste real antes de cliente.
- Liberação UNIC = primeiro feedback de uso real.

**O 80% que pode esperar:** Zernio/Meta API, ROI dashboard, follow-up cron, campanhas pagas. Todos têm valor, mas nenhum bloqueia "UNIC rodando o produto".

---

## Fase 6-LITE — Publicação manual (export)

**Duração:** 1 sprint
**Bloqueador:** Fase 5 concluída ✅
**Objetivo:** produto funciona end-to-end sem dependência externa de API de publicação

### Checklist

- [ ] Botão "Baixar post" na fila de aprovação
- [ ] Endpoint `/api/conteudos/[id]/download` que retorna ZIP:
  - `post.png` (já renderizado pela Fase 4)
  - `copy.txt` (copy gerada pela Fase 5)
  - `hashtags.txt` (separado pra UX de copy-paste)
- [ ] Status do conteúdo: `aprovado` → `exportado` (sem `publicado` ainda nesta fase)
- [ ] Tela de aprovação com instrução clara: "Baixe e poste no Instagram"
- [ ] Smoke test: aprovar 1 post → baixar ZIP → arquivos válidos

### Critério de aceite

```
□ ZIP baixa com 3 arquivos válidos
□ PNG abre, copy é texto puro, hashtags em linha
□ Status muda para 'exportado' após download
□ Tela explica próximo passo ao dono (não-dev)
```

### Por que não Zernio/Meta agora

- Zernio adiciona dependência externa antes de validar produto core
- Meta API depende de App Review (2-4 semanas, fora do controle)
- Export manual preserva 80% do valor: IA gerou tudo, dono só publica

---

## Sprint 0.5 — Dogfooding

**Duração:** 1-2 dias
**Bloqueador:** Fase 6-LITE concluída
**Quem:** Founder como `tenant_admin` da "Academia Demo Juliano" (tenant fictício — não usar dados da UNIC)
**Resolve:** validação end-to-end antes do cliente real

### Checklist de 13 itens

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
□ 10. Export: baixar ZIP, validar 3 arquivos          ← novo (Fase 6-LITE)
□ 11. Identidade visual:
       - Chrome dashboard usa --prisma-* (midnight visível)
       - Preview de post usa --tenant-primary (não cor Prisma)
       - Logo Prisma_Azul_Midnight.png no header
□ 12. Bot CMO: msg WhatsApp → resposta no tom do brand_manual
□ 13. Audit log: SELECT mostra ações registradas
```

### Critério go/no-go para liberar UNIC

| Métrica | Threshold |
|---|---|
| Bugs bloqueantes | <5 |
| Tempo total wizard (passos 1-8) | <15min |
| Posts aprovados sem editar | ≥2 de 3 |
| Export ZIP funcional | sim |

### Saída

- [ ] `docs/release-notes/RELATORIO_DOGFOOD.md` com bugs bloqueantes corrigidos, backlog não-bloqueante, decisões UX
- [ ] Decisão go/no-go documentada

---

## Liberação Fitness UNIC

**Quando:** Sprint 0.5 verde
**O que:** criar tenant real, onboarding completo com dados reais, bot CMO em produção

- [ ] Criar tenant Fitness UNIC via signup (mesmo fluxo do dogfood)
- [ ] Onboarding 8 passos com fotos reais, marca real, OAuth real
- [ ] Instância Evolution apontando pro número WhatsApp comercial da UNIC
- [ ] Bot CMO operando em produção
- [ ] Owner publica manualmente os primeiros posts (Fase 6-LITE)

**Suporte:** WhatsApp direto do founder. Página `/ajuda` com 5-10 FAQs (entrega pós-UNIC).

**Janela de validação:** 2-4 semanas operando antes de decidir Fase 6-FULL / Fase 7.

---

## Após validação UNIC — decidir com base em dados

> Não pré-comprometer. Após 2-4 semanas de uso real, decidir qual entra primeiro.

### Fase 6-FULL — Publicação automatizada

**Gatilho:** owner cansou de baixar e postar manualmente, OU UNIC pediu automação explicitamente.

#### 6.1 Camada 1 — Zernio
- [ ] Criar conta Zernio gratuita (2 contas inclusas)
- [ ] Integrar API Zernio: post aprovado → agendar publicação
- [ ] Agendamento por melhor horário (campo em `conteudos`)
- [ ] Status no dashboard: `publicado` / `falhou` / `agendado`
- [ ] **Go/no-go após 14 dias:** se <5% falha + UX boa → confirmar Camada 1; se ≥5% falha → Camada 2

#### 6.2 Camada 2 — Meta API direto (fallback)
- [ ] Meta Marketing API + Instagram Graph API
- [ ] **Bloqueador:** Meta App Review aprovado (ADR-MKT-002)
- [ ] Ads sempre criados **PAUSADOS** — dono ativa manualmente

### Fase 7 — Dashboard ROI

**Gatilho:** UNIC operando ≥30 dias com dados reais pra mostrar.

- [ ] KPI central: visitas + AEs agendadas por semana (número único, em português)
- [ ] ROI automático: `leads convertidos × mensalidade média estimada − custo campanha`
- [ ] Botão "confirmar aluno" (fecha ciclo sem disciplina manual)
- [ ] Insights relativos ao histórico do tenant (nunca threshold fixo hardcoded)
- [ ] Métricas Meta: alcance, impressões, engajamento, CPL, CPC, CTR, gasto
- [ ] Relatório semanal automático via Resend
- [ ] Sugestões de otimização → fila de aprovação

### Fase 8 — Bot CMO refinado

**Gatilho:** UNIC operando ≥2 semanas, observar % de áudio.

- [ ] Follow-up automatizado via Vercel Cron: 2h retomada, 24h msg final, 48h → lead `frio`
- [ ] Heurística de conversa degenerada (N turnos sem tool call → handoff)
- [ ] Notificação handoff via WhatsApp do owner (não dashboard)
- [ ] Google Calendar OAuth por tenant + tool `agendar_aula_experimental`
- [ ] **ADR-MKT-002** antes do código do Google Calendar
- [ ] **Whisper condicional:** se >30% áudio nos primeiros 30 dias → adicionar; senão adiar

### Fase 9 — Campanhas pagas

**Gatilho:** Meta App Review aprovado (2-4 semanas após submissão).

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

## Meta App Review (paralelo — owner executa)

- [ ] Criar Meta App em `developers.facebook.com`
- [ ] Configurar scopes: `pages_show_list, pages_manage_posts, instagram_basic, instagram_content_publish, ads_management, ads_read, business_management`
- [ ] Submeter App Review (leva 2-4 semanas)
- [ ] Documentar status em `.adrs/ADR-MKT-002.md`

> Não bloqueia nenhuma fase atual — corre em paralelo.

---

## Anti-padrões deste ROADMAP

- Misturar inventário (passado) com plano (futuro) — passado vive no `ESTADO_ATUAL.md`
- Iniciar Fase 6-FULL antes de validar 6-LITE com tenant real
- Liberar UNIC antes do Sprint 0.5 verde
- Reabrir N8N sem ADR nova (ADR-MKT-005 §5)
- Tratar Fitness UNIC como staging — UNIC é tenant em produção
- Adicionar feature pós-MVP sem cliente #1 validado 30+ dias
- Pré-comprometer com Fase 6-FULL / 7 antes da janela de validação UNIC

---

## Pendências menores (não bloqueiam fase nova)

- [ ] Renomear `ADR-MKT-001-agente-whatsapp.md` → `ADR-MKT-001-DEPRECATED-agente-whatsapp.md`
- [ ] Sunset de `app/api/webhooks/evolution/route.ts` (substituído por `agents/cmo/route.ts`)

---

## Referências cruzadas

| Item | Doc |
|---|---|
| Estado atual do repo | `ESTADO_ATUAL.md` |
| Pilares do produto | `docs/PRD.md` §3 |
| Schemas SQL | `docs/ARCHITECTURE.md` §3 |
| Roles e estados | `docs/DOMAIN.md` §3-4 |
| Anti-padrões com enforcement | `CLAUDE.md` §3 |
| ENGINE_VS_TENANT | `docs/principles/ENGINE_VS_TENANT.md` |
| Decisões arquiteturais | `.adrs/ADR-MKT-001/003/005/006.md` |

---

*Fim do ROADMAP.md v3.0.*
