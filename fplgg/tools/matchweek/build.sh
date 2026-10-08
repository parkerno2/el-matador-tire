#!/bin/bash
# build.sh [outdir]  → bundles src/ into outdir/{index.html,app.js,app.css,core.js,sw.js} and a harness site dir (outdir/site)
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT=$(realpath -m "${1:-$HERE/dist}")
SRC=$(realpath -m "${2:-$HERE/src}")
cd "$HERE"
mkdir -p "$OUT"
BUILD=$(date -u +%Y%m%d%H%M%S)
tools/node_modules/.bin/esbuild "$SRC/main.js" --bundle --minify --format=iife --target=es2020 --outfile="$OUT/app.js" --log-level=warning --legal-comments=none
cat "$SRC"/css/*.css > "$OUT/app.css"
cp core.gen.js "$OUT/core.js"
sed "s/__BUILD__/$BUILD/g" index.template.html > "$OUT/index.html"
sed "s/__BUILD__/$BUILD/g" sw.template.js > "$OUT/sw.js"
cp manifest.template.webmanifest "$OUT/manifest.webmanifest"
node --check "$OUT/app.js" && node --check "$OUT/core.js"
# harness site: the build at the root, plus the repo's assets
SITE="$OUT/site"; mkdir -p "$SITE"
for f in index.html app.js app.css core.js sw.js manifest.webmanifest; do ln -sfn "$(realpath $OUT/$f)" "$SITE/$f"; done
for x in faces icons show press recap-gw1.html recap-gw2.html recap-gw3.html preview-gw2.html preview-gw3.html preview-gw4.html; do ln -sfn /home/claude/emt/$x "$SITE/$x"; done
ln -sfn /home/claude/emt/classic.html "$SITE/classic.html"
echo "built $BUILD → $OUT"
