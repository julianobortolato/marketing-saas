# Cutover Checklist — Phase 3: Agente WhatsApp

> ADR-MKT-001 §15 itens 16–18 · Sprint 4 — testes E2E e cutover gradual
> Porta de saída para WHATS-01, WHATS-02, WHATS-03 live em produção.
>
> **Protocolo:** Tique cada item SOMENTE após verificar o resultado esperado.
> Nunca avance de estágio sem o gate anterior completo.
> Em caso de dúvida: rollback primeiro, investiga depois.

---

## Pre-flight — Faça ANTES de mudar a URL do webhook Evolution

- [ ] **1. Deploy Plans 03-01 e 03-02 para Vercel Production**

  ```
  Verificar: Vercel dashboard → Deployments → SHA mais recente = 0c7d7c8 (ou posterior)
             Build status = READY
  ```

  *Resultado esperado:* Build verde, funções de Edge visíveis no dashboard.
  *Rollback:* Vercel dashboard → selecionar deploy anterior → "Promote to Production".

---

- [ ] **2. Verificar variáveis de ambiente em Production**

  ```bash
  vercel env ls --environment=production
  ```

  Confirmar que estas 6 vars existem com escopo "Production":

  | Variável | Origem |
  |---|---|
  | `EVOLUTION_WEBHOOK_SECRET` | Gerada com `openssl rand -hex 32` |
  | `UPSTASH_REDIS_URL` | Upstash dashboard |
  | `UPSTASH_REDIS_TOKEN` | Upstash dashboard |
  | `OPENAI_API_KEY` | OpenAI Platform |
  | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
  | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |

  *Resultado esperado:* Nenhuma variável listada como "not set" ou com escopo errado.
  *Rollback:* `vercel env add <NOME> production` + re-deploy.

---

- [ ] **3. Smoke suite verde contra a URL de produção**

  ```bash
  # Em .env.smoke: SMOKE_BASE_URL=https://<prod-domain>
  npm run test:smoke
  ```

  *Resultado esperado:* 7 describe blocks passando (hmac, webhook-evolution, new-lead,
  idempotency, handoff, kill-switch, rls-inverse). 0 falhas.
  *Rollback:* **NÃO prosseguir para cutover.** Debugar falhas, corrigir, re-rodar.

---

- [ ] **4. Seed da linha evolution_instances para o tenant Fitness UNIC**

  Execute no Supabase SQL Editor:

  ```sql
  -- ============================================================
  -- Pre-flight SQL — Phase 3 Cutover — evolution_instances seed
  -- Execute: Supabase dashboard → SQL Editor → New query
  -- Timestamp esperado: execute ANTES de mudar o webhook Evolution
  -- ============================================================

  -- Verificar tenant Fitness UNIC existe
  SELECT id, nome, slug, iara_tenant_id
  FROM public.tenants
  WHERE slug = 'fitness-unic';
  -- Esperado: 1 linha com iara_tenant_id IS NULL

  -- Inserir (ou substituir) a linha de instância
  INSERT INTO public.evolution_instances (
    tenant_id,
    instance_name,
    numero_whatsapp,
    api_key_encrypted,
    webhook_secret,
    ativo
  )
  SELECT
    t.id,
    'iara_v2_staging',
    '+556796884451',           -- número E.164 da UNIC
    'PLACEHOLDER_ENCRYPT_API_KEY_VIA_VAULT',  -- <COLE_AQUI> chave cifrada via Supabase Vault
    '<COLE_AQUI_VALOR_DE_EVOLUTION_WEBHOOK_SECRET_DO_VERCEL>',
    true
  FROM public.tenants t
  WHERE t.slug = 'fitness-unic'
  ON CONFLICT (instance_name) DO UPDATE SET
    webhook_secret = EXCLUDED.webhook_secret,
    ativo          = true,
    atualizado_em  = now();

  -- Verificação pós-insert
  SELECT id, tenant_id, instance_name, numero_whatsapp, ativo, webhook_secret
  FROM public.evolution_instances
  WHERE instance_name = 'iara_v2_staging';
  -- Esperado: 1 linha com ativo=true e webhook_secret preenchido

  -- ROLLBACK (descomente só se precisar reverter):
  -- DELETE FROM public.evolution_instances WHERE instance_name = 'iara_v2_staging';
  ```

  *Resultado esperado:* 1 linha com `ativo=true` e `webhook_secret` igual ao valor de
  `EVOLUTION_WEBHOOK_SECRET` no Vercel Production.

  **Atenção:** O valor de `webhook_secret` aqui DEVE ser idêntico ao de
  `EVOLUTION_WEBHOOK_SECRET` no Vercel. Se divergirem, o HMAC vai falhar em produção.
  *Rollback:* `DELETE FROM public.evolution_instances WHERE instance_name = 'iara_v2_staging';`

