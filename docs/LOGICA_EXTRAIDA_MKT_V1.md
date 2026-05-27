# Lógica Extraída — MKT v1 (marketing-saas)

> Fonte: /Users/julianobortolato/marketing-saas @ 319f543ec54dbd5930def4afa2324f4611f66dda
> Objetivo: servir de briefing para reimplementação no MKT 2.0
> Este documento NÃO é código — é a inteligência de negócio que MKT v1 validou.

---

## 1. Fluxo Principal (sequência linear)

```
[Evolution API V2] POST webhook → /api/webhooks/evolution
    │
    ├─ 1. Ler raw body (texto puro — necessário para HMAC)
    ├─ 2. Verificar autenticação (3 caminhos em ordem de prioridade):
    │      a. HMAC-SHA256 em x-hub-signature-256  (smoke tests)
    │      b. Authorization: Bearer <secret>       (se Evolution suportar headers custom)
    │      c. ?secret=<valor> query param          (fallback — Evolution V2 salva URL as-is)
    │      → se nenhum válido → 401
    ├─ 3. Rate limit por IP (Upstash, 30 req/60s sliding window) → 429 se excedido
    ├─ 4. Parse JSON (Evolution V2 shape): extrair instance_name, remotejid, fromMe, conteudo
    ├─ 5. Resolver tenant: fn_tenant_id_by_evolution_instance(instance_name)
    │      → instância desconhecida → 200 ok (absorve silenciosamente)
    ├─ 6. Rate limit por tenant (Upstash, 100 req/60s sliding window) → 429 se excedido
    ├─ 7. ATOMIC ANCHOR: rpc_persistir_mensagem_entrada(...)
    │      → cria lead+conversa se primeiro contato
    │      → idempotência por evolution_message_id
    │      → retorna: { ok, idempotente, conversa_id, lead_id, ia_ativa }
    │      → a partir daqui: SEMPRE retornar 200 (absorção garantida)
    ├─ 8. idempotente=true → 200 ok (reentrega já processada, evita dupla cobrança OpenAI)
    ├─ 9. ia_ativa=false → 200 ok (handoff ativo, LLM bloqueado)
    ├─ 10. fromMe=true → 200 ok (eco de mensagem própria, previne loop)
    ├─ 11. Ler tenant row: ia_habilitada, ia_limite_diario_usd, iara_tenant_id
    │      → iara_tenant_id IS NOT NULL → 200 ok (bridge tenant, agente externo cuida)
    │      → ia_habilitada=false → enviar fallback "Recebi sua mensagem..." → 200 ok
    ├─ 12. Carregar contexto:
    │      a. academia_config (todos campos relevantes para prompt)
    │      b. chat_messages últimas 20 mensagens da conversa (DESC by enviada_em, reversed)
    │      c. Pre-LLM: checar gatilhos_handoff contra conteudo (keyword match)
    │         → se match → rpc_handoff_humano + fallback fixo → 200 ok (sem LLM)
    ├─ 13. buildSystemPrompt(academiaConfig, chatHistory) → string 5 blocos
    ├─ 14. callOpenAIWithTools(systemPrompt, userMessage, cmoTools, ...)
    │      → GPT-4o, tool_choice='auto', loop até 5 iterações
    │      → cada tool_use: dispatchTool → valida Zod → executa handler → tool_result
    │      → handoff_humano tool: +1 iteração com tool_choice='none' para mensagem de despedida
    │      → log rpc_registrar_uso_ia após CADA invocação (sucesso ou falha)
    ├─ 15. applyGuardrails(texto, context) → 7 checks determinísticos pós-LLM
    ├─ 16. Se handoff (tool ou guardrail): rpc_handoff_humano(...)
    ├─ 17. rpc_persistir_resposta_bot(...) com status_envio='pendente' (persist-before-send)
    ├─ 18. Evolution API sendText → POST /message/sendText/{instance_name}
    │      → atualizar chat_messages.status_envio para 'enviada' ou 'falhou'
    └─ 19. Retornar 200 { ok: true, conversa_id }
```

---

## 2. Guardrails Determinísticos (pré-LLM e pós-LLM)

