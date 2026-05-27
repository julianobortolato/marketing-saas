# Handoff — Fases 4.3 + 4.4 + fix TS tests

## SHA base para próximo chat
`22c86a3` — fix(tests): corrigir TS2352/TS2554 em test files do Sprint 0

## Status

Fases 4.3, 4.4 e fix de tsc com aceite verde:
- `next build` ✅ verde
- `tsc --noEmit` ✅ 0 erros
- 7 blocos da Fase 4.3+4.4 commitados + 1 commit de fix de testes

## Commits desta sessão (ordem cronológica)

| SHA | Entregável |
|---|---|
| `bdfec30` | middleware protege `/onboarding/*` + tokens `--prisma-*` (ADR-MKT-006) |
| `46a3b0f` | `dashboard/layout.tsx` gate `onboarding_passo < 9` |
| `257cf1e` | Fix S-1/S-2/S-3: `/api/evolution/criar-instancia` server-side + AES-256-GCM |
| `7b12444` | `/dashboard/configuracoes/marca` — Manual de Marca editável |
| `dcb6532` | OAuth stubs `/api/oauth/meta` + `/api/oauth/google` → 501 |
| `6e856bc` | `/dashboard/banco-imagens` — galeria com approve/reject + multi-select |
| `c9aaa74` | HANDOFF.md v1 |
| `22c86a3` | fix(tests): TS2352/TS2554 nos dois test files do Sprint 0 |

## Fix de testes aplicado (documentação para próximo dev)

**Padrão adotado:** `type MockSupabase = Awaited<ReturnType<typeof createClient>>`
com double-cast `as unknown as MockSupabase` em vez do conditional type inline
`as ReturnType<typeof import(...)> extends Promise<infer T> ? T : never`.

**Arquivos corrigidos:**
- `app/api/admin/saude-mkt/__tests__/route.test.ts`
  - TS2352 × 8: cast para `as unknown as MockSupabase`
  - TS2554 × 8: `GET(makeRequest())` → `GET()` (handler não tem parâmetro)
  - Remove import `NextRequest` e helper `makeRequest()` não utilizados
- `app/dashboard/configuracoes/editorial/__tests__/actions.test.ts`
  - TS2352 × 4: cast para `as unknown as MockSupabase`

## Próxima tarefa: Fase 5.1 — `/api/posts/render` + Satori

### Contexto

Fase 5 gera posts de imagem via Satori (HTML→PNG). ADR-MKT-003 documenta a decisão.
A tabela `conteudos` foi criada na Fase 4 (schema mínimo) — Fase 5 adiciona templates.

### O que entra na Fase 5.1

- `/api/posts/render` — rota Node.js que recebe `conteudo_id`, busca dados do `conteudos`
  + `brand_manual`, renderiza template Satori, retorna PNG
- Template base fitness (componente React → `@vercel/og` / Satori)
- Integração com `banco_imagens` para foto de fundo
- Schema mínimo de `conteudos` já existe; Fase 5 adiciona `template`, `satori_html`

### Arquivos esperados na Fase 5.1

```
app/api/posts/render/route.ts          ← Node.js runtime (Satori não roda em Edge)
lib/satori/templates/base.tsx          ← template React → PNG
lib/satori/render.ts                   ← wrapper Satori
lib/queries/conteudos.ts               ← getConteudo(id), updateConteudo(...)
```

### Restrições da ADR-MKT-003 (ler antes de implementar)

- Satori: `runtime = 'nodejs'` (não Edge) — mesmo padrão do `/api/onboarding/logo`
- Fontes: carregadas de `public/fonts/` via `fs.readFileSync` na rota (não no browser)
- `--tenant-*` tokens injetados inline no template (não via CSS global)
- Imagem do post usa `brand_manual.visual.cor_primaria` (não `--prisma-*`)

## Estado do .env.local — 3 vars pendentes do owner

Necessário antes de testar passo 7 do wizard (WhatsApp):

| Variável | Como gerar | Onde usar |
|---|---|---|
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | AES-256-GCM em `evolution_instances.api_key_encrypted` |
| `EVOLUTION_API_URL` | URL do servidor Evolution (ex: `http://servidor:8080`) | `/api/evolution/criar-instancia` |
| `EVOLUTION_API_KEY` | Dashboard Evolution → API Key | Idem acima |

`NEXT_PUBLIC_EVOLUTION_API_URL` e `NEXT_PUBLIC_EVOLUTION_API_KEY`: remover do `.env.local` e Vercel.

## Decisões técnicas que afetam fases futuras

1. **`savePasso7` sem argumentos** — instância salva pela rota `/api/evolution/criar-instancia`.
   Se precisar de `instanceName` downstream, buscar em `evolution_instances` pelo `tenant_id`.

2. **`patchBrandManual` merge shallow** — Manual de Marca lê `brand_manual` atual antes de gravar
   (`getBrandManual()` + spread). Qualquer feature que edite `brand_manual.visual` deve seguir
   o mesmo padrão.

3. **Banco de imagens usa signed URLs regeneradas em render** — `url_publica` no banco expira
   em 1h. Galeria regenera via `getSignedUrl()` a cada request. Com >100 imagens, considerar
   cache antes da Fase 5.

4. **`globals.css` usa `--prisma-midnight` como `--primary`** — componentes Shadcn com
   `bg-primary` renderizam em midnight. Revisar visualmente antes do primeiro tenant real.
