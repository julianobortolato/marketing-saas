# ENGINE vs TENANT — Princípio de separação em SaaS multi-tenant

> **Tipo:** princípio universal, portável entre projetos
> **Versão:** v1.0 — 20/mai/2026
> **Localização canônica:** `docs/principles/ENGINE_VS_TENANT.md`
> **Owner:** Juliano Bortolato
> **Aplicações conhecidas:** `.adrs/ADR-MKT-000.md` (greenfield), `.adrs/ADR-V2-000.md` (brownfield)
> **Origem:** autópsia do IARA V2 (mai/2026) — débito de identidade UNIC vazado em engine compartilhado

---

## Como usar este documento

Princípio destilado, portável, focado em **uma dimensão única**: a fronteira entre código que processa (engine) e conteúdo que define um cliente específico (tenant). Convive lado a lado com outros princípios universais em `docs/principles/`, cada um com foco próprio (LLM-first, observability, billing, etc.).

Para aplicar a um projeto específico, criar ADR local que referencie este princípio e liste:
- Quais decisões do projeto seguem o princípio
- Quais exceções conscientes existem (com gatilho objetivo de revisita)
- Quais violações ativas existem e como serão remediadas (brownfield)

---

## Princípio em uma frase

Em projeto multi-tenant, **identidade de cliente específico vive em config por tenant — nunca em código compartilhado**. PR que cole identidade de cliente individual dentro de `lib/`, `components/`, `prompts/` ou qualquer caminho universal é rejeitada.

---

## Por que esse princípio existe

Três forças geram o anti-padrão:

**Força 1 — Viés do owner-cliente.** Quando o owner do SaaS é também o cliente piloto, a fronteira entre "o produto" e "minha empresa" fica psicologicamente nebulosa. Cada sprint resolve uma dor real do cliente piloto e "deixa pra refatorar depois" — esse "depois" vira 12 meses de débito. O viés é estrutural, não negligência.

**Força 2 — Tenant único existindo na prática.** Quando só existe 1 tenant rodando, qualquer coisa "funciona" em produção — o teste empírico falha em detectar acoplamento. Identidade vaza pelo caminho mais curto (`fs.readFileSync('CADERNO_X.md')`, constante hardcoded, enum colado em `lib/`) porque é mais rápido do que criar a abstração certa.

**Força 3 — PRD ambíguo sobre escopo.** "Multi-tenant" é polissêmico. Pode significar "vários clientes do mesmo segmento" (multi-cliente) ou "várias verticais distintas" (multi-vertical). Sem distinção explícita, o time investe em RLS por `tenant_id` (multi-cliente) e esquece de abstrair léxico/identidade (multi-vertical). O resultado é um SaaS que multi-instancia o schema mas é monolítico no conteúdo.

**Custo do anti-padrão (medido em projetos reais):**
- Sprint de débito de 3-5 dias quando o problema é detectado tardiamente
- Retrabalho de prompts, componentes, enums — quanto mais tarde, mais espalhado
- Bloqueio comercial: não dá pra demonstrar pra próximo cliente sem repintar tudo
- Cristalização em docs: anti-padrão vira "regra do produto" no CLAUDE.md, infectando futuras PRs

---

## As duas camadas de conteúdo de tenant

A regra mecânica só funciona se distinguir duas camadas. Tratá-las igual gera falsos positivos (paralisa o projeto) ou falsos negativos (deixa vazar identidade).

### Camada 1 — Identidade do tenant individual

Conteúdo que pertence a **um cliente específico** dentro da vertical do produto.

| Tipo de conteúdo | Exemplos |
|---|---|
| Marca e visual | Nome da empresa, cores, tipografia, logo, slogan |
| Tom de voz | Formal/coloquial, vocabulário próprio, expressões características |
| Caderno editorial | Argumentos de venda, objeções, respostas, palavras proibidas |
| Configuração comercial | Lista de planos, preços, horários, regras de cancelamento |
| Identidade humana | Nome de diretores, equipe, endereço, telefone |
| Persona da IA | Como a IA se apresenta como representante daquele tenant |

**Regra:** **SEMPRE em `<tabela_config_tenant>` por tenant. Zero exceções.** Hardcoded em código = violação inconsciente, PR rejeitada.

### Camada 2 — Léxico/domínio da vertical

Conteúdo que pertence à **vertical inteira** que o produto atende. É o vocabulário do segmento, não de um cliente.