### Pré-LLM (no webhook, antes de chamar OpenAI)

| Guardrail | Lógica | Decisão | Arquivo |
|---|---|---|---|
| HMAC / Bearer / Query auth | 3 caminhos de auth em ordem; qualquer válido passa | Rejeita 401 se nenhum bater | `route.ts:61-67` |
| Rate limit IP | Upstash sliding window 30 req/60s | Rejeita 429 | `route.ts:70-74` |
| Instância desconhecida | `fn_tenant_id_by_evolution_instance` retorna NULL | 200 silencioso (evita retries Evolution) | `route.ts:104-107` |
| Rate limit tenant | Upstash sliding window 100 req/60s | Rejeita 429 | `route.ts:110-113` |
| Idempotência | `evolution_message_id` UNIQUE por tenant em `chat_messages` | 200 silencioso (evita dupla cobrança OpenAI) | `route.ts:143-145` |
| Handoff ativo | `ia_ativa=false` retornado pelo RPC de persistência | 200 silencioso (LLM não chamado) | `route.ts:148-150` |
| fromMe echo | `key.fromMe=true` no payload Evolution | 200 silencioso (previne loop de resposta própria) | `route.ts:154-156` |
| Bridge tenant | `iara_tenant_id IS NOT NULL` na row do tenant | 200 silencioso (agente externo responsável) | `route.ts:166-168` |
| ia_habilitada=false | Kill switch acionado (budget ou manual) | Envia fallback fixo "Recebi sua mensagem...", 200 | `route.ts:171-201` |
| Gatilhos handoff (keyword) | `gatilhos_handoff` dict de `academia_config`: keywords ativas → match case-insensitive no conteúdo | `rpc_handoff_humano` + fallback fixo, sem LLM | `route.ts:229-253` |

### Pós-LLM (em `applyGuardrails`, 7 checks em ordem, short-circuit ao primeiro handoff)

| # | Guardrail | Lógica | Fallback enviado | Arquivo |
|---|---|---|---|---|
| 1 | Loop tool-use | `toolUseIterations >= 5` | `'Um momento, vou verificar isso com a equipe'` + handoff | `guardrails.ts:55-61` |
| 2 | Resposta vazia | `texto.trim() === ''` | `'Um momento, vou verificar isso com a equipe'` + handoff | `guardrails.ts:65-70` |
| 3 | Resposta muito longa | `texto.length > 1200` | texto original (não truncado) + handoff | `guardrails.ts:74-80` |
| 4 | Desconto detectado | Regex `/\b(desconto\|cupom\|promo[çc][aã]o\|mais barato)\b/i` no texto do LLM | `'Entendo que está buscando a melhor condição...'` + handoff | `guardrails.ts:83-89` |
| 5 | Preço divergente | Qualquer valor `R$` no texto do LLM que não apareça literalmente em `planos` JSON | `'Vou confirmar esse valor com a equipe...'` + handoff | `guardrails.ts:95-108` |
| 6 | Palavra proibida | Match de qualquer item de `academia_config.palavras_proibidas` no texto | `'Um momento, vou verificar como posso ajudar melhor.'` + handoff | `guardrails.ts:112-123` |
| 7 | Identidade (nomes próprios) | Match de nomes de staff não pertencentes ao lead | Substitui nome por `'a equipe'`, SEM handoff | `guardrails.ts:127-142` |

**Nota de engine vs tenant:**
- Guards 1–3: engine (limites técnicos)
- Guard 4: engine (regra de negócio universal para academias)
- Guard 5: tenant (depende de `academia_config.planos`)
- Guard 6: tenant (depende de `academia_config.palavras_proibidas`)
- Guard 7: tenant (depende de `academia_config.nomesProprios` — campo passado opcionalmente)

---

## 3. Tools / Function Calling

### Tool 1: `consultar_disponibilidade_ae`

