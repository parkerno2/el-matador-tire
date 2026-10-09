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
# Player images (Parker, 8 Oct 2026): the FC cutouts in faces/ that FC_FACES lists, otherwise FPL's own photo. Every
# listed code must have its file, and the stale PL CDN path (last season's kits, nothing for new signings) never ships.
node -e '
const fs=require("fs"),s=fs.readFileSync("core.gen.js","utf8"),m=/const FC_FACES=new Set\('"'"'([0-9 ]*)'"'"'\.split/.exec(s);
if(!m){console.error("FC_FACES not found in core.gen.js");process.exit(1)}
const miss=m[1].split(" ").filter(c=>!fs.existsSync(process.argv[1]+"/faces/"+c+".png"));
if(miss.length){console.error("FC_FACES lists codes with no faces/<code>.png: "+miss.join(", "));process.exit(1)}' "$ROOT"
if grep -rlE 'premierleague/photos/players' src core.gen.js; then echo "the old PL photo path is back (stale kits): use FPL_PHOTO / faceUrls" >&2; exit 1; fi
BUILD=$(date -u +%Y%m%d%H%M%S)
node_modules/.bin/esbuild src/main.js --bundle --minify --format=iife --target=es2020 --outfile="$ROOT/app.js" --log-level=warning --legal-comments=none
cat src/css/*.css > "$ROOT/app.css"
# The league's config (league.json, ROADMAP C1): checked, then written as `const LEAGUE={...}` in front of the engine.
{ node -e 'const L=require("./tools/league.js");process.stdout.write(L.header(L.load()))'; cat core.gen.js; } > "$ROOT/core.js"
sed "s/__BUILD__/$BUILD/g" index.template.html > "$ROOT/index.html"
sed "s/__BUILD__/$BUILD/g" sw.template.js > "$ROOT/sw.js"
cp manifest.template.webmanifest "$ROOT/manifest.webmanifest"
node --check "$ROOT/app.js" && node --check "$ROOT/core.js"
echo "built $BUILD → $ROOT"
