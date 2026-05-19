---
phase: 02-lead-pipeline-aprovacoes
plan: "01"
type: execute
wave: 0
depends_on: []
files_modified:
  - supabase/migrations/20260520000001_create_leads.sql
  - supabase/migrations/20260520000002_create_aprovacoes.sql
  - supabase/migrations/20260520000003_leads_aprovacoes_rls.sql
  - supabase/migrations/20260520000004_leads_aprovacoes_grants.sql
  - supabase/migrations/20260520000005_reload_pgrst_schema_p2.sql
autonomous: false
requirements: [LEAD-01, LEAD-02, LEAD-03, APROV-01, APROV-02]

must_haves:
  truths:
    - "public.leads exists with tenant_id UUID NOT NULL, nome, telefone, origem, status, remotejid, score, criado_em"
    - "public.aprovacoes exists with tenant_id UUID NOT NULL, tipo, referencia_id, status, criado_em"
    - "leads and aprovacoes each have a PERMISSIVE policy set AND a RESTRICTIVE isolation policy set (fn_tenant_id() = tenant_id)"
    - "leads INSERT/UPDATE PERMISSIVE policy requires fn_usuario_role() IN ('owner','manager') so a viewer cannot write"
    - "authenticated has GRANT SELECT,INSERT,UPDATE,DELETE on both tables; service_role has GRANT ALL"
    - "supabase db push applied all 5 migrations and a fresh SELECT on public.leads and public.aprovacoes returns 0 rows (table exists, empty) for an authenticated owner"
  artifacts:
    - path: "supabase/migrations/20260520000001_create_leads.sql"
      provides: "leads table DDL with all 8 columns + status/origem CHECK constraints"
      contains: "tenant_id UUID NOT NULL"
    - path: "supabase/migrations/20260520000002_create_aprovacoes.sql"
      provides: "aprovacoes table DDL with all 5 columns + tipo/status CHECK constraints"
      contains: "tenant_id UUID NOT NULL"
    - path: "supabase/migrations/20260520000003_leads_aprovacoes_rls.sql"
      provides: "PERMISSIVE + RESTRICTIVE dual-policy for both tables"
      contains: "AS RESTRICTIVE"
    - path: "supabase/migrations/20260520000004_leads_aprovacoes_grants.sql"
      provides: "Table-level grants for authenticated + service_role"
      contains: "TO authenticated"
    - path: "supabase/migrations/20260520000005_reload_pgrst_schema_p2.sql"
      provides: "PostgREST schema cache reload after grants"
      contains: "NOTIFY pgrst"
  key_links:
    - from: "supabase/migrations/20260520000003_leads_aprovacoes_rls.sql"
      to: "public.fn_tenant_id()"
      via: "RESTRICTIVE USING/WITH CHECK clause wrapped in (SELECT ...)"
      pattern: "SELECT public.fn_tenant_id"
    - from: "supabase/migrations/20260520000003_leads_aprovacoes_rls.sql"
      to: "public.fn_usuario_role()"
      via: "leads/aprovacoes write PERMISSIVE policy gating owner/manager"
      pattern: "fn_usuario_role"
---

<objective>
Create the Phase 2 data foundation: two new tables (`leads`, `aprovacoes`) with the exact schema from the briefing, the PERMISSIVE + RESTRICTIVE dual RLS policy pattern established in Phase 1 migration 0004, table-level grants (Phase 1 migration 0007 pattern), a PostgREST cache reload (Phase 1 migration 0008 pattern), and a [BLOCKING] `supabase db push` so the tables physically exist before any webhook/UI plan runs.

Purpose: Every other Phase 2 plan (webhook ingestion, lead panel, aprovacoes queue) reads/writes these two tables. They cannot function until the schema is pushed. This is the Wave 0 prerequisite for the entire phase.

Output: Five idempotent migration files + a live database with `public.leads` and `public.aprovacoes` enforcing tenant isolation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@ARCHITECTURE.md

<interfaces>
<!-- From Phase 1 migrations. Replicate these patterns exactly. -->

