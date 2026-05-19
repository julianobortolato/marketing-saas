# Requirements: marketing-saas

**Defined:** 2026-05-18
**Core Value:** Campanhas Google/Meta rodando com raio de 5km sem que o dono da academia precise abrir um Ads Manager — leads chegam, o sistema trata.

## v1 Requirements

### Foundation

- [ ] **FOUND-01**: Usuário pode criar conta com email e senha e manter sessão ativa entre reloads
- [ ] **FOUND-02**: Sistema cria tenant no signup com campos: slug, plano (starter/pro/enterprise), ativo, setup_fee_pago, contrato_anual, fundador; função `fn_calcular_mensalidade()` disponível
- [ ] **FOUND-03**: Dono preenche DNA da academia (academia_config): bairro, raio_km, tom de voz, diferenciais, horários e planos oferecidos
- [ ] **FOUND-04**: Tenant suporta roles: owner / manager / viewer com controle de acesso por papel

### Aprovações

- [ ] **APROV-01**: Sistema mantém fila semanal de posts orgânicos para aprovação em lote (até 10 por vez); dono aprova ou rejeita em bloco no dashboard
- [ ] **APROV-02**: Anúncios pagos exigem aprovação individual explícita do dono antes de qualquer publicação; nenhuma campanha paga sobe sem approve registrado em `aprovacoes`

### Lead Pipeline

- [ ] **LEAD-01**: Sistema recebe lead via webhook (Meta Lead Form ou mensagem WhatsApp) e cria registro em `leads` com origem, telefone e status `novo`
- [ ] **LEAD-02**: Dono visualiza lista de leads com status, filtros (por status, canal, data) e pode alterar o status manualmente
- [ ] **LEAD-03**: Dono pode cadastrar lead manualmente no painel informando nome, telefone e origem

### WhatsApp

- [ ] **WHATS-01**: Agente WhatsApp responde automaticamente ao lead em menos de 5 minutos após entrada — exclusivo para tenants com `iara_tenant_id IS NULL`; tenants com IARA Systems recebem lead via bridge sem agente próprio
- [ ] **WHATS-02**: Agente oferece agendamento de Aula Experimental e confirma data/horário no WhatsApp, atualizando status do lead para `agendado`
- [ ] **WHATS-03**: Dono pode assumir a conversa manualmente (handoff humano), desativando o agente para aquele lead

### Conteúdo

- [ ] **CONT-01**: Dono faz upload de vídeo bruto pelo dashboard
- [ ] **CONT-02**: IA gera copy, hashtags e estratégia de canal (Instagram, Stories, Reels) a partir do DNA da academia e do vídeo enviado
- [ ] **CONT-03**: Dono visualiza preview do conteúdo gerado e pode aprovar ou rejeitar antes de qualquer ação
- [ ] **CONT-04**: Sistema publica conteúdo aprovado diretamente no Instagram via Meta Graph API

### Campanhas

- [ ] **CAMP-01**: IA gera criativos de campanha (copy + segmentação sugerida + raio de 5km) a partir do DNA da academia
- [ ] **CAMP-02**: Dono revisa criativos gerados e aprova individualmente antes de publicar (fluxo APROV-02)
- [ ] **CAMP-03**: Painel exibe métricas básicas por campanha: impressões, cliques e custo total

### Inteligência Competitiva

- [ ] **INTEL-01**: Sistema monitora Meta Ad Library e coleta anúncios ativos de academias concorrentes no mesmo bairro/raio
- [ ] **INTEL-02**: IA analisa anúncios coletados, identifica brechas de oferta e gera sugestões acionáveis para o dono

## v2 Requirements

### Lead Pipeline

- **LEAD-V2-01**: Score do lead (1-10) calculado por agente IA com base em engajamento e perfil

### WhatsApp

- **WHATS-V2-01**: Histórico completo de conversa WhatsApp visível no painel do lead

### Conteúdo

- **CONT-V2-01**: Download de conteúdo gerado para publicação manual

### Campanhas

- **CAMP-V2-01**: Conexão de conta Google Ads via OAuth por tenant
- **CAMP-V2-02**: Conexão de conta Meta Business via OAuth por tenant
- **CAMP-V2-03**: Publicação automática de campanha após aprovação (sem etapa manual)

### Inteligência Competitiva

- **INTEL-V2-01**: Painel visual com anúncios dos concorrentes organizados por bairro
- **INTEL-V2-02**: Alertas automáticos quando concorrente lança novo anúncio

## Out of Scope

| Feature | Reason |
|---------|--------|
| Integração lógica com IARA Systems | Campo `iara_tenant_id` existe (bridge futura), lógica não entra no MVP |
| Portal do aluno | Foco é o dono/gestor, não o aluno |
| Relatórios com ML | Analytics simples suficientes para MVP |
| Multi-unidade (franqueado > 1 CNPJ) | Tier Enterprise, pós-MVP |
| App mobile | Web-first |
| repo marketing-brain | Repo separado, não entra neste workspace |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| APROV-01 | Phase 2 | Pending |
| APROV-02 | Phase 2 | Pending |
| LEAD-01 | Phase 2 | Pending |
| LEAD-02 | Phase 2 | Pending |
| LEAD-03 | Phase 2 | Pending |
| WHATS-01 | Phase 3 | Pending |
| WHATS-02 | Phase 3 | Pending |
| WHATS-03 | Phase 3 | Pending |
| CONT-01 | Phase 4 | Pending |
| CONT-02 | Phase 4 | Pending |
| CONT-03 | Phase 4 | Pending |
| CONT-04 | Phase 4 | Pending |
| CAMP-01 | Phase 5 | Pending |
| CAMP-02 | Phase 5 | Pending |
| CAMP-03 | Phase 5 | Pending |
| INTEL-01 | Phase 6 | Pending |
| INTEL-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-18*
*Last updated: 2026-05-18 after initial definition*
