// v3.20 tests: the writers on the Claude 5.5 models. Quick calls turn thinking off the way each model allows, the batch
// calls get room for it, a refused parameter is retried without, and an article that failed under an older Code.gs is
// tried once more by a newer one.   cd /home/claude/emt && node tests/codegs/v320.js
const T = require(__dirname + '/harness.js').make();
const { ctx, sheets, props, check, iso, H } = T;
const F = T.F, PREV = F.previewFacts(), src = T.src;
const resp = T.resp;
/* the Messages API mock: a queue of replies; every request body is kept */
const msgs = []; let MSG = [];
const base = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (url, o) => {
  if (url === 'https://api.anthropic.com/v1/messages') {
    const body = JSON.parse(o.payload); msgs.push(body);
    const next = MSG.shift(); if (!next) throw new Error('no Messages reply queued');
    if (next.code) return resp(next.code, next.body);
    return resp(200, { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: next.text }], stop_reason: next.stop || 'end_turn' });
  }
  return base(url, o);
};
props.ANTHROPIC_API_KEY = 'sk-test';

console.log('--- V the release');
check('V1 EMT_VERSION is v3.20 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.20') >= 0 && /\* v3\.20 · 8 Oct 2026\n \*   The writers work again on the Claude 5\.5 models\./.test(src));
check('V2 the budgets: feed 2000, show 4000, research 8000, writing 16000, punch-up 16000', ctx.EMT_AI_MAX_TOKENS === 2000 && ctx.EMT_SHOW_MAX_TOKENS === 4000 && ctx.EMT_ART_RESEARCH_MAX_TOKENS === 8000 && ctx.EMT_ART_WRITE_MAX_TOKENS === 16000 && ctx.EMT_ART_PUNCH_MAX_TOKENS === 16000);

console.log('--- P the parameters per model');
const P = (m, mode) => JSON.stringify(ctx.emtModelParams(m, mode));
check('P1 quick: Sonnet 5.5 thinks between tools only (off), Haiku 5.5 thinking disabled, Opus 5.5 effort low, Fable 5.1 effort low', P('claude-sonnet-5-5', 'quick') === '{"thinking":{"type":"between_tools"}}' && P('claude-haiku-5-5', 'quick') === '{"thinking":{"type":"disabled"}}' &&
  P('claude-opus-5-5', 'quick') === '{"output_config":{"effort":"low"}}' && P('claude-fable-5-1', 'quick') === '{"output_config":{"effort":"low"}}');
check('P2 quick: the 4.5 fallbacks get nothing', P('claude-sonnet-4-5', 'quick') === '{}' && P('claude-haiku-4-5', 'quick') === '{}' && P('', 'quick') === '{}');
check('P3 batch: nothing extra for any model (the model keeps its own thinking, max_tokens leaves room)', P('claude-sonnet-5-5', 'batch') === '{}' && P('claude-haiku-5-5', 'batch') === '{}' && P('claude-sonnet-4-5', 'batch') === '{}');
check('P4 emtParamRefused: a 400 naming thinking, output_config or effort; not other 400s, not a 404', ctx.emtParamRefused(400, 'thinking.type: between_tools is not supported') && ctx.emtParamRefused(400, 'output_config.effort is not valid for this model') &&
  !ctx.emtParamRefused(400, 'model: claude-x does not exist') && !ctx.emtParamRefused(404, 'thinking'));

