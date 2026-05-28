#!/usr/bin/env bash
# Smoke test: /api/conteudos/[id]/download
# Pré-requisito: ter um conteudo com status='aprovado' no banco
# Uso: CONTEUDO_ID=<uuid> AUTH_TOKEN=<bearer> bash tests/smoke/download.sh

set -euo pipefail

BASE="${BASE_URL:-https://marketing-saas-nu.vercel.app}"
ID="${CONTEUDO_ID:?Defina CONTEUDO_ID com o UUID de um conteudo aprovado}"
TOKEN="${AUTH_TOKEN:?Defina AUTH_TOKEN com o Bearer token de sessão}"

TMP=$(mktemp -d)
ZIP_PATH="$TMP/post.zip"

echo "→ GET $BASE/api/conteudos/$ID/download"
HTTP_CODE=$(curl -s -o "$ZIP_PATH" -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/conteudos/$ID/download")

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ status $HTTP_CODE (esperado 200)"
  cat "$ZIP_PATH"
  exit 1
fi

# Valida que é um ZIP válido
if ! unzip -t "$ZIP_PATH" > /dev/null 2>&1; then
  echo "❌ arquivo não é um ZIP válido"
  exit 1
fi

# Valida presença dos 3 arquivos
for f in post.png copy.txt hashtags.txt; do
  if ! unzip -Z1 "$ZIP_PATH" | grep -q "^$f$"; then
    echo "❌ $f ausente no ZIP"
    exit 1
  fi
done

# Valida magic bytes PNG (0x89 0x50 0x4E 0x47)
unzip -p "$ZIP_PATH" post.png > "$TMP/post.png"
MAGIC=$(xxd -l 4 "$TMP/post.png" | awk '{print $2$3}')
if [ "$MAGIC" != "89504e47" ]; then
  echo "❌ post.png não é PNG válido (magic: $MAGIC)"
  exit 1
fi

rm -rf "$TMP"
echo "✅ ZIP válido com post.png + copy.txt + hashtags.txt"
