# QA — docs-canonicos-prisma-v1

**Sprint:** docs-canonicos-prisma-v1
**SHA:** 2e12be2
**Data:** 2026-05-26
**Status:** Pendente de validação manual

---

## Pré-requisitos

- Acesso ao repo `~/marketing-saas` na branch main
- SHA 2e12be2 em produção

## Cenários

### C1 — Docs canônicos presentes no repo

**Passos:**
1. `cd ~/marketing-saas`
2. `ls docs/ARCHITECTURE.md docs/DOMAIN.md docs/ROADMAP.md docs/PRD.md`
3. `ls .adrs/ADR-MKT-001.md .adrs/ADR-MKT-003.md .adrs/ADR-MKT-005.md .adrs/ADR-MKT-006.md`

**Esperado:**
- Todos os 8 arquivos listados existem sem erro

### C2 — CLAUDE.md v1.0 com identidade Prisma

**Passos:**
1. `grep -c "Prisma" ~/marketing-saas/CLAUDE.md`
2. `grep "Versão" ~/marketing-saas/CLAUDE.md | head -1`

**Esperado:**
- Contagem > 0 ocorrências de "Prisma"
- Versão exibe "1.0 — 26/mai/2026"

### C3 — Skill dev-senior-review instalada globalmente

**Passos:**
1. `ls ~/.claude/skills/dev-senior-review/SKILL.md`
2. `head -3 ~/.claude/skills/dev-senior-review/SKILL.md`

**Esperado:**
- Arquivo existe
- Cabeçalho contém nome da skill

### C4 — Nenhum arquivo de código tocado neste sprint

**Passos:**
1. `git show --stat 2e12be2 | grep -E "^(app|src|components|lib|supabase/migrations)/"`

**Esperado:**
- Nenhuma linha retornada (zero arquivos de código no commit)

---

## Casos de borda

- `.adrs/` contém `ADR-MKT-001-agente-whatsapp.md` (antigo) E `ADR-MKT-001.md` (novo canônico) — confirmar que ambos existem sem conflito
- `docs/principles/ENGINE_VS_TENANT.md` não foi sobrescrito — confirmar que ainda é o arquivo pré-existente

**Query de validação (opcional):**
```bash
# Confirmar que ENGINE_VS_TENANT não foi alterado neste sprint
git show 2e12be2 --name-only | grep ENGINE_VS_TENANT
# Esperado: nenhuma linha (arquivo não aparece no diff deste commit)
```

## Fora do escopo (não testar)

- Conteúdo interno dos docs (verificação editorial/semântica)
- Blocker Evolution webhook (escopo separado)

---

## Validação de produção

- [ ] `git log -1 --format=%h` retorna `2e12be2`
- [ ] `git show --stat HEAD` mostra apenas docs (CLAUDE.md, docs/, .adrs/) — zero app/ ou supabase/migrations/
- [ ] CHANGELOG.md sem header duplicado: `grep -c "^# Changelog" CHANGELOG.md` retorna `1`
