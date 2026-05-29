# DIAGNOSTICO.md — Sessão autônoma 2026-05-28

**SHA base:** `de48ba8` | **SHA final:** `bb1d9f0`
**Browser MCP:** não disponível — diagnóstico via leitura de código
**Supabase MCP:** não disponível — diagnóstico via código e migrations
**Dados de teste criados:** nenhum (diagnóstico read-only)

---

## 1. CONSERTADO (auto)

### Fix 1 — `lib/agents/gerador.ts`: paths errados no brand_manual
**SHA:** `b65835f`

O gerador lia campos de `brand_manual.identidade_visual.*` que **não existem** no JSONB.
O `savePasso3` persiste em `brand_manual.visual.*`. Resultado: todos os posts gerados usavam
fallbacks hardcoded — cor `#7B61C4`, fonte Plus Jakarta Sans, logo placeholder — ignorando a
identidade visual configurada pelo tenant.

Também leu `config.logo_url` da coluna separada de `tenant_config` (nunca escrita por nenhum código).

**Antes:**
```ts
logo_url: config.logo_url || LOGO_PLACEHOLDER,           // coluna morta
cor_primaria: brand_manual?.identidade_visual?.cor_primaria ?? '#7B61C4',   // path errado
fonte_familia: brand_manual?.identidade_visual?.fonte_familia,              // path errado
```

**Depois:**
```ts
const bm = config.brand_manual as Record<string, Record<string, string>> | null
logo_url: bm?.visual?.logo_url || LOGO_PLACEHOLDER,      // path correto
cor_primaria: bm?.visual?.cor_primaria ?? '#7B61C4',     // path correto
fonte_familia: bm?.visual?.fonte_titulo as TemplateSlots['fonte_familia'],  // campo correto
```

---

### Fix 2 — `app/onboarding/[passo]/step3.tsx`: catch ausente em handleFile
**SHA:** `b65835f`

`handleFile` usava `try/finally` sem `catch`. Se `fetch('/api/onboarding/logo')` lançasse
(erro de rede, timeout, resposta não-JSON), o erro era silencioso: `uploading` voltava para
`false`, nenhuma mensagem aparecia. O usuário via o spinner sumir e concluía que "nada aconteceu".
Causa provável do bug reportado "não responde ao clique".

Adicionado `catch { setError('Falha na conexão...') }` entre o `try` e o `finally`.

---

### Fix 3 — `app/onboarding/[passo]/step5.tsx`: mesmo padrão do Fix 2
**SHA:** `bb1d9f0`

`handleFiles` no banco de imagens tinha o mesmo `try/finally` sem `catch`. Mesmo sintoma:
falha de rede silenciosa. Aplicado o mesmo padrão de catch.

---

## 2. ACHADO MAS NÃO MEXIDO

### Bug A — logo_url salvo como signed URL com TTL de 1h
**Severidade:** não-bloqueante (degrada após 1h do upload)
**Arquivo:** `app/api/onboarding/logo/route.ts` + `app/onboarding/[passo]/step3.tsx`

O `display_url` retornado pela rota `/api/onboarding/logo` é uma signed URL com TTL de 1h
(`createSignedUrl(storagePath, 3600)`). Essa URL é salva em `brand_manual.visual.logo_url`.

Após 1 hora:
- Logo não aparece no passo 3 ao recarregar (img com URL expirada)
- Gerador pode receber URL expirada e gerar post sem logo

O `storage_path` é retornado na resposta e capturado em estado (`setStoragePath`), mas o estado
é declarado com blank destructure — `const [, setStoragePath] = useState<string | null>(null)` — e
nunca passado para `savePasso3`. Fix completo requer:

1. Renomear destructure para `const [storagePath, setStoragePath]`
2. Passar `logo_storage_path: storagePath` para `savePasso3` e schema Zod
3. No gerador, usar admin client para gerar signed URL fresca do `storage_path`

Toca: `step3.tsx`, `actions.ts`, `onboarding.ts` (validator), `gerador.ts`, `brand-manual.ts`.

---

### Bug B — `batch-approval.tsx:96` hex hardcoded `#E30613`
**Severidade:** ENGINE_VS_TENANT (não-bloqueante funcional)
**Arquivo:** `app/dashboard/aprovacoes/batch-approval.tsx`, linha 96

