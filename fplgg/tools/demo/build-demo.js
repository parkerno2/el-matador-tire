/* fplgg/tools/demo/build-demo.js — builds matchweek.gg's demo league into site/public/demo (Parker's Q2, 8 Oct 2026).
   Run after fplgg/tools/matchweek/ci-build.sh (the Build Matchweek app workflow does; `npm ci` in that folder first):
       node fplgg/tools/demo/build-demo.js            # snapshot the live tabs, anonymise, build, copy, check
       node fplgg/tools/demo/build-demo.js --check    # the leak check alone, over site/public, nothing written
   What it writes, and nothing else: site/public/demo/{index.html, app.js, app.css, core.js, data/*.json, data/index.json}
   plus copies of faces/, icons/ and voices/. The app is the same source as the league app, bundled with __MW_DEMO__ set
   (src/data/tabs.js: the data source fixed to the frozen tabs, nothing read from the Sheet, the web app or Supabase,
   every write off, no service worker, the Demo league label), and the league's built-in names in core.js, app.js and
   app.css replaced by the fictional ones (names.js). The snapshot is taken from the live Sheet at build time and
   anonymised with a mapping derived from its own rows, so no real name is ever written to the repo; when the Sheet
   cannot be read the demo is left as it was (the root build must never fail for the demo's sake) unless --strict.
   The leak check reads the real names from the live Standings tab and fails when one appears as a whole word anywhere
   under site/public: team names, full names, first names, surnames and the engine's short names (SHORTOF). A first name
   a footballer in the Players tab shares (Jacob Ramsey, Ethan Nwaneri) is not checked, and no first or short name is
   checked in the data files of the player tabs; team names, full names and surnames always are.
   No EA assets (Parker, 9 Oct 2026): the demo uses FPL photos and initials only. faces/ is not copied and the demo's
   core.js has an empty FC_FACES, so every player goes through FPL's photo and then initials; the EA Map and FC27 tabs are
   not read or written, and the Rosters OVR column (an EA-based rating) is blanked, so the engine's rating derived from the
   FPL projection stands in (ovrOf) and the player sheet's Ratings tab says so (src/sheets/player.js, DEMO). The EA check
   (eaScan) fails the build when a file byte-identical to one in faces/, a faces/ folder, a <code>.png of FC_FACES, or a
   file named fc27 or ea-map lands anywhere under site/public. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const names = require('./names.js'), snap = require('./snapshot.js');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const APP = path.join(ROOT, 'fplgg', 'tools', 'matchweek');
const SITE = path.join(ROOT, 'site', 'public');
const OUT = path.join(SITE, 'demo');
const TEXT_EXT = /\.(html?|js|mjs|css|json|jsonc|webmanifest|txt|md|svg|xml|csv)$/i;
const ASSET_DIRS = ['icons', 'voices', 'press'];   /* press/: the editorial posts' pictures; never faces/ (EA renders, 9 Oct 2026) */
const EA_TABS = ['EA Map', 'FC27'];                /* the EA tabs: not read, not written (9 Oct 2026) */
const EA_FILE_RE = /(^|[\\/])(fc27|ea[-_ ]?map)[^\\/]*$/i;   /* a data file named after them, anywhere, any extension */

/* the engine's initials per team, from core.gen.js's TEAMS table (ini:'XX'), so the mapping renames the keys it uses */
function engineInitials(core) {
  const out = {}; const re = /'([^']+)':\{mgr:'[^']*',ini:'([A-Za-z0-9]+)'/g; let x;
  while ((x = re.exec(core))) out[x[1]] = x[2];
  return out;
}
/* the engine's short names per team, from core.gen.js's SHORTOF table ('Cold Palmers':'Palmers'), so the one word a
   team goes by on a tight line is fictional too */
