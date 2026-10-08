// v3.23 tests: the research budget and its log (BUGS #28). The batch calls get 32,000 tokens each, and the research
// line in the Log says when the model ran out of its budget or wrote no notes.   node tests/codegs/v323.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src } = T;
const F = T.F, PREV = F.previewFacts();

console.log('--- V the release');
check('V1 EMT_VERSION is v3.23 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.23') >= 0 && /\* v3\.23 · 8 Oct 2026\n \*   The articles' research gets the room it needs/.test(src));

console.log('--- B the batch budgets');
const job = { id: 'preview-gw6-abc123', gw: 6, kind: 'preview', phase: 'research', redos: 0, note: '' };
const rp = ctx.emtArtResearchParams(job, PREV, 'claude-sonnet-5-5', null), wp = ctx.emtArtWriteParams('user text', null, 'claude-sonnet-5-5'), pp = ctx.emtArtPunchParams(job, { title: 'x' }, 'claude-haiku-5-5');
check('B1 research, writing and punch-up: 32000 tokens each, the constants and the requests alike', ctx.EMT_ART_RESEARCH_MAX_TOKENS === 32000 && ctx.EMT_ART_WRITE_MAX_TOKENS === 32000 && ctx.EMT_ART_PUNCH_MAX_TOKENS === 32000 && rp.max_tokens === 32000 && wp.max_tokens === 32000 && pp.max_tokens === 32000);
check('B2 no thinking or effort parameter on the batch calls (adaptive thinking stays on, with room)', [rp, wp, pp].every(x => !('thinking' in x) && !('output_config' in x)));
check('B3 the quick calls unchanged: feed 2000, show 4000, thinking off on the 5.5 models', ctx.EMT_AI_MAX_TOKENS === 2000 && ctx.EMT_SHOW_MAX_TOKENS === 4000 && JSON.stringify(ctx.emtModelParams('claude-sonnet-5-5', 'quick')) === '{"thinking":{"type":"between_tools"}}' && JSON.stringify(ctx.emtModelParams('claude-haiku-5-5', 'quick')) === '{"thinking":{"type":"disabled"}}');
check('B4 the research still searches the web (up to 10 searches) and continues a paused turn', rp.tools.length === 1 && rp.tools[0].name === 'web_search' && rp.tools[0].max_uses === 10 && ctx.EMT_ART_CONTS === 2);

console.log('--- L the research log');
const L = (R, stop) => ctx.emtArtResearchLog(R, stop, ctx.EMT_ART_CONTS);
check('L1 notes and sources, ended by the model: as before', L({ text: 'x'.repeat(1200), sources: 3 }, 'end_turn') === 'research done: 1200 characters, 3 sources.');
check('L2 one source, singular', L({ text: 'abc', sources: 1 }, 'end_turn') === 'research done: 3 characters, 1 source.');
check('L3 searched but no notes: says so and that the article is written from the league data alone', L({ text: '', sources: 0 }, 'end_turn') === 'research done: 0 characters, 0 sources (the model searched but wrote no notes; the article is written from the league data alone).');
check('L4 cut off with no notes: names the budget', L({ text: '', sources: 0 }, 'max_tokens') === 'research done: 0 characters, 0 sources (the model used its whole budget of 32000 tokens, thinking included, before writing any notes; the article is written from the league data alone).');
check('L5 cut off with notes: the notes end where the model stopped', L({ text: 'notes', sources: 2 }, 'max_tokens') === 'research done: 5 characters, 2 sources (cut off at the budget of 32000 tokens, thinking included; the notes end where the model stopped).');
check('L6 still paused after the continuations: the note as before', L({ text: 'nn', sources: 0 }, 'pause_turn') === 'research done: 2 characters, 0 sources (still paused after 2 continuations; kept what it had).');
check('L7 a missing result never throws', L(null, 'end_turn') === 'research done: 0 characters, 0 sources (the model searched but wrote no notes; the article is written from the league data alone).');
check('L8 the batch handler logs through it', /emtArtResearchDone\(job, R\.text, emtArtResearchLog\(R, msg\.stop_reason, EMT_ART_CONTS\), S\)/.test(src));

T.done();
