# ADR-MKT-001 — Agente WhatsApp para conversão de lead frio

> **Status:** Proposto — 19/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas`
> **Localização canônica:** `.adrs/ADR-MKT-001-agente-whatsapp.md`
> **Sucessor de:** primeira ADR escrita em arquivo dedicado (ADRs 001-005 permanecem inline em `ARCHITECTURE.md`)

---

## 1. Contexto

Fase 3 do `marketing-saas` exige um agente WhatsApp que converta lead frio em aula experimental (AE) agendada em < 5min, dentro do orçamento de < R$ 15/lead (PRD §Métricas). O agente atende **lead frio** (antes da matrícula) — distinto do chatbot do IARA V2 que atende **aluno matriculado** com modelagem comportamental IBC.

Antes desta ADR, o owner avaliou em 3 chats paralelos (Opus MKT + Opus V2 + Opus Greenfield) se valia reaproveitar código do IARA V2. A decisão registrada no briefing foi: **MKT nasce do zero, sem código herdado**. Princípios entram via documentação — manifesto LLM-first 2026 (Greenfield) + padrões multi-tenant testados em produção (`skill-seguranca` do V2). Esta ADR formaliza essa decisão e expande para schema, componentes, tools, prompt strategy e guardrails.

**Documentos de origem (em ordem de precedência):**

1. `PRD.md` — métricas, MVP, escopo
2. `ARCHITECTURE.md` — ADRs 001-005 (multi-tenant via RLS, cérebro separado, bridge IARA, Evolution V2, OpenAI direto)
3. `DOMAIN.md` — glossário lead/AE/score/canais
4. `CLAUDE.md` — regras pro agente Code, identidade visual, anti-padrões
5. `Green_MANIFESTO_2026.md` — 12 princípios LLM-first
6. `skill-seguranca/SKILL.md` — padrões multi-tenant Fase 5 do V2 (referenciados, não copiados)

**Restrições inegociáveis (não reabrir nesta ADR):**

- MKT e V2 são codebases independentes — integração futura via `tenants.iara_tenant_id`, nunca via código compartilhado
- MKT não importa nenhum arquivo do V2
- ADRs 001-005 do `ARCHITECTURE.md` valem como decisões base — esta ADR não as revoga

---

## 2. Decisão

O agente WhatsApp da Fase 3 é construído como **fluxo síncrono prompt-first com um único LLM (GPT-4o ou Sonnet 4.6) operando tools nativas**, persistindo mensagens antes de qualquer chamada externa, com guardrails determinísticos em código pós-LLM, budget cap por tenant com kill switch automático, e roteamento webhook → tenant via tabela dedicada `evolution_instances`.

Sub-decisões binárias (aprovadas pelo owner sob critério "menos retrabalho e manutenção"):

1. **Score:** coluna `leads.score` (dado) + tool `score_lead` (mecanismo). Score **não** controla fluxo de conversa
2. **Roteamento instância → tenant:** tabela `evolution_instances` (1:N tenant → instâncias) — antecipa Tier Enterprise sem migração custosa
3. **Caderno editorial:** colunas adicionais em `academia_config` (não tabela separada) — 1 ponto de manutenção, sem JOIN
4. **Processamento de mensagem:** síncrono em API Route Vercel, com gatilho objetivo de revisita (§15)
5. **ADR em arquivo dedicado:** `.adrs/` pasta nova; ADRs 001-005 ficam inline em `ARCHITECTURE.md`

---

## 3. Princípios aplicados — referência cruzada

| Princípio | Fonte | Aplicação concreta no MKT |
|---|---|---|
| Um LLM, várias tools | Manifesto P1 | 1 chamada por turno, sem multi-agente, sem classificador prévio |
| Sem máquina de estados explícita | Manifesto P2 | Nenhuma coluna `fase_conversa` / `etapa`. `leads.status` é dado de negócio, não FSM |
| Sem RAG na v1 | Manifesto P3 | `academia_config` enriquecido cabe em < 10k tokens. Gatilho de revisita: > 50k OU dinâmico |
| Tool use nativo | Manifesto P4 | `function calling` da OpenAI. Nunca JSON simulado no prompt |
| Persistir antes de enviar | Manifesto P5 | `chat_messages` INSERT antes de chamar OpenAI ou Evolution |
| Guardrails em código | Manifesto P6 | Validações pós-LLM: horário, desconto, preço, palavras proibidas, identidade |
| Limitar loop de tool-use | Manifesto P7 | Máximo 5 iterações por turno; fallback fixo se exceder |
| Validação HMAC do webhook | Manifesto P8 | `EVOLUTION_WEBHOOK_SECRET` HMAC sha256 antes de qualquer processamento |
| Secret só em env | Manifesto P9 | Nenhuma chave em código. CLAUDE.md já enforça |
| RLS por padrão | Manifesto P10 | Toda tabela nova com RLS + policy por `tenant_id` |
| Venda consultiva é prompt | Manifesto P11 | Tom do CMO no system_prompt + `academia_config` |
| Modelo dual PERMISSIVE + RESTRICTIVE | skill-seguranca §9.1 | `chat_messages`, `conversas`, `leads` |
| `fn_validar_acesso_tenant` | skill-seguranca §9.2 | Em toda RPC multi-tabela |
| RPC service_role re-valida por ID | skill-seguranca §9.4 | Webhook Evolution roda como service_role — re-valida tenant por `evolution_instances.tenant_id` |
| Budget cap + kill switch | skill-seguranca §9.7 | OpenAI calls com auditoria + acumulador diário + desabilitação automática |
| Teste RLS inverso | skill-seguranca §9.8 | Suite obrigatória pré-merge para `chat_messages`, `conversas` |

---

## 4. Schema — DDL completo

> Todas as tabelas seguem regras do `CLAUDE.md`: `tenant_id UUID NOT NULL`, RLS habilitada, migrations versionadas em `supabase/migrations/`.

### 4.1 `evolution_instances` (nova) — roteamento instância → tenant

```sql
CREATE TABLE evolution_instances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_name       TEXT NOT NULL UNIQUE,           -- identificador na Evolution API
  numero_whatsapp     TEXT NOT NULL,                  -- E.164: +5567...
  api_key_encrypted   TEXT NOT NULL,                  -- via Supabase Vault
  webhook_secret      TEXT NOT NULL,                  -- HMAC sha256 secret por instância
  ativo               BOOLEAN NOT NULL DEFAULT true,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evolution_instances_tenant ON evolution_instances(tenant_id);