console.log('--- A the feed writer');
const ev = { id: 'test-1', kind: 'test', desc: 'test', ask: 'write', facts: { x: 1 }, n: 1, teams: ['Cold Palmers'], players: [] };
MSG = [{ text: '{"posts":[]}' }]; msgs.length = 0;
let out = ctx.aiWrite(ev);
check('A1 Haiku 5.5: max_tokens 2000 and thinking disabled; the reply (empty posts) handled', msgs.length === 1 && msgs[0].model === 'claude-haiku-5-5' && msgs[0].max_tokens === 2000 && JSON.stringify(msgs[0].thinking) === '{"type":"disabled"}' && Array.isArray(out) && out.length === 0, JSON.stringify(msgs[0]).slice(0, 200));
props.EMT_AI_MODEL = 'claude-haiku-4-5'; MSG = [{ text: '{"posts":[]}' }]; msgs.length = 0; ctx.aiWrite(ev);
check('A2 Haiku 4.5 (EMT_AI_MODEL): no thinking parameter at all', msgs[0].model === 'claude-haiku-4-5' && !('thinking' in msgs[0]) && !('output_config' in msgs[0]) && msgs[0].max_tokens === 2000);
delete props.EMT_AI_MODEL;
MSG = [{ code: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'thinking: this model does not take thinking.type disabled' } } }, { text: '{"posts":[]}' }]; msgs.length = 0; T.reset();
out = ctx.aiWrite(ev);
check('A3 the model refuses the thinking parameter: asked once more without it, on the same model, logged', msgs.length === 2 && msgs[0].thinking && !('thinking' in msgs[1]) && msgs[1].model === 'claude-haiku-5-5' && Array.isArray(out) && T.logs.some(l => /refused a parameter/.test(l)), T.logs.join(' | '));
MSG = [{ code: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'messages: text content blocks must be non-empty' } } }]; msgs.length = 0;
let threw = null; try { ctx.aiWrite(ev); } catch (e) { threw = e; }
check('A4 another 400 is not retried: one call, the error surfaces as before', msgs.length === 1 && threw && /Claude API 400/.test(threw.message));
MSG = [{ code: 404, body: { type: 'error', error: { type: 'not_found_error', message: 'model: claude-haiku-5-5' } } }, { text: '{"posts":[]}' }]; msgs.length = 0; delete props.EMT_MODEL_GONE;
ctx.aiWrite(ev);
check('A5 a retired model still falls through the chain: Haiku 4.5 next, without a thinking parameter', msgs.length === 2 && msgs[1].model === 'claude-haiku-4-5' && !('thinking' in msgs[1]));
delete props.EMT_MODEL_GONE;

console.log('--- S the show writer');
MSG = [{ text: '{"ok":1}' }]; msgs.length = 0;
let r = ctx.emtShowAsk('claude-sonnet-5-5', 'hello');
check('S1 Sonnet 5.5: max_tokens 4000, thinking between_tools (off); the text comes back with its stop reason', msgs[0].max_tokens === 4000 && JSON.stringify(msgs[0].thinking) === '{"type":"between_tools"}' && r.text === '{"ok":1}' && r.stop === 'end_turn');
MSG = [{ text: 'x' }]; msgs.length = 0; ctx.emtShowAsk('claude-sonnet-4-5', 'hello');
check('S2 Sonnet 4.5: no thinking parameter', !('thinking' in msgs[0]) && msgs[0].max_tokens === 4000);
MSG = [{ text: 'x' }]; msgs.length = 0; ctx.emtShowAsk('claude-haiku-5-5', 'hello', ctx.EMT_PUNCH_SHOW_SYSTEM);
check('S3 the show punch-up on Haiku 5.5: thinking disabled, the punch system', JSON.stringify(msgs[0].thinking) === '{"type":"disabled"}' && msgs[0].system === ctx.EMT_PUNCH_SHOW_SYSTEM);
MSG = [{ code: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'thinking.type: between_tools is not supported at this effort' } } }, { text: 'x' }]; msgs.length = 0;
r = ctx.emtShowAsk('claude-sonnet-5-5', 'hello');
check('S4 the show writer: a refused parameter is retried once without it', msgs.length === 2 && !('thinking' in msgs[1]) && r.text === 'x');
MSG = [{ code: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'model: claude-sonnet-5-5 is retired' } } }]; msgs.length = 0;
r = ctx.emtShowAsk('claude-sonnet-5-5', 'hello');
check('S5 a 400 about the model: not retried, reported as missing (the chain moves on)', msgs.length === 1 && r.error && r.missing === true);

