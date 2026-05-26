# PRD — marketing-saas
> **Versão:** 2.4 — 25/mai/2026
> **Autor:** Opus (enxugamento do v2.3 → escopo de produto puro)
> **Base:** ESCOPO_DEFINITIVO_MKT_SAAS v2.1 + BRIEFING_SINTESE_CROSS_PROJETO
> **Status:** Ativo — substitui PRD v2.3 integralmente
> **Delta v2.3→v2.4:**
> - Enxugamento: schemas SQL, detalhes de OAuth, gargalos técnicos profundos e §17 (camada de produto detalhada) saem do PRD
> - PRD passa a responder **o quê** e **por quê** (produto). Como/quando/regras migram pros docs gerados no `/init`
> - 758 → ~420 linhas (45% redução). Cada bloco terminal aponta o doc canônico que detalha
>
> **Onde foram os detalhes:**
> - Schemas SQL, stack detalhado, OAuth (Meta + Google), bridge MKT→V2 → **ARCHITECTURE.md**
> - Roles, convite, trial, notificações, logs de auditoria → **DOMAIN.md**
> - Checklist Sprint 0.5 (12 itens), roadmap operacional → **ROADMAP.md**
> - Regras pro Code, anti-padrões técnicos com enforcement → **CLAUDE.md**
> - Decisões individuais (Edge Runtime, N8N out, Sentry, etc.) → **ADRs específicos**

---

## 1. Problema

PMEs de serviço não fazem marketing digital consistente. O dono sabe entregar seu serviço, não sabe operar Ads Manager, Canva, Later e Instagram simultaneamente.

| Alternativa | Custo/mês | Problema |
|---|---|---|
| Agência | R$3-10k | Caro demais |
| Ferramentas genéricas (Later, Buffer) | R$50-300 | Exigem conhecimento de marketing |
| Gestão vertical (Mindbody, PushPress) | R$200-800 | Fazem gestão, não marketing |
| Dono faz sozinho | Tempo | Inconsistente, para em 2 semanas |

Nenhuma combina geração de conteúdo + publicação automatizada + inteligência de campanha, especializada no mercado local.

---

## 2. Proposta de valor

CMO autônomo para pequenas empresas de serviço.

A IA gera conteúdo no tom da marca usando fotos reais do negócio, sugere campanhas pagas prontas, e publica quando o gestor aprovar.

**Princípio operacional:** IA prepara tudo → Humano revisa e aprova → IA executa.

O produto desonera. Não substitui.

**MVP vertical:** fitness/academias. Expansão por preset de vertical sem refactor de engine.

---

## 3. Pilares

| # | Pilar | O que faz |
|---|---|---|
| 1 | **Manual de marca** | Wizard guiado com autopreenchimento (logo + redes) → brand_manual JSONB |
| 2 | **Geração de conteúdo** | Copy no tom da marca + foto real do banco + formatação por plataforma |
| 3 | **Publicação automatizada** | Aprovação → publicação via API (fallback manual preserva valor) |
| 4 | **Campanhas pagas (Meta)** | Campanha pronta, gestor aprova e ativa. Meta Advantage+ otimiza. |
| 5 | **Dashboard de ROI** | KPI central único + ROI automático + insights contextuais |
| 6 | **Bot WhatsApp (delegado)** | Atendimento a leads via Evolution API direto na rota Next.js |

---

## 4. KPI central

**Visitas + AEs agendadas por semana.**

Número único, automático, em português. É o "uau semanal" — dono vê resultado sem entender marketing.

Complementado na Fase 7: `ROI = leads convertidos × mensalidade média estimada − custo de campanha`.

Não precisa ser perfeito. Precisa ser automático e crível. É o que impede churn nos primeiros 90 dias.

---

## 5. Divisão de trabalho

| A IA faz | O humano faz |
|---|---|
| Gerar copy no tom da marca | Tirar/selecionar fotos do negócio |
| Selecionar foto do banco por contexto | Subir fotos com tags |
| Montar post (foto + copy + CTA + branding) | Aprovar conteúdo antes de publicar |
| Formatar por plataforma | Aprovar campanhas (mexe em dinheiro) |
| Sugerir campanha Meta Advantage+ | Gravar vídeos/reels no celular |
| Publicar post/campanha aprovada | Confirmar quando lead virou aluno |
| Gerar insights da conta Meta | Responder leads complexos via WhatsApp Business (fora do app) |
| Calcular ROI e KPI semanal | |
| Agendar AE no Google Calendar | |
| Autopreencher manual de marca | |
| Auto-taguear fotos do banco | |

---

## 6. Público-alvo

