# PRD — marketing-saas
> Versão 1.0 — 18/mai/2026

## Problema

Academias de pequeno e médio porte não têm budget para contratar um Diretor de Marketing. O resultado é presença digital fraca, leads que esfriam no WhatsApp e campanhas genéricas sem foco local.

## Solução

SaaS que atua como CMO autônomo 24/7: automatiza tráfego local, criação de conteúdo e atendimento a leads via IA.

## Personas

| Persona | Perfil | Dor principal |
|---|---|---|
| **Dono de academia** | 35-55 anos, não é dev, opera 1 unidade | Não tem tempo nem conhecimento para fazer marketing |
| **Franqueado** | Opera 2-5 unidades | Precisa de consistência de marca + escala |
| **Gestor de marketing** | Contratado pela academia | Quer ferramentas que automatizem o operacional |

## O que o produto faz (MVP)

1. **Tráfego local** — campanhas Google e Meta focadas em raio de 5km
2. **Conteúdo** — transforma vídeo bruto do celular em post com copy, hashtags e estratégia
3. **Atendimento** — agente WhatsApp que agenda aula experimental em < 5 minutos
4. **Inteligência competitiva** — monitora anúncios dos concorrentes locais e aponta brechas

## O que NÃO entra no MVP

- Integração com IARA Systems (bridge futura via `tenant_id` compartilhado)
- Portal do aluno
- Relatórios avançados com ML
- Multi-unidade (franqueado com > 1 CNPJ)
- App mobile

## Métricas de sucesso do MVP

| Métrica | Meta |
|---|---|
| Tempo de resposta a lead (WhatsApp) | < 5 minutos |
| Custo por lead gerado | < R$ 15 |
| Taxa de agendamento de AE | > 30% dos leads |
| Retenção mensal (churn) | < 5% |

## Arquitetura — decisão canônica

- **Multi-tenant desde o dia 1:** toda tabela tem `tenant_id NOT NULL`
- **Isolamento por RLS:** Academia A nunca acessa dados da Academia B
- **Bridge futura com IARA:** campo `iara_tenant_id` nullable em `tenants` — ativa quando cliente compra os dois produtos
- **Cérebro separado:** prompts, templates e memória de agentes vivem no repo `marketing-brain`, não aqui

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 App Router + TypeScript + Tailwind |
| Backend | Next.js API Routes + Supabase Edge Functions |
| Banco | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth |
| IA | OpenAI GPT-4o (operação) |
| WhatsApp | Evolution API V2 |
| Deploy | Vercel |
| CI/CD | GitHub Actions |

## Tiers do produto

| Tier | Academias-alvo | Limite |
|---|---|---|
| **Starter** | 1 unidade, < 200 alunos | 1 tenant |
| **Pro** | 200-500 alunos | 3 tenants |
| **Enterprise** | Redes e franquias | Ilimitado |
