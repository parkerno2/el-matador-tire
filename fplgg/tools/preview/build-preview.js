/* fplgg/tools/preview/build-preview.js — builds a PREVIEW of the Matchweek app from the checked-out source, for Parker's
   eye on his phone, on the live league data, without touching what the league sees (10 Oct 2026, his UI pass request).
       node fplgg/tools/preview/build-preview.js [OUTDIR]        # default: <repo>/preview
   The Preview Matchweek app workflow (.github/workflows/preview.yml) runs it on every push to the `preview` branch, after
   the same gate as Code.gs tests and release, and commits the folder as preview/ on main, so GitHub Pages serves it at
   https://parkerno2.github.io/el-matador-tire/preview/ beside the league app. Production is untouched: the six root
   files are not written, and the only production rule that knows the preview is sw.js, which passes any /preview/ request
   straight to the network (sw.template.js), so a phone never gets the cached league shell for the preview.
   What differs from ci-build.sh: the bundle carries the define __MW_PREVIEW__ (src/data/tabs.js PREVIEW: no service
   worker, no error reports, no facts sent, a Preview label on every page); index.html has no manifest (not installable)
   and a preview title; faces/, icons/, voices/, press/ and show/ are copied beside it, because the app reads them by
   relative path. Everything else (the engine, the LEAGUE header, the CSS, the data source) is the league app's own. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const APP = path.join(ROOT, 'fplgg', 'tools', 'matchweek');
const league = require(path.join(APP, 'tools', 'league.js'));
const OUT_DEFAULT = path.join(ROOT, 'preview');
const ASSET_DIRS = ['faces', 'icons', 'voices', 'press', 'show'];   /* read by relative path from the page */
const FILES = ['index.html', 'app.js', 'app.css', 'core.js'];        /* no sw.js, no manifest */

/* the preview's index.html from the app's template: its own title, no manifest, the build stamp in place */
function previewIndex(template, build) {
  return template
    .replace(/<title>[^<]*<\/title>/, '<title>Matchweek · El Matador Tire · preview</title>')
    .replace(/<link rel="manifest"[^>]*>\n?/, '')
    .replace(/<meta name="apple-mobile-web-app-title" content="[^"]*">/, '<meta name="apple-mobile-web-app-title" content="Matchweek preview">')
    .replace(/__BUILD__/g, build);
}
function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(cmd + ' ' + args.join(' ') + ' failed: ' + (r.stderr || r.stdout || r.error));
  return r.stdout;
}
function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

function main(argv) {
  const out = path.resolve(argv[0] || OUT_DEFAULT);
  const log = m => console.log('[preview] ' + m);
  if (!fs.existsSync(path.join(APP, 'node_modules', '.bin', 'esbuild'))) throw new Error('esbuild is not installed: run npm ci in ' + APP);
  const build = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mw-preview-'));
  /* the same bundle as ci-build.sh, with the define; the same CSS order (LC_ALL=C name order) and the same core.js */
  run(path.join(APP, 'node_modules', '.bin', 'esbuild'), ['src/main.js', '--bundle', '--minify', '--format=iife', '--target=es2020', '--define:__MW_PREVIEW__=true', '--log-level=warning', '--legal-comments=none', '--outfile=' + path.join(tmp, 'app.js')], APP);
  const appJs = fs.readFileSync(path.join(tmp, 'app.js'), 'utf8');
  const cssFiles = fs.readdirSync(path.join(APP, 'src', 'css')).filter(f => f.endsWith('.css')).sort();
  const appCss = cssFiles.map(f => fs.readFileSync(path.join(APP, 'src', 'css', f), 'utf8')).join('');
  const coreJs = league.header(league.load()) + fs.readFileSync(path.join(APP, 'core.gen.js'), 'utf8');
  const index = previewIndex(fs.readFileSync(path.join(APP, 'index.template.html'), 'utf8'), build);
  rmrf(out); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), index);
  fs.writeFileSync(path.join(out, 'app.js'), appJs);
  fs.writeFileSync(path.join(out, 'app.css'), appCss);
  fs.writeFileSync(path.join(out, 'core.js'), coreJs);
  ASSET_DIRS.forEach(d => { if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(out, d), { recursive: true, filter: s => !/README\.md$/.test(s) }); });
  fs.writeFileSync(path.join(out, 'build.json'), JSON.stringify({ build, from: process.env.GITHUB_SHA || '', branch: process.env.GITHUB_REF_NAME || '' }) + '\n');
  run(process.execPath, ['--check', path.join(out, 'app.js')]);
  run(process.execPath, ['--check', path.join(out, 'core.js')]);
  rmrf(tmp);
  log('written to ' + out + ': app ' + (appJs.length / 1024 | 0) + ' KB, core ' + (coreJs.length / 1024 | 0) + ' KB, build ' + build);
  return 0;
}
module.exports = { ROOT, APP, OUT_DEFAULT, ASSET_DIRS, FILES, previewIndex, main };
if (require.main === module) { try { process.exit(main(process.argv.slice(2))); } catch (e) { console.error('[preview] ' + (e && e.stack || e)); process.exit(1); } }
