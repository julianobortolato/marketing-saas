# ENGINE_VS_TENANT — Fronteira entre engine e conteúdo do tenant

> **Status:** Ativo
> **Versão:** 1.0 — 20/mai/2026
> **Autor:** Juliano Bortolato
> **Localização canônica:** `docs/principles/ENGINE_VS_TENANT.md`
> **Aplicações registradas:** ADR-MKT-000 · ADR-V2-000

---

## 1. O princípio (cabe num post-it)

> **Código de engine não conhece nenhum tenant. Tudo que varia por tenant vive no banco — nunca em código, prompt hardcoded ou arquivo de configuração do repositório.**

---

## 2. Definições

| Termo | Definição | Exemplos |
|---|---|---|
| **Engine** | Código, prompts-template, guardrails e configurações que vivem no repositório e são iguais pra todos os tenants | `lib/agents/`, `app/api/webhooks/`, migrations, system prompt com `{placeholders}` |
| **Tenant content** | Tudo que pertence a um tenant específico e varia entre tenants | Nome da academia, tom de voz, cores, argumentos de venda, palavras proibidas, logo, planos, horários |
| **Fronteira** | O ponto onde engine para e tenant content começa | Leitura de `academia_config` / `tenants` no início de cada operação — a partir daí, tudo é variável |
| **Exceção temporal** | Conteúdo de tenant aceito em engine por decisão explícita, com gatilho objetivo de remoção registrado em ADR | Enum de modalidades fitness em tool — válido enquanto vertical único |
| **Drift disfarçado de exceção** | Conteúdo de tenant em engine sem ADR registrando o gatilho de remoção | `#E30613` como cor do produto, "bora!" como tom padrão do agente |

---

## 3. Regra mecânica

A seguir, violações detectáveis em PR review. Cada uma tem exemplo de código que viola e o padrão correto.

### 3.1 Cor, logo ou token visual de tenant em código

**Viola:**
```typescript
// lib/theme.ts
export const PRIMARY = '#E30613'   // cor da Fitness UNIC hardcoded no engine
```

**Passa:**
```typescript
// lib/theme.ts — engine lê do banco
const theme = await db.from('academia_config')
  .select('tema').eq('tenant_id', tenantId).single()
const primary = theme.data?.tema?.primary ?? '#000000'  // fallback neutro
```

**Regra:** PR que define cor, fonte, logo ou qualquer token visual como constante em `lib/`, `components/`, `app/` ou arquivo de configuração (`tailwind.config`, `globals.css`) **sem** ler de `academia_config.tema` é rejeitada.

---

### 3.2 Nome, slogan ou texto de marketing de tenant em código ou prompt

**Viola:**
```typescript
// lib/agents/cmo/system-prompt.ts
const BASE = `Você é o CMO da Fitness UNIC, a melhor academia de Campo Grande.`
```

**Passa:**
```typescript
// lib/agents/cmo/system-prompt.ts
const BASE = `Você é o CMO autônomo da ${config.nome_academia}.`
// config vem de academia_config — lido antes de montar o prompt
```

**Regra:** PR que contém nome próprio de academia, cidade específica, slogan ou qualquer texto de marketing como string literal em código ou template de prompt **é rejeitada**.

---

### 3.3 Arquivo de configuração ou memorial de tenant no repositório

**Viola:**
```
/lib/tenants/unic-config.ts        ← arquivo por tenant no repo
/lib/tenants/vertice-config.json   ← idem
/docs/cadernos/unic-editorial.md   ← memorial lido em runtime via fs.readFileSync
```

**Passa:**
```
banco → academia_config (colunas argumentos_venda, objecoes_comuns, persona_cmo)
banco → evolution_instances (por tenant)
```

**Regra:** PR que adiciona arquivo com nome de tenant ou lê arquivo de tenant via `fs.readFileSync` / `import` em runtime **é rejeitada**.

---

### 3.4 Enum que só funciona pra um vertical ou um tenant

**Viola:**
```typescript
// tool agendar_aula_experimental — enum hardcoded sem ADR
modalidade: z.enum(['musculacao', 'funcional', 'pilates'])
// Se cliente for estúdio de boxe, esse enum rejeita 'boxe' silenciosamente
```

**Passa (com exceção temporal registrada em ADR):**
```typescript
// Aceito enquanto MKT for vertical fitness único — ver ADR-MKT-000 §3
modalidade: z.enum(['musculacao', 'funcional', 'pilates'])
// TODO: migrar para vertical_modalidades quando primeiro tenant não-fitness entrar
```

**Regra:** Enum que pressupõe vertical ou identidade de tenant **sem comentário apontando pro ADR** que registra o gatilho de remoção é rejeitado.

---

### 3.5 Segredo ou credencial de tenant em variável de ambiente do engine

**Viola:**
```
UNIC_EVOLUTION_API_KEY=xxx   # credencial de tenant específico em .env do engine
```

**Passa:**
```sql
-- api_key_encrypted armazenada em evolution_instances.api_key_encrypted (Supabase Vault)
-- lida em runtime por tenant, nunca em variável de ambiente do engine
```