---

- [ ] **5. Confirmar iara_tenant_id IS NULL para o tenant Fitness UNIC**

  ```sql
  SELECT id, nome, slug, iara_tenant_id, ia_habilitada, ia_limite_diario_usd
  FROM public.tenants
  WHERE slug = 'fitness-unic';
  ```

  *Resultado esperado:* `iara_tenant_id IS NULL` (se não for NULL, o webhook fará
  bridge para o IARA V2 em vez de usar o agente novo — comportamento errado).
  *Rollback:* Se `iara_tenant_id` não for NULL e você ainda quer usar o agente novo,
  deve ser uma decisão consciente — consultar ADR-MKT-001 §4.1 antes de alterar.

---

- [ ] **6. Aprovação semântica do anti-leak gate (Task 3 checkpoint)**

  Abrir `tests/smoke/.identity-leak-report.json` e confirmar:
  - 10/10 entradas: resposta em tom formal Academia Premium Vértice
  - Nenhuma frase com vocabulário UNIC (bora, top, sensacional, beleza, etc.)
  - Nenhuma menção a bairro, modalidade, ou precificação específica da UNIC
  - Tratamento senhor/senhora ou "você" neutro (sem gírias)

  *Resultado esperado:* Task 3 aprovada no checkpoint — registrar aprovação aqui.
  *Rollback:* Se falhar: revisar `lib/agents/cmo/system-prompt.ts` (Plan 03-01)
  antes de qualquer cutover.

---

## Estágio 1: 10% do tráfego (janela de 1 hora de observação)

> Pré-requisito: todos os 6 itens de pre-flight tique ados.

- [ ] **7. Redirecionar 10% do tráfego iara_v2_staging para o novo endpoint**

  No painel da Evolution API:
  ```
  Instances → iara_v2_staging → Webhook settings
  URL: https://<prod-domain>/api/webhooks/evolution
  Events: MESSAGES_UPSERT (ou equivalente Evolution V2)
  ```

  Se a Evolution API não suportar split de tráfego nativo:
  - Opção A: Apontar 100% para o novo endpoint e observar pelo dashboard
    (aceitar que é "stage 1 manual" — volume baixo de madrugada)
  - Opção B: Aguardar a chegada de 1 novo lead manualmente e observar

  *Monitoramento (a cada 10 min durante 1 hora):*
  ```bash
  curl -H "Authorization: Bearer <TOKEN_OWNER>" \
    https://<prod-domain>/api/admin/saude-mkt
  ```
  Verificar: `usage_diario.custo_usd` cresce ~$0.02–$0.05/turno; `conversas_ativas`
  aumenta; nenhum `ia_habilitada: false` inesperado (kill switch não deve disparar a 10%).

  *Resultado esperado:* ≥1 lead processado pelo novo endpoint em 1 hora.
  *Rollback:* Evolution dashboard → reverter URL para endpoint IARA V2.

---

- [ ] **8. Owner revisa as primeiras 5 respostas reais do agente**

  Acessar `/dashboard/conversas` e verificar as 5 primeiras conversas processadas:
  - Tom bate com o caderno editorial da UNIC?
  - Nenhuma palavra proibida (lista em academia_config.palavras_proibidas)?
  - AE proposal sensata (modalidade, horário, preço corretos)?
  - Nenhum handoff inesperado (desconto mencionado indevidamente, etc.)?

  *Resultado esperado:* 5/5 respostas adequadas OU qualquer divergência documentada
  com decisão explícita de continuar ou reverter.
  *Rollback:* Reverter URL no Evolution dashboard; abrir plano de revisão de guardrails.

---

## Estágio 2: 50% do tráfego (janela de 24 horas)

> Pré-requisito: Stage 1 completo e aprovado.

