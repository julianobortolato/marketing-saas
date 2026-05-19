---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None instalado ainda — Wave 0 deve adicionar |
| **Config file** | `jest.config.ts` (Wave 0 gap) |
| **Quick run command** | `npm test -- --testPathPattern=<file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (build) |

> Phase 1 usa `next build` + smoke tests manuais como gates principais.
> Jest completo é diferido: não há lógica de negócio pura que se beneficie de unit tests além do que TypeScript + build já valida.

---

## Sampling Rate

- **Após cada commit de tarefa:** `next build` deve passar sem erros
- **Após cada wave:** `next build` + smoke manual dos 4 critérios de sucesso
- **Antes de `/gsd:verify-work`:** build verde + todos os 4 critérios atendidos via smoke manual
- **Max feedback latency:** ~60 seconds (build local)

---

## Per-Task Verification Map

| Req ID | Comportamento | Tipo | Comando / Instrução | Arquivo existe? | Status |
|--------|--------------|------|---------------------|----------------|--------|
| FOUND-01 | Usuário faz signup e sessão persiste no reload | smoke manual | Fazer signup → recarregar página → verificar que continua logado | N/A | ⬜ |
| FOUND-01 | Middleware redireciona unauthenticated de /dashboard para /login | smoke manual | Acessar /dashboard sem login → verificar redirect | N/A | ⬜ |
| FOUND-02 | Signup cria linha em tenants + usuarios (role=owner) | smoke + SQL | `SELECT * FROM tenants; SELECT * FROM usuarios;` no Supabase SQL editor | N/A | ⬜ |
| FOUND-02 | fn_calcular_mensalidade() retorna número | SQL | `SELECT fn_calcular_mensalidade('<tenant_uuid>');` no SQL editor | N/A | ⬜ |
| FOUND-03 | Formulário DNA salva e recarrega valores persistidos | smoke manual | Preencher DNA → salvar → recarregar página → verificar campos | N/A | ⬜ |
| FOUND-04 | Viewer não consegue executar ações de escrita | smoke manual | Convidar viewer → tentar salvar → verificar que botão está oculto e DB rejeita | N/A | ⬜ |
| FOUND-04 | Tenant A não lê dados do Tenant B (RLS) | SQL | `SET LOCAL role = <user_tenant_b>; SELECT * FROM academia_config WHERE tenant_id = '<tenant_a_id>';` deve retornar 0 linhas | N/A | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Projeto Next.js 14 inicializado (`npx create-next-app@14`)
- [ ] shadcn/ui inicializado (`npx shadcn@latest init` — base Zinc + CSS variables)
- [ ] `.env.local` com credenciais Supabase (URL + anon key + service role key)
- [ ] Supabase CLI instalado para `supabase gen types typescript --local`
- [ ] Primeiro `next build` passando verde antes de qualquer componente

---

## Manual-Only Verifications

| Comportamento | Requisito | Por que manual | Instruções |
|--------------|-----------|---------------|------------|
| Sessão persiste entre reloads | FOUND-01 | Depende de cookie HttpOnly do browser | Fazer signup, fechar aba, reabrir → verificar que está logado |
| Invite manager recebe email | FOUND-04 | Supabase envia email de convite — não testável sem caixa de email real | Convidar manager via dashboard → confirmar recebimento do email |
| Viewer vê form read-only sem save button | FOUND-04 | Renderização condicional por role — verificar visualmente | Logar como viewer → navegar para /configuracoes → confirmar que botão salvar está ausente |

---

## Security Threat Map

| Ameaça | STRIDE | Mitigação | Verificação |
|--------|--------|-----------|-------------|
| Cross-tenant data read | Information Disclosure | RESTRICTIVE RLS em toda tabela; `fn_tenant_id()` lê do DB | SQL: query de tenant A como usuário do tenant B → 0 linhas |
| JWT claim spoofing (tenant_id falso no JWT) | Tampering | `fn_tenant_id()` ignora JWT, lê de `usuarios` | Tentativa de JWT manipulado → `fn_tenant_id()` retorna valor correto do DB |
| Service role key exposta | Elevation of Privilege | `lib/supabase/admin.ts` com `import 'server-only'` | `grep -r "SUPABASE_SERVICE_ROLE_KEY" app/` deve retornar 0 resultados |
| Escalada de privilégio via URL | Elevation of Privilege | Viewer: Server Component não renderiza save button; RLS bloqueia write | Viewer + POST direto → DB retorna erro de política RLS |
| Sessão expirada usada | Authentication Bypass | `getUser()` no middleware valida JWT no servidor a cada request | Acessar com cookie expirado → redirect para /login |