- **Quando:** LLM quer verificar horários antes de agendar uma Aula Experimental
- **Input:** `{ data_iso: string (YYYY-MM-DD), horario_preferido?: string (HH:mm) }`
- **Execução:** Lê `academia_config.horarios` (JSONB `{text: string}`) do tenant. Se há texto de horários, retorna 6 slots fixos hardcoded (`['07:00', '09:00', '10:00', '15:00', '17:00', '19:00']`). Sem gestão real de conflitos — v1 é um proxy de disponibilidade estática.
- **Regras de validação:** Zod `consultarDisponibilidadeSchema` — `data_iso` deve ser `YYYY-MM-DD` regex
- **Output pro LLM:** `{ resultado: { horarios_disponiveis: string[], horarios_texto: string, data: string } }` ou `{ resultado: { horarios_disponiveis: [] } }` se sem config
- **Arquivo:** `lib/agents/cmo/tools.ts:197-231`

### Tool 2: `agendar_aula_experimental`

- **Quando:** LLM decide agendar após confirmar disponibilidade e intenção do lead
- **Input:** `{ lead_id: UUID, data: YYYY-MM-DD, horario: HH:mm, modalidade: string, observacao?: string }`
- **Execução:** `leads.update({ status: 'agendado' })` com filtro `.eq('tenant_id', tenantId).eq('id', lead_id)`. Não cria tabela de agenda dedicada — usa lead_id como referência. Tabela de agenda própria adiada para versão futura.
- **Regras de validação:** Zod `agendarAulaExperimentalSchema` — UUID obrigatório, regex YYYY-MM-DD, regex HH:mm, modalidade min 1 char
- **Output pro LLM:** `{ resultado: { ok: true, agendamento_id: lead_id, mensagem_confirmacao: string } }` ou `{ erro: string }`
- **Arquivo:** `lib/agents/cmo/tools.ts:233-265`

### Tool 3: `salvar_perfil_lead`

- **Quando:** LLM coleta informações do lead durante a conversa (nome, objetivo, urgência)
- **Input:** `{ lead_id: UUID, nome?: string, objetivo?: string, interesse_principal?: string, nivel_urgencia?: 'baixa'|'media'|'alta' }`
- **Execução:** `leads.update(campos_fornecidos)` — apenas campos não-undefined são atualizados. Se nenhum campo fornecido, retorna `{ ok: true }` sem query.
- **Regras de validação:** Zod `salvarPerfilLeadSchema` — lead_id UUID obrigatório, demais campos opcionais
- **Output pro LLM:** `{ resultado: { ok: true } }` ou `{ erro: string }`
- **Arquivo:** `lib/agents/cmo/tools.ts:267-297`

### Tool 4: `score_lead`

- **Quando:** LLM avalia qualidade do lead com base em sinais da conversa
- **Input:** `{ lead_id: UUID, sinais: { engajamento: int 1-5, proximidade_decisao: int 1-5, compatibilidade_perfil: int 1-5 } }`
- **Execução:** Fórmula determinística: `score = clamp(round((eng + prox + compat) * 10 / 15), 1, 10)`. Faixas: 1-4=`frio`, 5-7=`morno`, 8-10=`quente`. Chama `rpc_atualizar_score_lead(p_tenant_id, p_lead_id, p_score, p_motivo)` que faz UPDATE em `leads.score` com validação tenant.
- **Regras de validação:** Zod `scoreLeadSchema` — UUID, inteiros 1-5 em cada sinal
- **Output pro LLM:** `{ resultado: { score: int, faixa: 'frio'|'morno'|'quente' } }` ou `{ erro: string }`
- **Arquivo:** `lib/agents/cmo/tools.ts:299-333`

### Tool 5: `handoff_humano`

- **Quando:** Lead pede desconto, tem reclamação, dúvida complexa, ou solicita explicitamente humano
- **Input:** `{ conversa_id: UUID, motivo: 'desconto'|'reclamacao'|'duvida_complexa'|'pedido_explicito'|'outro', observacao_para_atendente: string }`
- **Execução:** Chama `rpc_handoff_humano(p_tenant_id, p_conversa_id, p_motivo)` que faz `conversas.update({ ia_ativa: false, motivo_handoff: motivo })`. Irrevogável até ação humana no dashboard.
- **Regras de validação:** Zod `handoffHumanoSchema` — UUID obrigatório, motivo enum, observacao min 1 char
- **Output pro LLM:** Após resultado da tool, uma iteração adicional com `tool_choice='none'` é forçada para o LLM gerar mensagem de despedida. O system prompt recebe o resultado da tool antes dessa última chamada.
- **Arquivo:** `lib/agents/cmo/tools.ts:335-360`