Dono ou gestor de PME de serviço sem equipe de marketing, gasta entre zero e R$500/mês com marketing e quer resultado sem aprender ferramentas complexas.

**Perfil típico:** 25-50 anos, 1-3 unidades, WhatsApp como canal principal, posts esporádicos no Instagram, nunca rodou campanha paga sozinho ou tentou e desistiu.

**MVP:** academias de fitness. Vertical é preset, não código.

---

## 7. Features do MVP

### Bloco 0 — Sprint 0: Segurança e fundação (executa antes de tudo)

- Inventário do MKT v1 existente (`INVENTARIO_MKT_V1.md`)
- Migration rename `academia_config` → `tenant_config`
- HMAC no endpoint `/api/agents/cmo`
- Rate limit por `remotejid` + `tenant_id`
- Idempotência via `evolution_message_id` UNIQUE por tenant
- Consentimento LGPD na primeira mensagem do bot
- Webhook Evolution validado com webhook.site antes de prosseguir
- Sentry configurado
- Pre-commit hook `next build` configurado
- Meta App Review iniciado em paralelo

> Detalhes técnicos, ordem exata, arquivos tocados: **ROADMAP.md Sprint 0**

### Bloco 1 — Fundação existente (não mexer exceto rename)

- Auth + multi-tenant + RLS (SHA 4385514)
- Lead pipeline (SHA 92b59a3)
- Sistema de aprovação batch (SHA 92b59a3)
- `tenant_config` (SHA 4385514)
- `ai_usage_log` + kill switch (SHA 92b59a3)
- Bot CMO: prompt, tools, guardrails (SHA e216238)

### Bloco 2 — Onboarding + Manual de Marca + Banco de Imagens

**Objetivo:** tenant configurado em 8-12 min, IA preenchendo tudo que dá pra inferir.

**Filosofia:** dono digita o mínimo. IA preenche. Dono aprova ou edita. Cada campo manual evitado = redução de churn.

**Fluxo (8 passos):**

1. **Cadastro mínimo** (~30s): nome, email, empresa, cidade, WhatsApp
2. **Vertical** (1 clique): Fitness / Gastronomia / Beleza / Outro → carrega preset
3. **Upload logo**: `node-vibrant` extrai paleta → GPT-4o Vision retorna cores nomeadas, estilo, tipografia → dono confirma primária
4. **Análise de redes**: lê Instagram + site → GPT-4o destila briefing inicial (tom, temas, público, diferencial, frequência) → dono revisa e aprova
5. **Banco de imagens**: dono sobe 10-20 fotos → Vision auto-tagueia → dono revisa
6. **OAuth Meta + Google** (opcional, pula e configura depois)
7. **WhatsApp**: conecta instância Evolution + envia mensagem de teste
8. **Momento "uau"**: IA gera 3 posts iniciais usando briefing + fotos

**Tempo total alvo:** 8-12 minutos.
**Custo IA por tenant:** ~$0.20 (Vision + análises + auto-tag + 3 posts iniciais).

**Presets de vertical (seed data, nunca hardcoded):**

| Vertical | Categorias |
|---|---|
| Fitness | treino, bastidores, equipe, espaço, depoimento, equipamento |
| Gastronomia | pratos, ambiente, equipe, bastidores, eventos |
| Beleza | procedimentos, antes-depois, equipe, ambiente, produtos |
| Genérico | produto, equipe, espaço, bastidores, cliente, evento |

> Schemas `tenant_config.brand_manual` e `banco_imagens`: **ARCHITECTURE.md**
> OAuth Meta + Google (permissões, App Review, criptografia pgsodium): **ARCHITECTURE.md**

### Bloco 3 — Gerador de conteúdo (core do produto)

- GPT-4o gera copy no tom da marca (brand_manual no system prompt)
- Seleciona foto do banco por tag + contexto
- Monta post: foto + copy + CTA + hashtags
- Adapta por plataforma (Instagram feed/story/carousel; Facebook; TikTok)
- Templates HTML/CSS com slots → renderizados (solução em ADR-MKT-003)
- Sugestão de campanha Meta (copy + público + budget + duração, Advantage+ default)
- Preview visual + fila de aprovação
- Vídeos: dono sobe, IA gera legenda + hashtags + melhor horário

**Regra:** IA nunca gera foto do zero. Foto real do banco + overlay via template.

**Bloqueador:** **ADR-MKT-003** (renderização HTML→PNG) precisa fechar antes de codar este bloco.

### Bloco 4 — Publicação

- Camada 1: **Zernio** (1 integração, 15 plataformas, free: 2 contas)
- Camada 2 (fallback): Meta Marketing API + Instagram Graph API direto
- Camada 3 (fallback final): exportar tudo pronto, dono publica manualmente
- Agendamento por melhor horário
- Status no dashboard: publicado / falhou / agendado
- Ads sempre criados **PAUSADOS** — dono ativa manualmente

