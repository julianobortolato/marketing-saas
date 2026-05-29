# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com).

## [2026-05-29] fix-onboarding-validacao (2/2) — SHA 283c0e7

### Fixed
- `app/onboarding/[passo]/step4.tsx`: campos `publico_descricao` e `diferencial` usavam `{...register()}` com `Textarea` sem `React.forwardRef` — em React 18, `ref` é interceptado pelo React antes de chegar ao componente; `reValidateMode: 'onChange'` não disparava após submit; substituídos por `Controller` (modo controlado `value`+`onChange`, sem dependência de ref)

---

## [2026-05-29] fix-onboarding-validacao (1/2) — SHA 9204260

### Fixed
- `app/onboarding/[passo]/step1.tsx`: campo `nome_dono` ausente de `defaultValues` — iniciava como `undefined`; Zod emitia "Required" no submit sem o campo ter sido tocado
- `app/onboarding/[passo]/step4.tsx`: `frequencia` defaultValue usava `as EnumType` sem runtime check — se banco enviasse valor fora do enum (ex: `'mensal'`), form iniciava inválido silenciosamente; substituído por whitelist explícita `['diaria','3x_semana','semanal','quinzenal'].includes(val ?? '') ? val : '3x_semana'`
- `app/onboarding/[passo]/step4.tsx`: `errors.frequencia` nunca renderizado na UI — falha de validação era completamente silenciosa para o usuário
- `app/onboarding/[passo]/step4.tsx`: `addTag` em `palavras_preferidas`/`palavras_a_evitar` usava `setValue` sem `{ shouldValidate: true, shouldDirty: true }` — erro persistia após adicionar/remover tag mesmo com valor válido

---

## [2026-05-29] fix-onboarding-logo-step4 — SHA 9005b42

### Changed
- `app/api/onboarding/logo/route.ts`: substituiu `colorthief` por `node-vibrant` (`import { Vibrant } from 'node-vibrant/node'`) — colorthief retornava formato inconsistente no Node.js runtime; palette agora vem de `Object.values(palette).filter(Boolean).map(s => s.hex)`

### Fixed
- `app/api/onboarding/logo/route.ts`: `ColorThief.getPalette` podia retornar `null` ou objetos `{r,g,b}` em vez de arrays `[r,g,b]` — causava `TypeError: object is not iterable` (Symbol.iterator) e `TypeError: Cannot read properties of undefined (reading 'toString')`
- `app/onboarding/[passo]/step4.tsx`: campo `tom` não atualizava o estado do formulário após clique — `Controller`+`field.onChange` não re-validava em `mode: 'onSubmit'`; substituído por `setValue('tom', t, { shouldValidate: true, shouldDirty: true })` + `watch('tom')`
- `app/onboarding/[passo]/step4.tsx`: `defaultValues.tom` aceitava string inválida do banco (ex: `''`) via cast `as EnumType` — substituído por whitelist explícita `['formal','neutro','coloquial'].includes(val) ? val : 'neutro'`
- `app/onboarding/[passo]/step4.tsx`: `errors.tom` nunca exibido na UI (display ausente) — adicionado `{errors.tom && <p>{errors.tom.message}</p>}`
- `app/onboarding/[passo]/step4.tsx`: `toggleTema` usava `setValue` sem `{ shouldValidate: true }` — erro "Selecione ao menos 1 tema" persistia mesmo após clicar

### Added
- `node-vibrant@^4.0.4` em `package.json`

---

## [2026-05-29] diagnostico-autonomo — SHA a4bb823

### Fixed
- `lib/agents/gerador.ts`: paths `brand_manual.identidade_visual.*` eram inválidos — JSONB usa `brand_manual.visual.*`. Posts gerados usavam cor #7B61C4, fonte Plus Jakarta Sans e logo placeholder em vez da identidade do tenant
- `lib/agents/gerador.ts`: removida seleção da coluna `logo_url` de `tenant_config` (coluna existe mas nunca foi escrita); logo agora lida de `brand_manual.visual.logo_url`
- `app/onboarding/[passo]/step3.tsx`: `try/finally` sem `catch` em `handleFile` silenciava erros de rede — upload falhava sem feedback ao usuário
- `app/onboarding/[passo]/step5.tsx`: mesmo padrão `try/finally` sem `catch` em `handleFiles` corrigido

---

## [2026-05-28] webhook-zernio-registro — SHA de48ba8

### Fixed
- `app/api/webhooks/zernio/route.ts`: campo `postId` estava errado — payload real do Zernio usa `payload.post.id` (aninhado), não `payload.postId` (top-level). Causaria `400 missing_postId` em 100% dos callbacks reais
- `app/api/webhooks/zernio/route.ts`: campo `reason` em `post.failed` não existe no top-level — coletado de `post.platforms[].error` e concatenado com `join('; ')`