---

## 4. Loop de Tool Use

Implementado em `lib/openai/client.ts:callOpenAIWithTools`:

1. Máximo de 5 iterações (`MAX_TOOL_ITERATIONS = 5`)
2. Em cada iteração: POST `gpt-4o` com `tool_choice='auto'`
3. Se `choice.message.tool_calls` vazio → `finalText = content`, break
4. Se há tool calls → para cada call: `JSON.parse(arguments)` → `dispatchTool(name, args, context)`
5. Cada tool result é appendado às mensagens como `{ role: 'tool', tool_call_id, content: JSON.stringify(result) }`
6. Se a tool chamada foi `handoff_humano` → flag `handoffOccurred = true` → uma iteração extra com `tool_choice='none'` para gerar mensagem de despedida → break
7. Se 5 iterações esgotadas sem `finalText` → retorna fallback + `handoff_solicitado=true` (motivo: `loop_tool_use`)
8. `rpc_registrar_uso_ia` é chamado após o loop completo com tokens cumulativos de TODAS as iterações

**Garantia de tool_result:** Todo `tool_use` block recebe um `tool_result` correspondente antes da próxima chamada OpenAI — sem esse par, a API retornaria 400. O loop garante isso appendando o resultado antes de continuar (`route.ts:199-204`).

---

## 5. System Prompt — Estrutura (NÃO o conteúdo completo)

| Bloco | Conteúdo | Engine ou Tenant |
|---|---|---|
| BLOCO 1 — Persona CMO | Papel do agente (CMO consultivo), objetivo único (agendar Aula Experimental), regra anti-desconto. Override opcional via `persona_cmo`. | Hybrid: texto base é Engine; `persona_cmo` é Tenant |
| BLOCO 2 — DNA da academia | `nome_academia`, localização, tom de voz, diferenciais, horários (texto), planos (texto) | Tenant puro |
| BLOCO 3 — Caderno editorial | Escopo, tom editorial, restrições, objetivos, exemplos de abordagem, argumentos de venda, tratamento de objeções, palavras proibidas, gatilhos de handoff | Tenant puro |
| BLOCO 4 — Regras inegociáveis | Proibições absolutas (desconto, horário inventado, nome de colaborador, inventar plano). Instrução de usar tools corretas. Limite de 2 parágrafos por turno. | Engine puro — idêntico para todos os tenants |
| BLOCO 5 — Histórico da conversa | Últimas 20 mensagens (entrada: "Lead:", saída: "CMO:"). Variável por turno. | Tenant puro (dados da conversa) |

**Total de tokens estimados:** ~800–1.500 tokens de input por turno, dependendo da riqueza de `academia_config` e histórico. Blocos 1–4 são elegíveis para prompt caching (estáveis por tenant). Bloco 5 muda a cada turno.

**Como é montado:** função pura `buildSystemPrompt(academiaConfig, chatHistory)` em `lib/agents/cmo/system-prompt.ts:53-161`. Retorna string concatenada dos 5 blocos com `\n\n` entre eles.

---

## 6. Contexto Injetado em Runtime

| Bloco | Fonte | Quando é injetado | Engine ou Tenant |
|---|---|---|---|
| Histórico de conversa (últimas 20 msgs) | `chat_messages` WHERE `conversa_id = X` ORDER BY `enviada_em DESC` LIMIT 20, reversed | A cada webhook processado | Tenant |
| DNA da academia (nome, bairro, tom, diferenciais, horários, planos) | `academia_config` — colunas core da migration 0003 | A cada webhook processado | Tenant |
| Caderno editorial (escopo, tom, restrições, objetivos, exemplos, argumentos, objeções, palavras proibidas, gatilhos handoff, persona_cmo) | `academia_config` — colunas adicionadas em migration 0006 e 0011 | A cada webhook processado | Tenant |
| Resultado de tools | Retorno de `dispatchTool` no loop | Inline durante o tool-use loop | Hybrid |

