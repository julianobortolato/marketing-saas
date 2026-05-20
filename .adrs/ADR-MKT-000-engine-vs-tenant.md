# ADR-MKT-000 — Aplicação do princípio Engine vs Tenant

> **Status:** Proposto — 20/mai/2026
> **Owner:** Juliano Bortolato
> **Repo:** `marketing-saas`
> **Localização canônica:** `.adrs/ADR-MKT-000-engine-vs-tenant.md`
> **Princípio universal:** `docs/principles/ENGINE_VS_TENANT.md`
> **Numeração:** 000 por ser fundacional — precede ADRs 001-005 (`ARCHITECTURE.md`) e ADR-MKT-001 logicamente, embora venha depois cronologicamente

---

## 1. Contexto

O `marketing-saas` (MKT) nasce em mai/2026 como SaaS multi-tenant para academias, atendendo aquisição de leads (lead frio → AE) via WhatsApp. O primeiro tenant é a Fitness UNIC (mesma empresa do owner). O segundo tenant esperado é uma academia fundadora não-relacionada nos próximos 3-6 meses.

A autópsia do IARA V2 (sistema irmão, brownfield) identificou que sua identidade institucional vazou para o engine compartilhado porque a fronteira entre **identidade do tenant individual** e **léxico da vertical** nunca foi formalizada como decisão arquitetural com regra mecânica. O custo dessa omissão é o sprint de débito técnico `S-DEBT-CRITICAL` aberto em mai/2026.

Este ADR formaliza, no nascimento do MKT, a aplicação do princípio universal `ENGINE_VS_TENANT.md` — para que o débito do V2 não se repita.

---

## 2. Decisão

O `marketing-saas` adota integralmente o princípio `ENGINE_VS_TENANT.md`. Aplicação específica:

**Camada 1 (identidade do tenant individual):** zero hardcode. Todo conteúdo específico de cliente vive em `academia_config` (e tabelas relacionadas — `evolution_instances`, `tenants`). Lista canônica abaixo.

**Camada 2 (léxico da vertical fitness):** **exceção consciente registrada**. Léxico fitness pode estar em código (`musculacao`, `funcional`, `pilates`, `AE`, `matrícula`, `aluno`) por escolha de escopo vertical-único. Gatilho de revisita objetivo: vender para vertical não-fitness (registrado no ADR-MKT-001 §14, linha 559).

---

## 3. Aplicação concreta — Camada 1

Pontos do schema e do código que materializam o princípio. Já implementados ou previstos no ADR-MKT-001.

| Conteúdo Camada 1 | Onde vive | Referência |
|---|---|---|
| Nome, bairro, cidade, telefone, e-mail | `academia_config` (colunas base) | ADR-MKT-001 §4.4 |
| Argumentos de venda | `academia_config.argumentos_venda` JSONB | ADR-MKT-001 §4.4 |
| Objeções e respostas | `academia_config.objecoes_comuns` JSONB | ADR-MKT-001 §4.4 |
| Palavras proibidas | `academia_config.palavras_proibidas` TEXT[] | ADR-MKT-001 §4.4 |
| Gatilhos de handoff | `academia_config.gatilhos_handoff` JSONB | ADR-MKT-001 §4.4 |
| Persona da IA (override do CMO padrão) | `academia_config.persona_cmo` TEXT | ADR-MKT-001 §4.4 |
| Lista de planos e preços | `academia_config.planos` JSONB (existente) | — |
| Horários de funcionamento | `academia_config.horarios` (existente) | — |
| Tom de voz | `academia_config.tom_de_voz` (existente) | ADR-MKT-001 §8.1 |
| Instância WhatsApp | `evolution_instances` (1:N tenant → instâncias) | ADR-MKT-001 §4.1 |
| Tema visual (cores, fonte) | `academia_config.tema_*` (a especificar antes do Sprint 3) | Este ADR §6 |
| Budget OpenAI | `tenants.ia_limite_diario_usd` | ADR-MKT-001 §4.5 |

**Validação em runtime:** system prompt do agente CMO é montado dinamicamente com placeholders resolvidos contra `academia_config` (ADR-MKT-001 §8.1 — Blocos 1-4). Não existe template estático com identidade de tenant hardcoded.

---

## 4. Exceção consciente — Camada 2 (léxico fitness)

