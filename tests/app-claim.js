// The team claim and the commissioner's PIN reset in the app (Parker, 4 Nov 2026: "CJ wasn't able to claim his team
// today, he tried and it stalled out"). The phone gave up on the web app after 15 s while a claim could still land; it now
// waits 40 s and sends a timed-out claim once more (Code.gs v3.33 signs a repeat of the same claim in). The commissioner
// resets a team's PIN from Your club (Code.gs resetpin), two taps, on his phone only. Code.gs's half: tests/codegs/v333.js.
// The browser half, fplgg/tools/preview/check-claim.js, runs a built preview with the web app simulated; it is not in the gate.
//   node tests/app-claim.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), MW = path.join(ROOT, 'fplgg', 'tools', 'matchweek');
const rd = f => fs.readFileSync(path.join(MW, f), 'utf8');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (!cond && info !== undefined ? '  ' + info : '')); };

console.log('--- W the wait for the web app');
const CORE = rd('core.gen.js'), V10 = rd('src-prod/v10.js');
check('W1 the engine waits 40 s for the web app (a cold start and its lock wait passed 15 s), in core.gen.js and src-prod/v10.js alike', /const AUTH_TIMEOUT=40000,/.test(CORE) && /const AUTH_TIMEOUT=40000,/.test(V10));
const ID = rd('src/sheets/identity.js');
check('W2 a claim or sign-in that timed out is sent once more, the same request, and only after a time-out', /const send = again => authPost\(req\)\.catch\(e => \{ if \(!again && e && e\.name === 'AbortError'\) return send\(true\); throw e; \}\);/.test(ID) && /send\(false\)\.then\(r => \{/.test(ID));
check('W3 a claim the server answers claimed still tells the manager to sign in with its PIN', /else if \(code === 'claimed'\) \{ authMarkClaimed\(sel\); CL\.err = 'Already claimed\. Sign in with its PIN, or ask the commissioner to reset it\.'; \}/.test(ID));

console.log('--- R the commissioner\'s PIN reset');
check('R1 the Team PINs block shows only when the signed-in team is the commissioner the server named', /if \(!D\.api \|\| !D\.commish \|\| team !== D\.commish \|\| !Array\.isArray\(D\.claimed\)\) return '';/.test(ID) && /\+ pinResetHTML\(team\)\n/.test(ID));
check('R2 it lists every claimed team but his own', /const list = D\.claimed\.filter\(t => t !== team && TEAMS\[t\]\);/.test(ID));
check('R3 a first tap arms the row, a second sends resetpin with his team, his token and the target', /if \(PR\.armed !== t\) \{ PR\.armed = t; redraw\(el\); return; \}/.test(ID) && /authPost\(authBuildReq\('resetpin', \{ team: a\.team, token: a\.token, target: t \}\)\)/.test(ID));
check('R4 the status answer names the commissioner (Code.gs) and the app keeps it (claim view and editor)', /if \(action === 'status'\) return \{ ok: true, claimed: emtClaimed\(\), commish: emtCommish\(\) \};/.test(fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8')) && (ID.match(/if \(typeof r\.commish === 'string'\) D\.commish = r\.commish;/g) || []).length === 2);
const CSS = rd('src/css/60-sheets.css');
check('R5 the rows: the name left-aligned on up to two lines, a button of at least 40 px', /\.id-pinr \.id-pinn\{display:flex;flex-direction:column;align-items:flex-start;/.test(CSS) && /\.id-pinr b\{[^}]*-webkit-line-clamp:2/.test(CSS) && /\.id-pinr \.btn\{[^}]*min-height:40px/.test(CSS));
check('R6 the browser check exists for the next change', fs.existsSync(path.join(ROOT, 'fplgg', 'tools', 'preview', 'check-claim.js')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
