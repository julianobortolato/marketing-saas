# PRD — marketing-brain
> Versão 1.0 — 18/mai/2026

## O que é este repo

O cérebro do sistema. Contém os prompts, templates editoriais, memória de testes e configuração dos agentes de IA que o `marketing-saas` usa em runtime.

**Não tem servidor. Não faz deploy.** É lido pelo `marketing-saas` como fonte de conhecimento.

## Estrutura de pastas

```
marketing-brain/
├── agents/                       # definição de cada agente
│   ├── whatsapp-resposta/        # agente de atendimento WhatsApp
│   ├── content-creator/          # agente de criação de conteúdo
│   ├── competitor-scout/         # agente de inteligência competitiva
│   └── campaign-optimizer/       # agente de otimização de campanhas
│
├── templates/                    # templates editoriais por canal
│   ├── whatsapp/
│   ├── instagram/
│   ├── google-ads/
│   └── meta-ads/
│
├── clients/                      # memória e configuração por tenant
│   └── _template/                # modelo para novo cliente
│       ├── config.json           # DNA da academia (espelha academia_config)
│       ├── memoria-testes.md     # anúncios que falharam — agente não repete
│       └── CLAUDE.md             # tom de voz e regras locais deste cliente
│
├── skills/                       # skills de marketing (Progressive Disclosure)
│   ├── INDEX.md                  # 1 linha por skill — agente carrega sob demanda
│   ├── trafego-local/
│   ├── ugc-to-content/           # vídeo bruto → post
│   ├── resposta-rapida/
│   └── competitive-intel/
│
├── guardrails/                   # regras que todos os agentes seguem
│   ├── LGPD.md
│   ├── tom-de-voz-global.md
│   └── limites-de-acao.md        # o que o agente NUNCA faz sozinho
│
└── README.md
```

## Princípio de Progressive Disclosure

**Problema:** Se o agente ler todos os templates toda vez, o custo de tokens explode com múltiplos tenants.

**Solução:** `skills/INDEX.md` lista apenas nome + 1 linha de cada skill. O agente carrega o manual completo da skill **só quando a tarefa atual exige**.

```markdown
# INDEX.md — exemplo
- trafego-local: Cria e otimiza campanhas Google/Meta para raio de 5km
- ugc-to-content: Transforma vídeo bruto em post com copy e hashtags
- resposta-rapida: Roteiro de atendimento WhatsApp para agendamento em < 5min
- competitive-intel: Monitora biblioteca de anúncios dos concorrentes locais
```

## Como o marketing-saas lê este repo

```
1. Agente recebe tarefa (ex: "criar post para Instagram da Academia X")
2. marketing-saas lê clients/[tenant_slug]/config.json → DNA da academia
3. marketing-saas lê skills/INDEX.md → identifica skill necessária
4. marketing-saas lê skills/ugc-to-content/SKILL.md → carrega o manual
5. Agente executa com contexto mínimo necessário
```

## O que NÃO entra aqui

- Código de aplicação (fica no marketing-saas)
- Schema de banco de dados
- Lógica de autenticação ou multi-tenant
- Integrações de API (ficam no marketing-saas)

## Regra de atualização

Mudanças editoriais (tom de voz, templates, guardrails) → commit aqui, sem deploy no marketing-saas.
Mudanças de schema de prompts que afetam como o marketing-saas lê os arquivos → commit coordenado nos dois repos.
