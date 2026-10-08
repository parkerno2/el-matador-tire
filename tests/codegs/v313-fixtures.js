// v3.13 test fixtures: the mocked research and the articles Claude "writes" (used by v313.js), and (tone pass) their
// punched-up versions.
// Every number in the articles is in the facts (scratchpad/gs/recap-facts.gw5.json, scratchpad/show/facts.json) or in
// the research notes below.
const fs = require('fs');
const RECAP = JSON.parse(fs.readFileSync(__dirname + '/recap-facts.gw5.json', 'utf8'));
const SHOWF = JSON.parse(fs.readFileSync(__dirname + '/fixtures/facts.json', 'utf8'));
const TABS = __dirname + '/fixtures/tabs/';
const tab = n => { const d = JSON.parse(fs.readFileSync(TABS + n + '.json', 'utf8')); const cols = d.table.cols.map(c => c.label);
  return [cols].concat(d.table.rows.map(r => r.c.map(c => c ? (c.f != null ? c.f : c.v) : ''))); };

/* the preview facts: the real GW6 facts plus the v3.13 keys, computed from them and the real GW6 club fixtures */
function previewFacts() {
  const f = JSON.parse(JSON.stringify(SHOWF));
  const clubs = tab('Clubs').slice(1), name = s => (clubs.find(c => c[0] === s) || [])[1] || s;
  const games = tab('Club Fixtures').slice(1).filter(r => Number(r[0]) === 6).map(r => ({ h: r[1], a: r[2], ko: r[3] }));
  f.kind = 'preview';
  f.slate = games.map(g => ({ home: name(g.h), away: name(g.a), ko: g.ko }));
  f.collisions = f.fixtures.map(x => ({ home: x.home, away: x.away, games: games.map(g => {
    const pick = s => s.xi.filter(p => p.club === g.h || p.club === g.a).map(p => p.name);
    const H = pick(x.H), A = pick(x.A);
    return H.length && A.length ? { pl: name(g.h) + ' v ' + name(g.a), ko: g.ko, H, A } : null; }).filter(Boolean) }));
  f.rosters = {}; f.fixtures.forEach(x => ['H', 'A'].forEach(k => { f.rosters[x[k].team] = x[k].xi.map(p => p.name + ' (' + p.club + ')'); }));
  f.moves = [];
  return f;
}

/* ---------- research (web search) mocks ---------- */
const U = {
  bbc: 'https://www.bbc.co.uk/sport/football/articles/c5y2gw5brenche',
  sky: 'https://www.skysports.com/football/news/11095/13420001/man-city-5-3-sunderland',
  guardian: 'https://www.theguardian.com/football/2026/sep/20/bournemouth-liverpool-match-report',
  fake: 'https://made-up.example.com/never-searched',
  skyPre: 'https://www.skysports.com/football/news/11095/13431122/team-news-gameweek-6',
  bbcPre: 'https://www.bbc.co.uk/sport/football/articles/c9gw6pressers',
};
const search = (id, urls) => [
  { type: 'server_tool_use', id, name: 'web_search', input: { query: 'Premier League results' } },
  { type: 'web_search_tool_result', tool_use_id: id, content: urls.map((u, i) => ({ type: 'web_search_result', url: u, title: 'Result ' + i, encrypted_content: 'enc' + i, page_age: 'September 20, 2026' })) }];