**Regra:** PR que adiciona variável de ambiente com nome de tenant ou credencial individual de tenant em `.env.example` ou `CLAUDE.md` **é rejeitada**.

---

## 4. Exceções aceitas — critério objetivo

Uma exceção é legítima se satisfizer **os três critérios** abaixo. Se falhar em qualquer um, é drift.

| Critério | Pergunta de teste |
|---|---|
| **1. ADR registrada** | Existe `.adrs/ADR-XXX-YYY.md` citando esta exceção com justificativa? |
| **2. Gatilho de remoção objetivo** | O ADR define condição mensurável (não "quando fizer sentido") que obriga refatoração? |
| **3. Genérica dentro do vertical** | O conteúdo serve qualquer tenant do vertical, não um tenant específico? |

**Exemplo que passa nos 3:**
- Enum `['musculacao','funcional','pilates']` em tool — ADR-MKT-000 §3 registra, gatilho é "primeiro tenant não-fitness", serve qualquer academia fitness.

**Exemplo que falha no critério 3:**
- `#E30613` como cor padrão do produto — serve só a UNIC, não serve Academia Vértice com paleta azul-marinho.

**Exemplo que falha no critério 2:**
- `CADERNO_LEGACY.md` lido via `fs.readFileSync` sem gatilho de remoção — drift disfarçado de "decisão técnica".

---

## 5. Aplicação por camada

| Camada | Engine (repositório) | Tenant content (banco) |
|---|---|---|
| **Schema** | Estrutura das tabelas, índices, políticas RLS | Linhas — cada tenant popula as suas |
| **Código** | Templates com `{placeholders}`, guardrails genéricos, tools com parâmetros | Valores que preenchem os placeholders |
| **Prompt** | System prompt com blocos `[BLOCO 1..N]` e `{academia.campo}` | `academia_config.*` que preenche os blocos |
| **Config** | `tailwind.config` com tokens CSS neutros ou variáveis | `academia_config.tema` com tokens do tenant |
| **UI — dashboard** | Componentes, layouts, navegação — marca do SaaS | Nome da academia no header, dados do perfil |
| **UI — saída externa** | Template de mensagem WhatsApp, template de post | Tom, copy, hashtags vindos de `academia_config` |
| **Variáveis de ambiente** | Chaves de infraestrutura compartilhada (Supabase, OpenAI, Vercel) | Credenciais por tenant em `evolution_instances.api_key_encrypted` |

---

## 6. Modelo de produto implicado por este princípio

Este princípio pressupõe **modelo B parcial:**

- **Dashboard** tem marca do SaaS (engine controla visual)
- **WhatsApp, conteúdo gerado, e qualquer saída que o lead vê** reflete identidade do tenant (tenant content controla visual da saída)

Dashboard white-label total (modelo B puro) requer extensão deste princípio: tokens visuais do dashboard também viram tenant content. Isso exige ADR dedicada antes de implementar.

---

## 7. Apêndice — anti-padrões observados

Lista factual. Sem moralizar — só registrar pra não repetir.

| Anti-padrão | Onde apareceu | Consequência observada |
|---|---|---|
| Memorial de tenant (`CADERNO_LEGACY.md`) lido via `fs.readFileSync` no orquestrador | IARA V2 — produção | Engine assumiu identidade do primeiro tenant; segundo tenant herdaria léxico do primeiro |
| Enums `IARA_FASES` e `HISTORICO_TREINO` fitness-only sem exceção registrada | IARA V2 — produção | Vertical não-fitness tecnicamente inviável sem refatoração de código |
| `keywords_ibc6.ts` com léxico fitness embutido | IARA V2 — produção | IBC (metodologia do produto) misturado com fitness (vertical do primeiro cliente) |
| Tokens visuais do tenant (`#E30613`, fontes UNIC) como design system do engine | marketing-saas — CLAUDE.md v1.1 | Engine prescreveria identidade UNIC a todo tenant futuro; segundo tenant quebraria gate de contraste |
| Nome do produto ("Prisma") mencionado em CLAUDE.md de outro projeto | marketing-saas — referência a projeto morto | Drift de identidade silencioso em instruções do agente Code |

---

## 8. Gatilhos de revisita

Este princípio é revisitado quando qualquer uma das condições abaixo for verdadeira:

- Produto adotar modelo white-label total (B puro) → extensão da seção 5 para tokens visuais do dashboard
- Produto expandir para multi-vertical (fitness + não-fitness) → seção 4 "exceções aceitas" ganha critério de vertical
- Aparecimento de novo anti-padrão não listado na seção 7 → incluir + abrir ADR no repo afetado
- ADR local que referencia este princípio for revisitada → checar se regra mecânica ainda captura o caso

---

## 9. Apêndices — aplicações registradas

- **Apêndice A:** [ADR-MKT-000](.adrs/ADR-MKT-000.md) — aplicação ao marketing-saas (greenfield)
- **Apêndice B:** [ADR-V2-000](.adrs/ADR-V2-000.md) — aplicação ao IARA V2 (débitos ativos)