Phase 1 helper functions (already deployed — DO NOT recreate):
  public.fn_tenant_id()    -> uuid   (SECURITY DEFINER, reads usuarios, NOT JWT)
  public.fn_usuario_role() -> text   ('owner'|'manager'|'viewer', reads usuarios)
  public.fn_usuario_id()   -> uuid   (auth.uid() wrapper)

Phase 1 RLS dual-policy pattern (supabase/migrations/20260519000005_rls_policies.sql):
  - ALTER TABLE ... ENABLE ROW LEVEL SECURITY
  - PERMISSIVE policy set: grants capability; write policies add fn_usuario_role() gate
  - RESTRICTIVE policy set: AS RESTRICTIVE; hard tenant boundary
  - ALWAYS wrap helper calls as (SELECT public.fn_tenant_id()) — per-row perf

Phase 1 grants pattern (supabase/migrations/20260519000007_grants_and_policy_fix.sql):
  GRANT SELECT,INSERT,UPDATE,DELETE ON public.<table> TO authenticated;
  GRANT ALL ON public.<table> TO service_role;

Phase 1 pgrst reload pattern (supabase/migrations/20260519000008_reload_pgrst_schema.sql):
  NOTIFY pgrst, 'reload schema';

Migration numbering: Phase 1 used 20260519000001..0008. Phase 2 continues at
20260520000001 (next day, sequential). NEVER edit an existing migration file
(CLAUDE.md: "Migrations: arquivo novo — nunca editar migration existente").

Schema from briefing (exact):
  leads(id uuid pk default gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    nome text, telefone text, origem text, status text, remotejid text, score smallint,
    criado_em timestamptz default now())
  aprovacoes(id uuid pk default gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    tipo text, referencia_id uuid, status text, criado_em timestamptz default now())
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: leads + aprovacoes table migrations with CHECK constraints</name>
  <files>supabase/migrations/20260520000001_create_leads.sql, supabase/migrations/20260520000002_create_aprovacoes.sql</files>
  <read_first>
    - supabase/migrations/20260519000001_create_tenants.sql (Phase 1 table DDL style: COMMENT ON, CHECK constraints, column ordering)
    - supabase/migrations/20260519000003_create_academia_config.sql (tenant_id REFERENCES tenants(id) pattern)
    - ARCHITECTURE.md (§ Schema — tabelas core: leads + the exact enum value lists)
    - CLAUDE.md (§ Banco — schema antes de código; § Multi-tenant — tenant_id NOT NULL toda tabela)
  </read_first>
  <action>
Create `supabase/migrations/20260520000001_create_leads.sql`:
`CREATE TABLE public.leads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, nome TEXT, telefone TEXT, origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('meta_form','whatsapp','google','manual')), status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','contatado','agendado','convertido','perdido')), remotejid TEXT, score SMALLINT, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW());`
Add `CREATE INDEX idx_leads_tenant_status ON public.leads (tenant_id, status);` and `CREATE INDEX idx_leads_tenant_criado ON public.leads (tenant_id, criado_em DESC);` (the lead panel filters by status and orders by criado_em — Plan 03). Add `COMMENT ON TABLE public.leads IS 'Captured leads. origem: meta_form|whatsapp|google|manual. status pipeline: novo->contatado->agendado->convertido|perdido. remotejid populated by Phase 3 WhatsApp agent.';` and `COMMENT ON COLUMN public.leads.remotejid IS 'WhatsApp phone JID — populated by Phase 3 agent; nullable in Phase 2.';`

Create `supabase/migrations/20260520000002_create_aprovacoes.sql`:
`CREATE TABLE public.aprovacoes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, tipo TEXT NOT NULL CHECK (tipo IN ('conteudo','campanha')), referencia_id UUID, status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')), criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW());`
Add `CREATE INDEX idx_aprovacoes_tenant_tipo_status ON public.aprovacoes (tenant_id, tipo, status);` (Plan 04 queries the pending organic-content batch and checks campaign approval existence). Add `COMMENT ON TABLE public.aprovacoes IS 'Approval records. tipo conteudo = weekly organic batch (APROV-01, batch up to 10). tipo campanha = per-campaign paid approval (APROV-02, no paid campaign without an aprovado row). referencia_id points at conteudos.id or campanhas.id (those tables arrive in later phases — nullable / unconstrained FK in Phase 2).';`