CREATE UNIQUE INDEX idx_evolution_instances_numero ON evolution_instances(numero_whatsapp) WHERE ativo = true;

ALTER TABLE evolution_instances ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE: owner do tenant lê suas instâncias
CREATE POLICY evolution_instances_select_permissive ON evolution_instances
  FOR SELECT USING (tenant_id = fn_tenant_id());

-- RESTRICTIVE: fail-closed cross-tenant
CREATE POLICY evolution_instances_tenant_restrictive ON evolution_instances
  AS RESTRICTIVE FOR ALL USING (tenant_id = fn_tenant_id());
```

### 4.2 `conversas` (nova) — estado da conversa por lead

```sql
CREATE TABLE conversas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  evolution_instance_id UUID NOT NULL REFERENCES evolution_instances(id),
  remotejid           TEXT NOT NULL,                  -- WhatsApp ID do lead
  ia_ativa            BOOLEAN NOT NULL DEFAULT true,  -- handoff humano = false
  motivo_handoff      TEXT,                           -- desconto / loop / pedido_explicito / outro
  ultima_mensagem_em  TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, remotejid)
);

CREATE INDEX idx_conversas_lead ON conversas(lead_id);
CREATE INDEX idx_conversas_ativa ON conversas(tenant_id, ia_ativa) WHERE ia_ativa = false;

ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversas_select_permissive ON conversas
  FOR SELECT USING (tenant_id = fn_tenant_id());

CREATE POLICY conversas_tenant_restrictive ON conversas
  AS RESTRICTIVE FOR ALL USING (tenant_id = fn_tenant_id());
