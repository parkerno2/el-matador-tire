// v3.33 tests: a team claim no longer stalls (Parker, 4 Nov 2026: "CJ wasn't able to claim his team today, he tried and
// it stalled out"). The claim waited for the script lock that the data refresh and the AI writer hold while they run, and
// the phone gave up while the claim could still land. Now the PIN properties have their own lock (the Sheet's document
// lock), a claim of an already claimed team with the same PIN signs in while any other PIN is a wrong try under the
// lockout, and the commissioner resets a team's PIN from the app (action resetpin).   node tests/codegs/v333.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src, props } = T;
const Hd = r => ctx.emtHandle(r);
const TEAMS = ctx.emtTeams();
const BOSS = ctx.emtCommish(), A = TEAMS.find(t => t !== BOSS), B = TEAMS.find(t => t !== BOSS && t !== A);

/* the locks: the script lock as Apps Script behaves while another run holds it (waitLock throws after the wait, tryLock
   answers false), the document lock free; every lock taken is recorded */
let scriptHeld = false, docLock = true;
const taken = [];
const lock = kind => ({
  waitLock() { taken.push(kind + ':wait'); if (kind === 'script' && scriptHeld) throw new Error('Lock timeout: another process was holding the lock for too long.'); },
  tryLock() { taken.push(kind + ':try'); return !(kind === 'script' && scriptHeld); },
  releaseLock() { taken.push(kind + ':release'); },
});
ctx.LockService = { getScriptLock: () => lock('script'), getDocumentLock: () => (docLock ? lock('doc') : null) };
const fresh = () => { taken.length = 0; };

console.log('--- L the PIN properties have their own lock');
check('L0 the teams are read from the sheet, and the commissioner is one of them', TEAMS.length === 8 && TEAMS.indexOf(BOSS) > -1, TEAMS.join(', ') + ' / ' + BOSS);
scriptHeld = true; fresh();
let r = Hd({ action: 'claim', team: A, pin: '1234' });
check('L1 a claim succeeds while another run holds the script lock (the refresh or the AI writer): it waits on the Sheet\'s lock only', r.ok === true && !!r.token && taken.every(t => t.indexOf('doc:') === 0) && taken.includes('doc:wait') && taken.includes('doc:release'), JSON.stringify(r) + ' ' + taken.join(','));
check('L2 the claim stored the PIN hash', props['EMT_PIN_' + A] === ctx.emtPinHash(A, '1234'));
fresh(); r = Hd({ action: 'login', team: A, pin: '1234' });
check('L3 a sign-in succeeds while the script lock is held, on the Sheet\'s lock', r.ok === true && r.token === ctx.emtToken(A, props['EMT_PIN_' + A]) && taken.every(t => t.indexOf('doc:') === 0), JSON.stringify(r) + ' ' + taken.join(','));
scriptHeld = false; docLock = false; fresh();
r = Hd({ action: 'login', team: A, pin: '1234' });
check('L4 a script not bound to a Sheet (no document lock) falls back to the script lock', r.ok === true && taken.includes('script:wait') && taken.includes('script:release'), taken.join(','));
docLock = true;
check('L5 emtPinLock is the only lock the claim, sign-in and reset code takes', (() => {
  const a = src.indexOf("if (action === 'claim' || action === 'login') {"), b = src.indexOf("if (action === 'save' || action === 'reset') {");
  const block = src.slice(a, b);
  return a > 0 && b > a && !/getScriptLock/.test(block) && (block.match(/emtPinLock\(\)/g) || []).length === 2;
})());

console.log('--- C a claim of a claimed team');
fresh(); r = Hd({ action: 'claim', team: A, pin: '1234' });
check('C1 the same PIN again (a claim whose answer the phone never got) signs in, with the sign-in\'s token', r.ok === true && r.token === ctx.emtToken(A, props['EMT_PIN_' + A]), JSON.stringify(r));
check('C2 and leaves the PIN as it was', props['EMT_PIN_' + A] === ctx.emtPinHash(A, '1234'));
r = Hd({ action: 'claim', team: A, pin: '9999' });
check('C3 another PIN answers claimed and keeps the stored PIN', r.ok === false && r.error === 'claimed' && props['EMT_PIN_' + A] === ctx.emtPinHash(A, '1234'), JSON.stringify(r));
check('C4 and counts as a wrong try', JSON.parse(props['EMT_FAIL_' + A] || '{}').n === 1, props['EMT_FAIL_' + A]);
let last = null;
for (let i = 0; i < 4; i++) last = Hd({ action: 'claim', team: A, pin: String(1000 + i) });
check('C5 five wrong claims lock the team, as five wrong sign-ins do (no way round the lockout)', last && last.error === 'locked' && last.retryMin > 0, JSON.stringify(last));
r = Hd({ action: 'claim', team: A, pin: '1234' });
const r2 = Hd({ action: 'login', team: A, pin: '1234' });
check('C6 while locked, even the right PIN is refused by a claim and by a sign-in', r.error === 'locked' && r2.error === 'locked', JSON.stringify([r, r2]));
delete props['EMT_FAIL_' + A];
r = Hd({ action: 'login', team: A, pin: '0000' });
check('C7 a wrong sign-in still answers wrong', r.ok === false && r.error === 'wrong', JSON.stringify(r));
delete props['EMT_FAIL_' + A];
r = Hd({ action: 'login', team: B, pin: '1234' });
check('C8 a sign-in to an unclaimed team still answers unclaimed', r.error === 'unclaimed', JSON.stringify(r));
check('C9 a bad PIN and an unknown team are refused before any lock', Hd({ action: 'claim', team: B, pin: '12a4' }).error === 'badpin' && Hd({ action: 'claim', team: 'Nobody FC', pin: '1234' }).error === 'badteam');