### Bloco 5 — Bot WhatsApp (Evolution direto) + Google Calendar

**Princípio:** **copia decisões do Green, não código nem infra.** Prompt, guardrails e cenários do Green viram input do `system-prompt.ts` e `guardrails.ts`. **N8N fora** — repetiria 10 anti-padrões + 6 limitações documentadas.

**Arquitetura alto nível:**

```
Evolution API (instância por tenant)
  ↓ webhook POST
/api/agents/cmo (Next.js Edge Runtime — sem cold start)
  ↓ HMAC → persist → LLM + tools → persist → envia
```

- Refactor `app/api/webhooks/evolution/route.ts` → `app/api/agents/cmo/route.ts` em **Edge Runtime**
- Lead convertido entra no pipeline automaticamente
- Remover UI de chat do dashboard (`app/dashboard/conversas/`)
- Follow-up: 2h retomada, 24h msg final
- Heurística de conversa degenerada: N turnos sem tool call de progresso = handoff
- **Google Calendar (Sprint 2.5):** OAuth refresh token por tenant, tool `agendar_aula_experimental`. ADR-MKT-002 antes do código.
- **Whisper (Fase 3.1):** condicional. Gatilho objetivo: % de áudio na instância UNIC >30% nos primeiros 30 dias.

> Detalhes de tools, criptografia de tokens OAuth, contratos de RPC: **ARCHITECTURE.md**

### Bloco 6 — Dashboard ROI

- KPI central: visitas + AEs/semana (número único, em português)
- ROI automático: leads convertidos × mensalidade média − custo campanha
- Botão "confirmar aluno" no dashboard (fecha ciclo sem disciplina manual)
- Insights relativos ao histórico (**nunca threshold fixo hardcoded**)
- Métricas Meta: alcance, impressões, engajamento, CPL, CPC, CTR, gastos
- Relatório semanal automático
- Sugestões de otimização → fila de aprovação

---

## 8. O que NÃO entra no MVP

| Item | Motivo | Quando |
|---|---|---|
| Inteligência competitiva | Alto custo, baixa confiabilidade | Cliente #1 validado 30+ dias |
| Google Ads | Meta converte melhor pra negócio local | Meta estável + 2º tenant |
| Geração de imagem por IA | Inconsistente com marca real | Não previsto |
| Geração de vídeo/motion | Caro, complexo, ROI incerto | Após validar posts estáticos |
| Chat interno no dashboard | 3 tentativas, 0 funcionando | Nunca |
| A/B testing automatizado | Precisa de volume | >100 posts/tenant |
| Multi-idioma | Sem demanda | Cliente fora do BR |
| White-label | Extensão | 10+ clientes |
| Bridge IARA V2 | Integração futura (`pessoas.id` como master) | Cliente comprar os dois |
| Stripe / billing automático | Volume baixo | >5 academias pagantes |
| **N8N** | Repetiria 10 anti-padrões + 6 limitações Green | Reabrir só com evidência objetiva |

---

## 9. Progressão de confiança (campanhas pagas)

| Fase | UX do gestor | Risco |
|---|---|---|
| MVP | Sistema gera pacote pronto. Gestor cola no Ads Manager. | Zero |
| Fase 2 | Sistema cria campanha PAUSADA via API. Gestor vê preview e ativa. | Baixo |
| Fase 3 | Sistema cria e ativa. Kill switch protege. | Médio |

**Travas em todas as fases:** budget cap diário, preview completo, kill switch automático.

**Meta Advantage+:** SaaS configura uma vez com escolhas certas e traduz resultado em português — não reinventa otimização.

**Learning Limited:** alerta relativo ao histórico do tenant — nunca threshold fixo.

---

## 10. Validação com cliente #1

Fitness UNIC como cobaia. Cliente #1, não identidade do produto.

### 10.1. Sprint 0.5 — Dogfooding (obrigatório antes de liberar pra UNIC)

Founder usa o produto inteiro como `tenant_admin` numa academia fictícia ("Academia Demo Juliano") antes do cliente real ver.

**Resolve:** Gap #3 da síntese cross-projeto (nenhum dos 3 projetos teve feedback loop real).

**Tempo:** 1 dia útil. **Critério de avanço:** <5 bugs bloqueantes.

> Checklist completo de 12 itens: **ROADMAP.md §Sprint 0.5**

### 10.2. Milestones pós-liberação

