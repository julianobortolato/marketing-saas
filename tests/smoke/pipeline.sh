#!/usr/bin/env bash
# Smoke test — pipeline de geração semanal (/api/cron/gerar-posts)
# Uso: ./tests/smoke/pipeline.sh <BASE_URL> <CRON_SECRET>
# Exemplo local:  ./tests/smoke/pipeline.sh http://localhost:3000 meu-secret
# Exemplo prod:   ./tests/smoke/pipeline.sh https://marketing-saas-nu.vercel.app "$CRON_SECRET"

set -euo pipefail

BASE="${1:-http://localhost:3000}"
SECRET="${2:-}"

if [[ -z "$SECRET" ]]; then
  echo "Uso: $0 <BASE_URL> <CRON_SECRET>"
  exit 1
fi

echo "→ POST ${BASE}/api/cron/gerar-posts"

RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST "${BASE}/api/cron/gerar-posts" \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json")

BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)

echo "HTTP: $STATUS"
echo "Body: $BODY"

if [[ "$STATUS" != "200" ]]; then
  echo "❌ Esperado 200, obteve $STATUS"
  exit 1
fi

# Verificar campo 'erros' = 0
ERROS=$(echo "$BODY" | grep -o '"erros":[0-9]*' | grep -o '[0-9]*$' || echo "")
if [[ -n "$ERROS" && "$ERROS" != "0" ]]; then
  echo "⚠️  Pipeline retornou $ERROS erros — verificar logs"
  exit 1
fi

echo "✅ Pipeline disparado — $(echo "$BODY" | grep -o '"processados":[0-9]*') tenant(s) processado(s)"

# Teste de auth: sem header → 401
echo ""
echo "→ Teste auth: sem Authorization"
STATUS_NO_AUTH=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/cron/gerar-posts")
if [[ "$STATUS_NO_AUTH" == "401" ]]; then
  echo "✅ Sem auth → 401 correto"
else
  echo "❌ Sem auth esperava 401, obteve $STATUS_NO_AUTH"
  exit 1
fi

# Teste de auth: token errado → 401
echo "→ Teste auth: token errado"
STATUS_WRONG=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/cron/gerar-posts" \
  -H "Authorization: Bearer token-errado")
if [[ "$STATUS_WRONG" == "401" ]]; then
  echo "✅ Token errado → 401 correto"
else
  echo "❌ Token errado esperava 401, obteve $STATUS_WRONG"
  exit 1
fi