---

## 7. Roteiro Conversacional

Não há roteiro fixo com etapas obrigatórias em sequência. O LLM conduz com guardrails:

- **Único objetivo de conversão explícito:** agendar Aula Experimental (declarado no Bloco 1 e Bloco 4 do system prompt)
- **Coleta de perfil progressiva:** `salvar_perfil_lead` chamada quando informações surgem naturalmente
- **Score sob demanda:** `score_lead` chamada quando o LLM detecta sinais suficientes para avaliar qualidade
- **Verificação antes de agendar:** o Bloco 4 instrui explicitamente chamar `consultar_disponibilidade_ae` antes de `agendar_aula_experimental`
- **Handoff imediato:** qualquer menção a desconto (Bloco 1 + Bloco 4) deve disparar `handoff_humano` sem tentar negociar

---

## 8. Handoff Humano

- **Triggers possíveis (4 caminhos distintos):**
  1. Pre-LLM: keyword em `academia_config.gatilhos_handoff` presente no conteúdo da mensagem de entrada
  2. LLM via tool: `handoff_humano` tool chamada pelo modelo
  3. Pós-LLM guardrail 4: desconto detectado no texto da resposta
  4. Pós-LLM guardrails 1,2,3,5,6: loop/vazio/longo/preço/palavra proibida

- **Execução:** `rpc_handoff_humano(p_tenant_id, p_conversa_id, p_motivo)` → `conversas.update({ ia_ativa: false, motivo_handoff: p_motivo })` com revalidação do tenant por PK

- **Pós-handoff:** Mensagens continuam sendo persistidas em `chat_messages` (webhook ainda recebe e persiste), mas o check `ia_ativa=false` no step 8 do pipeline bloqueia o LLM. Lead continua na mesma conversa.

- **Mensagem padrão por caminho:**
  - Keyword trigger: `'Já estou transferindo para um de nossos atendentes. Em breve alguém entrará em contato!'`
  - Tool handoff: LLM gera mensagem de despedida em iteração extra com `tool_choice='none'`
  - Guardrail desconto: `'Entendo que está buscando a melhor condição. Vou conectar você a um especialista que poderá ajudar com isso.'`
  - Guardrail outros (vazio, longo, preço, palavra): `'Um momento, vou verificar isso com a equipe'` ou `'Vou confirmar esse valor com a equipe...'`

- **Reativação:** Ação humana exclusiva no dashboard → Server Action `reativarAgente(conversaId)` → `conversas.update({ ia_ativa: true, motivo_handoff: null })`. Roles autorizados: `owner` e `manager`. Após reativação, próxima mensagem do lead volta ao pipeline LLM normalmente.

- **Resposta manual durante handoff:** Server Action `enviarMensagemManual(conversaId, conteudo)` — só funciona quando `ia_ativa=false`. Texto máx 4096 chars. Usa mesmo flow persist-before-send via `rpc_persistir_resposta_bot`.

---

## 9. Persistência