**Decisão:** léxico fitness está aceito em código (`lib/`) por escolha de escopo vertical-único.

**Pontos do código que materializam a exceção:**

| Local | Conteúdo de léxico vertical | Justificativa |
|---|---|---|
| `lib/agents/tools/marketing-cmo.ts` | `modalidade: 'musculacao' \| 'funcional' \| 'pilates' \| ...` | Tools recebem enum fitness — fitness é o produto |
| `lib/agents/tools/marketing-cmo.ts` | `objetivo: 'emagrecer' \| 'ganhar_massa' \| 'saude' \| 'condicionamento'` | Léxico de objetivo de aluno |
| Nome de tool: `agendar_aula_experimental` | Termo "Aula Experimental" (AE) | Conceito-chave da vertical |
| Nome de tool: `consultar_disponibilidade_ae` | Mesmo | Mesmo |
| `DOMAIN.md` (glossário) | Termos: lead, AE, matrícula, modalidade, plano | Glossário é vertical-único intencional |

**Gatilho de revisita:** registrado no ADR-MKT-001 §14, linha 559 — "MKT começar a vender para vertical não-fitness (dentistas, salões, terapia, etc.) → reabrir ADR-MKT-000, refatorar engine para suportar léxico configurável por vertical (`vertical_id` em `tenants`, `vertical_lexico` em `lib/agents/lexico/`)".

**O que isso significa na prática:** até o gatilho disparar, novas tools/enums/conceitos fitness podem ser adicionados em `lib/` sem violar o princípio. Após o gatilho, o ADR é reaberto e a refatoração para multi-vertical entra como sprint dedicado.

---

## 5. Gate de auditoria — anti-vazamento contínuo

Toda PR que toca `lib/`, `components/`, `prompts/` ou caminhos compartilhados passa pelo checklist do princípio (`ENGINE_VS_TENANT.md` §"Regra mecânica"). O gate operacional já está formalizado no ADR-MKT-001 §11 (Testes e gates pré-merge), linha 502-509: "Gate de contraste (anti-vazamento UNIC): criar tenant fictício 'Academia Premium Vértice' em staging — tom formal, paleta azul-marinho/branco, regra editorial específica. UMA mensagem que soe UNIC = blocker."

Esse teste é a manifestação operacional do princípio: substitui mentalmente o cliente atual por um cliente de contraste, e se algo soa UNIC em vez de Vértice, há vazamento Camada 1 a ser corrigido.

---

## 6. Violação ativa a remediar antes do Sprint 1

**Local:** `CLAUDE.md` v1.1, seção "Identidade visual".
**Texto atual:** "O SaaS usa a identidade visual da Fitness UNIC — não há marca separada."
**Diagnóstico:** cristaliza o anti-padrão **Persona-cristalizada** em documento oficial. Encoraja futuras PRs a hardcodear cores, fontes e marca da UNIC em componentes compartilhados.

**Remediação:** patch do CLAUDE.md §Identidade visual (entregue junto com este ADR). Redação corrigida em arquivo separado — substituir a seção inteira pela versão que trata UNIC como **tenant seed**, não como **marca do produto**.

**Schema implícito a destravar:** colunas `academia_config.tema_*` (paleta de cores, tipografia, logo URL) precisam existir antes do Sprint 3 (UI mínima) — caso contrário a UI inevitavelmente vai hardcodear cores UNIC nos primeiros componentes. Migration a ser criada no Sprint 1, mesmo que a UI só consuma no Sprint 3.

---

## 7. Relação com outros docs

| Doc | Relação |
|---|---|
| `docs/principles/ENGINE_VS_TENANT.md` | Lei universal — este ADR é a aplicação local |
| `Green_MANIFESTO_2026.md` | Manifesto LLM-first — dimensão diferente, complementar |
| `ADR-MKT-001-agente-whatsapp.md` | Aplicação técnica concreta: schema, tools, prompt — encarna o princípio |
| `CLAUDE.md` (após patch) | Regras pro Code que enforce o princípio em runtime de PR |
| `ARCHITECTURE.md` (ADRs 001-005) | Decisões base de stack — não conflitam |

---

## 8. Histórico de revisões

| Versão | Data | Alteração |
|---|---|---|
| v1.0 | 20/mai/2026 | Versão inicial. Formalização do princípio aplicado ao MKT desde nascimento. |

---

*Fim do ADR-MKT-000.*
