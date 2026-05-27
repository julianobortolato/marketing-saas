# Handoff — Fase 4 parcial

## SHA do último commit
`03d5be9` — feat(fase4): migrations + colorthief + p-limit

## Arquivos escritos mas NÃO commitados

```
lib/queries/tenant.ts
lib/queries/brand-manual.ts
lib/queries/vertical-presets.ts
lib/queries/banco-imagens.ts
lib/validators/onboarding.ts
lib/openai/vision-logo.ts
lib/openai/vision-autotag.ts
lib/openai/brand-analysis.ts
app/api/onboarding/logo/route.ts
app/api/onboarding/images/route.ts
app/api/onboarding/posts/route.ts
app/onboarding/layout.tsx
app/onboarding/[passo]/page.tsx
app/onboarding/[passo]/stepper.tsx
app/onboarding/[passo]/actions.ts
app/onboarding/[passo]/step1.tsx  (passos 1-8, todos escritos)
app/onboarding/[passo]/step2.tsx
app/onboarding/[passo]/step3.tsx
app/onboarding/[passo]/step4.tsx
app/onboarding/[passo]/step5.tsx
app/onboarding/[passo]/step6.tsx
app/onboarding/[passo]/step7.tsx
app/onboarding/[passo]/step8.tsx
```

Próxima ação: `git add -A && git commit -m "feat(fase4): wizard completo passos 1-8 + lib layer + api routes"`
Executar `pnpm build` antes — pode ter erros de tipo nos step components.

## Arquivos ainda NÃO escritos (do briefing)

```
app/dashboard/configuracoes/marca/page.tsx        (4.3 — Manual de Marca editável)
app/dashboard/configuracoes/marca/marca-form.tsx
app/dashboard/configuracoes/marca/actions.ts
app/dashboard/banco-imagens/page.tsx              (4.4 — Galeria)
app/dashboard/banco-imagens/galeria.tsx
app/dashboard/banco-imagens/actions.ts
app/api/oauth/meta/route.ts                       (passo 6 — OAuth stub)
app/api/oauth/google/route.ts                     (passo 6 — OAuth stub)
middleware.ts                                     (adicionar /onboarding/* à proteção)
app/dashboard/layout.tsx                          (gate onboarding: passo < 9 → redirect)
app/globals.css                                   (adicionar tokens --prisma-* ADR-MKT-006)
```

## Decisões técnicas tomadas (não estavam no briefing)

1. **Passo 1 não recria tenant** — trigger `handle_new_user` já cria tenant no signup.
   Passo 1 faz UPDATE no tenant existente + upsert em `tenant_config`. `ensureTenantConfig()`
   em `lib/queries/brand-manual.ts` usa `onConflict: 'tenant_id'`.

2. **`onboarding_passo >= 9` = wizard concluído** — INT, não boolean. 9 significa "passou do 8".
   `advanceOnboardingPasso` usa `.gte('onboarding_passo', nextPasso - 1)` para nunca regredir.

3. **Tabela `conteudos` criada na Fase 4** (não Fase 5) — necessária para passo 8 persistir posts.
   Schema mínimo: formato, copy, hashtags, foto_url, status, fonte. Fase 5 adiciona Satori/templates.

4. **colorthief escreve em /tmp** — API route do logo usa `runtime = 'nodejs'`. colorthief não
   aceita Buffer direto na v3; requer path. Tmp file criado/deletado por chamada.

5. **Step7 chama Evolution API direto do browser** — usa `NEXT_PUBLIC_EVOLUTION_API_URL`.
   Alternativa mais segura seria proxy via API route. Marcar para revisão se Evolution API
   não estiver exposta publicamente.

6. **OAuth routes (passo 6) são stubs** — `<a href="/api/oauth/meta">` aponta para rotas
   inexistentes. Não bloqueiam o wizard (passo 6 é skippable). Criar antes do primeiro tenant real.

## TODOs/FIXMEs deixados no código

- `step7.tsx`: `apikey: ''` no header da chamada Evolution — precisa da chave real via
  variável de ambiente. Adicionar `NEXT_PUBLIC_EVOLUTION_API_KEY` ou proxiar via API route.
- `actions.ts savePasso7`: `api_key_encrypted: ''` — salva vazio. Criptografar antes de salvar.
- `brand-manual.ts patchBrandManual`: merge shallow (spread) — patches em sub-objetos
  como `visual` sobrescrevem o JSONB inteiro para aquela chave. Funcional para o wizard
  (cada passo escreve sua chave inteira), mas atenção ao Manual de Marca editável (4.3).

## Build — pendências conhecidas

- `colorthief` não tem types `@types/colorthief`. Adicionar `declare module 'colorthief'`
  em `lib/openai/vision-logo.ts` ou criar `types/colorthief.d.ts` se o build reclamar.
- `step7.tsx` usa `process.env.NEXT_PUBLIC_EVOLUTION_API_URL` — precisa estar no `.env.local`.
- Adicionar `NEXT_PUBLIC_EVOLUTION_API_URL` ao `.env.local` antes de testar passo 7.