| Tabela | Quando escreve | Quando lê | Idempotência |
|---|---|---|---|
| `evolution_instances` | Provisionamento de tenant (fora do fluxo de mensagem) | Step 5 (resolver tenant) e Step 18 (pegar api_key) | Única por instance_name |
| `leads` | Step 7 (RPC cria lead no primeiro contato) + tool `salvar_perfil_lead` (atualiza campos) + tool `agendar_aula_experimental` (status→agendado) + tool `score_lead` (score via RPC) | Webhook leads (`/api/webhooks/leads`) | Nenhuma idempotência explícita para criação; o RPC usa SELECT antes de INSERT |
| `conversas` | Step 7 (RPC upsert ON CONFLICT tenant+remotejid) + `rpc_handoff_humano` (ia_ativa=false) + `reativarAgente` (ia_ativa=true) | Step 12 (carregado junto com chat_messages) e Step 11 (ia_habilitada check) | UNIQUE (tenant_id, remotejid) — upsert garante 1 conversa por número por tenant |
| `chat_messages` | Step 7 (mensagem de entrada via RPC) + Step 17 (resposta bot via RPC, status=pendente) + Step 18 (update status=enviada/falhou) | Step 12 (últimas 20 msgs para histórico) | UNIQUE (tenant_id, evolution_message_id) — absorve reentrega Evolution |
| `ai_usage_log` | `rpc_registrar_uso_ia` após cada chamada OpenAI (sucesso e falha) | `buildSaudeMktPayload` (latência p50/p95) | Sem idempotência — cada chamada gera nova linha |
| `ai_usage_diario` | Trigger `fn_acumular_uso_ia` AFTER INSERT em `ai_usage_log` | `buildSaudeMktPayload` (custo do dia, percentual) | PK (tenant_id, data) — upsert acumulativo |
| `tenants` | Trigger kill switch (`ia_habilitada=false`) via `fn_acumular_uso_ia` | Step 11 (ia_habilitada, iara_tenant_id, limite) | Sem idempotência (SET columns) |
| `academia_config` | Server Action `saveAcademiaConfig` (upsert ON CONFLICT tenant_id) e `saveEditorialConfig` (UPDATE by tenant_id) | Step 12 (contexto para system prompt) e tool `consultar_disponibilidade_ae` | UNIQUE tenant_id — 1 linha por tenant |
| `aprovacoes` | Não gerenciado no fluxo WhatsApp; escopo futuro (Phase 4/5) | `getWeeklyOrganicBatch` (dashboard aprovações) | N/A no fluxo atual |

---

## 10. Budget / Kill Switch / Rate Limit

### Budget diário (Kill Switch automático)

- **Colunas em `tenants`:** `ia_habilitada BOOLEAN DEFAULT true`, `ia_limite_diario_usd NUMERIC DEFAULT 5.00`, `ia_desabilitada_em TIMESTAMPTZ`, `ia_desabilitada_motivo TEXT`
- **Trigger:** `fn_acumular_uso_ia()` — AFTER INSERT ON `ai_usage_log` (SECURITY DEFINER)
- **Lógica:** Upsert em `ai_usage_diario` com custo acumulado do dia. Se `custo_total_usd >= ia_limite_diario_usd` E `ia_habilitada = true` → UPDATE `tenants SET ia_habilitada=false, ia_desabilitada_em=now(), ia_desabilitada_motivo='budget_diario_excedido'`
- **Detecção pelo webhook:** Step 11 lê `ia_habilitada`. Se false, envia fallback e retorna 200 sem chamar OpenAI
- **Reset:** Não há reset automático implementado. Manual via dashboard ou SQL (gap identificado)
- **Observabilidade:** `/api/admin/saude-mkt` (GET, role=owner apenas) expõe `usage_diario.percentual`, `status_ia.habilitada`, `latencia_24h.p50_ms`, `latencia_24h.p95_ms`

### Rate Limit (Upstash Redis)

- **IP:** 30 req/60s sliding window, prefixo `ratelimit:ip`
- **Tenant:** 100 req/60s sliding window, prefixo `ratelimit:tenant`
- **Comportamento em erro Upstash:** fail-open (retorna `{ success: true }` — webhook não é bloqueado)
- **Dev fallback:** sem `UPSTASH_REDIS_URL/TOKEN`, rate limiting desabilitado com `console.warn` único

### Custo por turno (estimativa de projeto)

- GPT-4o input: $0.0025/1k tokens
- GPT-4o output: $0.01/1k tokens
- Custo calculado em `lib/openai/client.ts:computeCost` antes de logar
- Limites padrão: Starter $5/dia, Pro $15/dia (comentário em migration 0008)

---

## 11. Decisões de Arquitetura Validadas