### Added
- `ZERNIO_WEBHOOK_SECRET` gerado e salvo em `.env.local` (`openssl rand -hex 32`)
- Webhook registrado no Zernio via `POST /v1/webhooks/settings` — ID `6a189ee88fd02c0071c7d8a5`, eventos `post.published` + `post.failed`, URL produção Vercel

---

## [2026-05-27] Fase 5 bugfix — SHA f339db1

### Fixed
- `tenant_config.logo_url` ausente: PostgREST retornava 400 → `config = null` → erro falso "brand_manual ausente" mesmo com coluna preenchida
- `lib/agents/gerador.ts` — captura `configError` e loga via `console.error` para rastreabilidade em produção

### Added
- `supabase/migrations/20260527163000_tenant_config_logo_url.sql` — `ADD COLUMN IF NOT EXISTS logo_url TEXT` em `tenant_config`

---

## [2026-05-27] Fase 5.1→5.4 — SHA 1125fbe

### Added
- Tabela `conteudos` (renomeada de `posts`) com RLS dual + indexes + trigger `fn_set_atualizado_em`
- Tabela `prompts_agentes` com RLS, partial indexes e seed `gerador_copy v1` (engine scope)
- Colunas `ia_pausado` e `owner_email` em `tenants`
- FK `aprovacoes.referencia_id → conteudos.id`
- 9 fontes estáticas WOFF/TTF em `public/fonts/` (Plus Jakarta Sans, Inter, Playfair Display, Bebas Neue, Lora)
- `lib/render/fonts.ts` — helper `carregarFontes()` para Satori Edge Runtime
- `lib/render/templates/` — 3 templates JSX clean/minimalista: feed (1080×1080), story (1080×1920), carousel (1080×1080)
- `lib/render/templates/types.ts` — contrato `TemplateSlots` + `FormatoTemplate`
- `lib/agents/gerador.ts` — pipeline GPT-4o: brand_manual → copy → seleção foto por tags → render → Storage → INSERT conteudos
- `/api/posts/render` — rota Edge Runtime com `@vercel/og`, modos `html` (legado) e `template`
- `/api/cron/gerar-posts` — Node Runtime, auth Bearer CRON_SECRET, loop multi-tenant, notificação Resend
- `vercel.json` — cron toda segunda-feira 11:00 UTC (08:00 BRT)
- Bucket `posts` no Supabase Storage (público, uploads protegidos por RLS)
- `tests/smoke/render.sh` — validação magic bytes PNG + latência <10s
- `tests/smoke/pipeline.sh` — validação auth 401 + pipeline 200

### Changed
- `/api/posts/render` estendido com `discriminatedUnion` — modo `template` com slots JSX
- `getWeeklyOrganicBatch()` estendida com JOIN `conteudos` via `referencia_id`
- `app/dashboard/aprovacoes/page.tsx` — tabela de IDs substituída por grid de `PostCard` com preview PNG + copy + ações individuais
- `BatchApproval` mantido como ação de lote complementar

### Fixed
- `OpenAI` client movido do module scope para dentro de `gerarPostSemanal()` — corrige 500 em prod (module scope lançava antes de env var estar disponível)
- `Resend` inicializado dentro do handler (mesmo padrão)
- `.eq('aprovada', true)` em `banco_imagens` (não `ativo`)

### Security
- RLS RESTRICTIVE em `conteudos` e `prompts_agentes` com padrão canônico `TO authenticated + tenant_id IS NOT NULL AND`
- Partial indexes em `prompts_agentes` para unicidade correta com NULL em `tenant_id`
- Upload Storage em path `<tenant_id>/` — namespacing por tenant

### Deprecated
- `ADR-MKT-001-agente-whatsapp.md` — renomear para `ADR-MKT-001-DEPRECATED-agente-whatsapp.md` (débito Sprint 0, ainda pendente)

---

## Anti-padrões registrados nesta sessão

- AP-RENDER-001: Variable fonts TTF do google/fonts causam TypeError no Satori 0.25.0 → usar WOFF estático via @fontsource
- AP-RENDER-002: `{expressão} + texto` em JSX Satori gera dois filhos em div sem `display:flex` → concatenar em string
- AP-RUNTIME-001: Instanciar clients de API (OpenAI, Resend) no module scope em Node/Edge Runtime → sempre dentro do handler

---

## [2026-05-26] sprint-0-fundacao-segura — SHA 9984cf8