```tsx
className="bg-[#E30613] hover:bg-[#C0040F] text-white min-w-[140px]"
```

`#E30613` está listado explicitamente no CLAUDE.md §2.1 como exemplo de hex de tenant
hardcoded proibido em código compartilhado. O botão "Aprovar lote" é chrome do dashboard
(Camada 2 — engine), deve usar `--prisma-*` tokens.

Remediação: substituir por `bg-[var(--prisma-danger)]` ou cor Tailwind genérica `bg-red-600`.
Requer decisão de produto sobre o token correto no Design System.

---

### Bug C — janela 5 minutos do cancelamento não enforçada no backend
**Severidade:** não-bloqueante (comportamento atual permite cancelar a qualquer hora)
**Arquivos:** `app/api/conteudos/[id]/cancelar-agendamento/route.ts`

O `BatchApproval` component implementa a janela de 5 min corretamente (timer client-side que
esconde o botão). Porém o `CancelAgendamentoButton` (na seção "Agendados para publicação")
não tem restrição de tempo, e o backend `DELETE cancelar-agendamento` também não verifica
se `agendado_para > now() + 5min`. Usuário pode cancelar qualquer post agendado, inclusive
próximo da publicação.

Remediação sugerida: no backend, adicionar verificação:
```sql
AND agendado_para > NOW() + INTERVAL '5 minutes'
```
ou retornar 409 se dentro da janela.

---

### Bug D — `[saude-mkt] internal error` no build
**Severidade:** cosmético (não afeta produção)

Durante `next build`, o static page generator tenta chamar `/api/admin/saude-mkt` sem
autenticação, o que cai no `catch` interno e loga `[saude-mkt] internal error { errCode: 'Error' }`.
A rota retorna corretamente 401 em produção. O log é falso-positivo do build.

---

## 3. SÓ O OWNER PODE FAZER

| Ação | Onde | Por quê |
|---|---|---|
| Verificar se bucket `logos` existe no Supabase Storage | Dashboard Supabase → Storage | Upload de logo falha com 500 se bucket ausente |
| Verificar se bucket `posts` é público | Dashboard Supabase → Storage → `posts` | `gerarPostSemanal` usa `getPublicUrl()` — bucket privado gera URL inacessível |
| Confirmar `ZERNIO_API_KEY` configurado na Vercel | Vercel → Settings → Env Vars | Agendamento Zernio falha silenciosamente sem a key |
| Confirmar `ZERNIO_WEBHOOK_SECRET` configurado na Vercel | Vercel → Settings → Env Vars | Webhook Zernio retorna 401 sem o secret |
| Inserir `zernio_account_id` em `tenant_config` para o tenant UNIC | SQL Editor Supabase: `UPDATE tenant_config SET zernio_account_id='<ID>' WHERE tenant_id='2ab4c5b4-...'` | Sem isso, `agendarPublicacao` lança erro e approval não agenda |
| Confirmar `OPENAI_API_KEY` em produção | Vercel → Settings → Env Vars | Gerador e vision-logo falham sem key |
| Confirmar `CRON_SECRET` em produção | Vercel → Settings → Env Vars | Cron `gerar-posts` retorna 401 sem o secret |

---

## 4. Dados de teste criados

Nenhum. A sessão foi exclusivamente de diagnóstico e fix de código — sem criação de registros no banco.

---

## Diagnóstico do bug principal: step3 "não responde ao clique"

Sem browser MCP, não foi possível reproduzir o bug diretamente. A análise de código aponta duas causas prováveis:

1. **Causa mais provável:** O `handleFile` sem `catch` tornava qualquer falha de rede/servidor silenciosa. O usuário selecionava o arquivo, via o spinner aparecer e sumir, mas sem mensagem de erro. Percepção: "não fez nada". **Corrigido no Fix 2.**

2. **Causa alternativa:** O bucket `logos` pode não existir no Supabase Storage. O upload retornaria 500 com JSON, que seria exibido como erro pelo `if (!res.ok)`. Com o Fix 2, mesmo respostas não-JSON (HTML de erro) agora mostram mensagem clara.

3. **O handler de clique em si está correto:** `onClick={() => inputRef.current?.click()}` sobre `<input ref={inputRef} type="file" className="hidden">` é um padrão React válido, o input é sempre renderizado (não condicional), e o `inputRef` é corretamente atribuído na montagem.
