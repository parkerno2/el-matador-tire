#!/bin/bash
# ci-build.sh — builds the Matchweek app straight into the repo root (what the Matchweek workflow runs).
# Writes exactly six root files: index.html app.js app.css core.js sw.js manifest.webmanifest. Touches nothing else.
# Needs `npm ci` in this folder first (esbuild is pinned in package.json).
set -euo pipefail
export LC_ALL=C   # stable name order for src/css/*.css
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
cd "$HERE"
[ -f "$ROOT/Code.gs" ] && [ -f "$ROOT/classic.html" ] || { echo "repo root not found at $ROOT" >&2; exit 1; }
BUILD=$(date -u +%Y%m%d%H%M%S)
node_modules/.bin/esbuild src/main.js --bundle --minify --format=iife --target=es2020 --outfile="$ROOT/app.js" --log-level=warning --legal-comments=none
cat src/css/*.css > "$ROOT/app.css"
cp core.gen.js "$ROOT/core.js"
sed "s/__BUILD__/$BUILD/g" index.template.html > "$ROOT/index.html"
sed "s/__BUILD__/$BUILD/g" sw.template.js > "$ROOT/sw.js"
cp manifest.template.webmanifest "$ROOT/manifest.webmanifest"
node --check "$ROOT/app.js" && node --check "$ROOT/core.js"
echo "built $BUILD → $ROOT"