```

**Decisão registrada:** `ia_ativa` é flag binária. Quando vira `false`, mensagens continuam sendo persistidas em `chat_messages` mas **não** disparam LLM. Reativação só por ação humana via dashboard.

### 4.3 `chat_messages` (nova) — log de mensagens

```sql
CREATE TABLE chat_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversa_id         UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  evolution_message_id TEXT,                          -- idempotência: NULL para mensagens do bot
  direcao             TEXT NOT NULL CHECK (direcao IN ('entrada','saida')),
  tipo                TEXT NOT NULL CHECK (tipo IN ('texto','audio','imagem','outro')),
  conteudo            TEXT NOT NULL,                  -- texto ou transcrição
  enviada_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_envio        TEXT,                           -- 'pendente','enviada','falhou' (saida)
  UNIQUE (tenant_id, evolution_message_id)            -- idempotência de entrada
);

CREATE INDEX idx_chat_messages_conversa ON chat_messages(conversa_id, enviada_em DESC);
CREATE INDEX idx_chat_messages_pendentes ON chat_messages(tenant_id, status_envio) WHERE status_envio = 'pendente';

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_select_permissive ON chat_messages
  FOR SELECT USING (tenant_id = fn_tenant_id());

CREATE POLICY chat_messages_tenant_restrictive ON chat_messages
  AS RESTRICTIVE FOR ALL USING (tenant_id = fn_tenant_id());
```

**Decisão registrada:** `evolution_message_id` é UNIQUE por tenant. Webhook que reentrega mesma mensagem é absorvido idempotentemente — sem cobrar token OpenAI duas vezes.

### 4.4 `academia_config` — ALTER (caderno editorial)

```sql
ALTER TABLE academia_config
  ADD COLUMN argumentos_venda   JSONB,    -- [{contexto, argumento, evidencia}, ...]
  ADD COLUMN objecoes_comuns    JSONB,    -- [{objecao, resposta_padrao}, ...]
  ADD COLUMN palavras_proibidas TEXT[],   -- ["barato","desconto","promoção", ...]
  ADD COLUMN gatilhos_handoff   JSONB,    -- {desconto: true, pagamento: true, ...}
  ADD COLUMN persona_cmo        TEXT;     -- override do tom padrão do CMO
```

### 4.5 `tenants` — ALTER (budget OpenAI)

```sql
ALTER TABLE tenants
  ADD COLUMN ia_habilitada              BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN ia_limite_diario_usd       NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN ia_desabilitada_em         TIMESTAMPTZ,
  ADD COLUMN ia_desabilitada_motivo     TEXT;
```

**Defaults por tier (não enforced em schema — gerenciado em código de provisionamento):**

| Tier | `ia_limite_diario_usd` |
|---|---|
| Starter | 5.00 |
| Pro | 15.00 |
| Enterprise | configurável |

### 4.6 `ai_usage_log` (nova) — auditoria de cada chamada

```sql
CREATE TABLE ai_usage_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversa_id     UUID REFERENCES conversas(id),
  modelo          TEXT NOT NULL,           -- 'gpt-4o','claude-sonnet-4-6'
  tokens_entrada  INTEGER NOT NULL,
  tokens_saida    INTEGER NOT NULL,
  custo_usd       NUMERIC(10,6) NOT NULL,
  duracao_ms      INTEGER NOT NULL,
  sucesso         BOOLEAN NOT NULL,
  erro            TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_tenant_dia ON ai_usage_log(tenant_id, criado_em DESC);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_log_select_permissive ON ai_usage_log
  FOR SELECT USING (tenant_id = fn_tenant_id());

CREATE POLICY ai_usage_log_tenant_restrictive ON ai_usage_log
  AS RESTRICTIVE FOR ALL USING (tenant_id = fn_tenant_id());
```

### 4.7 `ai_usage_diario` (nova) — acumulador para kill switch

```sql
CREATE TABLE ai_usage_diario (
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data            DATE NOT NULL,
  custo_total_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  chamadas_count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, data)
);