- [ ] **9. Atualizar roteamento Evolution para 50/50**

  Evolution dashboard → `iara_v2_staging` → ajustar split para 50% do tráfego.
  Se split não disponível: manter 100% no novo endpoint e proceder (Stage 1 já validou).

  *Monitoramento (a cada 1 hora por 24 horas):*
  - `/api/admin/saude-mkt` — verificar `custo_usd` acumulado vs budget `ia_limite_diario_usd`
  - P95 de tempo entre `chat_messages.recebida_em` e `enviada_em` < 30s
  - Kill switch não disparou (`ia_habilitada: true` persiste)

  *Rollback:* Reverter para Stage 1 (10%) ou Stage 0 (0%) via Evolution dashboard.

---

- [ ] **10. Spot-check diário de conversas + KPIs mínimos**

  ```sql
  -- Taxa de handoff (deve ser < 30%)
  SELECT
    COUNT(*) FILTER (WHERE ia_ativa = false) AS handoffs,
    COUNT(*)                                  AS total,
    ROUND(100.0 * COUNT(*) FILTER (WHERE ia_ativa = false) / NULLIF(COUNT(*),0), 1) AS pct_handoff
  FROM public.conversas
  WHERE tenant_id = (SELECT id FROM tenants WHERE slug='fitness-unic')
    AND criado_em > now() - interval '24 hours';

  -- Agendamentos (deve ser > 0 em 24h)
  SELECT COUNT(*) FROM public.leads
  WHERE tenant_id = (SELECT id FROM tenants WHERE slug='fitness-unic')
    AND status = 'agendado'
    AND atualizado_em > now() - interval '24 hours';
  ```

  *Resultado esperado:* Taxa de handoff < 30%; ≥1 lead com `status='agendado'` em 24h.
  *Rollback:* Se KPIs fora do esperado, reverter roteamento + investigar.

---

## Estágio 3: 100% do tráfego

> Pré-requisito: Stage 2 estável por 24 horas.

- [ ] **11. Atualizar roteamento Evolution para 100% no novo endpoint**

  Evolution dashboard → `iara_v2_staging` → 100% para
  `https://<prod-domain>/api/webhooks/evolution`.

  *Resultado esperado:* IARA V2 para de receber inbound da UNIC. Todos os leads
  processados pelo novo agente.
  *Rollback:* Reverter URL no Evolution dashboard para endpoint IARA V2 (< 30s).

---

- [ ] **12. Smoke suite final contra produção**

  ```bash
  # SMOKE_BASE_URL aponta para produção
  npm run test:smoke
  ```

  *Resultado esperado:* Todos os 7 testes passam com produção a 100%.

---

- [ ] **13. Atualizar STATE.md — Phase 3 completa**

  Editar `.planning/STATE.md`:
  - `progress.percent`: 33 → 50
  - `progress.completed_phases`: 2 → 3
  - `Current Position.Phase`: 03 → 04 (próxima fase)
  - Registrar SHA do commit final + timestamp do cutover completo
  - Registrar na seção "Decisions": "Phase 3 cutover concluído — WHATS-01/02/03 live"

---

## Rollback de emergência (se algo quebrar em qualquer estágio)

**Passo 1 — Imediato (< 1 min):**
```
Evolution dashboard → Instances → iara_v2_staging → Webhook settings
→ Reverter URL para o endpoint IARA V2
```

**Passo 2 — Confirmar parada do novo tráfego (< 2 min):**
```sql
-- Deve parar de crescer em 30s após o rollback
SELECT COUNT(*), MAX(recebida_em)
FROM public.chat_messages
WHERE tenant_id = (SELECT id FROM tenants WHERE slug='fitness-unic')
  AND recebida_em > now() - interval '5 minutes';
```

**Passo 3 — Registrar STATE.md:**
Adicionar entrada na seção "Blockers/Concerns":
```
ROLLBACK Stage X — <timestamp> — <modo de falha observado>
```

**Passo 4 — Análise:**
Abrir plano de revisão específico para o modo de falha antes de tentar novamente.
Não re-tentar cutover sem resolução documentada.

---

## Referência rápida — endpoints de monitoramento

| O que verificar | Como |
|---|---|
| Saúde geral do agente UNIC | `GET /api/admin/saude-mkt` (autenticado como owner) |
| Kill switch status | `SELECT ia_habilitada, ia_limite_diario_usd FROM tenants WHERE slug='fitness-unic'` |
| Últimas conversas | `/dashboard/conversas` → filtrar por lead |
| Custo acumulado do dia | `SELECT * FROM ai_usage_diario WHERE tenant_id = ... AND data = current_date` |
| Idempotência (redelivery) | `SELECT evolution_message_id, COUNT(*) FROM chat_messages GROUP BY 1 HAVING COUNT(*)>1` |
