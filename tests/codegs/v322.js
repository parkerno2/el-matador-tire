// v3.22 tests: the Clubs tab mirrors the fields FPL publishes now (ROADMAP A7, BUGS #25). FPL's classic bootstrap-static
// carries 0 in every attack and defence strength this season and its 1 to 5 fixture difficulty in strength_overall_home
// and strength_overall_away, so the tab keeps Str H and Str A and drops the rest.   node tests/codegs/v322.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src } = T;
const row = (c, d) => JSON.stringify(ctx.clubStrengthRow(c, d));

console.log('--- V the release');
check('V1 EMT_VERSION is v3.22 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.22') >= 0 && /\* v3\.22 · 8 Oct 2026\n \*   The Clubs tab mirrors what FPL publishes now/.test(src));
check('V2 the Clubs tab header: Short, Name, Badge code, Badge URL, Str H, Str A', ctx.CLUB_STR_HEAD.join('|') === 'Str H|Str A' && /put\('Clubs', \['Short', 'Name', 'Badge code', 'Badge URL'\]\.concat\(CLUB_STR_HEAD\), clubRows\);/.test(src));
check('V3 the fields: strength_overall_home and strength_overall_away, nothing else', ctx.CLUB_STR_FIELDS.join('|') === 'strength_overall_home|strength_overall_away');
check('V4 the row builder still takes the classic team, falling back to the draft team', /\.concat\(clubStrengthRow\(\(classicTeams \|\| \{\}\)\[t\.short_name\], t\)\);/.test(src));

console.log('--- R the row');
/* Arsenal as FPL's classic bootstrap-static returned it on 8 Oct 2026 */
const ARS = { code: 3, id: 1, name: 'Arsenal', short_name: 'ARS', strength: null, strength_overall_home: 4, strength_overall_away: 5, strength_attack_home: 0, strength_attack_away: 0, strength_defence_home: 0, strength_defence_away: 0 };
check('R1 FPL\'s figures as they are: [4, 5] for Arsenal, the zeroed fields ignored', row(ARS, { id: 1, short_name: 'ARS' }) === '[4,5]');
check('R2 strings become numbers', row({ strength_overall_home: '3', strength_overall_away: '4' }, null) === '[3,4]');
check('R3 a field the classic team lacks comes from the draft team, per field', row({ strength_overall_home: 2 }, { strength_overall_home: 5, strength_overall_away: 3 }) === '[2,3]' && row(null, { strength_overall_home: 4, strength_overall_away: 4 }) === '[4,4]');
check('R4 nothing from either: blanks, never a throw', row(null, null) === '["",""]' && row({}, {}) === '["",""]' && row(undefined, { id: 1 }) === '["",""]');
check('R5 a 0 (a rating FPL no longer publishes) is blank, so the app keeps its own table', row({ strength_overall_home: 0, strength_overall_away: 0 }, { strength_overall_home: 0 }) === '["",""]');
check('R6 the old 1000 to 1400 scale and junk are blank too; 1 and 5 are kept', row({ strength_overall_home: 1250, strength_overall_away: 'x' }, null) === '["",""]' && row({ strength_overall_home: 1, strength_overall_away: 5 }, null) === '[1,5]');
check('R7 an empty string on the classic team falls back to the draft team', row({ strength_overall_home: '', strength_overall_away: 3 }, { strength_overall_home: 2 }) === '[2,3]');

T.done();
