# QA Checklist — Fase 5 Bugfix (SHA f339db1)

> Sprint: fix(gerador) — logo_url + configError log
> Data: 27/mai/2026
> Critério de aceite: gerador.ts executa sem erro 400 em tenant com brand_manual preenchido

## Checklist binário

```
□ 1. Migration aplicada: SELECT column_name FROM information_schema.columns
     WHERE table_name = 'tenant_config' AND column_name = 'logo_url';
     → deve retornar 1 linha

□ 2. Nenhum erro 400 no log do gerador ao rodar /api/cron/gerar-posts
     → smoke test: curl -X POST /api/cron/gerar-posts -H "Authorization: Bearer $CRON_SECRET"
     → status 200, body JSON com tenants processados

□ 3. configError aparece no log apenas quando a query falha (não quando sucede)
     → verificar Vercel Function Logs após smoke test

□ 4. logo_url: coluna existe e aceita NULL (tenant sem logo não quebra)
     → SELECT logo_url FROM tenant_config LIMIT 5; → não gera erro

□ 5. brand_manual ainda válido: gerador usa brand_manual.tom_de_voz, cores, etc.
     → post gerado tem copy coerente com brand_manual do tenant
```

## Anti-padrão registrado

**AP-SCHEMA-001:** Query selecionando coluna não existente em PostgREST retorna 400 (não 404 nem NULL).
O erro em `data` fica null e o código downstream lança erro de negócio (brand_manual ausente) mascarando a causa raiz.

**Solução padrão:** sempre executar `SELECT * FROM tabela LIMIT 5` antes de implementar queries em tabela nova ou modificada.