function recapResearch() {
  return [{ type: 'text', text: 'I will look up every game.' }].concat(search('srvtoolu_01', [U.bbc, U.sky, U.guardian]), [
    { type: 'text', text: '\n\nBrentford v Chelsea\n- Schade set up both of Thiago\'s goals in a 3-0 win ', citations: [{ type: 'web_search_result_location', url: U.bbc, title: 'Brentford 3-0 Chelsea', cited_text: 'Schade set up' }] },
    { type: 'text', text: '(BBC Sport)\n\nMan City v Sunderland\n- Brobbey scored in the 12th, 44th and 81st minutes for Sunderland (Sky Sports)\n- Semenyo scored twice and set up Haaland (Sky Sports)\n- Guardiola said: "We were careless at the back, but the boys kept going." (Sky Sports)\n\n' +
      'Bournemouth v Liverpool\n- Isak scored the only goal after 63 minutes (The Guardian)\n\nPLAYERS TO CHECK\n- Saliba missed out with a knock picked up in training (BBC Sport)\n\n' +
      'SOURCES:\nBBC Sport | ' + U.bbc + '\nSky Sports | ' + U.sky + '\nThe Guardian | ' + U.guardian + '\nMade Up Daily | ' + U.fake + '\n' }]);
}
function previewResearch() {
  return search('srvtoolu_11', [U.skyPre, U.bbcPre]).concat([
    { type: 'text', text: 'Arsenal v Leeds\n- Arteta said Saka trained fully on Thursday (Sky Sports)\n- Rice is expected to be fit after a knock (Sky Sports)\n\nLiverpool v Man City\n- Isak is a doubt with a thigh problem and will be assessed on Friday (BBC Sport)\n- Guardiola expects Haaland to start (BBC Sport)\n\nChelsea v Bournemouth\n- Palmer has a muscle issue and is 50-50 (BBC Sport)\n\n' +
      'SOURCES:\nSky Sports | ' + U.skyPre + '\nBBC Sport | ' + U.bbcPre + '\n' }]);
}

/* ---------- the recap of GW5 (valid) ---------- */
function recapArticle() {
  return {
    gw: 5, kind: 'recap',
    title: 'Brobbey and Semenyo hit 17 each as Trophy Hunters run up 66',
    sub: 'A one point thriller, a rout, two comfortable away wins and a waiver market worth a look',
    lede: 'Gameweek 5 was decided by Sunderland, Brentford and a busy afternoon at the Etihad. Trophy Hunters posted the biggest score of the week, Cold Palmers won by the smallest margin possible, Kobbie Mainoo Fan stayed top of the table and Devils U21s are still waiting for their first point.',
    matchups: [
      { home: 'Team Jacob', away: 'Cold Palmers', kicker: 'One point in it', star: { code: '513418', label: 'Star of the match' },
        story: 'Cold Palmers won 34 to 33 at Team Jacob, and the point that separated them came from Brentford. Schade set up both of Thiago\'s goals in the 3-0 win over Chelsea and finished on 9 points. Jacob, meanwhile, watched Kostoulas score 10 on his bench, where they counted for nothing.',
        bullets: ['Mitchell led Team Jacob with 7 points from the goalless draw at Leeds.', 'Van Hecke scored for Spurs and still finished on the losing side against Aston Villa.', 'Gyökeres lasted 17 minutes for Cold Palmers and returned 1 point.'],
        number: { value: '10', caption: 'Kostoulas\'s points, left on Team Jacob\'s bench in a one point defeat' } },
      { home: 'Trophy Hunters', away: 'In It to McGinn It', kicker: 'A rout at the top', star: { code: '441264', label: 'Star of the match' },
        story: 'Trophy Hunters scored 66, the highest total of the week, and won by 26. Brobbey scored in the 12th, 44th and 81st minutes of Sunderland\'s 5-3 defeat at Man City for 17 points, and Semenyo matched him from the other side of the same game with two goals and an assist.',
        bullets: ['Tarkowski added 14 points from defence, with an assist and 3 bonus.', 'Bryant\'s side took 9 bonus points to Nate\'s 3.', 'Thiago scored for Brentford, but Nate\'s attack never got close.'],
        number: { value: '66', caption: 'Trophy Hunters\' total, the best score of gameweek 5' } },
      { home: 'The Soaring Gulls', away: 'Kobbie Mainoo Fan', kicker: 'The leaders hold', star: { code: '487838', label: 'Star of the match' },
        story: 'Kobbie Mainoo Fan won 49 to 31 and stay top on 10 points. Hall scored in Newcastle\'s 2-1 win over Hull and collected 13 points with full bonus, while Isak scored the only goal at Bournemouth after 63 minutes and added 8 more for Baha.',
        bullets: ['Hall\'s goal came with 3 bonus points on top.', 'CJ\'s side collected no bonus at all.', 'Wissa played 90 minutes for Newcastle and finished on 0.'],
        number: { value: '13', caption: 'Hall\'s points, the highest in this matchup' } },
      { home: 'Devils U21s', away: 'I Am a Baleba', kicker: 'Still waiting', star: { code: '430871', label: 'Star of the match' },
        story: 'I Am a Baleba won 54 to 32, and Devils U21s are still without a point after five games. Cunha scored in Man Utd\'s 1-1 draw at Fulham for 10 points, and Trafford matched him in goal with 10 of his own from a goalless afternoon at Leeds.',
        bullets: ['Virgil was PJ\'s best with 8 points.', 'Haaland scored in the 5-3 win over Sunderland but returned only 6.', 'Eze managed 17 minutes and 1 point.'],
        number: { value: '22', caption: 'The winning margin, the biggest away win of the week' } }],
    around: [
      { h: 'Around the league', body: 'Kobbie Mainoo Fan lead on 10 points, one clear of a four way pack on 9: The Soaring Gulls, Trophy Hunters, I Am a Baleba and Cold Palmers. The Soaring Gulls have scored 240, the most in the league, without the results to match. Devils U21s sit 8th on 0 after five straight defeats, and Team Jacob slipped to 6th.',
        bullets: ['Trophy Hunters climbed to 3rd.', 'In It to McGinn It are 7th on 6 points.'] },
      { h: 'Waiver watch', body: 'Dasilva scored 15 for Coventry in their 1-0 win at Nott\'m Forest and nobody owns him. Schuster added 14 at Brentford and Groß 14 at Brighton, and both are unowned. Cold Palmers were the busiest side on the wire last week with four waivers, Mainoo and Jacquet among them.',
        bullets: ['Manzambi, Aston Villa, 13 points.', 'Buendía, Aston Villa, 12 points.', 'Rushworth, Coventry, 11 points.'] },
      { h: 'Next up', body: 'Gameweek 6 brings The Nolan Derby, Cold Palmers against Devils U21s, and The Sacred Heart Derby, Kobbie Mainoo Fan against Trophy Hunters. I Am a Baleba host The Soaring Gulls and In It to McGinn It meet Team Jacob. The deadline is on 10 October.' }],
    sources: [{ name: 'BBC Sport', url: U.bbc }, { name: 'Sky Sports', url: U.sky }, { name: 'The Guardian', url: U.guardian }],
    foot: 'Scores are provisional until FPL confirms bonus and stat corrections.' };
}

