# CLAUDE.md — marketing-saas
> Instruções para o agente Code. Ler antes de qualquer ação.
> Versão 1.2 — 20/mai/2026

## Contexto do projeto

SaaS de marketing autônomo para academias. CMO IA 24/7.
Stack: Next.js 14 App Router + Supabase + Evolution API + OpenAI + Vercel.
**Primeiro cliente:** Fitness UNIC (fitnessacademia.com.br) — academia do fundador.

## Identidade visual

O SaaS é multi-tenant. **Não existe uma "marca do produto" hardcoded em código** — toda
identidade visual (cores, tipografia, logo) é configurada por tenant.

### Onde mora a configuração de tema

Tema visual vive nas colunas `academia_config.tema_*` (paleta, tipografia, URL do logo,
slogan). Migration que cria essas colunas faz parte do Sprint 1 (mesmo que a UI só
consuma no Sprint 3 — schema pronto antes da primeira tela).

### Tenant seed: Fitness UNIC

O primeiro tenant é a Fitness UNIC, cliente piloto. As cores, tipografia e elementos
visuais documentados em `Manual Identidade Visual.md` (ou caminho equivalente) são
**dados de seed** desse tenant — não constantes do produto. Esses valores são inseridos
em `academia_config` no provisionamento da UNIC, exatamente como serão inseridos os
valores da próxima academia, da próxima, e assim por diante.

### Como componentes consomem tema

Componentes compartilhados (`components/`) **nunca** referenciam valor de tenant
direto. Padrão obrigatório:

- CSS variables carregadas no boot da rota `(dashboard)/[tenant_slug]/...` a partir
  de `academia_config.tema_*`
- Componentes consomem via `var(--brand-primary)`, `var(--font-display)` etc.
- Tema fallback (para rotas públicas pré-login) é um tema neutro do produto, não as
  cores de nenhum tenant específico

### Anti-padrões — PR rejeitada

| Padrão proibido | Substituto correto |
|---|---|
| `bg-[#E30613]` ou qualquer hex de tenant em componente | `bg-[var(--brand-primary)]` |
| `font-family: 'Fonte-da-UNIC'` em CSS global | `font-family: var(--font-display)` |
| Import direto de logo de tenant em componente | `<img src={tenant.logo_url} />` |
| String "Fitness UNIC" hardcoded em copy de UI compartilhada | `{tenant.nome}` resolvido em runtime |
| Constante "neutra" com valor de tenant: `export const COR_PADRAO = '#E30613'` | Mover para `academia_config.tema_primary` |

### Princípio fundante

Esta seção operacionaliza o princípio universal `docs/principles/ENGINE_VS_TENANT.md`
aplicado no `.adrs/ADR-MKT-000-engine-vs-tenant.md`. Em caso de dúvida sobre se algo
pertence a `lib/` ou a `academia_config`, ler primeiro o princípio.

Teste mental: substituir "Fitness UNIC" por "Academia Genérica X". Se o componente
quebra, fica estranho, ou perde sentido visual — há vazamento de identidade Camada 1,
PR rejeitada.

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