ALTER TABLE ai_usage_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_diario_select_permissive ON ai_usage_diario
  FOR SELECT USING (tenant_id = fn_tenant_id());

CREATE POLICY ai_usage_diario_tenant_restrictive ON ai_usage_diario
  AS RESTRICTIVE FOR ALL USING (tenant_id = fn_tenant_id());
```

### 4.8 `leads` — sem alterações de schema

Schema atual já suporta o agente: `id`, `tenant_id`, `nome`, `telefone`, `remotejid`, `score`, `status`, `origem`. Tools do agente escrevem nestas colunas via RPC SECURITY DEFINER.

---

## 5. Funções e RPCs

### 5.1 `fn_tenant_id_by_evolution_instance(instance_name TEXT) → UUID`

Resolve `instance_name` recebido no webhook para `tenant_id`. Service_role bypassa RLS; função busca direto.

```sql
CREATE OR REPLACE FUNCTION fn_tenant_id_by_evolution_instance(p_instance_name TEXT)
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM evolution_instances
  WHERE instance_name = p_instance_name AND ativo = true;
  RETURN v_tenant_id;  -- NULL se não achar
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 5.2 `rpc_persistir_mensagem_entrada(...) → JSONB`

Webhook entry-point. Idempotente por `evolution_message_id`. Cria `conversas` se não existir. Retorna `{ ok, conversa_id, lead_id, ia_ativa }`.

### 5.3 `rpc_persistir_resposta_bot(...) → JSONB`

Persiste mensagem de saída ANTES do envio ao Evolution. Inicia com `status_envio = 'pendente'`. Atualizado pra `'enviada'` ou `'falhou'` após resposta da Evolution API.

### 5.4 `rpc_registrar_uso_ia(...) → JSONB`

Insere em `ai_usage_log`, atualiza `ai_usage_diario`. Trigger checa `ai_limite_diario_usd` e desabilita IA do tenant se exceder (kill switch — skill-seguranca §9.7).

### 5.5 `rpc_atualizar_score_lead(p_lead_id, p_score, p_motivo) → JSONB`

Re-valida tenant por PK (skill-seguranca §9.4). Atualiza `leads.score`. Loga motivo em `ai_usage_log.notas` (campo a adicionar se necessário).

### 5.6 `rpc_handoff_humano(p_conversa_id, p_motivo) → JSONB`

Seta `conversas.ia_ativa = false` + `motivo_handoff`. Dispara notificação (canal a definir em Fase 3.2).

---

## 6. Componentes — fluxo ponta a ponta

```
[Lead WhatsApp]
      │
      ▼ mensagem
[Evolution API V2 (instância do tenant)]
      │
      ▼ POST com HMAC
[/api/webhooks/evolution]  ← Next.js API Route
      │
      ├─ 1. validateSignature(body, x-evolution-signature)   ❌→ 401
      ├─ 2. rateLimitByIP                                    ❌→ 429
      ├─ 3. fn_tenant_id_by_evolution_instance(instance)     ❌→ 404
      ├─ 4. rateLimitByTenant(tenant_id)                     ❌→ 429
      ├─ 5. rpc_persistir_mensagem_entrada (idempotente)
      ├─ 6. conversas.ia_ativa?
      │      ❌ não → return 200 (humano cuida)
      ├─ 7. tenant.ia_habilitada?
      │      ❌ não → enviar fallback fixo ("breve um atendente"), return 200
      │      ✓ sim mas ia_desabilitada_em < hoje → reabilitar (reset diário)
      ├─ 8. carregar system_prompt + histórico (últimas 20 msgs)
      ├─ 9. OpenAI Chat Completion (tool use nativo)
      │      ├─ loop tool-use (máx 5 iter):
      │      │   ├─ executa tool chamada
      │      │   └─ envia resultado de volta ao LLM
      │      └─ resposta final em texto
      ├─ 10. guardrails determinísticos (§8)
      ├─ 11. rpc_persistir_resposta_bot
      ├─ 12. Evolution API send → atualiza status_envio
      ├─ 13. rpc_registrar_uso_ia (auditoria + kill switch check)
      └─ 14. return 200
```

