# QA — docs/ENGINE_VS_TENANT + canônicos

**Sprint:** docs/ENGINE_VS_TENANT
**SHA:** a7b37f8
**Data:** 2026-05-20
**Status:** Pendente de validação manual

---

## Pré-requisitos

- Acesso aos repos `~/marketing-saas` e `~/iara-systems-v2`
- Terminal aberto em `~/marketing-saas`

---

## Cenários

### C1 — CLAUDE.md não prescreve mais identidade UNIC como design system do engine

**Setup:**
- Abrir `~/marketing-saas/CLAUDE.md`

**Passos:**
1. Localizar seção `## Identidade visual`
2. Verificar que **não** contém tabela de tokens CSS com `#E30613` como cor do produto
3. Verificar que contém referência a `academia_config.tema`
4. Verificar que contém referência a `docs/principles/ENGINE_VS_TENANT.md`
5. Verificar que contém referência a `.adrs/ADR-MKT-000.md`

**Esperado:**
- Seção descreve modelo B parcial (dashboard engine / saída externa tenant)
- Nenhuma linha prescreve `--color-primary: #E30613` como constante do engine
- JSON de exemplo mostra `#E30613` como exemplo de seed da UNIC, não como padrão do produto

---

### C2 — Arquivos canônicos existem e têm conteúdo esperado

**Setup:**
- Terminal em `~/marketing-saas`

**Passos:**
1. `ls docs/principles/` — deve listar `ENGINE_VS_TENANT.md`
2. `ls .adrs/` — deve listar `ADR-MKT-000.md` e `ADR-MKT-001-agente-whatsapp.md`
3. Abrir `docs/principles/ENGINE_VS_TENANT.md` — verificar que §3 contém 5 subseções de regras mecânicas com exemplos de código
4. Abrir `.adrs/ADR-MKT-000.md` — verificar que §4 ("Violação ativa") existe e menciona correção do CLAUDE.md
5. Abrir `.adrs/ADR-MKT-001-agente-whatsapp.md` — verificar que contém `## 4. Schema — DDL completo` com DDL das 5 tabelas novas

**Esperado:**
- `ENGINE_VS_TENANT.md` > 5 KB, contém seção `## 3. Regra mecânica`
- `ADR-MKT-000.md` contém seção `## 4. Violação ativa`
- `ADR-MKT-001-agente-whatsapp.md` > 20 KB, contém `evolution_instances`, `conversas`, `chat_messages`

---

### C3 — iara-systems-v2 tem ADR-V2-000 no branch correto

**Setup:**
- Terminal em `~/iara-systems-v2`

**Passos:**
1. `git checkout spec/extracao-iara`
2. `ls .adrs/` — deve listar `ADR-V2-000.md`
3. Abrir `.adrs/ADR-V2-000.md` — verificar que §3 tem 7 subseções de violações mapeadas (§3.1 a §3.7)
4. Verificar que §4 contém sprint `S-DEBT-CRITICAL` com critérios de aceite em checklist

**Esperado:**
- `.adrs/ADR-V2-000.md` existe
- §3 contém `### 3.1 CADERNO_LEGACY.md` com severidade 🔴 CRÍTICO

---

## Casos de borda a testar

```bash
# Nenhum token visual de tenant em lib/ ou components/
grep -r "#E30613" ~/marketing-saas/lib/ ~/marketing-saas/components/ ~/marketing-saas/tailwind.config.ts
# Esperado: zero resultados

# Nenhum nome próprio de academia em código
grep -r "Fitness UNIC" ~/marketing-saas/lib/ ~/marketing-saas/components/
# Esperado: zero resultados (CLAUDE.md pode mencionar como cliente — ok)

# ARCHITECTURE.md reflete nova estrutura de pastas
grep "docs/principles" ~/marketing-saas/ARCHITECTURE.md
# Esperado: ≥ 1 resultado

# ADR-006 existe em ARCHITECTURE.md
grep "ADR-006" ~/marketing-saas/ARCHITECTURE.md
# Esperado: ≥ 1 resultado
```

## Fora do escopo (não testar)

- Coluna `academia_config.tema` no banco: migration ainda não criada — será entregue na Fase 3
- Gate de contraste tenant Vértice: executado somente antes do merge da Fase 3 (ADR-MKT-001 §11)
- Identidade visual do dashboard: a definir quando SaaS tiver marca própria (ADR-MKT-000 §3.3)

---

## Validação de produção

- [ ] `next build` passa sem erro em `~/marketing-saas`
- [ ] `git log --oneline -3` em `~/marketing-saas` mostra commits de docs em ordem correta
- [ ] SHA em main: `git rev-parse --short HEAD` = `a7b37f8`
- [ ] `git log --oneline -1` em `~/iara-systems-v2` na branch `spec/extracao-iara` mostra SHA `7212426`
