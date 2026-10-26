#!/usr/bin/env bash
# ==========================================================================
# Deploy Misi Hijau Temon ke Firebase Hosting.
#
# Situs ini adalah "multi-site" di proyek perisai-kapanewon-temon:
# deploy ke sini TIDAK menyentuh pelayanan-umum.web.app atau situs lain.
#
# Pakai:  bash deploy.sh
# ==========================================================================
set -euo pipefail
cd "$(dirname "$0")"

PROJECT="perisai-kapanewon-temon"
SITE="misi-hijau-temon"

AKUN=$(firebase login:list 2>/dev/null | head -1 | sed 's/^Logged in as //' | tr -d '\r')
echo "==> Akun Firebase: ${AKUN:-tidak diketahui}"

if [ "$AKUN" != "temonkec@gmail.com" ]; then
  echo "!!  Akun bukan temonkec@gmail.com. Ganti dulu:"
  echo "    firebase login:use temonkec@gmail.com"
  exit 1
fi

echo "==> Menyiapkan dist/"
rm -rf dist
mkdir -p dist/css dist/js

cp index.html dist/
cp css/style.css dist/css/
for f in config.js api.js store.js app.js; do
  cp "js/$f" "dist/js/$f"
done
# content.js sengaja tidak disalin: bank soal hidup di tabel game_items.

echo "==> Berkas yang diunggah:"
find dist -type f | sort

echo "==> Deploy ke $SITE"
firebase deploy --only hosting --project "$PROJECT"

echo ""
echo "==> Selesai: https://$SITE.web.app"