### Added
- `verifyWebhookSignature` migrado para Web Crypto API (async) — compatível com Edge Runtime
- `export const runtime = 'edge'` em `/api/webhooks/evolution` e `/api/agents/cmo`
- `/api/agents/cmo/route.ts` — path canônico do agente CMO (gradual rename)
- `supabase/migrations/20260527000001_rename_academia_to_tenant.sql` — rename + view de compat (SUNSET Sprint 1)
- `supabase/migrations/20260527000002_conversas_lgpd_aceito.sql` — `conversas.lgpd_aceito BOOLEAN`
- `supabase/migrations/20260527000003_bridge_iara_v2.sql` — índice parcial `idx_tenants_iara_bridge`
- Sentry `@sentry/nextjs` via `instrumentation.ts` (padrão Next.js 14 App Router)
- Husky pre-commit: `npm run build` bloqueia commit com erro de tipo

### Changed
- `academia_config` → `tenant_config` em todo o código (grep-zero verificado)
- `LGPD_aceito` movido para `conversas` (por conversa) em vez de `chat_messages` (por mensagem)
- `next.config.js` agora usa `withSentryConfig` wrapper

### Security
- Edge Runtime elimina cold start e alinha com ADR-MKT-005 §3 (4 peças que viabilizam Evolution→Next.js direto)
- HMAC via `crypto.subtle.verify` (constant-time) substitui `timingSafeEqual` de `node:crypto`

## [2026-05-26] docs-canonicos-prisma-v1 — SHA 2e12be2

### Added
- `docs/ARCHITECTURE.md`: arquitetura v1.0 do Prisma (stack, estrutura de pastas, padrões de multi-tenancy)
- `docs/DOMAIN.md`: domínio do negócio v1.0 (fitness, fluxos, perfis de usuário)
- `docs/ROADMAP.md`: roadmap v1.0 (6 fases Vertical MVP)
- `docs/PRD.md`: PRD v2.4 (requisitos funcionais e não-funcionais)
- `.adrs/ADR-MKT-001.md`: ADR agente WhatsApp v1.0 canônico
- `.adrs/ADR-MKT-003.md`: ADR modelo de dados v1.0
- `.adrs/ADR-MKT-005.md`: ADR orquestração v1.0 (sem N8N/Make/Zapier)
- `.adrs/ADR-MKT-006.md`: ADR engine vs tenant v1.0

### Changed
- `CLAUDE.md`: substituído por versão v1.0 canônica — produto Prisma documentado, seção de execução autônoma expandida (mapa 1.5 quem-executa-o-quê), MCP-first, guardrails e HMAC como seções dedicadas

---

## [2026-05-23] wave3-cutover-auth — SHA 319f543

### Changed
- Webhook `/api/webhooks/evolution` aceita 3 paths de autenticação em ordem de prioridade: HMAC `x-hub-signature-256` (smoke tests), `Authorization: Bearer <secret>` (fallback), `?secret=` query param na URL (Evolution V2 — único path que persiste)
- `EVOLUTION_WEBHOOK_SECRET` rotacionado em Vercel Production, `.env.smoke`, e `evolution_instances.webhook_secret`

### Security
- Secret rotacionado preventivamente após exposição em ambiente de desenvolvimento

---

## [2026-05-21] wave3-task5-uat — SHA 32192b1

### Added
- Campo de resposta manual no rodapé de `/dashboard/conversas/[id]` (só aparece quando `ia_ativa=false`)
- `enviarMensagemManual` server action: persist-before-send via `rpc_persistir_resposta_bot` + Evolution API send + `status_envio` enviada/falhou
- `ManualReplyForm` Client Component: textarea + botão Enviar, Enter para enviar, Shift+Enter para nova linha

### Changed
- `conversa-actions.tsx`: `useState` local para update otimista do botão Assumir/Reativar — `router.refresh()` passa a ser sincronização de background, não fonte de verdade da UI
- `editorial/actions.ts`: `upsert` → `update(.eq tenant_id)` — evita `NOT NULL` em `nome_academia` ao editar colunas editoriais parciais

### Fixed
- Botão "Reativar IA" permanecia em estado Reativar após clicar (props do Server Component não atualizavam Client Component de forma síncrona via `router.refresh()` sozinho)
- `saveEditorialConfig` falhava com `NOT NULL constraint on nome_academia` em tenant sem academia_config row completo
- Script `"test"` ausente no `package.json` (vitest rodava smoke tests junto com unit tests sem `.env.smoke`)

### Gates passados
- 56/56 unit tests passando
- `next build` limpo
- UAT Phase 3: testes 1–8 passados; testes 9–11 (live traffic) aguardando cutover Stage 1

---

## [2026-05-21] Wave3-Tasks1-3 — SHA e216238

### Added
- Smoke suite 25 testes cobrindo ADR-MKT-001 §11 (webhook, kill switch, handoff, idempotência, HMAC, lead novo)
- 3 helpers reutilizáveis em tests/smoke/helpers/
- .identity-leak-report.json gerado automaticamente pelo smoke (gate ENGINE_VS_TENANT)
- evolution_instances seed para Fitness UNIC (instance_name=iara_v2_staging, webhook_secret configurado)
- Deploy Production em marketing-saas-nu.vercel.app com 8 env vars configuradas