| Tipo de conteúdo | Exemplos (vertical fitness) | Exemplos (vertical SaaS jurídico) |
|---|---|---|
| Termos de negócio | musculação, funcional, pilates, AE | petição, audiência, prazo, autos |
| Enums de domínio | objetivo: emagrecer, ganhar massa, saúde | tipo_ação: cível, trabalhista, criminal |
| Estados de processo | aluno ativo, ex-aluno, lead frio | em andamento, sentenciado, arquivado |
| Conceitos de produto | check-in, dossiê, anamnese | timesheet, billable hours, conflict check |

**Regra:** **pode estar em código quando o produto é vertical-único, MAS apenas com decisão consciente registrada em ADR local com gatilho objetivo de revisita.**

Sem ADR explícito documentando a escolha = é violação por omissão. A decisão "esse produto é só fitness" tem que estar escrita em algum lugar auditável — não pode ser premissa implícita.

---

## Regra mecânica — checklist binário

Aplicar a toda PR que toca código compartilhado (`lib/`, `components/`, `prompts/`, `templates/`, `enums/`, qualquer caminho não-tenant-específico):

```
□ A PR adiciona conteúdo da Camada 1 (identidade de cliente individual)?
  → SE SIM: PR rejeitada. Mover pra tabela de config por tenant.

□ A PR adiciona conteúdo da Camada 2 (léxico da vertical)?
  → SE SIM E existe ADR local declarando o produto como vertical-única:
    → Permitido. Verificar que está na lista de exceções do ADR.
  → SE SIM E não existe ADR documentando: PR rejeitada até decisão consciente.

□ A PR modifica conteúdo existente de Camada 1 ou 2?
  → Aplica mesmas regras do "adiciona".

□ A PR adiciona referência cruzada a um cliente específico
  (nome, marca, exemplo "como na Academia X")?
  → SE SIM: PR rejeitada. Exemplos genéricos ou abstrações de persona.
```

**Sinal de violação silenciosa:** se a PR funciona porque "é assim que o cliente atual faz" sem que o código declare "isso é configuração", há vazamento de identidade. Teste: substituir mentalmente o nome do cliente atual por "Cliente Genérico Inc" — se o código quebra ou fica estranho, está hardcoded.

---

## Anti-padrões identificáveis

Padrões nomeados para auditoria. Encontrar qualquer um = débito de Camada 1 com remediação obrigatória.

| Anti-padrão | Sinal | Substituto correto |
|---|---|---|
| **Caderno-no-FS** | `fs.readFileSync('CADERNO_X.md')` em código de produção | Conteúdo em coluna JSONB/TEXT em `<config_tenant>` |
| **Identidade-no-prompt** | System prompt com nome de empresa hardcoded | Template com placeholder `{tenant.nome}` resolvido em runtime |
| **Cor-no-componente** | `bg-[#E30613]` (vermelho UNIC) em componente compartilhado | CSS var (`var(--brand-primary)`) carregada do tema do tenant |
| **Tom-no-código** | `if (cliente_x) return "bora!"` ou template específico de cliente | `tom_de_voz` em `<config_tenant>` injetado no prompt |
| **Persona-cristalizada** | "O SaaS usa a identidade visual da [Cliente X]" em doc oficial | "O SaaS suporta tema por tenant; [Cliente X] usa cores documentadas em [...] como seed" |
| **Exemplo-com-nome** | Comentário "// como faz a Academia UNIC com o plano dela" | Comentário genérico ou exemplo abstrato |
| **Enum-de-cliente** | `enum Plano { UNIC_PERSONAL, UNIC_TRADICIONAL }` | `planos` JSONB por tenant em `<config_tenant>` |
| **Endereço-no-código** | Constante com telefone, endereço, e-mail do cliente | Em `<config_tenant>` |

---

## Casos limítrofes — parece violação mas não é

**1. Léxico da vertical aceito em `lib/`** *(parece violação, não é se documentado)*

Exemplo: `lib/agents/tools.ts` aceita parâmetro `modalidade: 'musculacao' | 'funcional' | 'pilates'`.

Não é violação Camada 1 — é léxico de vertical. Aceitável **se** existe ADR local declarando o produto como vertical-fitness com gatilho objetivo de revisita ("se MKT vender pra vertical não-fitness, refatorar para `vertical_lexico` configurável"). Sem ADR explícito → vira violação por omissão.

**2. Tenant default em ambiente de desenvolvimento** *(parece violação, não é)*

Seed que cria `tenant_id = 'unic-pilot'` em ambiente local para o owner testar sem precisar provisionar cada vez.

Não é violação se: o seed está em `seeds/` (não em `lib/`), o tenant é tratado como qualquer outro tenant pelo código, e a ausência de hardcode é verificável (pesquisa por "unic" em `lib/` retorna zero).

**3. Skill ou template canônico citando cliente real como exemplo** *(parece violação, não é)*