Both files start with a comment block explaining purpose (mirror Phase 1 DDL header style). Do NOT add a FK on `referencia_id` — `conteudos`/`campanhas` tables do not exist until Phases 4/5; adding the FK now would break the migration.
  </action>
  <verify>
    <automated>grep -q "tenant_id UUID NOT NULL" supabase/migrations/20260520000001_create_leads.sql && grep -q "CHECK (status IN ('novo'" supabase/migrations/20260520000001_create_leads.sql && grep -q "tenant_id UUID NOT NULL" supabase/migrations/20260520000002_create_aprovacoes.sql && grep -q "CHECK (tipo IN ('conteudo','campanha'))" supabase/migrations/20260520000002_create_aprovacoes.sql && ! grep -q "REFERENCES public.conteudos" supabase/migrations/20260520000002_create_aprovacoes.sql</automated>
  </verify>
  <acceptance_criteria>
    - `supabase/migrations/20260520000001_create_leads.sql` declares `tenant_id UUID NOT NULL REFERENCES public.tenants(id)` and CHECK constraints for origem (meta_form|whatsapp|google|manual) and status (novo|contatado|agendado|convertido|perdido)
    - leads has `remotejid TEXT` and `score SMALLINT` columns (Phase 3 forward-compat — present now, not added later)
    - `supabase/migrations/20260520000002_create_aprovacoes.sql` declares `tenant_id UUID NOT NULL` + CHECK for tipo (conteudo|campanha) and status (pendente|aprovado|rejeitado)
    - aprovacoes has NO foreign key on referencia_id (conteudos/campanhas tables do not exist yet)
    - Both files create their tenant-scoped indexes
  </acceptance_criteria>
  <done>Two new migration files create leads + aprovacoes with NOT NULL tenant_id, CHECK-constrained enums, and query indexes.</done>
</task>

<task type="auto">
  <name>Task 2: RLS dual-policy + grants + pgrst reload migrations</name>
  <files>supabase/migrations/20260520000003_leads_aprovacoes_rls.sql, supabase/migrations/20260520000004_leads_aprovacoes_grants.sql, supabase/migrations/20260520000005_reload_pgrst_schema_p2.sql</files>
  <read_first>
    - supabase/migrations/20260519000005_rls_policies.sql (EXACT PERMISSIVE+RESTRICTIVE dual-policy pattern to replicate; note (SELECT public.fn_tenant_id()) wrapping for perf, RESTRICTIVE FOR SELECT + RESTRICTIVE FOR ALL split)
    - supabase/migrations/20260519000007_grants_and_policy_fix.sql (grant statements for authenticated + service_role)
    - supabase/migrations/20260519000008_reload_pgrst_schema.sql (NOTIFY pgrst pattern)
    - CLAUDE.md (§ Multi-tenant — RLS PERMISSIVE + RESTRICTIVE em toda tabela; § Anti-padrões — query sem tenant_id proibida)
  </read_first>
  <action>
Create `supabase/migrations/20260520000003_leads_aprovacoes_rls.sql`. For BOTH `public.leads` and `public.aprovacoes`:
1. `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;`
2. PERMISSIVE SELECT: `CREATE POLICY "<table>_select_same_tenant" ON public.<table> FOR SELECT TO authenticated USING ((SELECT public.fn_tenant_id()) = tenant_id);` (all roles in a tenant can read its leads/aprovacoes).
3. PERMISSIVE INSERT: `CREATE POLICY "<table>_insert_owner_manager" ON public.<table> FOR INSERT TO authenticated WITH CHECK ((SELECT public.fn_tenant_id()) = tenant_id AND (SELECT public.fn_usuario_role()) IN ('owner','manager'));` (viewer cannot create leads/approvals — security_requirements: viewer write block at DB).
4. PERMISSIVE UPDATE: `CREATE POLICY "<table>_update_owner_manager" ON public.<table> FOR UPDATE TO authenticated USING ((SELECT public.fn_tenant_id()) = tenant_id AND (SELECT public.fn_usuario_role()) IN ('owner','manager')) WITH CHECK ((SELECT public.fn_tenant_id()) = tenant_id AND (SELECT public.fn_usuario_role()) IN ('owner','manager'));` (manual status change in Plan 03 + batch approve in Plan 04 require owner/manager).
5. RESTRICTIVE SELECT: `CREATE POLICY "<table>_isolation_select" ON public.<table> AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT public.fn_tenant_id()) = tenant_id);`
6. RESTRICTIVE ALL: `CREATE POLICY "<table>_isolation_write" ON public.<table> AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.fn_tenant_id()) = tenant_id) WITH CHECK ((SELECT public.fn_tenant_id()) = tenant_id);`
NOTE: the webhook (Plan 02) writes via the service-role admin client which bypasses RLS — these authenticated policies govern dashboard users only. Add a header comment stating this so the executor does not add an anon/service policy.

