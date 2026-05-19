# Roadmap: marketing-saas

## Overview

Six phases that build the autonomous CMO SaaS for gyms from the ground up: secure multi-tenant foundation first, then lead capture and approval flows, then the WhatsApp agent, then AI-powered content creation, then campaign creatives and metrics, and finally competitive intelligence. Each phase delivers a working vertical slice that the owner can use in production before the next phase begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Auth, multi-tenant isolation, academia DNA config, and role-based access (completed 2026-05-19)
- [ ] **Phase 2: Lead Pipeline + Aprovacoes** - Webhook lead ingestion, lead panel, manual entry, and approval queue
- [ ] **Phase 3: Agente WhatsApp** - Automated < 5 min response, AE scheduling, and human handoff
- [ ] **Phase 4: Conteudo** - Video upload, AI content generation, preview, and Instagram publish
- [ ] **Phase 5: Campanhas** - AI campaign creatives, individual approval flow, and metrics dashboard
- [ ] **Phase 6: Inteligencia Competitiva** - Meta Ad Library monitoring and AI gap analysis

## Phase Details

### Phase 1: Foundation
**Goal:** Owner can create an account, configure their gym's identity, and the system enforces tenant isolation by default
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. Owner can sign up with email and password and stay logged in across browser reloads
  2. Signing up automatically creates a tenant with slug, plan, and billing fields; `fn_calcular_mensalidade()` is callable
  3. Owner can fill in the academia DNA form (bairro, raio_km, tom de voz, diferenciais, horarios, planos) and see it saved
  4. An invited manager can log in and access the dashboard; a viewer cannot perform write actions; tenant A cannot read tenant B's data
**Plans:** 4/4 plans complete
Plans:
- [x] 01-PLAN-01.md — Walking Skeleton: scaffold + pinned deps + shadcn brand + 3 Supabase clients + 5 migrations + schema push (FOUND-01 infra, FOUND-02)
- [x] 01-PLAN-02.md — Auth slice: /signup + /login wired to Supabase Auth, session persistence (FOUND-01)
- [x] 01-PLAN-03.md — Academia DNA slice: /configuracoes form + Server Action upsert, server-enforced tenant_id (FOUND-03)
- [x] 01-PLAN-04.md — Role-based access slice: dashboard shell + overview + server-only invite API + tenant isolation (FOUND-04)
**UI hint:** yes

### Phase 2: Lead Pipeline + Aprovacoes
**Goal:** Leads arrive from Meta or WhatsApp webhooks and appear in a filterable panel; owner can batch-approve organic posts and individually approve paid campaigns
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** LEAD-01, LEAD-02, LEAD-03, APROV-01, APROV-02
**Success Criteria** (what must be TRUE):
  1. A POST to the webhook endpoint creates a lead record with origin, phone, and status `novo` — visible immediately in the panel
  2. Owner can filter the leads list by status, channel, and date and manually change a lead's status
  3. Owner can add a lead manually by entering name, phone, and origin from the dashboard
  4. Owner can see a weekly batch of up to 10 organic posts and approve or reject them in one action
  5. No paid campaign can be published without an explicit per-campaign approval record in `aprovacoes`
**Plans:** TBD
**UI hint:** yes

### Phase 3: Agente WhatsApp
**Goal:** Tenants without IARA Systems get an automated WhatsApp agent that responds to leads in under 5 minutes, offers an Aula Experimental slot, and can be overridden by the owner
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** WHATS-01, WHATS-02, WHATS-03
**Success Criteria** (what must be TRUE):
  1. A new lead triggers an automatic WhatsApp reply within 5 minutes — only for tenants where `iara_tenant_id IS NULL`
  2. The agent proposes an Aula Experimental date/time in WhatsApp and, upon confirmation, updates the lead status to `agendado`
  3. Owner can flip a switch on a lead to take over the conversation manually, which stops the agent from sending further automated messages to that lead
**Plans:** TBD

### Phase 4: Conteudo
**Goal:** Owner uploads raw video and the system generates ready-to-use social content; owner previews and approves before Instagram publishing
**Mode:** mvp
**Depends on:** Phase 1
**Parallel:** Can run in parallel with Phase 3 if Instagram API approval is delayed
**Requirements:** CONT-01, CONT-02, CONT-03, CONT-04
**Success Criteria** (what must be TRUE):
  1. Owner can upload a raw video file from the dashboard without leaving the app
  2. After upload, the system generates copy, hashtags, and a channel strategy (Instagram Feed, Stories, Reels) using the academia DNA
  3. Owner can preview the generated content and approve or reject it before any external action is taken
  4. Approved content is published to the connected Instagram account via Meta Graph API and a confirmation is shown in the dashboard
**Contingency — Instagram API delay:** Phase 4 ships CONT-01..03 (upload + AI generation + preview) as a complete working slice without publishing. CONT-04 enters as a patch once Meta Graph API access is approved.
**Plans:** TBD
**UI hint:** yes

### Phase 5: Campanhas
**Goal:** AI generates campaign creatives from the academia DNA; owner approves each one individually; a metrics panel shows performance per campaign
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** CAMP-01, CAMP-02, CAMP-03
**Success Criteria** (what must be TRUE):
  1. Owner can trigger AI creative generation and receive copy plus a suggested 5 km-radius segmentation based on the academia DNA
  2. Owner reviews each generated creative and approves it individually — no creative can proceed without an approval record in `aprovacoes`
  3. The campaigns panel shows impressions, clicks, and total cost for each campaign
**Plans:** TBD
**UI hint:** yes

### Phase 6: Inteligencia Competitiva
**Goal:** System monitors Meta Ad Library for local competitor ads and AI surfaces actionable offer gaps for the owner
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** INTEL-01, INTEL-02
**Success Criteria** (what must be TRUE):
  1. System periodically collects active ads from competing gyms within the configured bairro/raio and stores them linked to the tenant
  2. Owner can view AI-generated suggestions identifying offer gaps versus competitors, derived from the collected ads
**Plans:** TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-05-19 |
| 2. Lead Pipeline + Aprovacoes | 0/TBD | Not started | - |
| 3. Agente WhatsApp | 0/TBD | Not started | - |
| 4. Conteudo | 0/TBD | Not started | - |
| 5. Campanhas | 0/TBD | Not started | - |
| 6. Inteligencia Competitiva | 0/TBD | Not started | - |