Documentação técnica que cita "exemplo: no caso da Fitness UNIC, o caderno tem X linhas" para ilustrar uso.

Não é violação porque é doc, não código. Mas cuidado: se o exemplo vira "regra de produto" ("o caderno deve ter X linhas como na UNIC"), o anti-padrão pulou pra cristalização. Manter exemplos como ilustração, nunca como spec.

## Casos limítrofes — parece OK mas é violação

**1. Constante "neutra" com valor do cliente atual**

```typescript
export const TIPOGRAFIA_PADRAO = 'Syne';  // fonte da UNIC
```

Nome genérico esconde que o valor é específico do cliente. Violação Camada 1 — tipografia é identidade visual. Substituto: `tema.tipografia` por tenant.

**2. Cor "padrão" do sistema que é cor do cliente**

```css
:root {
  --primary: #1A2E4A;  /* Midnight da PRISMA */
}
```

Parece neutro, mas se o `--primary` veio das cores do cliente, virou identidade compartilhada. Em produto multi-tenant, `:root` carrega cores **do tema padrão de fallback**, e cada tenant sobrescreve via CSS vars carregadas do banco.

**3. Comentário que documenta a violação**

```typescript
// TODO: extrair pra config quando tivermos segundo cliente
const HORARIO_FUNCIONAMENTO = '05h-21h';
```

Reconhecer o débito não anula a violação. Esse comentário é exatamente como o `CADERNO_LEGACY.md` vazou no IARA V2 — todo mundo sabia, ninguém escalou. Regra: não cria o débito; se já existe, remedia.

---

## Como auditar (instruções pra Code/skill)

Auditoria de violação Camada 1 em projeto existente. Output esperado: lista de pontos a corrigir, não correção em si.

```
1. Listar nomes de identidade do cliente atual:
   - Nome da empresa, variantes (UNIC, Fitness UNIC, FU)
   - Nome de diretores/sócios
   - Cores específicas (hex codes da marca)
   - Tipografias específicas
   - Tom de voz característico (palavras de assinatura)
   - Endereço, telefone, e-mails de domínio

2. Grep recursivo em código compartilhado (excluir seeds/, scripts/, docs/):
   grep -rn -i "<termo>" lib/ components/ prompts/ templates/

3. Para cada hit, classificar:
   a. Variável/constante hardcoded → VIOLAÇÃO Camada 1 (remediar)
   b. String em prompt template sem placeholder → VIOLAÇÃO Camada 1
   c. Exemplo em comentário ou docstring → permitido (sinalizar se virou spec)
   d. Tipo/enum com nome de cliente → VIOLAÇÃO Camada 1
   e. Path/filename com nome de cliente → VIOLAÇÃO Camada 1
   f. Léxico de vertical (modalidade, AE, etc.) → verificar ADR local
      - Existe ADR declarando vertical única? → permitido
      - Não existe? → VIOLAÇÃO por omissão (criar ADR ou abstrair)

4. Entregar:
   - Lista numerada de violações Camada 1 com caminho + linha
   - Lista numerada de violações por omissão Camada 2 (sem ADR)
   - Sugestão de remediação por tipo (não código pronto — owner prioriza)
   - Estimativa de esforço por bloco
```

Skill recomendada para automatizar: criar `skill-tenant-audit/` que executa esta auditoria com prompt cirúrgico, separada do executor que aplica correções.

---

## O que esse princípio **não** cobre

Para evitar diluição, escopo explícito:

- **Não cobre arquitetura LLM-first** → ver `MANIFESTO_2026.md`
- **Não cobre billing/pricing por tenant** → outro princípio universal a escrever
- **Não cobre observability multi-tenant** → ver convenções específicas do projeto
- **Não cobre RLS/isolamento de dados** → ver `skill-seguranca` ou ADRs de schema do projeto
- **Não cobre internacionalização (i18n)** → idioma é dimensão ortogonal, exige princípio próprio
- **Não cobre customização de feature flags por plano** → escopo de billing/produto

---

## Aplicações conhecidas

| Projeto | ADR local | Status |
|---|---|---|
| `marketing-saas` (MKT) | `.adrs/ADR-MKT-000.md` | Greenfield — princípio aplicado desde dia 1 |
| `iara-systems-v2` (V2) | `.adrs/ADR-V2-000.md` | Brownfield — violações ativas, remediação em `S-DEBT-CRITICAL` |

---

## Histórico de revisões

| Versão | Data | Alteração |
|---|---|---|
| v1.0 | 20/mai/2026 | Versão inicial. Destilado da autópsia do IARA V2 e do ADR-MKT-001 do `marketing-saas`. |

---

*Fim do ENGINE_VS_TENANT.md*