console.log('--- B the batch calls');
const job = { id: 'preview-gw6-abc123', gw: 6, kind: 'preview', phase: 'research', redos: 0, note: '' };
const rp = ctx.emtArtResearchParams(job, PREV, 'claude-sonnet-5-5', null), wp = ctx.emtArtWriteParams('user text', null, 'claude-sonnet-5-5'), pp = ctx.emtArtPunchParams(job, { title: 'x' }, 'claude-haiku-5-5');
check('B1 research 8000, writing 16000, punch-up 16000; no thinking or effort parameter (adaptive thinking stays on, with room)', rp.max_tokens === 8000 && wp.max_tokens === 16000 && pp.max_tokens === 16000 && [rp, wp, pp].every(x => !('thinking' in x) && !('output_config' in x)));

console.log('--- R a failed article is tried again by a newer Code.gs');
const at1 = iso(Date.now() - H);
T.REPO['index.json'] = { code: 200, text: JSON.stringify({ files: { 'preview-gw6.json': { kind: 'preview', gw: 6, at: at1, chars: 1, md5: 'x' } }, updated: at1 }) };
T.REPO['preview-gw6.json'] = { code: 200, text: JSON.stringify(PREV) };
const Sheet = T.Sheet;
const failedRow = (id, logTail) => [id, 6, 'preview', 'failed', '', '', "'" + at1, '', '', '', '', "'" + iso(Date.now() - 2 * H) + ' research: started.\n' + iso(Date.now() - H) + ' failed: try 3 of 3 failed, no more: the article failed the checks twice: The reply was cut off before the JSON ended.' + logTail];
sheets.Articles = new Sheet('Articles', [ctx.EMT_ART_HEAD.slice(), failedRow('preview-gw6-old111', '')]);
let meta = ctx.emtArtMeta();
check('R1 a failure logged before v3.20 (no version marker) reads as failedBy ""', meta.length === 1 && meta[0].status === 'failed' && meta[0].failedBy === '');
let due = ctx.emtArtDue(false, Date.now());
check('R2 emtArtDue: the GW6 preview is due again (the old failure does not count)', due.gw === 6 && due.kind === 'preview', JSON.stringify(due.why));
ctx.emtRepoReset(); T.cache = {}; T.reset();
let S = ctx.articleTick(Date.now());
const rows = sheets.Articles.rows.slice(1);
check('R3 articleTick starts a new row for the GW6 preview from the repo facts; the failed row stays as it was', S.stopped === 'submitted' && S.kind === 'preview' && rows.length === 2 && rows[0][3] === 'failed' && rows[1][3] === 'research' && rows[1][0] !== rows[0][0] && T.creates.length === 1, JSON.stringify({ S: S.stopped, why: S.why }));
/* that new job fails under this version: final */
const newId = rows[1][0];
ctx.emtArtFail({ id: newId, gw: 6, kind: 'preview', run: JSON.parse(props.EMT_ART_JOB).run }, 'try 3 of 3 failed, no more.', { did: [] });
meta = ctx.emtArtMeta();
check('R4 a failure under this version carries its marker and is final: not due again', meta[1].status === 'failed' && meta[1].failedBy === ctx.EMT_VERSION && /\[Code\.gs v3\.\d+\]$/.test(ctx.emtArtLogLast(meta[1].log)) && !ctx.emtArtDue(false, Date.now()).gw && ctx.emtArtDue(false, Date.now()).why.some(w => /preview of GW6 is already in the Articles tab/.test(w)), JSON.stringify(ctx.emtArtDue(false, Date.now()).why));
sheets.Articles = new Sheet('Articles', [ctx.EMT_ART_HEAD.slice(), failedRow('preview-gw6-old222', ' [Code.gs v9.99]')]);
check('R5 a failure logged by a newer version than this one is final too', !ctx.emtArtDue(false, Date.now()).gw);
sheets.Articles = new Sheet('Articles', [ctx.EMT_ART_HEAD.slice(), failedRow('preview-gw6-old333', ' [Code.gs v3.19]')]);
check('R6 a failure under v3.19 is tried again by this version', ctx.emtArtDue(false, Date.now()).gw === 6);
check('R7 with force (Articles: write now), a failed row never blocks, as before', ctx.emtArtDue(true, Date.now()).gw === 6);
delete props.EMT_ART_JOB;

T.done();