/* ---------- the preview of GW6 (valid) ---------- */
function previewArticle() {
  return {
    gw: 6, kind: 'preview',
    title: 'Two derbies, a Liverpool and City crossroads and Saka on 6.1',
    sub: 'Who has who in gameweek 6, and the doubts that could decide it',
    lede: 'Gameweek 6 runs through Anfield. Liverpool against Manchester City touches all four fixtures, two derbies are on the card, and a long list of flags hangs over Friday\'s pressers. Kobbie Mainoo Fan go into the week top on 10 points, with four sides one behind on 9.',
    matchups: [
      { home: 'Cold Palmers', away: 'Devils U21s', kicker: 'The Nolan Derby', star: { code: '244851', label: 'The limbo' },
        story: 'PJ leads The Nolan Derby series 4 to 3, but his side arrives without a point. The collisions run through Arsenal against Leeds, where Raya, Rice and Gyökeres face PJ\'s Eze, and Liverpool against City, where Jacquet meets Donnarumma, Gvardiol and Virgil. Chelsea at home to Bournemouth adds one more split, Lacroix and Palmer for Parker against Neto for PJ.',
        bullets: ['Palmer carries a 75% flag with a muscular injury, one of four doubts in Parker\'s eleven.', 'Gibbs-White leads PJ\'s side on a projection of 5.3 at Crystal Palace.', 'Devils U21s are still looking for a first win after five defeats.'],
        number: { value: '56%', caption: 'The model\'s chance of a Cold Palmers win' } },
      { home: 'I Am a Baleba', away: 'The Soaring Gulls', kicker: 'Haaland goes to Anfield', star: { code: '223094', label: 'Player to watch' },
        story: 'Ethan sends Haaland and Ndiaye to Anfield and has Szoboszlai and Barcola on the home side, with CJ\'s Guéhi in the middle of it. Trafford, in goal for Ethan, faces Gabriel at home to Leeds, and Bournemouth at Chelsea sets Truffert and Rayan against Tavernier. Predicted score: 43 to 46 for CJ.',
        bullets: ['Haaland is the top projection in Ethan\'s eleven at 5.5.', 'Gabriel leads CJ\'s side on 5.3 at home to Leeds.', 'Ethan leads the series 4 to 3.'],
        number: { value: '55%', caption: 'The model\'s chance of a Soaring Gulls win' } },
      { home: 'Kobbie Mainoo Fan', away: 'Trophy Hunters', kicker: 'The Sacred Heart Derby', star: { code: '219168', label: 'The limbo' },
        story: 'The Sacred Heart Derby puts Baha\'s Arsenal stack of Calafiori, Timber and Ødegaard against Bryant\'s Tzolis and Bruno G. at home to Leeds. Liverpool against City splits again, with Isak and Wirtz for Baha against Araujo and Semenyo. Everton at Hull is the quiet one: Barry for Baha against Tarkowski, who projects 5.5 for Bryant.',
        bullets: ['Isak carries a thigh injury and a 75% chance of playing.', 'Brobbey, Semenyo and Tzolis all carry flags for Bryant.', 'Baha leads the series 5 to 2.'],
        number: { value: '62%', caption: 'The model\'s chance of a Kobbie Mainoo Fan win' } },
      { home: 'In It to McGinn It', away: 'Team Jacob', kicker: 'A first meeting', star: { code: '223340', label: 'Player to watch' },
        story: 'Nate and Jacob have never met. Manchester United against Spurs is the big collision: Fernandes and Rashford for Nate against Jacob\'s Mbeumo, while Nate\'s Kudus, Porro and Marmoush line up on the visiting side with Jacob\'s Van Hecke. Jacob\'s Arsenal pair of Saka and Havertz face no one from Nate\'s side at all.',
        bullets: ['Saka projects 6.1 at home to Leeds, the highest in the league.', 'Fernandes leads Nate\'s side on 5.7.', 'The model makes Team Jacob 63% favourites.'],
        number: { value: '6.1', caption: 'Saka\'s projection, the best in the league this week' } }],
    around: [
      { h: 'The slate', body: 'Arsenal host Leeds in the early game on Saturday, and Liverpool against Manchester City on Sunday carries the most collisions of the week, with a player from both sides of every fixture. Coventry against Newcastle closes the gameweek on Monday night, with Hall, Wissa and Thiaw all involved.',
        bullets: ['Arsenal v Leeds, Saturday lunchtime.', 'Liverpool v Man City, Sunday afternoon.'] },
      { h: 'Transfer clock', body: 'No waivers have gone through since the last deadline, so every side goes in with the squad that played gameweek 5. On the injury front, Rice is expected to be fit after a knock, Arteta said Saka trained fully on Thursday, and Guardiola expects Haaland to start at Anfield. Isak will be assessed on Friday, and Palmer is described as 50-50 with a muscle issue.',
        bullets: ['Isak: assessed on Friday.', 'Palmer: 50-50 for Bournemouth.', 'Rice: expected to be fit.'] },
      { h: 'Waiver wire', body: 'The wire matters less than the flags this week. Fourteen starters across the league carry a doubt, so the managers who check team news after Friday\'s pressers will have the edge, and a bench with cover at the right club could be worth more than any pickup.' }],
    sources: [{ name: 'Sky Sports', url: U.skyPre }, { name: 'BBC Sport', url: U.bbcPre }],
    foot: 'Predicted scores come from each side\'s projected XI; flags can change at Friday\'s pressers.' };
}

/* ---------- the punch-up (tone pass): the same articles, sharper jokes; every number, star, heading and source kept ---------- */
function recapPunched(a) {
  a = a || recapArticle();
  const m = a.matchups[3];
  m.story = m.story.replace('still without a point after five games.', 'still without a point after five games. Five defeats, zero points, and still the loudest side in the group chat.');
  m.bullets[0] = 'Virgil was PJ\'s best with 8 points, which tells you everything about the rest.';
  a.matchups[1].bullets[2] = 'Thiago scored for Brentford, and Nate\'s attack watched it like everyone else.';
  return a;
}
function previewPunched(a) {
  a = a || previewArticle();
  a.matchups[0].bullets[2] = 'Devils U21s are still looking for a first win after five defeats. Form is temporary; this derby is not.';
  a.matchups[3].story = a.matchups[3].story.replace('Nate and Jacob have never met.', 'Nate and Jacob have never met. First dates are always awkward.');
  return a;
}

module.exports = { RECAP, SHOWF, previewFacts, recapResearch, previewResearch, recapArticle, previewArticle, recapPunched, previewPunched, U, tab };
