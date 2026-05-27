# Handoff — Fase 4.3 + 4.4 concluídas

## SHA base para próximo chat
`6e856bc` — feat(fase4.4): galeria banco de imagens

## Status

Fases 4.3 e 4.4 com aceite verde:
- Build `next build` ✅ verde no SHA `6e856bc`
- 7 blocos commitados, smoke tests passando
- RLS dual confirmado nas 3 tabelas tocadas (`evolution_instances`, `tenant_config`, `banco_imagens`)
- `NEXT_PUBLIC_EVOLUTION_*` removido do código e do `.env.local`

## O que foi entregue (por bloco)

| Bloco | SHA | Entregável |
|---|---|---|
| 1+2 | `bdfec30` | `middleware.ts` protege `/onboarding/*` + tokens `--prisma-*` em `globals.css` (ADR-MKT-006) |
| 3 | `46a3b0f` | `dashboard/layout.tsx` gate: `onboarding_passo < 9` → redirect `/onboarding/<passo>` |
| 4 | `257cf1e` | Fix S-1/S-2/S-3: `/api/evolution/criar-instancia` server-side + AES-256-GCM para `api_key_encrypted` |
| 5 | `7b12444` | `/dashboard/configuracoes/marca` — Manual de Marca editável (Zod por sub-seção, Option A) |
| 6 | `dcb6532` | `/api/oauth/meta` + `/api/oauth/google` stubs → 501 |
| 7 | `6e856bc` | `/dashboard/banco-imagens` — galeria com approve/reject + multi-select delete |

## Próxima tarefa: corrigir erros TypeScript em test files do Sprint 0

### Contexto

`tsc --noEmit` retorna 20 erros, todos em dois arquivos de teste pré-existentes do Sprint 0.
`next build` passa normalmente (test files excluídos do tsconfig de build).
Não bloqueia deploy, mas deve ser corrigido antes de qualquer execução de testes.

### Arquivos afetados

**Arquivo 1:** `app/api/admin/saude-mkt/__tests__/route.test.ts`

- **TS2554 (8 ocorrências)** — linhas 73, 86, 99, 112, 124, 144, 161, 173:
  `createClient` foi atualizado para não receber argumentos (`createClient()`), mas os testes
  ainda chamam `mockCreateClient.mockResolvedValueOnce(mockSupabase as ...)` passando 1 argumento.
  Fix: remover o argumento, ou ajustar o mock para `mockCreateClient.mockResolvedValue(mockSupabase as unknown as ...)`

- **TS2352 (8 ocorrências)** — linhas 70, 82, 95, 108, 119, 139, 156, 168:
  O objeto mock `{ auth: { getUser: Mock<Procedure> } }` é castado para `SupabaseClient<...>`
  mas não tem overlap suficiente. Fix: dobrar o cast → `as unknown as SupabaseClient<...>`

**Arquivo 2:** `app/dashboard/configuracoes/editorial/__tests__/actions.test.ts`

- **TS2352 (4 ocorrências)** — linhas 51, 65, 77, 90:
  Objeto mock `{ from: Mock<Procedure>; rpc: Mock<Procedure> }` castado para `SupabaseClient<...>`.
  Fix idêntico: `as unknown as SupabaseClient<...>`

### Fix padrão (aplicar nos dois arquivos)

```typescript
// ANTES (quebra no tsc)
mockCreateClient.mockResolvedValueOnce(mockSupabase as SupabaseClient<...>)

// DEPOIS
mockCreateClient.mockResolvedValueOnce(mockSupabase as unknown as SupabaseClient<...>)
```

e onde `createClient` é chamado com argumento:

```typescript
// ANTES
mockCreateClient.mockResolvedValueOnce(algo as SupabaseClient<...>)
// ou mockCreateClient.mockImplementation((arg) => ...)

// DEPOIS (0 argumentos)
mockCreateClient.mockResolvedValue(algo as unknown as SupabaseClient<...>)
```

### Instrução pro próximo chat

1. Ler este HANDOFF.md
2. Ler os dois arquivos de teste completos antes de editar
3. Aplicar o fix de double-cast nos arquivos afetados
4. Rodar `npx tsc --noEmit` — deve retornar 0 erros
5. Rodar `npm run build` — deve continuar verde
6. Commitar: `fix(tests): double-cast SupabaseClient mocks no tsc (Sprint 0)`

## Estado do .env.local — 3 vars pendentes do owner

O seguinte NÃO está configurado ainda. Necessário antes de testar o passo 7 do wizard (WhatsApp):

| Variável | Como gerar | Onde usar |
|---|---|---|
| `ENCRYPTION_KEY` | `openssl rand -hex 32` no terminal | Criptografia AES-256-GCM da api_key em `evolution_instances` |
| `EVOLUTION_API_URL` | URL do servidor Evolution (ex: `http://seu-servidor:8080`) | `/api/evolution/criar-instancia` — sem `/api` no final |
| `EVOLUTION_API_KEY` | Chave global do servidor Evolution (dashboard Evolution → API Key) | Idem acima |

Adicionar ao `.env.local` e no painel Vercel → Settings → Environment Variables.

`NEXT_PUBLIC_EVOLUTION_API_URL` e `NEXT_PUBLIC_EVOLUTION_API_KEY` devem ser **removidas** do `.env.local` e da Vercel — não são mais usadas.

## Decisões técnicas desta fase que afetam fases futuras

1. **`savePasso7` agora não recebe argumentos** — a instância Evolution é salva pela rota
   `/api/evolution/criar-instancia` antes de `savePasso7` ser chamado. Se alguma fase futura
   precisar acessar `instanceName` no passo 7, buscar em `evolution_instances` pelo `tenant_id`.

2. **`patchBrandManual` continua com merge shallow** — Manual de Marca (4.3) contorna isso
   lendo o `brand_manual` atual antes de gravar (`getBrandManual()` + spread). Qualquer nova
   feature que edite `brand_manual.visual` deve seguir o mesmo padrão.

3. **Banco de imagens usa signed URLs regeneradas em cada render** — `url_publica` armazenada
   no banco expira em 1h (foi salva como signed URL no upload do onboarding). A galeria regenera
   via `getSignedUrl()` a cada request. Se volume de imagens crescer (>100), considerar cache
   ou CDN antes de Fase 5.

4. **`globals.css` agora usa `--prisma-midnight` como `--primary`** — componentes Shadcn que
   usam `bg-primary` / `text-primary` / `ring-ring` renderizam em midnight/purple. Revisar
   visualmente antes do primeiro tenant real.