console.log('--- R the commissioner resets a PIN from the app');
const bossTok = Hd({ action: 'claim', team: BOSS, pin: '4321' }).token, aTok = ctx.emtToken(A, props['EMT_PIN_' + A]);
props['EMT_FAIL_' + A] = JSON.stringify({ n: 3 });
r = Hd({ action: 'resetpin', team: A, token: aTok, target: B });
check('R1 another manager cannot reset a PIN', r.ok === false && r.error === 'commish' && !!props['EMT_PIN_' + A], JSON.stringify(r));
r = Hd({ action: 'resetpin', team: BOSS, token: 'nope', target: A });
check('R2 the commissioner\'s team with a bad token cannot either', r.ok === false && r.error === 'auth' && !!props['EMT_PIN_' + A], JSON.stringify(r));
r = Hd({ action: 'resetpin', team: BOSS, token: bossTok, target: 'Nobody FC' });
check('R3 an unknown team is refused', r.ok === false && r.error === 'badteam', JSON.stringify(r));
scriptHeld = true; fresh();
r = Hd({ action: 'resetpin', team: BOSS, token: bossTok, target: A });
check('R4 the commissioner resets a team: its PIN and its lockout count are gone, on the Sheet\'s lock while the script lock is held', r.ok === true && !('EMT_PIN_' + A in props) && !('EMT_FAIL_' + A in props) && taken.includes('doc:wait') && !taken.some(t => t.indexOf('script:') === 0), JSON.stringify(r) + ' ' + taken.join(','));
check('R5 the answer lists the claimed teams without it', Array.isArray(r.claimed) && r.claimed.indexOf(A) < 0 && r.claimed.indexOf(BOSS) > -1, JSON.stringify(r.claimed));
r = Hd({ action: 'save', team: A, token: aTok, color: 'steel', shape: '', photo: '', pattern: '', emblem: '' });
check('R6 the old sign-in of the reset team no longer works', r.ok === false && r.error === 'auth', JSON.stringify(r));
r = Hd({ action: 'claim', team: A, pin: '5555' });
check('R7 the team claims again with a new PIN', r.ok === true && props['EMT_PIN_' + A] === ctx.emtPinHash(A, '5555'), JSON.stringify(r));
fresh(); ctx.adminResetPin(A);
check('R8 the editor\'s adminResetPin does the same, on the same lock', !('EMT_PIN_' + A in props) && taken.includes('doc:wait') && taken.includes('doc:release'), taken.join(','));
const bossTok2 = ctx.emtToken(BOSS, props['EMT_PIN_' + BOSS]);
r = Hd({ action: 'resetpin', team: BOSS, token: bossTok2, target: BOSS });
check('R9 the commissioner cannot reset his own PIN from the app (a stolen sign-in cannot take his team): only the editor can', r.ok === false && r.error === 'self' && !!props['EMT_PIN_' + BOSS], JSON.stringify(r));
scriptHeld = false;

console.log('--- H the health report');
check('H1 ?health=1 says the PIN code has its own lock (document) when the script is bound to the Sheet', T.get({ health: '1' }).pinLock === 'document');
docLock = false;
check('H2 and says script when it falls back to the shared lock', T.get({ health: '1' }).pinLock === 'script');
docLock = true;

console.log('--- V the version');
check('V1 the CHANGELOG\'s first version is v3.33 and EMT_VERSION follows it', ctx.emtSelfVersion(src) === 'v3.33' && ctx.EMT_VERSION === 'v3.33');
check('V2 the escape-hatch note names the app\'s reset', /Reset a team's PIN \(action resetpin\)/.test(src));

T.done();
