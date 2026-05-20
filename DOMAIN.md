# DOMAIN.md — marketing-saas
> Glossário: termo de negócio → significado técnico
> Versão 1.0 — 18/mai/2026

## Termos de negócio

| Termo | Significado no sistema |
|---|---|
| **Academia** | Um tenant. Cada academia é isolada por `tenant_id`. |
| **DNA da academia** | Tabela `academia_config` — tom de voz, bairro, diferenciais, planos, horários, identidade visual (`tema` JSONB). É tenant content — nunca em código. |
| **Lead** | Registro em `leads`. Pessoa que demonstrou interesse mas ainda não é aluno. |
| **AE (Aula Experimental)** | Evento de conversão. Lead agendado → status `agendado` em `leads`. |
| **Tráfego local** | Campanhas Google/Meta com raio de 5km a partir do endereço da academia. |
| **Agente WhatsApp** | Fluxo automatizado via Evolution API que responde leads em < 5 minutos. |
| **Conteúdo** | Registro em `conteudos` — post, story, reels ou anúncio gerado por IA. |
| **Campanha** | Registro em `campanhas` — conjunto de criativos e budget por canal. |
| **Criativo** | Conteúdo + configuração de público + bid de uma campanha. |
| **Brain** | Repo `marketing-brain` — prompts, templates e memória dos agentes. |
| **Memória de testes** | Arquivo por tenant no `marketing-brain` com histórico de anúncios que não converteram. |
| **Brecha de oferta** | Oportunidade identificada pela IA ao analisar anúncios dos concorrentes locais. |
| **Score do lead** | Campo `leads.score` (1-10) — calculado pelo agente com base em engajamento e perfil. |
| **Bridge IARA** | Campo `tenants.iara_tenant_id` — ativa integração com IARA Systems quando preenchido. |
| **Tier** | Plano do tenant: `starter` / `pro` / `enterprise`. Controla limites de uso. |

## Mapeamento de status

### Lead (`leads.status`)
```
novo → contatado → agendado → convertido
                            → perdido
```

### Campanha (`campanhas.status`)
```
rascunho → ativa → pausada → encerrada
```

### Conteúdo (`conteudos.status`)
```
rascunho → aprovado → publicado
```

## Canais suportados

| Canal | Código | Integração |
|---|---|---|
| Google Ads | `google` | Google Ads API |
| Meta Ads | `meta` | Meta Marketing API |
| WhatsApp | `whatsapp` | Evolution API V2 |
| Instagram orgânico | `instagram` | Meta Graph API |
| Google Meu Negócio | `gmb` | Google My Business API |