**Decisão registrada:** webhook responde 200 sempre que mensagem foi **persistida com sucesso**, independente do resultado da IA. Falha da IA é tratada em background (log + alerta), nunca devolvida ao Evolution como erro (evita reentrega que ressuscita falha).

---

## 7. Contrato das tools

> Em `lib/agents/tools/marketing-cmo.ts`. Schemas em Zod para validação.

```typescript
// Verifica disponibilidade de horários para AE
{
  name: 'consultar_disponibilidade_ae',
  parameters: {
    data: 'YYYY-MM-DD',
    periodo: 'manha' | 'tarde' | 'noite'
  }
  returns: { horarios_disponiveis: string[] }  // ['07:00','08:00',...]
}

// Agenda AE no sistema da academia (escreve em leads + futuramente em agenda)
{
  name: 'agendar_aula_experimental',
  parameters: {
    lead_id: UUID,
    data: 'YYYY-MM-DD',
    horario: 'HH:mm',
    modalidade: string,   // 'musculacao','funcional','pilates', ...
    observacao: string?   // contexto adicional
  }
  returns: { ok: boolean, agendamento_id: UUID, mensagem_confirmacao: string }
}

// Salva perfil do lead conforme dados aparecem na conversa
{
  name: 'salvar_perfil_lead',
  parameters: {
    lead_id: UUID,
    nome: string?,
    objetivo: string?,           // 'emagrecer','ganhar_massa','saude','condicionamento'
    interesse_principal: string?, // modalidade ou serviço
    nivel_urgencia: 'baixa' | 'media' | 'alta' | null
  }
  returns: { ok: boolean }
}

// Calcula e grava score 1-10 (mecanismo separado do controle de fluxo)
{
  name: 'score_lead',
  parameters: {
    lead_id: UUID,
    sinais: {
      engajamento: 1..5,           // intensidade da conversa
      proximidade_decisao: 1..5,   // sinais de "quero agendar"
      compatibilidade_perfil: 1..5 // bate com persona-alvo da academia
    }
  }
  returns: { score: 1..10, faixa: 'frio' | 'morno' | 'quente' }
}

// Transfere conversa para atendente humano (irrevogável até ação humana)
{
  name: 'handoff_humano',
  parameters: {
    conversa_id: UUID,
    motivo: 'desconto' | 'reclamacao' | 'duvida_complexa' | 'pedido_explicito' | 'outro',
    observacao_para_atendente: string
  }
  returns: { ok: boolean }
}
```

**Decisão registrada:** `score_lead` recebe **sinais explícitos** parametrizados pelo LLM, não "deixa o LLM decidir o score livremente". Função SQL combina sinais via fórmula determinística — auditável, reproduzível.

---

## 8. Prompt strategy

### 8.1 Estrutura do system_prompt

```
[BLOCO 1 — Persona CMO]
Você é o CMO autônomo da {academia.nome}. Sua função é conversar com leads via
WhatsApp, entender o que buscam, e agendar uma Aula Experimental sempre que houver
fit. Você não vende — você consulta, entende e propõe.

[BLOCO 2 — DNA da academia] (de academia_config)
Bairro: {bairro} · Cidade: {cidade}
Diferenciais: {diferenciais}
Planos: {planos resumidos}
Horários: {horarios estruturados}
Tom de voz: {tom_de_voz}

[BLOCO 3 — Caderno editorial]
Argumentos de venda por contexto: {argumentos_venda}
Objeções comuns e respostas: {objecoes_comuns}
Palavras proibidas (não usar): {palavras_proibidas}
Quando transferir para humano: {gatilhos_handoff}

[BLOCO 4 — Regras inegociáveis]
- Nunca conceder desconto. Se lead pedir, chame handoff_humano.
- Nunca confirmar horário fora do funcionamento (você tem tool para checar).
- Nunca mencionar professor específico por nome.
- Se não souber a resposta, chame handoff_humano em vez de inventar.

[BLOCO 5 — Histórico da conversa]
{últimas 20 mensagens}
```

### 8.2 Modelo