### Fixed
- Seed trigger-aware (respeitando triggers de banco ao popular dados de teste)
- Grants ai_usage_* (permissões faltando nas tabelas de auditoria)
- Handoff pre-LLM (guardrail de desconto acionado antes da chamada OpenAI)

### Security
- Gate de contraste tenant Vértice aprovado: 10/10 conversas sem vazamento de identidade UNIC

---

## [2026-05-20] Fase 3 Sprint 1 — Schema WhatsApp + IA (migrations 0006–0010)

### Added
- `supabase/migrations/20260520000006_academia_config_fase3.sql`: ALTER TABLE academia_config — colunas caderno editorial (`argumentos_venda`, `objecoes_comuns`, `palavras_proibidas`, `gatilhos_handoff`, `persona_cmo`), tema visual (`tema JSONB`) e `atualizado_em` com trigger
- `supabase/migrations/20260520000007_create_whatsapp_tables.sql`: tabelas `evolution_instances`, `conversas`, `chat_messages` com RLS PERMISSIVE+RESTRICTIVE e índices parciais
- `supabase/migrations/20260520000008_tenants_ia_budget.sql`: ALTER TABLE tenants — colunas IA budget (`ia_habilitada`, `ia_limite_diario_usd`, `ia_desabilitada_em`, `ia_desabilitada_motivo`)
- `supabase/migrations/20260520000009_ai_usage_tables.sql`: tabelas `ai_usage_log`, `ai_usage_diario` e trigger `fn_acumular_uso_ia` com kill switch automático por tenant
- `supabase/migrations/20260520000010_whatsapp_functions.sql`: RPCs SECURITY DEFINER — `fn_tenant_id_by_evolution_instance`, `rpc_persistir_mensagem_entrada` (idempotente), `rpc_persistir_resposta_bot`, `rpc_registrar_uso_ia`, `rpc_atualizar_score_lead`, `rpc_handoff_humano`

### Gates passados
- ✅ Todas as 5 migrations aplicadas via `supabase db push`
- ✅ RLS habilitada em todas as 5 tabelas novas
- ✅ PERMISSIVE (SELECT) + RESTRICTIVE (ALL) em cada tabela
- ✅ 7 colunas novas em academia_config confirmadas
- ✅ 4 colunas IA em tenants confirmadas
- ✅ 8 funções/RPCs SECURITY DEFINER confirmadas

---

## [2026-05-20] canônicos pós ENGINE_VS_TENANT — SHA a7b37f8

### Added
- `.adrs/ADR-MKT-001-agente-whatsapp.md`: ADR completo da Fase 3 commitado no repo (schema DDL, RPCs, tools, guardrails, observability)

### Changed
- `DOMAIN.md`: DNA da academia registra `tema` JSONB como tenant content — nunca em código
- `ARCHITECTURE.md`: estrutura de pastas documenta `docs/principles/` e `.adrs/`; ADR-006 engine vs tenant adicionada; schema `academia_config` ganha coluna `tema JSONB`

---

## [2026-05-20] ENGINE_VS_TENANT principle + ADR-MKT-000 — SHA 7f066b7

### Added
- `docs/principles/ENGINE_VS_TENANT.md`: princípio universal de separação engine vs tenant — regras mecânicas, exemplos de código, anti-padrões históricos, critérios de exceção
- `.adrs/ADR-MKT-000.md`: aplicação do princípio ao marketing-saas — modelo B parcial, exceções aceitas com gatilho objetivo, violação ativa documentada

### Changed
- `CLAUDE.md` seção "Identidade visual": prescrição de tokens UNIC como design system do engine removida; substituída por modelo B parcial com `academia_config.tema` como fonte de verdade em runtime

---

## [2026-05-19] Fase 2 — Lead Pipeline + Aprovacoes — SHA 92b59a3

### Added
- Tabela `leads` com RLS dual-policy (PERMISSIVE + RESTRICTIVE) e GRANTs explícitos
- Tabela `aprovacoes` com RLS dual-policy e GRANTs explícitos
- Webhook `POST /api/webhooks/leads` com validação HMAC-SHA256 e mapeamento tenant por token
- `/dashboard/leads` — pipeline visual com filtros por status/canal/data, criação manual e mudança de status inline
- `/dashboard/aprovacoes` — fila semanal com cap de 10 posts orgânicos, aprovação/rejeição em lote
- Gate `assertCampaignApproved` para campanhas pagas (APROV-02)
- Viewer role: sem botão "Novo lead" e sem dropdowns de ação em `/dashboard/leads` e `/dashboard/aprovacoes`

### Security
- Webhook valida assinatura antes de processar payload (anti-padrão do CLAUDE.md respeitado)
- `tenant_id` derivado do token de webhook — nunca do payload externo
