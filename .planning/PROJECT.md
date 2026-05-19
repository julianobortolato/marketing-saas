# marketing-saas

## What This Is

SaaS que age como CMO autônomo 24/7 para academias de pequeno e médio porte. Automatiza tráfego local (Google/Meta), criação de conteúdo a partir de vídeo bruto, atendimento a leads via WhatsApp e inteligência competitiva sobre concorrentes do bairro. Primeiro cliente: a própria academia do fundador.

## Core Value

Campanhas Google/Meta rodando com raio de 5km sem que o dono da academia precise abrir um Ads Manager — leads chegam, o sistema trata.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Dono pode cadastrar sua academia (DNA: nome, bairro, tom de voz, diferenciais, planos, horários)
- [ ] Autenticação multi-tenant com isolamento por RLS (academia A nunca vê dados da B)
- [ ] Dono conecta conta Google Ads e Meta Business e aprova campanhas antes de publicar
- [ ] Sistema gera criativos de campanha a partir do DNA da academia
- [ ] Campanha local roda com segmentação de raio de 5km automaticamente
- [ ] Lead capturado via Meta Lead Form ou WhatsApp aparece no pipeline com status
- [ ] Agente WhatsApp responde lead em < 5 min e oferece agendamento de AE
- [ ] Dono sobe vídeo bruto; sistema gera post com copy, hashtags e estratégia por canal
- [ ] Painel mostra leads capturados, status e taxa de agendamento de AE
- [ ] Sistema monitora anúncios dos concorrentes locais e sinaliza brechas de oferta

### Out of Scope

- Integração com IARA Systems — bridge futura via `iara_tenant_id` nullable (campo existe, lógica não)
- Portal do aluno — foco é o dono/gestor, não o aluno
- Relatórios com ML — analytics simples são suficientes para MVP
- Multi-unidade (franqueado com > 1 CNPJ) — Tier Enterprise, pós-MVP
- App mobile — web-first
- repo `marketing-brain` — repo separado, não entra neste workspace

## Context

- **Primeiro cliente:** própria academia do fundador (fitnessacademia.com.br) — teste com dados reais desde o início
- **Evolution API:** já disponível e validada em produção no IARA Systems — pode ser reutilizada para o WhatsApp agent
- **APIs de Ads:** Meta Marketing API e Google Ads API ainda não têm acesso aprovado — processos de aprovação devem ser iniciados em paralelo ao desenvolvimento
- **Bloqueio previsível:** Meta API review pode levar semanas — tráfego local (core value) ficará atrás de WhatsApp + conteúdo no roadmap por isso
- **Sem equipe:** projeto solo — decisões de scope devem priorizar entrega enxuta
- **Timeline:** 2-4 semanas para ter algo funcionando na academia própria

## Constraints

- **Tech Stack:** Next.js 14 App Router + TypeScript + Supabase + Vercel — não negociável
- **Multi-tenant:** `tenant_id NOT NULL` em toda tabela + RLS obrigatória desde a fase 1
- **IA:** OpenAI GPT-4o direto via API Routes (sem LangChain, sem framework de agentes no MVP)
- **WhatsApp:** Evolution API V2, instância por tenant
- **Segurança:** service role key nunca no cliente; webhooks validam assinatura antes de processar
- **Custo de IA:** rate limit de 10 req/min por `tenant_id` em endpoints IA

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-tenant via RLS (não schemas separados) | Operação mais simples, migrations únicas | — Pending |
| Cérebro separado (marketing-brain) em repo próprio | Atualização editorial sem deploy de código | — Pending |
| `iara_tenant_id UUID NULL` na tabela tenants | Integração futura é extensão, não refatoração | — Pending |
| Evolution API V2 por tenant | Já validado em produção no IARA | — Pending |
| OpenAI direto sem middleware de agentes | Menos abstração = menos bugs no MVP | — Pending |
| Foundation antes das integrações de Ads | Meta/Google API approvals demoram; WhatsApp e conteúdo entram primeiro | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-18 after initialization*