| Semana | Milestone | Métrica |
|---|---|---|
| 1-2 | Onboarding + Manual de marca + 20 fotos | Wizard completo, banco populado |
| 3-4 | Sistema gera 10 posts | 7/10 aprovados sem edição |
| 5-6 | Posts publicados | No ar, engajamento real |
| 7-8 | 2 campanhas Meta sugeridas | 1 campanha gerou leads |
| 9-10 | Bot WhatsApp + Google Calendar | Lead respondido <5 min, AE no calendar |
| 11-12 | Dashboard ROI funcionando | Founder vê KPI + ROI automático |

**Validado:** UNIC usa toda semana sem pedir ajuda, aprova >60% sem editar, 1 campanha gerou leads, pagaria R$297/mês.

**Pivot:** edita >70%, qualidade visual rejeitada, publicação falha >20%, prefere Canva + Ads Manager.

### 10.3. Suporte cliente #1

**Canal direto:** WhatsApp do founder. Pra 1-3 clientes, suficiente.
**FAQ in-app:** página `/ajuda` com 5-10 perguntas frequentes.
**Pra >3 clientes:** migrar pra helpdesk. Não MVP.

---

## 11. Pricing

**R$297/mês por tenant** — cobrança **mensal** (não diária).

**Billing no MVP:** manual (boleto/Pix por fora do app). Stripe entra na Fase 2 quando passar de 5 academias pagantes.

**Pricing pro cliente #1 (UNIC):** decisão pendente — não trava MVP.

**Rascunho de planos (definir antes de lançar comercial):**

| Plano | Posts/mês | Análise | Contas sociais |
|---|---|---|---|
| Básico | 30 | Mensal | 2 |
| Pro | 90 | Semanal | 4 |
| Premium | Sob demanda | Diária | Ilimitado |

> Schema de billing (campos `tenants.subscription_id`, `plan_tier`, `status`, `trial_ends_at`): **ARCHITECTURE.md**

---

## 12. Princípios inegociáveis

| Princípio | Fonte |
|---|---|
| ENGINE_VS_TENANT: engine não conhece nenhum tenant | ADR-MKT-000 |
| Multi-tenant: tenant_id + RLS PERMISSIVE + RESTRICTIVE | ADR-MKT-001 |
| RPC usa `fn_tenant_id()`, nunca JWT direto | CLAUDE.md |
| Secrets só em env, nunca em código | CLAUDE.md |
| Persistir antes de enviar (banco antes de API externa) | Cross-projeto |
| Guardrails em código, não no prompt | Cross-projeto |
| HMAC em todo webhook externo | Cross-projeto |
| Budget cap com kill switch automático | MKT v1 |
| Rate limit por `remotejid` + `tenant_id` | Cross-projeto |
| Bot copia decisões do Green — não código, não infra (N8N fora) | Cross-projeto + ADR-MKT-005 |
| Tokens OAuth criptografados via pgsodium | ARCHITECTURE |
| Erro em produção = evento Sentry, não inferência manual | CLAUDE.md |
| `next build` local antes de push (pre-commit obrigatório) | AP-011 V2 |

> Anti-padrões técnicos com enforcement, regras pro Code, paralelismo de chats: **CLAUDE.md**

---

## 13. Anti-padrões (não repetir)

**Técnicos** — detalhe e enforcement em CLAUDE.md:
identidade de tenant em código compartilhado, migration editada, query sem tenant_id, deploy ✅ sem Sentry, push sem `next build` local, schema assumido sem `SELECT * FROM tabela LIMIT 5`.

**Estratégicos:**
- Chat interno no SaaS (3 tentativas falhas)
- Romantizar feature sem validar viabilidade técnica
- Depender de API sem fallback manual
- Prometer automação total sem progressão de confiança
- IA gerando imagem do zero
- Vertical como identidade do engine
- Google Ads antes de Meta estável
- Trazer código OU infra do Green (N8N) sem evidência objetiva nova

**Produto:**
- Bot propondo conversão >2x na mesma conversa (limite em código)
- Listar opções como menu numerado (1 caminho com convicção)
- Insights com threshold fixo hardcoded (sempre relativo ao histórico real)
- Onboarding >12 min ou >3 campos manuais por passo

**Gatilhos pra reabrir decisão fechada:**
- N8N: só se evidência objetiva mostrar limitação irresolvível em Next.js direto
- Vercel Pro: se Edge Runtime esbarrar em limitação de lib usada pelo bot
- Cloud Run próprio pra renderização: se Browserless custar >$200/mês ou tiver outage recorrente

---

*Documento fechado. Base para ARCHITECTURE.md, DOMAIN.md, CLAUDE.md, ROADMAP.md, ADR-MKT-001 (v2), ADR-MKT-003 (renderização), ADR-MKT-005 (Evolution direto).*
