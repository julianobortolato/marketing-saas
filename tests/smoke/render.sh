#!/usr/bin/env bash
# Smoke test da rota /api/posts/render (modo html + modo template)
# Uso: ./tests/smoke/render.sh [BASE_URL]
# Exemplo: ./tests/smoke/render.sh http://localhost:3000
#          ./tests/smoke/render.sh https://marketing-saas-nu.vercel.app
#
# Requer: curl, xxd, awk (disponíveis no macOS e Linux)

set -e
BASE="${1:-http://localhost:3000}"

validar_png() {
  local arquivo="$1"
  local label="$2"
  local HEAD
  HEAD=$(head -c 8 "$arquivo" | xxd -p)
  if [[ "$HEAD" == "89504e470d0a1a0a" ]]; then
    echo "✅ PNG válido — ${arquivo}"
  else
    echo "❌ Não é PNG ($label). Output:"
    cat "$arquivo"
    exit 1
  fi
}

validar_latencia() {
  local tempo="$1"
  local label="$2"
  if awk -v t="$tempo" 'BEGIN { exit !(t > 10) }'; then
    echo "⚠️  Excedeu 10s (${tempo}s) — ${label}"
    exit 1
  fi
  echo "✅ Tempo: ${tempo}s (dentro do limite de 10s)"
}

# ── Modo html (legado) ────────────────────────────────────────────────────────
echo ""
echo "── Modo html (legado) ──"
OUT_HTML="/tmp/smoke-html-$(date +%s).png"

RESULT=$(curl -sS -X POST "${BASE}/api/posts/render" \
  -H "Content-Type: application/json" \
  -d '{"modo":"html","html":"Smoke Test Prisma","largura":1080,"altura":1080}' \
  -o "$OUT_HTML" \
  -w "%{http_code}|%{time_total}|%{size_download}")

HTTP_CODE=$(echo "$RESULT" | cut -d'|' -f1)
TIME_TOTAL=$(echo "$RESULT" | cut -d'|' -f2)
SIZE_BYTES=$(echo "$RESULT" | cut -d'|' -f3)

echo "HTTP ${HTTP_CODE} | tempo ${TIME_TOTAL}s | bytes ${SIZE_BYTES}"
validar_png "$OUT_HTML" "html"
validar_latencia "$TIME_TOTAL" "html"

# ── Modo template — 3 formatos ────────────────────────────────────────────────
SLOTS='{
  "foto_url": "https://via.placeholder.com/1080x1080/1A2E4A/F0EEE8?text=foto",
  "copy_principal": "Transforme seu corpo. Método comprovado.",
  "cta": "Agendar aula grátis",
  "logo_url": "https://via.placeholder.com/200x60/7B61C4/F0EEE8?text=LOGO",
  "cor_primaria": "#7B61C4"
}'

for FORMATO in feed story carousel_slide; do
  echo ""
  echo "── Modo template: $FORMATO ──"
  OUT="/tmp/smoke-${FORMATO}-$(date +%s).png"

  PAYLOAD=$(printf '{"modo":"template","formato":"%s","slots":%s}' "$FORMATO" "$SLOTS")

  RESULT=$(curl -sS -X POST "${BASE}/api/posts/render" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    -o "$OUT" \
    -w "%{http_code}|%{time_total}|%{size_download}")

  HTTP_CODE=$(echo "$RESULT" | cut -d'|' -f1)
  TIME_TOTAL=$(echo "$RESULT" | cut -d'|' -f2)
  SIZE_BYTES=$(echo "$RESULT" | cut -d'|' -f3)

  echo "HTTP ${HTTP_CODE} | tempo ${TIME_TOTAL}s | bytes ${SIZE_BYTES}"
  validar_png "$OUT" "$FORMATO"
  validar_latencia "$TIME_TOTAL" "$FORMATO"
done

# ── Validação de erro — slots inválidos → 400 ─────────────────────────────────
echo ""
echo "── Validação de erro: slots inválidos → 400 ──"
OUT_ERR="/tmp/smoke-erro-$(date +%s).json"

HTTP_ERR=$(curl -sS -X POST "${BASE}/api/posts/render" \
  -H "Content-Type: application/json" \
  -d '{"modo":"template","formato":"feed","slots":{"foto_url":"https://via.placeholder.com/1080","logo_url":"https://via.placeholder.com/200","cor_primaria":"#000","cta":"ok"}}' \
  -o "$OUT_ERR" \
  -w "%{http_code}")

if [[ "$HTTP_ERR" == "400" ]]; then
  echo "✅ HTTP 400 para slots inválidos (copy_principal ausente)"
else
  echo "❌ Esperado 400, recebido ${HTTP_ERR}"
  cat "$OUT_ERR"
  exit 1
fi

echo ""
echo "✅ Todos os smoke tests passaram"