Create `supabase/migrations/20260520000004_leads_aprovacoes_grants.sql`:
`GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;`
`GRANT SELECT, INSERT, UPDATE, DELETE ON public.aprovacoes TO authenticated;`
`GRANT ALL ON public.leads TO service_role;`
`GRANT ALL ON public.aprovacoes TO service_role;`
Header comment: same rationale as Phase 1 migration 0007 (PostgREST checks table GRANT before RLS).

Create `supabase/migrations/20260520000005_reload_pgrst_schema_p2.sql`: header comment (same rationale as 0008) + `NOTIFY pgrst, 'reload schema';`
  </action>
  <verify>
    <automated>grep -c "AS RESTRICTIVE" supabase/migrations/20260520000003_leads_aprovacoes_rls.sql | grep -qE "^[4-9]|^[1-9][0-9]" && grep -q "fn_usuario_role()) IN ('owner','manager')" supabase/migrations/20260520000003_leads_aprovacoes_rls.sql && grep -q "GRANT ALL ON public.leads TO service_role" supabase/migrations/20260520000004_leads_aprovacoes_grants.sql && grep -q "NOTIFY pgrst" supabase/migrations/20260520000005_reload_pgrst_schema_p2.sql</automated>
  </verify>
  <acceptance_criteria>
    - `20260520000003_leads_aprovacoes_rls.sql` has at least 4 `AS RESTRICTIVE` clauses (2 per table: FOR SELECT + FOR ALL)
    - Both tables' INSERT/UPDATE PERMISSIVE policies require `fn_usuario_role() IN ('owner','manager')` (viewer DB write block)
    - Every helper call is wrapped as `(SELECT public.fn_tenant_id())` / `(SELECT public.fn_usuario_role())` (Phase 1 perf pattern)
    - Grants migration grants authenticated DML + service_role ALL on both tables
    - `20260520000005_reload_pgrst_schema_p2.sql` contains `NOTIFY pgrst, 'reload schema';`
  </acceptance_criteria>
  <done>RLS dual-policy (with viewer write block), grants, and pgrst reload migrations mirror the proven Phase 1 pattern for both new tables.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: [BLOCKING] supabase db push — apply Phase 2 migrations to the live database</name>
  <what-built>Tasks 1-2 wrote 5 migration files (leads, aprovacoes, RLS, grants, pgrst reload). They are inert until pushed. This is the mandatory schema-push gate from the planning brief: NO webhook or UI plan can run until these tables physically exist.</what-built>
  <how-to-verify>
1. Ensure `.env.local` has the Supabase project linked (Phase 1 already created the project; same project ref). If `supabase link` was not persisted, run `supabase link --project-ref <ref>` (ref is in the Supabase dashboard / Phase 1 01-SUMMARY checkpoint notes).
2. Run `supabase db push`. It applies ONLY the 5 new `20260520*` migrations (Phase 1 migrations are already recorded in the migration history table and are skipped). If it prompts interactively, set `SUPABASE_ACCESS_TOKEN` env var and re-run, or confirm the prompt.
3. In the Supabase SQL Editor (or `supabase db push --dry-run` first to preview), run:
   `SELECT count(*) FROM public.leads;` → returns `0` (table exists, empty).
   `SELECT count(*) FROM public.aprovacoes;` → returns `0`.