| Decisão | Status em produção | Levar pro MKT 2.0? |
|---|---|---|
| 3 caminhos de auth (HMAC + Bearer + query param) | ✅ funcionou — Evolution V2 não envia HMAC nem headers custom; query param `?secret=` foi o único path funcional em produção | Sim, mas simplificar: query param como padrão, HMAC como opcional |
| Persist-before-send (Step 17 antes do Step 18) | ✅ funcionou — mensagem gravada mesmo quando Evolution falha no envio | Sim, manter como princípio |
| ATOMIC ANCHOR (retorno 200 após persist, sempre) | ✅ funcionou — Evolution não faz retry infinito se recebe 200 | Sim, manter |
| Idempotência por `evolution_message_id` | ✅ funcionou — absorve reentregas sem cobrar token duas vezes | Sim, obrigatório |
| Loop tool-use max 5 iterações | ⏳ não testado em produção real com volume | Sim, mas instrumentar para medir frequência de iterações 2+ |
| `fromMe=true` skip | ✅ funcionou — previne loop de bot respondendo a si mesmo | Sim, obrigatório |
| `iara_tenant_id` bridge fence | ✅ funcionou — scope fence entre agentes | Sim, adaptar para MKT 2.0 se houver bridge |
| Guardrail desconto por regex (pré e pós-LLM) | ✅ funcionou — dupla camada: keyword trigger pré-LLM e regex pós-LLM | Sim, manter dupla camada |
| Kill switch por trigger AFTER INSERT | ✅ funcionou — atômico, sem race condition | Sim, manter |
| `consultar_disponibilidade_ae` retorna slots fixos | 🔸 funcional com ressalva — não há gestão real de conflitos; sempre retorna os mesmos 6 horários se há texto de horários | Substituir por tabela de agenda real no MKT 2.0 |
| `agendar_aula_experimental` usa `leads.status='agendado'` sem tabela dedicada | 🔸 funcional com ressalva — sem confirmação de slot, sem notificação da academia | Criar tabela `agendamentos` no MKT 2.0 |
| Score determinístico (fórmula numérica, não LLM) | ✅ funcionou — previsível, auditável | Sim, manter fórmula |
| Upstash rate limit fail-open | 🔸 funcional com ressalva — se Upstash estiver fora, sem rate limit | Manter fail-open mas alertar quando Upstash indisponível |
| `api_key_encrypted` armazenada como texto plano (TODO Vault) | 🔸 funcional com ressalva — TODO pendente de decriptação via Supabase Vault | Implementar Vault no MKT 2.0 |
| Prompt: blocos 1-4 estáveis para cache, bloco 5 variável | ⏳ não instrumentado — não há medição de cache hit rate | Sim, instrumentar cache hit rate no MKT 2.0 |
| fn_tenant_id() via DB (não JWT) | ✅ funcionou — JWT pode ser stale; DB garante valor atual | Sim, obrigatório |

---

## 12. O Que NÃO Levar (com motivo)

| Item | Por quê |
|---|---|
| Gestão de slots em `consultar_disponibilidade_ae` via horários fixos | Retorna os mesmos 6 slots independente de data/conflitos reais. Precisa de tabela `agendamentos` com slots reais. |
| `agendamento_id = lead_id` como referência de agendamento | Hack de v1: sem tabela dedicada, sem gestão de conflitos, sem notificação. |
| Ausência de reset automático do kill switch | Budget diário sem reset automático. Tenant fica bloqueado até ação manual. |
| `api_key_encrypted` como texto plano | TODO comentado no código — Supabase Vault nunca implementado. |
| Ausência de retry queue para `status_envio='falhou'` | Índice parcial `idx_chat_messages_pendentes` existe mas background worker não existe. Mensagens com falha de envio ficam sem retry. |
| `handoffMotivo` hardcoded como `'desconto'` após tool handoff | `lib/openai/client.ts:195` — o motivo real passado na tool call não é extraído; sempre retorna `'desconto'`. |
| Ausência de notificação ao owner após handoff | TODO comentado em `rpc_handoff_humano:299` — Fase 3.2 nunca implementada. |
| `nomesProprios` no guardrail 7 não populado | `applyGuardrails` aceita `nomesProprios` mas o webhook chama `applyGuardrails` sem esse campo — guardrail 7 nunca dispara em produção. |

---

## 13. Edge Cases Descobertos em Execução

**1. Evolution V2 não envia HMAC nem headers custom**