GPT-4o por padrão (alinhado com `ARCHITECTURE.md` ADR-005). Tenant pode optar por Sonnet 4.6 via `tenants.modelo_ia` (coluna a ser adicionada na Fase 3.1 se houver demanda — não nesta entrega).

**Por que não GPT-4o-mini:** alinhado com manifesto linha 226 — tom consultivo paga o delta de custo. Lead frio em < 5min com agendamento bem-sucedido vale 50-100x o custo de tokens.

### 8.3 Cache

Prompt caching da OpenAI ativado por default. Bloco 1 + 2 + 3 + 4 são estáveis por tenant → custo marginal de turno = só Bloco 5 + resposta. Estimativa: < R$ 0,03 por turno após primeiro hit do dia.

---

## 9. Guardrails determinísticos (código pós-LLM)

Manifesto P6: regras invioláveis NÃO confiam em prompt. Validação em código após resposta do LLM.

| Guardrail | Trigger | Ação |
|---|---|---|
| **Horário** | LLM mencionou data/hora em texto | Parsing regex + check contra `academia_config.horarios`. Se fora: substitui resposta por fallback "vou verificar essa disponibilidade" e chama `consultar_disponibilidade_ae` |
| **Desconto** | Regex match em resposta OU input do lead: `(desconto\|cupom\|promo[çc][aã]o\|mais barato)` | Força `handoff_humano(motivo='desconto')` |
| **Preço** | LLM cita valor monetário em texto | Confronta com `academia_config.planos`. Se divergir > 5%: substitui por "vou confirmar esse valor com a equipe" + handoff |
| **Palavras proibidas** | Match em `academia_config.palavras_proibidas` | Remove a palavra (substitui por sinônimo neutro) OU força regeneração |
| **Identidade** | LLM mencionou nome próprio que não é do lead | Regex de nomes (lista mantida em `academia_config`) → substitui por "a equipe" |
| **Loop de tool-use** | Atingiu 5 iterações sem responder ao usuário | Fallback fixo: "Um momento, vou verificar isso com a equipe" + log alerta + handoff |
| **Resposta vazia ou >1200 chars** | LLM respondeu vazio ou muito longo | Re-prompt com instrução de tamanho, máx 1 retry |
| **Conversa degenerada** | N turnos consecutivos sem `salvar_perfil_lead` nem `consultar_disponibilidade_ae` | `handoff_humano(motivo='loop')` automático + notificação owner. N inicial = 5 turnos — ajustar com dados reais de campo. |

**Implementação:** `lib/agents/guardrails.ts` exporta `applyGuardrails(response, context)` que retorna `{ texto, handoff_solicitado, motivo }`. Ordem importa — handoff curto-circuita demais.

---

## 9b. Score em modo passivo

Score de lead (3 sinais × peso em `score_lead`) nunca foi testado em campo. Protocolo de ativação:

```
SCORE EM MODO PASSIVO:
- Calcular e registrar em leads.score a cada turno (tool score_lead já faz isso)
- NÃO usar score para decisão de handoff ou priorização por 30 dias após go-live
- Revisar distribuição estatística após 30 dias antes de ativar qualquer automação baseada em score
- Gatilho de ativação: P50 score > 5 E desvio padrão < 3 (sinal de que o modelo discrimina)
```

**Decisão registrada:** score é dado observável desde o primeiro turno, mas não é atuador de decisão no MVP.

---

## 10. Observability multi-tenant

### 10.1 Métricas por tenant (queryáveis via dashboard)

- Mensagens recebidas / enviadas / dia
- Latência P50/P95 do webhook
- Custo OpenAI / dia / mês
- Taxa de handoff (por motivo)
- Taxa de agendamento AE (meta PRD: > 30%)
- Tool calls por turno (saúde do prompt — esperado 1-2 médio)

### 10.2 Alertas (não bloqueiam, notificam)

