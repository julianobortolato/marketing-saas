#!/usr/bin/env bash
# Smoke test da rota /api/posts/render
# Uso: ./tests/smoke/render.sh [BASE_URL]
# Exemplo: ./tests/smoke/render.sh http://localhost:3000
#          ./tests/smoke/render.sh https://marketing-saas-nu.vercel.app
#
# Requer: curl, xxd, awk (disponíveis no macOS e Linux)

set -e
BASE="${1:-http://localhost:3000}"
OUT="/tmp/smoke-render-$(date +%s).png"

echo "→ POST ${BASE}/api/posts/render"

RESULT=$(curl -sS -X POST "${BASE}/api/posts/render" \
  -H "Content-Type: application/json" \
  -d '{"html":"Smoke Test Prisma","largura":1080,"altura":1080}' \
  -o "$OUT" \
  -w "%{http_code}|%{time_total}|%{size_download}")

HTTP_CODE=$(echo "$RESULT" | cut -d'|' -f1)
TIME_TOTAL=$(echo "$RESULT" | cut -d'|' -f2)
SIZE_BYTES=$(echo "$RESULT" | cut -d'|' -f3)

echo "HTTP ${HTTP_CODE} | tempo ${TIME_TOTAL}s | bytes ${SIZE_BYTES}"

# Validar magic bytes de PNG (89 50 4E 47 0D 0A 1A 0A)
HEAD=$(head -c 8 "$OUT" | xxd -p)
if [[ "$HEAD" == "89504e470d0a1a0a" ]]; then
  echo "✅ PNG válido — ${OUT}"
else
  echo "❌ Não é PNG. Output:"
  cat "$OUT"
  exit 1
fi

# Validar latência < 10s usando awk (compatível com macOS BSD e Linux GNU)
if awk -v t="$TIME_TOTAL" 'BEGIN { exit !(t > 10) }'; then
  echo "⚠️  Excedeu 10s (${TIME_TOTAL}s) — investigar"
  exit 1
fi

echo "✅ Tempo: ${TIME_TOTAL}s (dentro do limite de 10s)"