function engineShorts(core) {
  const out = {}; const t = /const SHORTOF=\{([^}]*)\}/.exec(core); if (!t) return out;
  const re = /'([^']+)':'([^']+)'/g; let x; while ((x = re.exec(t[1]))) out[x[1]] = x[2];
  return out;
}
/* the engine for the demo: FC_FACES emptied, so faceUrls never names faces/<code>.png and every player takes FPL's photo,
   then initials (the set stays a Set: the engine calls .has on it) */
function demoCore(core) {
  const re = /const FC_FACES=new Set\('[^']*'\.split\(' '\)\);/;
  if (!re.test(core)) throw new Error('core.gen.js: the FC_FACES set is not where the demo build expects it');
  return core.replace(re, 'const FC_FACES=new Set();/* the demo carries no EA faces */');
}
/* the snapshot without the EA ratings: the Rosters OVR column blanked (Code.gs builds it on the FC27 base), so the
   engine's ovrOf falls back to its rating from the FPL projection; the EA tabs, if a caller passed them, dropped */
function dropRatings(tabs) {
  const out = {};
  Object.keys(tabs).forEach(n => { if (!EA_TABS.includes(n)) out[n] = tabs[n]; });
  if (out.Rosters && out.Rosters.cols.includes('OVR')) out.Rosters = { cols: out.Rosters.cols, rows: out.Rosters.rows.map(r => Object.assign({}, r, { OVR: '' })) };
  return out;
}
/* the EA check over a folder: { file: why } for every file that is byte-identical to one in faces/ (md5), sits in a
   faces/ folder, is named <code>.png for a code of FC_FACES, or is named fc27 or ea-map. faceDir: the EA renders to
   compare against (the repo's faces/ by default); codes: the FC_FACES codes (from core.gen.js by default). */
function faceHashes(faceDir) {
  const out = new Map();
  if (!fs.existsSync(faceDir)) return out;
  fs.readdirSync(faceDir).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).forEach(f => out.set(crypto.createHash('md5').update(fs.readFileSync(path.join(faceDir, f))).digest('hex'), f));
  return out;
}
function faceCodes(core) { const m = /const FC_FACES=new Set\('([^']*)'\.split\(' '\)\)/.exec(core); return new Set(m ? m[1].split(' ') : []); }
function eaScan(dir, faceDir, codes) {
  const hashes = faceHashes(faceDir === undefined ? path.join(ROOT, 'faces') : faceDir);
  codes = codes || faceCodes(fs.readFileSync(path.join(APP, 'core.gen.js'), 'utf8'));
  const found = {};
  const walkAll = rel => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { walkAll(r); continue; }
      if (/(^|\/)faces\//.test(r)) found[r] = 'in a faces folder';
      else if (EA_FILE_RE.test(r)) found[r] = 'an EA data file by name';
      else if (/^\d+\.png$/i.test(e.name) && codes.has(e.name.replace(/\.png$/i, ''))) found[r] = 'an FC face by code';
      else if (/\.(png|jpe?g|webp)$/i.test(e.name) && hashes.size) { const h = crypto.createHash('md5').update(fs.readFileSync(path.join(dir, r))).digest('hex'); if (hashes.has(h)) found[r] = 'byte-identical to faces/' + hashes.get(h); }
    }
  };
  walkAll('');
  return found;
}
/* the demo's index.html from the app's template: its own title and description, no manifest (not installable), no
   preconnect to the Sheet, the build stamp in place */
function demoIndex(template, build) {
  return template
    .replace(/<title>[^<]*<\/title>/, '<title>Matchweek · Demo league</title>')
    .replace(/<link rel="manifest"[^>]*>\n?/, '')
    .replace(/<link rel="preconnect" href="https:\/\/docs\.google\.com">\n?/, '')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="The Matchweek demo league: the full app on a frozen week of real Premier League data, with fictional managers.">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="Matchweek · Demo league">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="Live matchups, projections, the table and the title odds, on a demo league you can tap through.">')
    .replace(/<meta name="apple-mobile-web-app-title" content="[^"]*">/, '<meta name="apple-mobile-web-app-title" content="Matchweek demo">')
    .replace(/__BUILD__/g, build);
}
/* every text file under dir (relative paths) */
function walk(dir, rel, out) {
  out = out || []; rel = rel || '';
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(dir, r, out); else if (TEXT_EXT.test(e.name)) out.push(r);
  }
  return out;
}
/* the player tabs' data files, where first names are not checked */
const playerFile = rel => names.PLAYER_TABS.some(t => rel.replace(/\\/g, '/').endsWith('/data/' + names.slug(t)));
/* { file: [names] } for every leak under dir; exempt: the footballers' first names (names.playerFirstNames) */
function leakScan(dir, m, exempt) {
  const found = {};
  walk(dir).forEach(rel => {
    const l = names.leaks(fs.readFileSync(path.join(dir, rel), 'utf8'), m, playerFile(rel), exempt);
    if (l.length) found[rel] = l;
  });
  return found;
}
function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(cmd + ' ' + args.join(' ') + ' failed: ' + (r.stderr || r.stdout || r.error));
  return r.stdout;
}