| Alerta | Threshold | Canal |
|---|---|---|
| Kill switch acionado | `ai_habilitada` mudou para `false` | E-mail owner + dashboard |
| P95 webhook > 30s | Janela 1h | Dashboard |
| > 2 timeouts/dia em 1 tenant | Janela 24h | E-mail owner |
| Taxa handoff > 50% | Janela 24h | Dashboard (sinal de prompt fraco) |
| Custo OpenAI 80% do limite | Janela 1h | E-mail owner |

### 10.3 Endpoint de diagnóstico

`GET /api/admin/saude-mkt` — retorna por tenant: status IA, uso do dia, última mensagem processada, conversas em handoff. Sem valores de credencial. Sem dados de lead (só contadores).

---

## 11. Testes e gates pré-merge

```
□ Migrations rodam limpas em banco vazio + idempotentes em re-run
□ Suite RLS inversa para evolution_instances, conversas, chat_messages,
  ai_usage_log, ai_usage_diario (cross-tenant SELECT/INSERT/UPDATE/DELETE = 0)
□ Smoke test webhook: mensagem mock → 200 + chat_messages persistida
□ Smoke test kill switch: forçar ai_limite_diario_usd=0.01 → segunda chamada
  retorna fallback e tenants.ia_habilitada = false
□ Smoke test handoff: input "desconto" → conversas.ia_ativa = false
□ Smoke test idempotência: webhook reentregue 3x → chat_messages com 1 registro
□ HMAC inválido → 401 sem persistir nada
□ Lead novo: primeira mensagem cria leads + conversas + chat_messages
□ next build local passou sem erro de TS / ESLint
□ Smoke test deploy evidence: após deploy, SELECT em ai_usage_log WHERE criado_em > NOW() - INTERVAL '5 min' retorna linhas
□ Smoke test calls paralelas: forçar 2 tools no mesmo turno → ambas executam, ambas geram tool_result, sem erro 400
□ Gate de contraste (anti-vazamento UNIC): criar tenant fictício
  "Academia Premium Vértice" em staging — tom formal (sem "bora!", sem
  emoji em mensagem pós-aceite), paleta azul-marinho/branco (não vermelho),
  regra editorial específica (e.g. tratamento "senhor/senhora"). Rodar
  10 conversas de teste. UMA mensagem que soe UNIC (tom coloquial,
  vocabulário UNIC, emoji em contexto formal) = blocker. Teste pega
  vazamento de identidade silencioso, não só ausência de configurabilidade.
```

---

## 12. O que NÃO entra na Fase 3

| Item | Quando entra | Por quê não agora |
|---|---|---|
| Bridge IARA via `iara_tenant_id` | Quando primeiro tenant comprar os dois produtos | ADR-003: extensão, não refatoração |
| Múltiplas instâncias Evolution por tenant na UI | Tier Enterprise — Fase futura | Schema já suporta (tabela `evolution_instances`); UI só quando houver demanda |
| Transcrição de áudio (Whisper) | Fase 3.1 | Lead frio raramente manda áudio em primeiro contato; valida hipótese antes de pagar |
| Reabertura automática de lead frio (cron) | Fase 4 | MVP valida conversão imediata primeiro |
| Anonimização forte do payload OpenAI | Quando MKT tratar dados de saúde (PAR-Q comercial) | Lead frio expõe pouco PII; mitigação atual: telefone fica fora do prompt, vai só pras tools |
| Dashboard de conversas em tempo real | Fase 3.2 | Owner usa WhatsApp Web diretamente no MVP |
| Multi-idioma | Fase 5+ | UNIC é Campo Grande, PT-BR only |

---

## 13. Variáveis de ambiente necessárias

> Conforme `CLAUDE.md`: chaves de produção no painel Vercel, nunca no repo. Code lê via `cat .env.local` (com travas da `skill-seguranca` §0). Novas:

```
# Evolution API (nova: HMAC do webhook)
EVOLUTION_WEBHOOK_SECRET=          # gerar: openssl rand -hex 32
                                   # add em Vercel (3 ambientes) + pull local

# Rate limiting (novas, se ainda não existem)
UPSTASH_REDIS_URL=                 # painel Upstash
UPSTASH_REDIS_TOKEN=               # painel Upstash
```

**Já existentes (referência — não recolocar):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `CRON_SECRET`.

