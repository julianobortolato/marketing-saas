# WORKFLOW.md — marketing-saas

> Guia de práticas para contribuição neste repositório.

---

## Gate de PR — checklist básico

Antes de abrir qualquer PR:

- [ ] `pnpm build` passa sem erros
- [ ] `pnpm lint` passa sem warnings novos
- [ ] Tipos TypeScript sem erros (`pnpm typecheck`)
- [ ] Variáveis de ambiente novas documentadas em `.env.example`

---

## Gate Engine vs Tenant

Antes de qualquer PR que toca `lib/`, `components/`, `prompts/` ou `templates/`:

- Ler `docs/principles/ENGINE_VS_TENANT.md` §"Regra mecânica"
- Confirmar que nenhum item da Camada 1 foi hardcoded
- Teste mental: substituir "Fitness UNIC" por "Academia Genérica X" —
  se algo quebra ou fica estranho, PR rejeitada