4. Verify RLS is enabled: `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('leads','aprovacoes');` → both `relrowsecurity = true`.
5. Verify the dual policies exist: `SELECT tablename, policyname, permissive FROM pg_policies WHERE tablename IN ('leads','aprovacoes') ORDER BY tablename, permissive;` → each table has PERMISSIVE select/insert/update policies AND RESTRICTIVE isolation_select + isolation_write policies.
6. Verify grants: `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='leads';` → `authenticated` has SELECT/INSERT/UPDATE/DELETE; `service_role` has all.
7. Confirm the next-numbered migration is sequential (no gap, no edited existing file): `ls supabase/migrations/ | tail -6` shows 20260520000001..0005 plus prior 0519* untouched.
  </how-to-verify>
  <files>(no source changes — runtime DB push + verification of Tasks 1-2 output)</files>
  <action>Run `supabase db push` to apply the 5 Phase 2 migrations, then run the SQL verification queries to confirm both tables exist with RLS enabled, dual policies present, and grants applied. Verification only; no source modification.</action>
  <verify>
    <automated>MISSING — applying migrations and verifying RLS/policies/grants require the live linked Supabase project and CLI auth (non-TTY needs SUPABASE_ACCESS_TOKEN); verified by the human SQL steps above (consistent with Phase 1 01-PLAN Task 4 blocking push checkpoint)</automated>
  </verify>
  <done>`supabase db push` succeeded; public.leads and public.aprovacoes exist, RLS enabled, PERMISSIVE+RESTRICTIVE policies present, grants applied, migration numbering sequential with no edited prior files.</done>
  <resume-signal>Type "approved" once `supabase db push` succeeded and the SQL checks confirm both tables exist with RLS + dual policies + grants; otherwise paste the SQL/CLI error.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Authenticated dashboard user → leads/aprovacoes | RLS RESTRICTIVE is the hard tenant boundary; PERMISSIVE write policies enforce role |
| Migration push (CLI) → live DB | Privileged operation; only the new 20260520* files apply |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Information Disclosure | Cross-tenant read of leads/aprovacoes | mitigate | RESTRICTIVE RLS `(SELECT fn_tenant_id()) = tenant_id` FOR SELECT on both tables (migration 20260520000003) |
| T-02-02 | Tampering | tenant_id forged on insert | mitigate | RESTRICTIVE FOR ALL WITH CHECK rejects any tenant_id ≠ fn_tenant_id() |
| T-02-03 | Elevation of Privilege | Viewer writes a lead/approval | mitigate | PERMISSIVE INSERT/UPDATE policies require fn_usuario_role() IN ('owner','manager') |
| T-02-04 | Tampering | Editing an already-applied Phase 1 migration | mitigate | New sequential files only (20260520*); CLAUDE.md rule enforced; verified in checkpoint step 7 |
| T-02-SC | Tampering | npm/pip installs | accept | No package installs — pure SQL migrations + Supabase CLI (already installed Phase 1) |
</threat_model>

<verification>
- 5 new migration files exist with sequential 20260520* numbering; no Phase 1 file modified
- leads + aprovacoes have NOT NULL tenant_id + CHECK enums + tenant-scoped indexes
- RLS: ≥4 RESTRICTIVE clauses; PERMISSIVE writes gated to owner/manager
- Grants for authenticated + service_role; pgrst reload present
- [BLOCKING] checkpoint: `supabase db push` applied; both tables exist empty with RLS + policies + grants confirmed by SQL
</verification>

<success_criteria>
- Schema foundation for Phase 2 Success Criteria 1-5: leads + aprovacoes tables exist with tenant isolation, ready for webhook ingestion (Plan 02), lead panel (Plan 03), and aprovacoes queue (Plan 04)
- All new tables: tenant_id NOT NULL + RLS PERMISSIVE + RESTRICTIVE (CLAUDE.md inegociável)
</success_criteria>

<output>
Create `.planning/phases/02-lead-pipeline-aprovacoes/01-SUMMARY.md` when done.
</output>