---

## 14. Gatilhos de revisita

> Manifesto P12: decisão fechada vira inegociável até gatilho objetivo. Lista abaixo é a condição de reabertura.

| Decisão | Gatilho de revisita |
|---|---|
| Processamento síncrono em API Route | P95 webhook > 30s OU > 2 timeouts/dia em 1 tenant em 7 dias consecutivos → considerar fila |
| GPT-4o como modelo padrão | Custo médio por turno > R$ 0,10 OU taxa handoff > 50% sustentada → testar Sonnet 4.6 |
| Caderno editorial em `academia_config` | Conteúdo editorial passar de 30k tokens OU precisar versionamento histórico → migrar para tabela `caderno_editorial_versoes` |
| Sem RAG | Conhecimento ultrapassar 50k tokens OU virar dinâmico (catálogo, estoque) |
| Sem anonimização forte do payload OpenAI | MKT começar a tratar dados de saúde (PAR-Q comercial, restrições clínicas) |
| Budget cap padrão R$ 5/dia Starter | > 10% dos tenants Starter atingirem kill switch em 1 mês |
| 1 instância Evolution por tenant na UI | Cliente Enterprise demandar matriz + filiais com instâncias separadas |
| ADR em arquivo dedicado vs inline | Quando ADRs em `.adrs/` chegarem a 10+, avaliar índice em `.adrs/README.md` |
| Engine fitness-only (léxico fitness em `lib/`) | MKT começar a vender para vertical não-fitness (dentistas, salões, terapia, etc.) → reabrir ADR-MKT-000, refatorar engine para suportar léxico configurável por vertical (`vertical_id` em `tenants`, `vertical_lexico` em `lib/agents/lexico/`) |

---

## 15. Próximos passos (briefing pro Code)

Sprint 1 — schema e fundação:
1. Criar migration `XXX_evolution_instances_e_conversas.sql` (tabelas 4.1, 4.2, 4.3)
2. Criar migration `XXX_academia_config_editorial.sql` (ALTER 4.4)
3. Criar migration `XXX_tenants_ia_budget.sql` (ALTER 4.5)
4. Criar migration `XXX_ai_usage.sql` (tabelas 4.6, 4.7 + trigger kill switch)
5. Criar funções e RPCs §5 (migration separada)
6. Rodar suite RLS inversa — gate obrigatório antes de Sprint 2

Sprint 2 — webhook e fluxo síncrono:
7. `lib/agents/cmo/system-prompt.ts` (montagem dinâmica)
8. `lib/agents/cmo/tools.ts` (handlers das 5 tools §7)
9. `lib/agents/cmo/guardrails.ts` (§9)
10. `app/api/webhooks/evolution/route.ts` (fluxo §6)
11. `lib/openai/client.ts` (cliente + tool use loop + log uso)

Sprint 3 — observability e UI mínima:
12. `app/api/admin/saude-mkt/route.ts`
13. Página `/dashboard/conversas` (lista + detalhe somente leitura)
14. Página `/dashboard/configuracoes/editorial` (CRUD `academia_config.argumentos_venda` etc.)

Sprint 4 — testes E2E e cutover:
15. Suite de smoke tests §11
16. Cadastrar Fitness UNIC como primeiro tenant
17. Conectar instância Evolution da UNIC
18. Cutover gradual: 10% do tráfego de lead → 50% → 100%

---

## 16. Referências

- `PRD.md` v1.0 — 18/mai/2026
- `ARCHITECTURE.md` v1.0 — 18/mai/2026 (ADRs 001-005)
- `DOMAIN.md` v1.0 — 18/mai/2026
- `CLAUDE.md` v1.1 — 19/mai/2026
- `Green_MANIFESTO_2026.md` v1.0 — 19/mai/2026 (P1–P12)
- `skill-seguranca/SKILL.md` (Fase 5 patterns: §0, §9.1–§9.8, §9b)
- `BRIEFING_CHAT_ANALISE_ARQUITETURAL.md` — 19/mai/2026

---

*Fim do ADR-MKT-001.*