async function main(argv) {
  const checkOnly = argv.includes('--check'), strict = argv.includes('--strict');
  const log = m => console.log('[demo] ' + m);
  const core = fs.readFileSync(path.join(APP, 'core.gen.js'), 'utf8');
  /* 1. the live tabs */
  let shot;
  try { shot = await snap.snapshot(undefined, checkOnly ? null : log, EA_TABS); }
  catch (e) {
    const msg = 'the league Sheet could not be read (' + String(e && e.message || e).slice(0, 160) + ')';
    if (strict) throw new Error(msg);
    log(msg + '; the demo is left as it was');
    return 0;
  }
  const m = names.mapping(shot.tabs.Standings.rows, engineInitials(core), engineShorts(core));
  if (!checkOnly) {
    /* 2. the anonymised data */
    const tabs = dropRatings(names.anonymiseTabs(shot.tabs, m));   /* no EA ratings in the demo (9 Oct 2026) */
    const build = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mw-demo-'));
    /* 3. the app with __MW_DEMO__ set; identifiers are kept so a name in a string is the only two-letter word that changes */
    run(path.join(APP, 'node_modules', '.bin', 'esbuild'), ['src/main.js', '--bundle', '--minify-whitespace', '--minify-syntax', '--format=iife', '--target=es2020', '--define:__MW_DEMO__=true', '--log-level=warning', '--legal-comments=none', '--outfile=' + path.join(tmp, 'app.js')], APP);
    const appJs = names.substituteCode(fs.readFileSync(path.join(tmp, 'app.js'), 'utf8'), m);
    const coreJs = names.substituteCode(demoCore(core), m);   /* no EA faces in the demo (9 Oct 2026) */
    const cssFiles = fs.readdirSync(path.join(APP, 'src', 'css')).filter(f => f.endsWith('.css')).sort();   /* name order, as ci-build.sh with LC_ALL=C */
    const appCss = names.substituteCode(cssFiles.map(f => fs.readFileSync(path.join(APP, 'src', 'css', f), 'utf8')).join(''), m);
    const index = demoIndex(fs.readFileSync(path.join(APP, 'index.template.html'), 'utf8'), build);
    /* 4. write it all, fresh */
    rmrf(OUT); fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'index.html'), index);
    fs.writeFileSync(path.join(OUT, 'app.js'), appJs);
    fs.writeFileSync(path.join(OUT, 'core.js'), coreJs);
    fs.writeFileSync(path.join(OUT, 'app.css'), appCss);
    const counts = {};
    Object.keys(tabs).forEach(n => { fs.writeFileSync(path.join(OUT, 'data', names.slug(n)), JSON.stringify(tabs[n])); counts[n] = tabs[n].rows.length; });
    fs.writeFileSync(path.join(OUT, 'data', 'index.json'), JSON.stringify({ taken: shot.taken, build, tabs: counts, skipped: shot.skipped, teams: m.order.length }, null, 1));
    ASSET_DIRS.forEach(d => { if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true, filter: s => !/README\.md$/.test(s) }); });
    run(process.execPath, ['--check', path.join(OUT, 'app.js')]);
    run(process.execPath, ['--check', path.join(OUT, 'core.js')]);
    rmrf(tmp);
    log('written: ' + Object.keys(tabs).length + ' tabs' + (Object.keys(shot.skipped).length ? ' (skipped: ' + Object.keys(shot.skipped).join(', ') + ')' : '') + ', app ' + (appJs.length / 1024 | 0) + ' KB, core ' + (coreJs.length / 1024 | 0) + ' KB, build ' + build);
  }
  /* 5. the leak check, over the whole site */
  const exempt = names.playerFirstNames(shot.tabs.Players);
  const found = leakScan(SITE, m, exempt);
  const files = Object.keys(found);
  if (files.length) {
    console.error('[demo] a real team or manager name is in site/public: ' + files.map(f => f + ' (' + found[f].length + ')').join(', '));
    return 1;
  }
  log('leak check: clean (' + walk(SITE).length + ' files)');
  /* 6. the EA check, over the whole site: no EA face, no fc27 or ea-map file (Parker, 9 Oct 2026) */
  const ea = eaScan(SITE);
  const eaFiles = Object.keys(ea);
  if (eaFiles.length) {
    console.error('[demo] an EA asset is in site/public: ' + eaFiles.slice(0, 20).map(f => f + ' (' + ea[f] + ')').join(', ') + (eaFiles.length > 20 ? ' and ' + (eaFiles.length - 20) + ' more' : ''));
    return 1;
  }
  log('EA check: clean');
  return 0;
}
module.exports = { ROOT, APP, SITE, OUT, TEXT_EXT, ASSET_DIRS, EA_TABS, EA_FILE_RE, engineInitials, engineShorts, demoCore, dropRatings, faceHashes, faceCodes, eaScan, demoIndex, walk, playerFile, leakScan, main };
if (require.main === module) main(process.argv.slice(2)).then(code => process.exit(code), e => { console.error('[demo] ' + (e && e.stack || e)); process.exit(1); });