- Situação: Evolution API V2 não calcula HMAC-SHA256 nem permite configurar headers de autenticação além da URL
- Como o código trata hoje: 3 caminhos de auth em ordem — HMAC (testes), Bearer (headers), `?secret=` query param (fallback real)
- Arquivo: `route.ts:58-67`

**2. Evolution V2 não entrega webhook (causa desconhecida)**

- Situação: instância configurada mas Evolution não dispara webhook para a URL registrada
- Como o código trata hoje: não há tratamento — é blocker externo de infraestrutura, não bug de código. Pre-flight 6/6 completo mas sem confirmar recepção real de mensagens em produção.
- Arquivo: documentado em `DIAGNOSTICO_CHAT_cutover-webhook.md` (memory)

**3. Reentrega idempotente do Evolution**

- Situação: Evolution pode reenviar o mesmo message_id após timeout
- Como o código trata hoje: UNIQUE `(tenant_id, evolution_message_id)` em `chat_messages` + check de idempotência antes do LLM. Retorna 200 sem cobrar OpenAI.
- Arquivo: `route.ts:143-145`, `migration 0007:91`

**4. `fn_tenant_id()` retorna NULL após signup**

- Situação: usuário recém-criado sem registro em `public.usuarios` — função retorna NULL
- Como o código trata hoje: Server Actions checam `if (!tenantId)` e retornam erro amigável
- Arquivo: `app/dashboard/configuracoes/actions.ts:19-25`

**5. Múltiplos overloads de RPCs**

- Situação: RPCs criadas via SQL Editor sem rastreamento podem ter assinaturas diferentes; `CREATE OR REPLACE` falha com `SQLSTATE 42P13` ao renomear parâmetros; `COMMENT ON` falha com `SQLSTATE 42725` com múltiplos overloads
- Como o código trata hoje: migration 0010 abre com bloco `DO $$` que dropa TODOS os overloads de cada RPC gerenciada antes de recriar
- Arquivo: `migration 0010:10-31`

**6. `BULK INSERT` de aprovações cruzando tipo**

- Situação: ação de bulk approve/reject poderia afetar linhas de tipo `campanha` ao invés de `conteudo`
- Como o código trata hoje: Server Action `applyBatch` força `.eq('tipo', 'conteudo')` mesmo na bulk — isolamento APROV-02
- Arquivo: `app/dashboard/aprovacoes/actions.ts:26`

**7. Resposta manual tentada com IA ativa**

- Situação: atendente tenta enviar resposta manual antes de assumir a conversa
- Como o código trata hoje: `enviarMensagemManual` verifica `if (conversa.ia_ativa) return { error: 'IA está ativa...' }` antes de enviar
- Arquivo: `app/dashboard/conversas/actions.ts:88`

**8. `tool_choice='none'` na iteração de despedida**

- Situação: após handoff, o LLM poderia chamar outras tools na iteração de despedida, causando loop
- Como o código trata hoje: iteração de despedida usa `tool_choice='none'` — força resposta de texto puro
- Arquivo: `lib/openai/client.ts:215`

---

## 14. Métricas de Execução Conhecidas

- **Volume de mensagens em produção real:** não instrumentado (blocker: Evolution não entregando webhook conforme `DIAGNOSTICO_CHAT_cutover-webhook.md`)
- **Custo médio por turno:** não instrumentado em produção. Dados existem em `ai_usage_log` mas não há agregação além do diário
- **Latência p50/p95:** disponível via `/api/admin/saude-mkt` (calculado em memória a partir de `ai_usage_log.duracao_ms` das últimas 24h). Sem coleta automatizada ou alertas.
- **Taxa de tool call:** não instrumentado — `ai_usage_log` não registra quais tools foram chamadas
- **Taxa de handoff:** não instrumentado — `conversas.ia_ativa=false` pode ser consultado mas não há dashboard de taxa
- **Cache hit rate (prompt caching):** não instrumentado — blocos 1-4 são elegíveis mas não há medição de acertos
- **Taxa de falha de envio Evolution:** disponível via `chat_messages.status_envio='falhou'` mas sem alerta automático. `/api/admin/saude-mkt` expõe `mensagens.falhas_24h`.
