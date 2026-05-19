# CLAUDE.md — marketing-saas
> Instruções para o agente Code. Ler antes de qualquer ação.
> Versão 1.1 — 19/mai/2026

## Contexto do projeto

SaaS de marketing autônomo para academias. CMO IA 24/7.
Stack: Next.js 14 App Router + Supabase + Evolution API + OpenAI + Vercel.
**Primeiro cliente:** Fitness UNIC (fitnessacademia.com.br) — academia do fundador.

## Identidade visual

**Fonte de verdade:** `Downloads/Marketing SaaS/Manual Identidade Visual Fitness UNIC _LOGO E CORES.md`

O SaaS usa a identidade visual da Fitness UNIC — não há marca separada ("Prisma" é referência de outro projeto, ignorar).

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#E30613` | CTAs, botões de ação, bordas de destaque |
| `--color-bg` | `#FFFFFF` | Fundo principal |
| `--color-surface` | `#F8FAFC` | Cards, painéis |
| `--color-text` | `#0F172A` | Texto principal |
| `--color-muted` | `#64748B` | Labels, textos secundários |
| `--color-border` | `#E2E8F0` | Bordas e divisores |

**Regra 60-30-10:** 60% branco/cinza-gelo · 30% cinza médio/neutro · 10% vermelho `#E30613`
**Fontes:** sans-serif moderna (Inter ou Geist) — títulos em maiúsculas bold, textos em normal
**Estilo:** Clean & Powerful — vermelho aparece só em CTAs e destaques, nunca como fundo extenso

## Regras inegociáveis

### Multi-tenant
- TODA tabela tem `tenant_id UUID NOT NULL`
- TODA query filtra por `tenant_id` — sem exceção
- RLS obrigatória: política PERMISSIVE + RESTRICTIVE em toda tabela
- RPC sensível: sempre `SECURITY DEFINER` + revalidar `tenant_id` internamente

### Banco
- `SELECT * FROM tabela LIMIT 5` ANTES de qualquer DDL ou INSERT
- Schema antes de código — nunca assumir estrutura de memória
- Migrations: arquivo novo em `supabase/migrations/` — nunca editar migration existente
- `fn_tenant_id()` e `fn_usuario_id()` em RPCs — nunca JWT direto

### Next.js
- `next build` local antes de push — `tsc --noEmit` não detecta ESLint
- `rm -rf .next` obrigatório ao copiar componente de outro projeto
- Server Components por padrão — `'use client'` só quando necessário
- Variáveis de ambiente públicas: `NEXT_PUBLIC_` prefix obrigatório

### Segurança
- Service role key: JAMAIS em componente cliente ou exposto em log
- Webhooks externos: validar assinatura ANTES de processar payload
- Secrets no chat: nunca. Header CAPS LOCK antes de qualquer bloco com token

### Código
- Blocos copy-paste prontos — sem placeholders soltos
- Placeholder obrigatório: `<COLE_AQUI>` + instrução de onde achar
- TypeScript strict — sem `any` sem justificativa
- Comentários só onde a intenção não é óbvia pelo código

## Anti-padrões proibidos

- Query sem `tenant_id` no WHERE
- `auth.jwt() ->> 'tenant_id'` direto em RPC (retorna null silenciosamente)
- INSERT direto do cliente em tabela sensível
- `console.log` com dados de aluno ou token em produção
- Assumir que `vercel env pull` traz CRON_SECRET ou OPENAI_API_KEY (não traz)

## Estrutura de pastas

Ver ARCHITECTURE.md — seção "Estrutura de pastas".

## Checklist antes de push

```
□ next build local passou sem erro?
□ Toda nova tabela tem tenant_id + RLS?
□ Toda nova RPC usa fn_tenant_id()?
□ Secrets fora do código?
□ Migration em arquivo novo (não editou existente)?
□ git push executado e SHA confirmado?
```

## Variáveis de ambiente necessárias

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # nunca expor no cliente

# OpenAI
OPENAI_API_KEY=                     # não desce via vercel env pull

# Evolution API
EVOLUTION_API_URL=
EVOLUTION_API_KEY=

# Crons
CRON_SECRET=                        # var de sistema Vercel — não desce via pull

# Opcional — bridge IARA
IARA_SUPABASE_URL=
IARA_SERVICE_ROLE_KEY=
```

## GSD Workflow

Este projeto usa Get Shit Done (GSD) para planejamento e execução.

**Artefatos de planejamento:** `.planning/`
- `PROJECT.md` — contexto e decisões do projeto
- `REQUIREMENTS.md` — 21 requisitos v1 com REQ-IDs
- `ROADMAP.md` — 6 fases, modo Vertical MVP
- `STATE.md` — estado atual e progresso
- `config.json` — preferências de workflow (modo: interactive, granularity: standard)

**Comandos GSD:**
- `/gsd:discuss-phase N` — discutir abordagem antes de planejar
- `/gsd:plan-phase N` — criar plano de execução para a fase N
- `/gsd:execute-phase N` — executar o plano
- `/gsd:verify-work` — verificar se entregáveis batem com os critérios
- `/gsd:progress` — ver estado atual do projeto

**Regras GSD para este projeto:**
- Antes de qualquer fase: ler `ROADMAP.md` e `REQUIREMENTS.md` para confirmar escopo
- Commits atômicos por tarefa — nunca batch de mudanças não relacionadas
- Fase só é "completa" quando todos os Success Criteria são verdadeiros, não quando as tarefas estão feitas
- Fase 4 (Conteúdo): CONT-01..03 podem ser entregues sem CONT-04 se Meta Graph API ainda não aprovada
