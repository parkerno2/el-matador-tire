/* feed/build.js — data in, posts out. Each builder states facts from D and the engine, and carries them on the post. */
import * as UI from '../ui.js';
import {
  esc, words, Words, WORDS, list, poss, possT, plural, ROUND_WORD, f1, oddsTxt, lsGet, dayMonth, relTime, logTime, gwDoneTime, buildUpTime,
  short, firstOf, mgrOf, byName, ptsOver, finishedGws, fxOf, fxFor, oppOf, newsLabel, newsWhen, chanceOf, statusWord, kickoffs, dt, hash,
  pick, pickAvoid, caps, posWord,
} from './util.js';
import {
  results, benchStory, record, tableOrder, posOf, recordsTo, motmTotals, periodDone, perfLuck, resultsLuck, luckiestPlayer, freeAgents, roundOne,
  worstPick, pickText, flagged, selectionCall, dangerMan, preKick, dealGroups, contested, deniedWhy, sim, oddsBefore, shows, mmss, starMan, wp, tp, ms, ex,
  latePick, finishedFxGws, teamPtsIn, seasonRange, lastMeeting, formGuide, hotStreak, unstarted, modelCheck,
} from './facts.js';
import { socialPosts } from './social-posts.js';
import { editorialPosts } from './editorial.js';
import { aiPosts } from './ai-posts.js';

const T = (d, min) => new Date((d ? d.getTime() : 0) + (min || 0) * 60e3);
const strong = s => '<strong>' + s + '</strong>';
const pt = n => n + (Math.abs(n) === 1 ? ' pt' : ' pts');
const name = t => esc(t);
const mins = () => { const live = (D.cf || []).filter(x => num(x.GW) === D.gw && fin(x.Started) && !fin(x.Finished)); return live.length ? Math.max(...live.map(x => num(x.Mins))) : 0; };
const liveLabel = () => { const m = mins(); return m ? 'Live · ' + m + '’' : 'Live'; };
const liveTime = () => { const k = (D.cf || []).filter(x => num(x.GW) === D.gw && fin(x.Started)).map(x => dt(x['Kickoff (UTC)'])).filter(Boolean).sort((a, b) => b - a)[0]; return k ? T(k, mins()) : (gwDeadline(D.gw) || new Date()); };
const derbyOr = (r, team) => r.nm ? r.nm : (team === r.home ? r.away : r.home);
const marginWords = m => m === 1 ? 'a single point' : words(m) + ' points';
const pctPair = w => w.h + '–' + w.a + '%';
/* the H2H series line from the engine ("PJ leads 4–3"), as a sentence part */
const sr = (a, b) => series(a, b);
const srLine = (a, b) => { const s = sr(a, b); if (!s) return ''; if (s === 'First ever meeting') return 'their first ever meeting'; return s.replace(' leads ', ' leads the series ').replace(/^Series level /, 'the series is level at '); };
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const pname = per => String(per[0]).replace(' & ', '–');
/* "the Devils", "the Gulls"; names that aren't plurals stay whole */
export const theShort = t => { const s = short(t); return s !== t && /s$/.test(s) ? 'the ' + s : t; };
/* ============================== who says what ==============================
   Each fact has one owner per gameweek, so the same line never turns up in two voices:
   · Archizio (insider): transactions, contested claims, injuries and doubts, the H2H series (derby week), the free-agent
     market, draft picks (round one, the best late pick), an owned player's hot streak, records, Manager of the Month,
     title odds, the Baha market (with the gap to the bottom, not the table position), team sheets.
   · Clark (the terrace): bench disasters, the week's biggest margin, losing runs and winless starts, performance luck,
     all-play robbery, the worst pick, the unstarted top scorer, a starter still waiting (live), the derby poll (each
     manager's season high and low) and the closest projected matchup.
   · Malcolm (the booth): the predicted board (biggest favourite and top projected score), previews (points over the last
     three gameweeks and the last meeting), the form guide, live board and swings, full time, the table, the gameweek
     against the projections, results boards.
   Wording rotates through 3–6 phrasings per kind with pick() (util.js): same data, same words, on every phone. */
const S = (...parts) => parts.filter(Boolean).join(' ');
const nTeams = () => Object.keys(TEAMS).length;
const gaText = (G, A) => [G ? (G === 1 ? 'a goal' : words(G) + ' goals') : '', A ? (A === 1 ? 'an assist' : words(A) + ' assists') : ''].filter(Boolean).join(' and ');
const aAn = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;

/* ============================== ARCHIZIO ============================== */
function archizio(out, you) {
  /* DEAL DONE: every waiver run and free-agent move. Walked oldest first: each deal starts from its gameweek's rotation
     (slot = its place among that gameweek's deals) and steps past the phrasing of the deal before it and of the same
     club's recent deals, so neighbours and a club's own history never read alike. A new deal never rewords an older one. */
  const DG = dealGroups().filter(g => g.ok.length), dseq = {}, used = {}, last = {}, dtext = {};
  const dealVariants = g => {
    const ins = g.ok.map(r => r.In), outs = g.ok.map(r => r.Out), n = g.ok.length, W = g.type === 'W';
    const Tn = name(g.team), TU = caps(g.team), I = esc(list(ins)), O = esc(list(outs));
    return n === 1 ? ['deal1', [
      () => strong('DEAL DONE FOR ' + caps(ins[0]) + '.') + ' ' + Tn + ' sign him ' + (W ? 'on waivers' : 'as a free agent') + '. ' + O + ' leaves.',
      () => strong(caps(ins[0]) + ' TO ' + TU + ', HERE WE GO.') + ' Signed ' + (W ? 'off the waiver wire' : 'from free agency') + ', with ' + O + ' making way.',
      () => strong(caps(outs[0]) + ' OUT, ' + caps(ins[0]) + ' IN.') + ' ' + Tn + ' make the switch ' + (W ? 'through waivers' : 'in free agency') + '.',
      () => strong(TU + ' SIGN ' + caps(ins[0]) + '.') + ' ' + (W ? 'A waiver claim' : 'A free-agent move') + ', and ' + O + ' leaves the squad.',
      () => strong(caps(ins[0]) + ', DONE DEAL.') + ' ' + Tn + ' add him ' + (W ? 'on waivers' : 'from free agency') + '; ' + O + ' is dropped.',
    ]] : ['dealN', [
      () => strong(WORDS(n) + ' IN AT ' + TU + '.') + ' ' + I + ' arrive ' + (W ? 'in one waiver run' : 'from free agency') + '; ' + O + ' leave.',
      () => strong('DEAL DONE AT ' + TU + '.') + ' ' + Words(n) + (W ? ' signings in one waiver run: ' : ' free-agent signings: ') + I + ' in, ' + O + ' out.',
      () => strong(TU + ' RESHUFFLE.') + ' ' + Words(n) + ' signings ' + (W ? 'from one waiver run' : 'from free agency') + ': ' + I + '. Making way: ' + O + '.',
      () => strong(WORDS(n) + ' FOR ' + TU + ', HERE WE GO.') + ' ' + I + ' sign ' + (W ? 'in one waiver run' : 'as free agents') + '. Dropped: ' + O + '.',
      () => strong(TU + ' CONFIRM ' + WORDS(n) + '.') + ' ' + (W ? 'One waiver run' : 'Free agency') + ' brings in ' + I + '. Out go ' + O + '.',
    ]];
  };
  DG.slice().sort((a, b) => a.at - b.at).forEach(g => {
    const ar = g.ok.length === 1 ? 1 : 2, k = g.gw + '|' + ar, tk = g.team + '|' + ar;
    dseq[k] = k in dseq ? dseq[k] + 1 : 0;
    const [kind, vs] = dealVariants(g), mine = used[tk] || (used[tk] = []);
    const c = pickAvoid(kind, g.gw, vs, dseq[k], new Set(mine.slice(-(vs.length - 2)).concat(ar in last ? [last[ar]] : [])));
    mine.push(c.i); last[ar] = c.i; dtext[g.key] = c.text;
  });
  DG.forEach(g => {
    const ins = g.ok.map(r => r.In), n = g.ok.length, W = g.type === 'W', via = W ? 'waivers' : 'free agency', text = dtext[g.key];
    const slides = g.ok.map(r => ({ code: r.pin ? String(r.pin.Code) : '', name: r.In, out: r.Out, team: g.team, via: W ? 'Waivers' : 'Free agent' }));
    out.push({
      id: 'deal:' + g.key, voice: 'archizio', kind: 'deal', ts: g.at, time: relTime(g.at), gw: g.gw, teams: [g.team], players: slides.map(s => s.code).filter(Boolean),
      text, media: { type: 'deal', slides },
      facts: 'Transactions · ' + dayMonth(g.at) + ' ' + via + ' · ' + n + ' accepted' + (g.no.length ? ', ' + g.no.length + ' denied' : ''),
      detail: g.rows.map(r => ({ k: esc(r.In) + ' in, ' + esc(r.Out) + ' out', v: esc(r.Result) })),
      links: [{ label: g.team === you ? 'Transfers' : short(g.team), ...(g.team === you ? { href: '#/team/transfers' } : { open: 'manager:' + g.team }) }],
      share: 'Deal done: ' + g.team + ' sign ' + list(ins) + ' via ' + via + '.',
    });
  });

  /* contested claims: two or more clubs after one player in a gameweek's waivers */
  const C = contested();
  Object.keys(C).forEach(gw => {
    const rows = C[gw].sort((a, b) => b.teams.length - a.teams.length), at = rows.map(r => r.at).sort((a, b) => b - a)[0], g = +gw;
    let text;
    if (rows.length === 1) {
      const r = rows[0], N = caps(r.name), L = esc(list(r.losers)), k = r.teams.length, many = r.losers.length > 1;
      text = r.winner ? pick('race1', g, [
        () => strong(N + ' GOES TO ' + caps(r.winner) + '.') + ' ' + L + ' claimed him too and missed out.',
        () => strong('HIJACK FOR ' + N + '.') + ' ' + name(r.winner) + ' beat ' + L + ' to him in the GW' + g + ' waivers.',
        () => strong(caps(list(r.losers)) + ' MISS OUT ON ' + N + '.') + ' ' + name(r.winner) + ' got there first.',
        () => strong('THE MOVE FOR ' + N + ' COLLAPSED.') + ' ' + L + (many ? ' put in claims; ' : ' put in a claim; ') + name(r.winner) + ' got there first.',
      ]) : pick('race0', g, [
        () => strong('NOBODY GETS ' + N + '.') + ' ' + Words(k) + ' clubs claimed him in the GW' + g + ' waivers. All denied.',
        () => strong(WORDS(k) + ' CLAIMS, NO DEAL FOR ' + N + '.') + ' Every claim in the GW' + g + ' waivers was denied.',
        () => strong(N + ' DEAL OFF.') + ' ' + Words(k) + ' clubs claimed him in the GW' + g + ' waivers; none went through.',
      ]);
    } else {
      const top = rows.slice(0, 2).map((r, i) => (i ? words(r.teams.length) : Words(r.teams.length)) + ' clubs claimed ' + esc(r.name)).join(' and ');
      const won = rows.filter(r => r.winner).slice(0, 2).map(r => name(r.winner) + ' got ' + esc(r.name)), wonS = won.length ? cap(list(won)) + '.' : '', k = rows.length;
      text = pick('raceN', g, [
        () => S(strong('WAIVER WARS, GW' + g + '.'), Words(k) + ' contested players. ' + top + '.', wonS),
        () => S(strong(WORDS(k) + ' CONTESTED IN GW' + g + '.'), top + '.', wonS),
        () => S(strong('THE GW' + g + ' WAIVERS.'), Words(k) + ' players drew more than one claim. ' + top + '.', wonS),
      ]);
    }
    out.push({
      id: 'race:' + gw + ':' + rows.map(r => r.name).join(','), voice: 'archizio', kind: 'race', ts: at, time: relTime(at), gw: g, teams: [...new Set(rows.flatMap(r => r.teams))], players: rows.map(r => r.p && String(r.p.Code)).filter(Boolean),
      text, media: { type: 'race', gw: g, rows },
      facts: 'Transactions · GW' + gw + ' waivers · ' + rows.length + ' contested ' + plural(rows.length, 'player'),
      detail: rows.map(r => ({ k: esc(r.name), v: r.winner ? 'Won by ' + esc(r.winner) + '; denied: ' + esc(list(r.losers)) : 'Denied for ' + esc(list(r.teams)) })),
      links: [], share: 'GW' + gw + ' waivers: ' + rows.map(r => r.name + (r.winner ? ' to ' + r.winner : '')).join(', ') + '.',
    });
  });

  const done = D.gwsDone, after = done ? gwDoneTime(done) : null;
  const pre = !D.dlPassed, bu = buildUpTime(D.gw);

  /* injuries and doubts on owned starters (before the deadline) */
  if (pre) {
    const teams = Object.keys(TEAMS).map(t => ({ t, f: flagged(t) })).filter(x => x.f.xi.length);
    const total = teams.reduce((s, x) => s + x.f.xi.length, 0);
    if (total) {
      const most = teams.slice().sort((a, b) => b.f.xi.length - a.f.xi.length), m = most[0].f.xi.length;
      const topN = most.filter(x => x.f.xi.length === m).map(x => x.t), one = topN.length === 1;
      const ids = teams.flatMap(x => x.f.xi.map(p => p.Code + statusWord(p))).join(',');
      const mostS = one ? name(topN[0]) + ' have the most: ' + words(m) + '.' : esc(list(topN)) + ' have ' + words(m) + ' each.';
      const st = Words(total) + ' ' + plural(total, 'starter') + (total === 1 ? ' carries' : ' carry');
      const text = pick('treat', D.gw, [
        () => S(strong('INJURY WATCH.'), st + ' a flag into GW' + D.gw + '.', mostS),
        () => S(strong('MEDICAL ROOM.'), (one ? name(topN[0]) + ' lead the GW' + D.gw + ' injury list with ' + words(m) + ' flagged ' + plural(m, 'starter') : esc(list(topN)) + ' have ' + words(m) + ' flagged ' + plural(m, 'starter') + ' each') + '.', 'Across the league: ' + words(total) + '.'),
        () => S(strong('FITNESS REPORT, GW' + D.gw + '.'), 'Flags on ' + words(total) + ' projected ' + plural(total, 'starter') + ' across the league.', mostS),
        () => S(strong('FLAGS UP.'), (one ? name(topN[0]) + ' have ' + words(m) : esc(list(topN)) + ' have ' + words(m) + ' each') + ' of the ' + words(total) + ' flagged ' + plural(total, 'starter') + ' going into GW' + D.gw + '.'),
      ]);
      out.push({
        id: 'treat:' + D.gw + ':' + hash(ids), voice: 'archizio', kind: 'treat', ts: T(bu, 70), time: 'GW' + D.gw + ' build-up', gw: D.gw, teams: teams.map(x => x.t), players: teams.flatMap(x => x.f.xi.map(p => String(p.Code))),
        text,
        media: { type: 'treat', groups: teams.sort((a, b) => posOf(a.t) - posOf(b.t)).map(x => ({ team: x.t, codes: x.f.xi.map(p => String(p.Code)) })) },
        facts: 'FPL injury news · projected XIs for GW' + D.gw,
        detail: teams.flatMap(x => x.f.xi.map(p => ({ k: esc(p.Player) + ' · ' + esc(short(x.t)), v: esc(p.News || statusWord(p)) }))),
        links: [], share: total + ' starters carry a flag into GW' + D.gw + '.',
      });
      /* the club with the most points at stake */
      const stake = teams.map(x => ({ ...x, last: x.f.xi.map(p => ({ p, pts: done ? ptsOver(p.Code, [done]) : 0 })) })).map(x => ({ ...x, sum: x.last.reduce((s, y) => s + y.pts, 0) })).sort((a, b) => b.sum - a.sum || b.f.xi.length - a.f.xi.length)[0];
      if (stake && stake.f.xi.length >= 2 && stake.t !== you) {
        const ps = stake.f.xi.slice(0, 4), nm = ps.map(p => p.Player), k = ps.length, who = esc(list(nm)), TU = caps(stake.t);
        const same = ps.every(p => statusWord(p) === statusWord(ps[0])), dAll = same && ps[0].Status === 'd', st0 = esc(statusWord(ps[0]));
        const pts = stake.last.slice(0, 4).map(x => x.pts), sum = pts.reduce((s, v) => s + v, 0), samePts = pts.every(v => v === pts[0]) && pts[0] > 0;
        const both = k === 2 ? 'Both' : 'All ' + words(k);
        const ptsA = !done ? '' : samePts ? both + ' scored ' + pts[0] + ' in GW' + done + '.' : sum > 0 ? 'Between them: ' + sum + ' points in GW' + done + '.' : '';
        const ptsB = !done ? '' : samePts ? (k === 2 ? 'They scored ' : 'They each scored ') + pts[0] + ' in GW' + done + '.' : sum > 0 ? 'They scored ' + sum + ' between them in GW' + done + '.' : '';
        const tx = pick('sweat', D.gw, [
          () => S(strong('UNDERSTAND.'), name(stake.t) + ' are sweating on ' + who + '.', ptsA, dAll ? both + ' are ' + st0 + ' for GW' + D.gw + '.' : ''),
          () => S(strong('CONCERN AT ' + TU + '.'), who + (k === 2 ? ' both' : ' all') + ' carry flags into GW' + D.gw + (dAll ? ', each at ' + st0 + '.' : '.'), ptsB),
          () => S(strong(TU + ' WAIT ON ' + WORDS(k) + '.'), ptsB, who + (dAll ? (k === 2 ? ' are both ' : ' are all ') + st0 + ' for GW' + D.gw + '.' : ' are flagged for GW' + D.gw + '.')),
        ]);
        out.push({
          id: 'sweat:' + D.gw + ':' + stake.t + ':' + hash(ps.map(p => p.Code + statusWord(p)).join()), voice: 'archizio', kind: 'sweat', ts: T(bu, 84), time: 'GW' + D.gw + ' build-up', gw: D.gw, teams: [stake.t], players: ps.map(p => String(p.Code)),
          text: tx, media: { type: 'injcards', codes: ps.map(p => String(p.Code)) },
          facts: 'FPL injury news' + (done ? ' · GW' + done + ' points' : ''),
          detail: ps.map(p => ({ k: esc(p.Player), v: esc(p.News) + (done ? ' · GW' + done + ': ' + pt(ptsOver(p.Code, [done])) + '' : '') })),
          links: [{ label: short(stake.t), open: 'manager:' + stake.t }], share: stake.t + ' are sweating on ' + list(nm) + '.',
        });
      }
    }
    /* EXCLUSIVE: an owned player out with no return date */
    const longOut = (D.ro || []).filter(p => p.Status === 'i' && /unknown return/i.test(String(p.News))).map(p => ({ p, pick: String(p.Drafted).match(/^R(\d+)/) })).sort((a, b) => (a.pick ? +a.pick[1] : 99) - (b.pick ? +b.pick[1] : 99))[0];
    if (longOut) {
      const p = longOut.p, rd = longOut.pick ? +longOut.pick[1] : 0, sp = num(p['Season pts']);
      const P = esc(p.Player), PU = caps(p.Player), news = esc(String(p.News).split(/\s+-\s+/)[0].toLowerCase());
      const pk = rd ? ROUND_WORD[rd] + '-round pick' : 'pick';
      const spS = sp ? 'has ' + sp + ' ' + plural(sp, 'point') + ' this season' : 'is yet to score a point this season';
      const text = pick('excl', D.gw, [
        () => strong('EXCLUSIVE.') + ' ' + P + ': ' + news + ', no return date. ' + esc(possT(p.Team)) + ' ' + pk + ' ' + spS + '.',
        () => strong('NO RETURN DATE FOR ' + PU + '.') + ' ' + cap(news) + ' for ' + esc(possT(p.Team)) + ' ' + pk + ', who ' + spS + '.',
        () => strong('UPDATE ON ' + PU + '.') + ' ' + cap(news) + ', and FPL gives no return date. ' + (rd ? name(p.Team) + ' took him in round ' + words(rd) + '; he ' : 'He ') + spS + '.',
        () => strong('BAD NEWS FOR ' + caps(p.Team) + '.') + ' ' + P + ' (' + news + ') has no return date. ' + (rd ? 'Their ' + pk + ' ' : 'He ') + spS + '.',
      ]);
      out.push({
        id: 'excl:' + p.Code + ':' + hash(p.News), voice: 'archizio', kind: 'excl', ts: T(bu, 80), time: 'GW' + D.gw + ' build-up', gw: D.gw, teams: [p.Team], players: [String(p.Code)],
        text,
        media: { type: 'injcards', codes: [String(p.Code)], wide: true },
        facts: 'FPL injury news · draft ' + esc(p.Drafted) + ' · season points',
        detail: [{ k: 'News', v: esc(p.News) }, { k: 'Drafted', v: esc(p.Drafted) }, { k: 'Season points', v: String(sp) }],
        links: [{ label: p.Player, open: 'player:' + p.Code }], share: p.Player + ': no return date.',
      });
    }
    /* derby build-up: Archizio owns the H2H series this week */
    const derbies = fxOf(D.gw).filter(f => derbyName(f.Home, f.Away));
    if (derbies.length) {
      const ds = derbies.map(f => ({ nm: esc(derbyName(f.Home, f.Away)), s: sr(f.Home, f.Away) || '' })), k = ds.length;
      const paren = d => d.nm + (d.s && d.s !== 'First ever meeting' ? ' (' + esc(d.s) + ')' : ' (a first ever meeting)');
      const sent = d => { const m = d.s.match(/^(\S+) leads (.+)$/); if (m) return 'In ' + d.nm + ', ' + esc(m[1]) + ' leads ' + esc(m[2]) + '.'; const l = d.s.match(/^Series level (.+)$/); if (l) return d.nm + ' is level at ' + esc(l[1]) + '.'; return d.nm + ' is a first ever meeting.'; };
      const text = pick('derbies', D.gw, [
        () => strong('DERBY WEEK.') + ' ' + (k === 1 ? 'One derby in GW' + D.gw + ': ' : Words(k) + ' derbies in GW' + D.gw + ': ') + list(ds.map(paren)) + '.',
        () => strong((k === 1 ? 'ONE DERBY' : WORDS(k) + ' DERBIES') + ' IN GW' + D.gw + '.') + ' ' + ds.map(sent).join(' '),
        () => S(strong('THE RECORD BOOKS.'), ds.map(sent).join(' '), (k === 1 ? 'It’s on in GW' : (k === 2 ? 'Both are on in GW' : 'All ' + words(k) + ' are on in GW')) + D.gw + '.'),
        () => strong('RIVALRY WEEK.') + ' GW' + D.gw + ' brings ' + list(ds.map(paren)) + '.',
      ]);
      out.push({
        id: 'derbies:' + D.gw, voice: 'archizio', kind: 'derbies', ts: T(bu, 87), time: 'GW' + D.gw + ' build-up', gw: D.gw, teams: derbies.flatMap(f => [f.Home, f.Away]), players: [],
        text,
        media: { type: 'derbies', fx: derbies.map(f => ({ h: f.Home, a: f.Away })) },
        facts: 'League derbies · H2H series incl. last season',
        detail: derbies.map(f => ({ k: esc(derbyName(f.Home, f.Away)), v: esc(f.Home) + ' v ' + esc(f.Away) + ' · ' + esc(sr(f.Home, f.Away) || '') })),
        links: [{ label: 'Derbies', href: '#/league/derbies' }], share: 'Derby week: ' + derbies.map(f => derbyName(f.Home, f.Away)).join(', ') + '.',
      });
    }
  }

  if (!done) return;

  /* FREE AGENT WATCH */
  const fa = freeAgents(3);
  if (fa.length) {
    const a = fa[0], two = a.l2 >= a.l3 * .6 && a.n >= 2, P = esc(a.p.Player), PU = caps(a.p.Player), nT = words(nTeams());
    const ptsS = two ? a.l2 + ' points in his last two gameweeks' : a.l3 + ' points in the last ' + words(a.n) + ' gameweeks';
    const on = a.droppedOn ? ' on ' + dayMonth(a.droppedOn) : '', by = a.droppedBy ? name(a.droppedBy) + ' let him go' + on : '';
    const tx = pick('fa', done, [
      () => S(strong('FREE AGENT WATCH.'), P + ': ' + ptsS + '.', by ? 'Unowned since ' + by + '.' : '', cap(nT) + ' managers, no takers.'),
      () => S(strong('NO TAKERS FOR ' + PU + '.'), cap(ptsS) + ', and he is still a free agent.', by ? cap(by) + '.' : ''),
      () => S(strong(PU + ' IS STILL AVAILABLE.'), cap(ptsS) + '.', a.droppedBy ? 'Released by ' + name(a.droppedBy) + on + ', and all ' + nT + ' managers have passed since.' : 'All ' + nT + ' managers have passed.'),
      () => S(strong('ON THE MARKET.'), P + ', free agent: ' + ptsS + '.', by ? cap(by) + '.' : '', 'Nobody has moved for him.'),
    ]);
    out.push({
      id: 'fa:' + done + ':' + fa.map(x => x.p.Code).join(','), voice: 'archizio', kind: 'fa', ts: T(after, 40), time: 'After GW' + done, gw: done, teams: a.droppedBy ? [a.droppedBy] : [], players: fa.map(x => String(x.p.Code)),
      text: tx, media: { type: 'fa', rows: fa.map(x => ({ code: String(x.p.Code), name: x.p['Full name'] && String(x.p['Full name']).length < 22 ? x.p['Full name'] : x.p.Player, club: x.p.Club, pos: x.p.Pos, l3: x.l3, l2: x.l2, season: x.season, n: x.n })), before: D.gw },
      facts: 'Players · owner FREE · GW Stats GW' + finishedGws(3)[0] + '–' + done + (a.droppedBy ? ' · Transactions ' + dayMonth(a.droppedOn) : ''),
      detail: fa.map(x => ({ k: esc(x.p.Player) + ' · ' + esc(x.p.Club) + ' ' + esc(x.p.Pos), v: pt(x.l3) + ' last ' + x.n + ' · ' + x.season + ' season' })),
      links: [{ label: 'Free agents', href: '#/team/transfers' }], share: a.p.Player + ' is a free agent: ' + a.l3 + ' points in the last ' + a.n + ' gameweeks.',
    });
  }

  /* ROUND ONE, n weeks in */
  const r1 = roundOne();
  if (r1.length && done >= 2) {
    const L = r1.map(x => esc(x.p.Player) + ' ' + x.pts).join(', ');
    const tx = pick('r1', done, [
      () => strong('ROUND ONE, ' + WORDS(done) + ' WEEKS IN.') + ' ' + L + '.',
      () => strong('FIRST-ROUND CHECK.') + ' Season points after GW' + done + ': ' + L + '.',
      () => strong('THE FIRST ROUND, RANKED.') + ' ' + Words(done) + ' gameweeks in: ' + L + '.',
      () => strong('BY THE NUMBERS.') + ' Round one after ' + words(done) + ' gameweeks: ' + L + '.',
    ]);
    out.push({
      id: 'r1:' + done, wide: true, voice: 'archizio', kind: 'r1', ts: T(after, 24), time: 'After GW' + done, gw: done, teams: r1.map(x => x.p.Team), players: r1.map(x => String(x.p.Code)),
      text: tx,
      media: { type: 'r1', rows: r1.map(x => ({ code: String(x.p.Code), name: x.p.Player, team: x.p.Team, pick: pickText(x.pick), pts: x.pts })), done },
      facts: 'Rosters · Drafted R1 · season points after GW' + done,
      detail: r1.map(x => ({ k: pickText(x.pick) + ' ' + esc(x.p.Player), v: esc(x.p.Team) + ' · ' + pt(x.pts) + '' })),
      links: [], share: 'Round one, ' + done + ' weeks in: ' + r1.map(x => x.p.Player + ' ' + x.pts).join(', ') + '.',
    });
  }

  /* NEW · HOT STREAK: an owned, available player with 6+ in each of the last three gameweeks */
  const hs = hotStreak();
  if (hs) {
    const p = hs.p, P = esc(p.Player), tm = p.Team, per = hs.per, wS = 'GW' + hs.win[0] + '–' + hs.win[2], perS = per[0] + ', ' + per[1] + ' and ' + per[2];
    const tx = pick('streak', done, [
      () => strong('HOT STREAK.') + ' ' + P + ': ' + perS + ' in the last three gameweeks, ' + hs.tot + ' in all. Owned by ' + name(tm) + '.',
      () => strong(caps(p.Player) + ' IS FLYING.') + ' ' + hs.tot + ' points over ' + wS + ' (' + perS + ') for the ' + esc(UI.club(p.Club)) + ' ' + posWord(p.Pos) + '. ' + name(tm) + ' have him.',
      () => strong('IN FORM.') + ' ' + P + ' has scored at least ' + Math.min(...per) + ' in each of the last three gameweeks: ' + perS + ', ' + hs.tot + ' in all. ' + name(tm) + ' own him.',
      () => strong('ON A RUN.') + ' ' + esc(possT(tm)) + ' ' + P + ' has ' + hs.tot + ' points over ' + wS + ': ' + perS + '.',
    ]);
    out.push({
      id: 'streak:' + done + ':' + p.Code, voice: 'archizio', kind: 'streak', ts: T(after, 26), time: 'After GW' + done, gw: done, teams: [tm], players: [String(p.Code)],
      text: tx, media: { type: 'stat', big: String(hs.tot), label: 'Last three gameweeks', sub: p.Player + ' · ' + per.join(', ') + ' · ' + short(tm), team: tm },
      facts: 'GW Stats · ' + wS + ' · owned, available, 6+ points every week',
      detail: hs.win.map((g, i) => ({ k: 'GW' + g, v: pt(per[i]) + ' · ' + hs.mins[i] + '’' + (hs.log[i] ? (hs.log[i].Started === 'XI' ? ' · started for ' + esc(hs.log[i].Team) : ' · on the ' + esc(hs.log[i].Team) + ' bench') : '') }))
        .concat([{ k: 'Owner', v: esc(tm) }, { k: 'Season points', v: String(num(p['Season pts'])) }]),
      links: [{ label: p.Player, open: 'player:' + p.Code }], share: p.Player + ': ' + per.join(', ') + ' in the last three gameweeks.',
    });
  }

  /* NEW · THE STEAL: the most season points from a pick after round seven */
  const lp = latePick(hs ? hs.p.Code : null);
  if (lp) {
    const p = lp.p, P = esc(p.Player), tm = p.Team, pk = pickText(lp.pick), rw = ROUND_WORD[lp.pick.r];
    const moreS = lp.more ? 'only ' + words(lp.more) + ' owned ' + plural(lp.more, 'player') + (lp.more === 1 ? ' has' : ' have') + ' more' : 'no owned player has more';
    const tx = pick('steal', done, [
      () => strong('STEAL OF THE DRAFT.') + ' ' + name(tm) + ' took ' + P + ' at ' + pk + '. ' + lp.pts + ' points after ' + words(done) + ' gameweeks, the most from any pick after round seven, and ' + moreS + '.',
      () => strong('LATE-ROUND VALUE.') + ' No pick after round seven has more points than ' + P + ': ' + lp.pts + ' for ' + name(tm) + ', who took him at ' + pk + '. ' + cap(moreS) + '.',
      () => strong('FOUND IN ROUND ' + WORDS(lp.pick.r) + '.') + ' ' + esc(possT(tm)) + ' ' + P + ' (' + pk + ') has ' + lp.pts + ' points, the best return from any pick after round seven. ' + cap(moreS) + '.',
      () => strong(caps(p.Player) + ', ' + pk + '.') + ' ' + cap(aAn(rw)) + '-round pick with ' + lp.pts + ' points for ' + name(tm) + ', the most of anyone taken after round seven. ' + cap(moreS) + '.',
    ]);
    out.push({
      id: 'steal:' + done + ':' + p.Code, voice: 'archizio', kind: 'steal', ts: T(after, 21), time: 'After GW' + done, gw: done, teams: [tm], players: [String(p.Code)],
      text: tx, media: { type: 'stat', big: String(lp.pts), label: 'Best pick after round seven', sub: p.Player + ' · ' + pk + ' · ' + short(tm), team: tm },
      facts: 'Rosters · drafted R8 or later · season points after GW' + done,
      detail: [{ k: 'Drafted', v: pk + ' · ' + esc(tm) }, { k: 'Season points', v: String(lp.pts) }, { k: 'Owned players with more', v: String(lp.more) }],
      links: [{ label: p.Player, open: 'player:' + p.Code }], share: p.Player + ', ' + pk + ': ' + lp.pts + ' points, the most from any pick after round seven.',
    });
  }

  /* RECORDS: the season high or low set or matched in a gameweek */
  for (let g = 1; g <= done; g++) {
    const R = recordsTo(g), prev = g > 1 ? recordsTo(g - 1) : { hi: null, lo: null };
    [['hi', 'highest', 'HIGH'], ['lo', 'lowest', 'LOW']].forEach(([k, word, HL]) => {
      const r = R[k]; if (!r || g === 1) return;
      const now = r.who.filter(w => w[1] === g); if (!now.length) return;
      const before = r.who.filter(w => w[1] < g);
      const who = now.map(w => w[0]), wE = esc(list(who)), wU = caps(list(who));
      let tx;
      if (!before.length) {
        const old = prev[k] ? prev[k].p : null;
        tx = pick('rec-' + k + '-new', g, [
          () => S(strong(r.p + ', A NEW SEASON ' + HL + '.'), wE + ' post it in GW' + g + '.', old !== null ? 'The old mark was ' + old + '.' : ''),
          () => S(strong('SEASON ' + HL + ' FOR ' + wU + '.'), r.p + ' in GW' + g + ' is the ' + word + ' score of the season.', old !== null ? 'It replaces ' + old + '.' : ''),
          () => S(strong(wU + ' SET THE MARK.'), r.p + ' in GW' + g + ', the ' + word + ' score of the season so far.', old !== null ? 'The previous ' + word + ' was ' + old + '.' : ''),
        ]);
      } else {
        const f0 = before[0], self = who.includes(f0[0]);
        const by = self ? 'which they first posted in GW' + f0[1] : 'first posted by ' + esc(f0[0]) + ' in GW' + f0[1];
        tx = pick('rec-' + k + '-eq', g, [
          () => strong(r.p + ' AGAIN.') + ' ' + wE + ' match the ' + word + ' score of the season, ' + by + '.',
          () => strong(r.p + ', EQUALLING THE SEASON ' + HL + '.') + ' ' + wE + ' in GW' + g + '; ' + (self ? 'they got there first, in GW' + f0[1] : esc(f0[0]) + ' got there first, in GW' + f0[1]) + '.',
          () => strong(wU + ' HIT ' + r.p + '.') + ' That equals the ' + word + ' score of the season, ' + by + '.',
          () => strong('SEASON ' + HL + ' MATCHED BY ' + wU + '.') + ' ' + r.p + ' in GW' + g + ', level with the mark ' + by + '.',
        ]);
      }
      const at = gwDoneTime(g);
      out.push({
        id: 'rec:' + k + ':' + g, voice: 'archizio', kind: 'record', ts: T(at, 19), time: 'GW' + g + ' · full time', gw: g, teams: who, players: [],
        text: tx, media: { type: 'stat', big: String(r.p), label: (k === 'hi' ? 'Season high' : 'Season low'), sub: r.who.map(w => short(w[0]) + ' GW' + w[1]).join(' · '), team: who[0] },
        facts: 'H2H Fixtures · finished GW1–' + g,
        detail: r.who.map(w => ({ k: esc(w[0]), v: 'GW' + w[1] + ' · ' + r.p })), links: [{ label: 'Results', href: '#/league/results' }], share: tx.replace(/<[^>]+>/g, ''),
      });
    });
  }

  /* MANAGER OF THE MONTH: winners of finished periods, and the race in the current one (phrasing rotates by period) */
  PERIODS.forEach((per, pi) => {
    if (per[1] > D.gw) return;
    const T2 = motmTotals(per); if (!T2.any) return;
    const [lead, pts] = T2.rows[0], tie = T2.rows.filter(r => r[1] === pts).map(r => r[0]), one = tie.length === 1;
    const P = esc(pname(per)), PU = caps(pname(per)), tE = esc(list(tie)), tU = caps(list(tie));
    if (periodDone(per)) {
      const at = gwDoneTime(per[2]), span = 'GW' + per[1] + '–' + per[2], fst = esc(firstOf(lead)), usd = '$30' + (one ? ' to ' + fst : '') + '.';
      const text = pick('motm', pi, [
        () => strong(PU + (one ? ' GOES TO ' : ' GO TO ') + tU + '.') + ' Manager of the Month with ' + pts + ' points over ' + span + '. ' + usd,
        () => strong(tU + ', MANAGER OF THE MONTH.') + ' ' + pts + ' points over ' + span + (one ? ' wins ' : ' share ') + P + '. ' + usd,
        () => one ? strong('$30 TO ' + caps(firstOf(lead)) + '.') + ' ' + tE + ' are Manager of the Month for ' + P + ': ' + pts + ' points over ' + span + '.'
          : strong(PU + ' IS SHARED.') + ' ' + tE + ' tie for Manager of the Month on ' + pts + ' points over ' + span + '. $30.',
        () => strong(PU + ' DONE.') + ' ' + tE + (one ? ' take' : ' share') + ' Manager of the Month with ' + pts + ' points over ' + span + '. ' + usd,
      ]);
      out.push({
        id: 'motm:' + per[0], voice: 'archizio', kind: 'motm', ts: T(at, 15), time: 'GW' + per[2] + ' · full time', gw: per[2], teams: tie, players: [],
        text,
        media: { type: 'stat', big: String(pts), label: 'Manager of the Month · ' + pname(per), sub: 'GW' + per[1] + '–' + per[2] + ' · $30', team: lead, rows: T2.rows.slice(0, 3) },
        facts: 'H2H Fixtures · points for, GW' + per[1] + '–' + per[2],
        detail: T2.rows.map(r => ({ k: esc(r[0]), v: pt(r[1]) + '' })), links: [{ label: 'Money', href: '#/league/money' }], share: lead + ' are Manager of the Month for ' + pname(per) + ' with ' + pts + ' points.',
      });
    } else {
      const live = UI.week().mode === 'live' || D.provOver, upTo = live ? D.gw : D.gwsDone;
      const at = D.provOver ? T(kickoffs(D.gw).slice(-1)[0], 110) : live ? liveTime() : gwDoneTime(D.gwsDone);
      const back = T2.rows[1] && T2.rows[1][1] < pts ? { t: esc(T2.rows[1][0]), d: pts - T2.rows[1][1] } : null;
      const liveS = live ? 'Includes GW' + D.gw + (D.provOver ? ' provisional scores.' : ' live scores.') : '';
      const text = pick('motmrace', upTo, [
        () => S(strong(PU + ' SO FAR.'), tE + ' lead the Manager of the Month race on ' + pts + '.', back ? back.t + ' ' + back.d + ' back.' : '', liveS),
        () => S(strong('THE $30 RACE.'), tE + ' on ' + pts + ' for ' + P + (back ? ', ' + back.t + ' ' + back.d + ' behind.' : '.'), liveS),
        () => S(strong('MANAGER OF THE MONTH WATCH.'), P + ': ' + tE + ' top on ' + pts + '.', back ? 'Next: ' + back.t + ', ' + back.d + ' back.' : '', liveS),
        () => S(strong(tU + ' SET THE PACE.'), pts + ' in ' + P + ' so far, the Manager of the Month lead.', back ? back.t + ' are ' + back.d + ' behind.' : '', liveS),
      ]);
      out.push({
        id: 'motmrace:' + per[0] + ':' + upTo + (live ? ':' + lead : ''), voice: 'archizio', kind: 'motm', ts: T(at, live ? 0 : 14), time: D.provOver ? 'GW' + D.gw + ' · provisional' : live ? liveLabel() : 'After GW' + D.gwsDone, gw: upTo, teams: tie, players: [],
        text,
        media: { type: 'stat', big: String(pts), label: 'Manager of the Month · ' + pname(per), sub: (per[1] === Math.min(per[2], upTo) ? 'GW' + per[1] : 'GW' + per[1] + '–' + Math.min(per[2], upTo)) + ' so far · $30', team: lead, rows: T2.rows.slice(0, 3) },
        facts: 'H2H Fixtures · points for, ' + (per[1] === upTo ? 'GW' + per[1] : 'GW' + per[1] + '–' + upTo) + (D.provOver ? ' (provisional)' : live ? ' (live)' : ''),
        detail: T2.rows.map(r => ({ k: esc(r[0]), v: pt(r[1]) + '' })), links: [{ label: 'Money', href: '#/league/money' }], share: lead + ' lead the ' + pname(per) + ' Manager of the Month race on ' + pts + '.',
      });
    }
  });

  /* TITLE ODDS and the BAHA MARKET (after the simulation has run for this data) */
  let S0 = sim(), saved = false;
  if (S0) {
    const ord = Object.keys(S0.title).sort((a, b) => S0.title[b] - S0.title[a]);
    const prev = saved ? null : oddsBefore();
    let mover = null;
    if (prev) mover = ord.map(t => ({ t, d: S0.title[t] - (prev.title[t] || 0) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    const top = ord[0], x = esc(oddsTxt(S0.title[top]));
    const asOf = D.provOver ? 'GW' + D.gw + ' (provisional)' : 'GW' + D.gwsDone;
    const others = ord.slice(1, 3).map(t => esc(t) + ' ' + esc(oddsTxt(S0.title[t])));
    const mvS = mover && Math.abs(mover.d) >= 2 ? 'Biggest mover since GW' + prev.gw + ': ' + esc(mover.t) + ', ' + (mover.d > 0 ? 'up ' : 'down ') + Math.round(Math.abs(mover.d)) + ' points.' : '';
    const tx = pick('odds', D.gwsDone, [
      () => S(strong('TITLE ODDS AFTER ' + caps(asOf) + '.'), name(top) + ' ' + x + ' from 5,000 simulated seasons' + (others.length ? '; ' + list(others) : '') + '.', mvS),
      () => S(strong(caps(top) + ' ARE FAVOURITES.'), 'The model gives them ' + x + ' to win the league after ' + asOf + ', from 5,000 simulated seasons.', others.length ? 'Next: ' + list(others) + '.' : '', mvS),
      () => S(strong('5,000 SEASONS SIMULATED.'), name(top) + ' win ' + x + ' of them after ' + asOf + '.', others.length ? list(others) + ' follow.' : '', mvS),
      () => S(strong('TITLE RACE UPDATE.'), 'After ' + asOf + ', the model has ' + name(top) + ' as favourites at ' + x + ' from 5,000 simulated seasons.', others.length ? 'Then ' + list(others) + '.' : '', mvS),
    ]);
    out.push({
      id: 'odds:' + D.gwsDone + (D.provOver ? 'p' : ''), wide: true, voice: 'archizio', kind: 'odds', ts: D.provOver ? T(kickoffs(D.gw).slice(-1)[0], 140) : T(after, 34), time: D.provOver ? 'GW' + D.gw + ' · provisional' : 'After GW' + D.gwsDone, gw: D.gwsDone, teams: ord.slice(0, 3), players: [],
      text: tx, media: { type: 'odds', rows: ord.map(t => ({ team: t, v: S0.title[t], d: prev ? S0.title[t] - (prev.title[t] || 0) : null })), prev: prev ? prev.gw : null },
      facts: 'Title odds · 5,000 simulated seasons · results to ' + asOf + (saved ? ' · saved on this phone at full time' : '') + (prev ? ' · GW' + prev.gw + ' odds saved on this phone' : ''),
      detail: ord.map(t => ({ k: esc(t), v: oddsTxt(S0.title[t]) + (prev ? ' (GW' + prev.gw + ': ' + oddsTxt(prev.title[t] || 0) + ')' : '') })), links: [{ label: 'Table', href: '#/league/overview' }],
      share: top + ' are title favourites at ' + oddsTxt(S0.title[top]) + '.',
    });
    const B = 'Kobbie Mainoo Fan';
    if (S0.last[B] !== undefined) {
      const p = posOf(B), v = S0.last[B], vT = esc(oddsTxt(v));
      const bp = prev && prev.last ? prev.last[B] : null;
      /* the gap to the bottom, not the table position: the table belongs to Malcolm */
      const ordT = tableOrder(), lpOf = t => num((D.st.find(s => s.Team === t) || {})['League Pts']), n = ordT.length;
      let gapS = '';
      if (n >= 2 && p === n) { const d7 = lpOf(ordT[n - 2].Team) - lpOf(B); gapS = d7 > 0 ? 'They are bottom, ' + words(d7) + ' ' + plural(d7, 'point') + ' off the side above.' : 'They are bottom, level on points with the side above.'; }
      else if (n >= 2 && p > 0) { const d = lpOf(B) - lpOf(ordT[n - 1].Team); gapS = d > 0 ? 'They are ' + words(d) + ' ' + plural(d, 'point') + ' clear of the bottom.' : 'They are level on points with the bottom side.'; }
      const asOf2 = D.provOver ? 'on provisional scores' : 'after GW' + D.gwsDone;
      const prevS = bp !== null && bp !== undefined ? 'It was ' + esc(oddsTxt(bp)) + ' after GW' + prev.gw + '.' : '';
      const mtx = pick('market', D.gwsDone, [
        () => S(strong('THE BAHA MARKET.'), name(B) + ' to finish last: ' + vT + ' ' + asOf2 + '.', gapS, prevS),
        () => S(strong('BAHA MARKET UPDATE.'), vT + ' that ' + name(B) + ' finish bottom, ' + asOf2 + '.', gapS, prevS),
        () => S(strong('LAST PLACE, PRICED.'), name(B) + ': ' + vT + ' ' + asOf2 + '.', gapS, prevS),
      ]);
      out.push({
        id: 'baha:' + D.gwsDone + (D.provOver ? 'p' : ''), voice: 'archizio', kind: 'market', ts: D.provOver ? T(kickoffs(D.gw).slice(-1)[0], 139) : T(after, 29), time: D.provOver ? 'GW' + D.gw + ' · provisional' : 'After GW' + D.gwsDone, gw: D.gwsDone, teams: [B], players: [],
        text: mtx,
        media: { type: 'market', v, pos: p, team: B, prev: bp, prevGw: prev ? prev.gw : null },
        facts: 'Chance of finishing 8th · 5,000 simulated seasons · resolves GW38', detail: [{ k: 'Chance of last', v: oddsTxt(v) }, { k: 'Table now', v: 'Position ' + p }], links: [{ label: 'Table', href: '#/league/overview' }],
        share: 'The Baha market: Kobbie Mainoo Fan to finish last, ' + oddsTxt(v) + '.',
      });
    }
  }

  /* DEADLINE XIs: once team sheets are in, the biggest benchings (Archizio owns "team sheets are in") */
  if (D.dlPassed && typeof lineupsLocked === 'function' && lineupsLocked()) {
    const benched = Object.keys(TEAMS).flatMap(t => benchOf(t).filter(p => p.Status === 'a').map(p => ({ p, t, sp: num(p['Season pts']) }))).sort((a, b) => b.sp - a.sp).slice(0, 3);
    if (benched.length) {
      const at = gwDeadline(D.gw), b0 = benched[0], Tm = name(b0.t), P = esc(b0.p.Player), also = benched.slice(1);
      const alsoL = list(also.map(x => esc(x.p.Player) + ' (' + esc(short(x.t)) + ')'));
      const tx = pick('sheets', D.gw, [
        () => S(strong('TEAM SHEETS ARE IN.'), 'Biggest call of GW' + D.gw + ': ' + Tm + ' bench ' + P + ', ' + b0.sp + ' points this season.', also.length ? 'Also on a bench: ' + alsoL + '.' : ''),
        () => S(strong('TEAM NEWS, GW' + D.gw + '.'), 'The biggest name on a bench: ' + P + ' (' + b0.sp + ' points this season), left out by ' + Tm + '.', also.length ? 'Also benched: ' + alsoL + '.' : ''),
        () => S(strong(caps(b0.p.Player) + ' ON THE BENCH.'), Tm + ' leave out their ' + b0.sp + '-point man for GW' + D.gw + ', the biggest call of the week.', also.length ? alsoL + (also.length > 1 ? ' are' : ' is') + ' benched too.' : ''),
        () => S(strong('LINEUPS LOCKED, GW' + D.gw + '.'), 'The big omission: ' + P + ', ' + b0.sp + ' points this season, on ' + esc(possT(b0.t)) + ' bench.', also.length ? 'Also benched: ' + alsoL + '.' : ''),
      ]);
      out.push({
        id: 'sheets:' + D.gw, voice: 'archizio', kind: 'sheets', ts: T(at, 1), time: 'GW' + D.gw + ' deadline', gw: D.gw, teams: benched.map(x => x.t), players: benched.map(x => String(x.p.Code)),
        text: tx,
        media: { type: 'injcards', codes: benched.map(x => String(x.p.Code)), chip: 'BENCH' },
        facts: 'Rosters · GW XI at the deadline · season points', detail: benched.map(x => ({ k: esc(x.p.Player), v: esc(x.t) + ' · bench · ' + pt(x.sp) + '' })), links: [], share: 'Team sheets are in for GW' + D.gw + '.',
      });
    }
  }
}

/* ============================== CLARK ============================== */
function clark(out, you) {
  const done = D.gwsDone;
  /* bench disasters in a defeat, every finished gameweek */
  for (let g = 1; g <= done; g++) {
    benchStory(g).forEach((b, i) => {
      if (i > 0) return;
      const at = gwDoneTime(g), sl = (D.gwsByGw[g] || {})[b.top.code] || {};
      const ga = gaText(sl.G || 0, sl.A || 0), Tm = name(b.team), P = esc(b.top.name), pts = b.top.pts;
      const M = strong(b.margin <= 20 ? WORDS(b.margin) : String(b.margin));
      const vs = b.r.nm ? esc(b.r.nm) : 'to ' + esc(b.opp);
      const text = pick('bench', g, [
        () => S(Tm + ' left ' + esc(poss(b.top.name)) + ' ' + pts + ' points on the bench and lost ' + vs + ' by ' + M + '.', ga ? cap(ga) + ', sat on the bench.' : ''),
        () => S(P + ' got ' + pts + ' points on ' + esc(possT(b.team)) + ' bench. ' + Tm + ' lost ' + vs + ' by ' + M + '.', ga ? 'That included ' + ga + '.' : ''),
        () => S('Lost ' + vs + ' by ' + M + ', with ' + esc(poss(b.top.name)) + ' ' + pts + ' points sat on the bench. Take a bow, ' + Tm + '.', ga ? cap(ga) + ' from him, too.' : ''),
        () => S(Tm + ' benched ' + P + ' and his ' + pts + ' points, then lost ' + vs + ' by ' + M + '.', ga ? cap(ga) + ', wasted.' : ''),
        () => S('Somebody tell ' + esc(firstOf(b.team)) + '. ' + P + ' scored ' + pts + ' on the bench and ' + Tm + ' lost ' + vs + ' by ' + M + '.', ga ? 'He had ' + ga + '.' : ''),
      ]);
      out.push({
        id: 'bench:' + g + ':' + b.team, voice: 'clark', kind: 'thumb', ts: T(at, 38), time: relTime(at), gw: g, teams: [b.team, b.opp], players: [b.top.code],
        text,
        media: { type: 'thumb', code: b.top.code, t1: b.top.pts + ' ' + plural(b.top.pts, 'POINT'), t2: 'ON THE BENCH', lo: 'LOST BY ' + (b.margin <= 20 ? WORDS(b.margin) : b.margin), chip: 'GW' + g, style: 'split' },
        facts: 'GW' + g + ' · ' + b.top.name + ' ' + b.top.pts + ' on the bench · ' + b.team + ' ' + b.score + '–' + b.oppScore,
        detail: b.bench.map(x => ({ k: esc(x.name) + ' (bench)', v: pt(x.pts) + ' · ' + x.mins + '’' })).concat([{ k: 'Bench total', v: String(b.tot) }, { k: 'Result', v: esc(b.team) + ' ' + b.score + '–' + b.oppScore + ' ' + esc(b.opp) }]),
        links: [{ label: 'Results', href: '#/league/results' }], share: b.team + ' left ' + b.top.name + '’s ' + b.top.pts + ' points on the bench and lost by ' + b.margin + '.',
      });
    });
  }
  /* NEW · CLOSEST CALL: the tightest projected matchup of the coming gameweek (before the deadline) */
  if (!D.dlPassed) clarkCoin(out);
  if (!done) { clarkPoll(out, you); return; }
  const after = gwDoneTime(done);

  /* hot take: the week's biggest margin (the score itself is Malcolm's) */
  const big = results(done).filter(r => r.done && r.margin > 0).sort((a, b) => b.margin - a.margin)[0];
  if (big && big.margin >= 10) {
    const M = WORDS(big.margin), Wn = name(big.win), Ln = name(big.lose);
    const tx = pick('margin', done, [
      () => strong(M + '.') + ' That’s the margin ' + Wn + ' beat ' + Ln + ' by in GW' + done + ', the biggest win of the week.',
      () => Wn + ' hammered ' + Ln + ' by ' + strong(M) + ' in GW' + done + '. Nobody won by more.',
      () => 'Biggest hiding of GW' + done + ': ' + Ln + ', beaten by ' + Wn + ' by ' + strong(M) + '.',
      () => strong(M + ' POINTS.') + ' ' + Ln + ' lost to ' + Wn + ' by that much in GW' + done + '. Nobody lost by more.',
    ]);
    out.push({
      id: 'margin:' + done, voice: 'clark', kind: 'take', ts: T(after, 23), time: 'After GW' + done, gw: done, teams: [big.win, big.lose], players: [],
      text: tx,
      media: { type: 'stamp', big: (big.win === big.home ? big.hs + '–' + big.as : big.as + '–' + big.hs), sub: 'Biggest win of GW' + done, a: big.win, b: big.lose }, facts: 'H2H Fixtures · GW' + done, detail: results(done).map(r => ({ k: esc(r.home) + ' v ' + esc(r.away), v: r.hs + '–' + r.as })), links: [{ label: 'Results', href: '#/league/results' }],
      share: big.win + ' beat ' + big.lose + ' by ' + big.margin + ' in GW' + done + '.',
    });
  }

  /* losing runs and winless starts (Clark owns them; nobody else says "still looking for a first win") */
  const runs = Object.keys(TEAMS).map(t => ({ t, r: record(t) })).filter(x => (x.r.kind === 'L' && x.r.run >= 3) || (x.r.w === 0 && x.r.played >= 3)).sort((a, b) => b.r.run - a.r.run);
  if (runs.length) {
    const x = runs[0], r = x.r, nf = fxFor(x.t, D.gw), opp = nf ? oppOf(nf, x.t) : null, dn = nf ? derbyName(nf.Home, nf.Away) : null;
    const all = r.l === r.played, winless = r.w === 0, Tm = name(x.t), nextOn = nf && !D.dlPassed, nx = nextOn ? (dn ? esc(dn) : esc(opp)) : '';
    const descA = all ? 'played ' + words(r.played) + ', lost ' + words(r.l) : winless ? 'no wins in ' + words(r.played) : words(r.run) + ' defeats in a row';
    const verb = all ? 'have played ' + words(r.played) + ' and lost ' + words(r.l) : winless ? 'have no wins in ' + words(r.played) : 'have lost ' + words(r.run) + ' in a row';
    const head = all ? WORDS(r.played) + ' GAMES, ' + WORDS(r.l) + ' DEFEATS' : winless ? 'NO WINS IN ' + WORDS(r.played) : WORDS(r.run) + ' DEFEATS IN A ROW';
    const tx = pick('run', done, [
      () => S(Tm + ': ' + descA + '.', nextOn ? (dn ? nx + ' is next.' : 'Next up: ' + nx + '.') + ' Who’s stopping the rot?' : ''),
      () => S(cap(descA) + '. That’s ' + Tm + ' for you.', nextOn ? 'Next: ' + nx + '.' : ''),
      () => S('Somebody check on ' + esc(firstOf(x.t)) + '. ' + Tm + ' ' + verb + '.', nextOn ? 'Up next, ' + nx + '.' : ''),
      () => S(strong(head + '.'), nextOn ? Tm + ' face ' + nx + ' next.' : 'Step forward, ' + Tm + '.', 'Somebody stop this.'),
    ]);
    out.push({
      id: 'run:' + done + ':' + x.t, voice: 'clark', kind: 'thumb', ts: nextOn ? T(buildUpTime(D.gw), 81) : T(after, 27), time: nextOn ? 'GW' + D.gw + ' build-up' : 'After GW' + done, gw: done, teams: [x.t].concat(opp ? [opp] : []), players: [],
      text: tx,
      media: { type: 'thumb', team: x.t, team2: nextOn && opp ? opp : '', t1: all ? r.w + ' FROM ' + r.played : r.w === 0 ? 'NO WINS' : r.run + ' IN A ROW', t2: nextOn ? (dn ? dn.replace(/^The /, '').toUpperCase() + ' NEXT' : 'NEXT: ' + short(opp).toUpperCase()) : all ? WORDS(r.l) + ' DEFEATS' : r.w === 0 ? 'IN ' + WORDS(r.played) : 'DEFEATS', lo: short(x.t).toUpperCase(), chip: 'GW1–' + done, style: 'stripes' },
      facts: 'H2H Fixtures · ' + short(x.t) + ' ' + r.w + '–' + r.d + '–' + r.l + ' W–D–L', detail: [{ k: 'Record', v: r.w + '–' + r.d + '–' + r.l + ' W–D–L' }, { k: 'Results', v: r.res.join(' ') }],
      links: [{ label: short(x.t), open: 'manager:' + x.t }], share: tx.replace(/<[^>]+>/g, ''),
    });
  }

  /* luck: performance (actual excl. bonus v xP) — a separate post from results luck (all-play) */
  const L = perfLuck();
  if (L.length >= 2 && L[0].d >= 8) {
    const a = L[0], b = L[1], lp = luckiestPlayer(a.team), D0 = Math.round(a.d), Tm = name(a.team), B2 = esc(b.team), nb = (b.d >= 0 ? '+' : '−') + Math.abs(Math.round(b.d));
    const lpOk = lp && lp.d >= 5, lpN = lpOk ? esc(lp.name) : '', lpD = lpOk ? Math.round(lp.d) : 0;
    const tx = pick('luck', done, [
      () => S(strong(WORDS(D0) + '.') + ' That’s how many points ' + Tm + ' are running above expected. Next best: ' + B2 + ', ' + nb + '.', lpOk ? lpN + ' alone is +' + lpD + '.' : ''),
      () => S(Tm + ' are ' + strong('+' + D0) + ' on expected points after GW' + done + '. Next best: ' + B2 + ' on ' + nb + '.', lpOk ? lpN + ' accounts for +' + lpD + ' on his own.' : ''),
      () => S('Luckiest side in the league? ' + Tm + ', running ' + D0 + ' points above expected. ' + B2 + ' are next on ' + nb + '.', lpOk ? lpN + ': +' + lpD + ' by himself.' : ''),
      () => S(strong('+' + D0 + '.') + ' ' + esc(possT(a.team)) + ' points above expected, GW1–' + done + '. Then ' + B2 + ', ' + nb + '.', lpOk ? 'Biggest contributor: ' + lpN + ', +' + lpD + '.' : ''),
    ]);
    out.push({
      id: 'luck:' + done, voice: 'clark', kind: 'thumb', ts: T(after, 33), time: 'After GW' + done, gw: done, teams: [a.team], players: lp ? [String(lp.code)] : [],
      text: tx,
      media: { type: 'thumb', code: lp ? String(lp.code) : '', team: a.team, t1: '+' + Math.round(a.d), t2: 'ABOVE EXPECTED', lo: 'RUNNING HOT', chip: 'GW1–' + done, style: 'yellow' },
      facts: 'Started points excl. bonus v xP · GW1–' + done,
      detail: L.map(x => ({ k: esc(x.team), v: (x.d >= 0 ? '+' : '−') + f1(Math.abs(x.d)) + ' (' + x.act + ' v ' + f1(x.x) + ' xP)' })), links: [{ label: 'Stats', href: '#/league/stats' }],
      share: a.team + ' are ' + Math.round(a.d) + ' points above expected.',
    });
  }
  const RL = resultsLuck();
  if (RL.length && RL[0].d <= -3) {
    const a = RL[0], Tm = name(a.team), ap = f1(a.ap), n7 = words(nTeams() - 1);
    const tx = pick('robbed', done, [
      () => strong(WORDS(a.pts) + '.') + ' That’s ' + esc(possT(a.team)) + ' league points. Against all ' + n7 + ', every week, they’d have ' + ap + '. Robbed.',
      () => Tm + ' have ' + strong(String(a.pts)) + ' league ' + plural(a.pts, 'point') + '. Play all ' + n7 + ' every week and it’s ' + ap + '. Robbed.',
      () => 'All-play says ' + ap + '. The table says ' + a.pts + '. ' + Tm + ' have been robbed.',
      () => strong(a.pts + ' v ' + ap + '.') + ' ' + esc(possT(a.team)) + ' league points against their all-play total. Daylight robbery.',
    ]);
    out.push({
      id: 'robbed:' + done, voice: 'clark', kind: 'take', ts: T(after, 18), time: 'After GW' + done, gw: done, teams: [a.team], players: [],
      text: tx,
      media: { type: 'robbed', team: a.team, pts: a.pts, ap: a.ap }, facts: 'All-play: every score v all seven rivals · GW1–' + done,
      detail: RL.map(x => ({ k: esc(x.team), v: pt(x.pts) + ' v ' + f1(x.ap) + ' all-play' })), links: [{ label: 'Stats', href: '#/league/stats' }],
      share: a.team + ' have ' + a.pts + ' league points; all-play says ' + f1(a.ap) + '.',
    });
  }

  /* the worst pick of the draft so far */
  const worst = worstPick();
  if (worst) {
    const rd = worst.pick.r, rw = ROUND_WORD[rd], P = esc(worst.p.Player), Tm = name(worst.p.Team), PT = strong(worst.pts + ' ' + plural(worst.pts, 'point'));
    const tx = pick('worst', done, [
      () => P + ' went in round ' + words(rd) + ' for ' + Tm + '. ' + Words(done) + ' gameweeks: ' + PT + '.',
      () => strong(worst.pts + ' ' + plural(worst.pts, 'POINT') + '.') + ' That’s ' + P + ', a round-' + words(rd) + ' pick by ' + Tm + ', after ' + words(done) + ' gameweeks.',
      () => 'Worst pick of the draft so far? ' + P + '. Round ' + words(rd) + ', ' + Tm + ', ' + PT + ' in ' + words(done) + ' gameweeks.',
      () => Tm + ' spent ' + aAn(rw) + '-round pick on ' + P + '. Return after ' + words(done) + ' gameweeks: ' + PT + '.',
    ]);
    out.push({
      id: 'worst:' + done + ':' + worst.p.Code, voice: 'clark', kind: 'thumb', ts: T(after, 28), time: 'After GW' + done, gw: done, teams: [worst.p.Team], players: [String(worst.p.Code)],
      text: tx,
      media: { type: 'thumb', code: String(worst.p.Code), t1: worst.pts + ' ' + plural(worst.pts, 'POINT'), t2: rw.toUpperCase() + '-ROUND PICK', lo: 'WORST PICK SO FAR', chip: pickText(worst.pick), style: 'split' },
      facts: 'Rosters · drafted ' + pickText(worst.pick) + ' · season points after GW' + done, detail: [{ k: 'Drafted', v: pickText(worst.pick) }, { k: 'Season points', v: String(worst.pts) }],
      links: [{ label: worst.p.Player, open: 'player:' + worst.p.Code }], share: worst.p.Player + ': round ' + worst.pick.r + ' pick, ' + worst.pts + ' points.',
    });
  }

  /* NEW · NOBODY STARTED HIM: the week's top scorer outside every XI (not the free agents Archizio leads with, not the bench story above) */
  const skip = new Set(freeAgents(3).map(x => String(x.p.Code)).concat(benchStory(done).slice(0, 1).map(b => String(b.top.code))));
  const hsP = hotStreak(); if (hsP) skip.add(String(hsP.p.Code));
  const nob = unstarted(done, skip);
  if (nob) {
    const r = nob.r, P = esc(r.Player), PT = r.Pts, free = !nob.owner, club = esc(UI.club(r.Club)), nT = words(nTeams());
    const tx = free ? pick('nobody-free', done, [
      () => strong(WORDS(PT) + '.') + ' That’s what ' + P + ' (' + club + ') scored in GW' + done + '. Not one of ' + nT + ' managers had him.',
      () => P + ' (' + club + ') put up ' + strong(String(PT)) + ' in GW' + done + ' and nobody in this league owned him.',
      () => cap(nT) + ' managers, and not one had ' + P + '. He scored ' + strong(String(PT)) + ' for ' + club + ' in GW' + done + '.',
      () => strong(PT + ' POINTS') + ' going spare in GW' + done + '. ' + P + ' (' + club + ') was unowned.',
    ]) : pick('nobody-bench', done, [
      () => strong(WORDS(PT) + '.') + ' ' + P + ' scored that in GW' + done + ', on ' + esc(possT(nob.owner)) + ' bench. Nobody started him.',
      () => name(nob.owner) + ' had ' + P + ' on the bench in GW' + done + '. He scored ' + strong(String(PT)) + '. Nobody started him.',
      () => 'Nobody started ' + P + ' in GW' + done + '. ' + name(nob.owner) + ' owned him and benched him: ' + strong(PT + ' points') + '.',
    ]);
    const now = (D.plr || []).find(p => String(p.Code) === String(r.Code)), nowOwner = now && now.Owner && now.Owner !== 'FREE' ? now.Owner : 'Free agent';
    out.push({
      id: 'nobody:' + done + ':' + r.Code, voice: 'clark', kind: 'thumb', ts: T(after, 31), time: 'After GW' + done, gw: done, teams: free ? [] : [nob.owner], players: [String(r.Code)],
      text: tx,
      media: { type: 'thumb', code: String(r.Code), t1: PT + ' ' + plural(PT, 'POINT'), t2: free ? 'IN NOBODY’S XI' : 'ON THE BENCH', lo: free ? 'UNOWNED' : short(nob.owner).toUpperCase() + ' BENCHED HIM', chip: 'GW' + done, style: 'split' },
      facts: 'GW Stats GW' + done + ' · GW Log XIs · ' + (free ? 'unowned that week' : 'on the ' + nob.owner + ' bench'),
      detail: [{ k: 'GW' + done, v: pt(PT) + ' · ' + r.Mins + '’' + (nob.line ? ' · ' + esc(nob.line) : '') }, { k: 'Club', v: club }, { k: 'Started by', v: 'Nobody' }, { k: free ? 'Owner that week' : 'Benched by', v: free ? 'Unowned' : esc(nob.owner) }, { k: 'Owner now', v: esc(nowOwner) }],
      links: [{ label: r.Player, open: 'player:' + r.Code }], share: r.Player + ' scored ' + PT + ' in GW' + done + ' and nobody started him.',
    });
  }

  clarkPoll(out, you);

  /* live: a starter still waiting while his club's match is well under way */
  if (D.liveNow) {
    const c = Object.keys(TEAMS).flatMap(t => xiOf(t).map(p => ({ p, t }))).map(x => { const cf = (D.cf || []).find(f => num(f.GW) === D.gw && (f.Home === x.p.Club || f.Away === x.p.Club) && fin(f.Started) && !fin(f.Finished)); return cf ? { ...x, cf, m: num(cf.Mins) } : null; })
      .filter(x => x && x.m >= 45 && num(x.p['GW mins']) === 0).sort((a, b) => (b.t === you) - (a.t === you) || (epOf(b.p.Code) || 0) - (epOf(a.p.Code) || 0))[0];
    if (c) {
      const ko = dt(c.cf['Kickoff (UTC)']), P = esc(c.p.Player), club = esc(UI.club(c.cf.Home)), dS = c.p.Status === 'd' ? chanceOf(c.p) : null;
      const tx = pick('waiting', D.gw, [
        () => S(c.m + ' minutes gone at ' + club + ' and ' + esc(possT(c.t)) + ' ' + P + ' hasn’t moved.', dS !== null ? 'He went in at ' + dS + '%.' : ''),
        () => S('Still nothing from ' + P + '. It’s ' + c.m + ' minutes gone at ' + club + ', and he’s in ' + esc(possT(c.t)) + ' XI.', dS !== null ? 'He was ' + dS + '% to play.' : ''),
        () => S(strong(c.m + ' MINUTES.') + ' ' + P + ' hasn’t kicked a ball at ' + club + ', and ' + name(c.t) + ' started him.', dS !== null ? 'FPL had him at ' + dS + '%.' : ''),
      ]);
      out.push({
        id: 'waiting:' + D.gw + ':' + c.p.Code, voice: 'clark', kind: 'thumb', ts: T(ko, c.m + 1), time: 'Live · ' + c.m + '’', gw: D.gw, teams: [c.t], players: [String(c.p.Code)],
        text: tx,
        media: { type: 'thumb', code: String(c.p.Code), t1: String(c.p.Player).toUpperCase(), t2: 'STILL ON THE BENCH', lo: c.m + ' MINUTES GONE', chip: c.m + '’', style: 'stripes', live: true },
        facts: 'Club Fixtures · ' + c.cf.Home + ' v ' + c.cf.Away + ' ' + c.m + '’ · Rosters GW mins 0', detail: [{ k: 'Match', v: esc(c.cf.Home) + ' ' + esc(c.cf['Home goals']) + '–' + esc(c.cf['Away goals']) + ' ' + esc(c.cf.Away) + ' · ' + c.m + '’' }, { k: c.p.Player, v: 'In ' + esc(c.t) + '’s XI · 0 minutes' }],
        links: [{ label: 'Matchup', href: '#/matchday/matchup' }], share: c.p.Player + ' still on the bench, ' + c.m + ' minutes gone.',
      });
    }
  }
}
/* NEW · the closest projected matchup of the coming gameweek, as a terrace take (the board's favourite is Malcolm's) */
function clarkCoin(out) {
  const fx = fxOf(D.gw); if (fx.length < 2) return;
  const R = fx.map((f, i) => ({ f, i, w: wp(f) })).sort((a, b) => Math.abs(a.w.h - a.w.a) - Math.abs(b.w.h - b.w.a) || a.i - b.i);
  const c = R[0], H = c.f.Home, A = c.f.Away, h = c.w.h, a = c.w.a, vs = name(H) + ' v ' + name(A), pr = h + '–' + a, bu = buildUpTime(D.gw);
  const tx = pick('coin', D.gw, [
    () => strong('CLOSEST CALL OF GW' + D.gw + '.') + ' ' + vs + ': ' + pr + '% on the model. Pick a side.',
    () => strong(pr + '%.') + ' That’s ' + vs + ', the tightest matchup of gameweek ' + D.gw + ' on the model.',
    () => 'Want a proper game this week? ' + vs + '. The model has it ' + h + '% to ' + a + '%, the closest on the card.',
    () => 'Too close to call? ' + vs + ' is ' + pr + '% on the model, the tightest of GW' + D.gw + '.',
  ]);
  out.push({
    id: 'coin:' + D.gw + ':' + H + '|' + A, voice: 'clark', kind: 'take', ts: T(bu, 83), time: 'GW' + D.gw + ' build-up', gw: D.gw, teams: [H, A], players: [],
    text: tx, media: { type: 'stamp', big: pr + '%', sub: 'Closest call of GW' + D.gw, a: H, b: A },
    facts: 'Win chance · the model · GW' + D.gw + ' projected XIs',
    detail: R.map(x => ({ k: esc(x.f.Home) + ' v ' + esc(x.f.Away), v: x.w.h + '–' + x.w.d + '–' + x.w.a + '% · ' + f1(tp(x.f.Home)) + '–' + f1(tp(x.f.Away)) })),
    links: [{ label: 'All matchups', href: '#/matchday/all' }], share: H + ' v ' + A + ' is the closest call of GW' + D.gw + ': ' + pr + '% on the model.',
  });
}
function clarkPoll(out, you) {
  const fx = fxOf(D.gw); if (!fx.length) return;
  const mine = you ? fx.find(f => f.Home === you || f.Away === you) : null;
  const f = (mine && derbyName(mine.Home, mine.Away)) ? mine : fx.find(x => derbyName(x.Home, x.Away)) || null;
  if (!f) return;
  const nm = derbyName(f.Home, f.Away), w = wp(f), s = sr(f.Home, f.Away);
  const pick0 = (lsGet('emt-feed-poll', {}) || {})[D.gw + '|' + f.Home + '|' + f.Away];
  const fav = w.h >= w.a ? f.Home : f.Away;
  const bu = buildUpTime(D.gw);
  const sc = D.dlPassed ? ms(f) : null, R = sc && (sc.liveNow || sc.done || D.provOver) ? { hs: sc.hs, as: sc.as2, done: sc.done || D.provOver, live: sc.liveNow && !D.provOver } : null;
  /* the poll's angle: each manager's best and worst score this season (the series is Archizio's, the win chance Malcolm's) */
  const hR = seasonRange(f.Home), aR = seasonRange(f.Away), hN = esc(firstOf(f.Home)), aN = esc(firstOf(f.Away));
  const tag = strong(esc(nm.replace(/^The /, '').toUpperCase()) + '.');
  const text = hR && aR ? pick('poll', D.gw, [
    () => tag + ' ' + hN + ' has scored between ' + hR.lo + ' and ' + hR.hi + ' this season, ' + aN + ' between ' + aR.lo + ' and ' + aR.hi + '. Who’s having it?',
    () => tag + ' Season highs: ' + hN + ' ' + hR.hi + ', ' + aN + ' ' + aR.hi + '. Season lows: ' + hN + ' ' + hR.lo + ', ' + aN + ' ' + aR.lo + '. Your call.',
    () => tag + ' ' + aN + '’s best week is ' + aR.hi + ' and worst ' + aR.lo + '. ' + hN + ' tops out at ' + hR.hi + ' and bottoms out at ' + hR.lo + '. Pick a side.',
    () => tag + ' Best and worst so far: ' + hN + ' ' + hR.hi + ' and ' + hR.lo + ', ' + aN + ' ' + aR.hi + ' and ' + aR.lo + '. Go on, who?',
  ]) : pick('poll0', D.gw, [tag + ' Who’s having it?', tag + ' Your call.', tag + ' Pick a side.']);
  out.push({
    id: 'poll:' + D.gw + ':' + f.Home + '|' + f.Away, voice: 'clark', kind: 'poll', ts: T(bu, 88), time: 'GW' + D.gw + ' build-up', gw: D.gw, teams: [f.Home, f.Away], players: [],
    text,
    media: { type: 'poll', h: f.Home, a: f.Away, w, pick: pick0, open: !D.dlPassed, fav, live: R && (R.live || R.done) ? R : null },
    facts: R && R.done ? 'Result ' + R.hs + '–' + R.as + (D.provOver ? ' (provisional)' : '') : 'Win chance ' + w.h + '–' + w.d + '–' + w.a + ' · the model' + (R ? ' now' : ''), detail: [{ k: esc(f.Home), v: w.h + '%' }, { k: 'Draw', v: w.d + '%' }, { k: esc(f.Away), v: w.a + '%' }],
    links: [{ label: 'Matchup', href: '#/matchday/matchup' }], share: nm + ': who’s having it?' + (hR && aR ? ' Season highs: ' + firstOf(f.Home) + ' ' + hR.hi + ', ' + firstOf(f.Away) + ' ' + aR.hi + '.' : ''),
  });
}

/* ============================== MALCOLM ============================== */
function malcolm(out, you) {
  const done = D.gwsDone, fx = fxOf(D.gw);
  const anyKO = (D.cf || []).some(x => num(x.GW) === D.gw && fin(x.Started));
  const locked = D.dlPassed && !anyKO && !D.provOver;          /* deadline gone, no ball kicked */
  const bu = buildUpTime(D.gw), when = locked ? 'GW' + D.gw + ' deadline' : 'GW' + D.gw + ' build-up';
  const firstKO = kickoffs(D.gw)[0];

  /* previews of every matchup before the deadline */
  if ((!D.dlPassed || locked) && fx.length) {
    const rows = fx.map(f => ({ h: f.Home, a: f.Away, w: wp(f), ph: tp(f.Home), pa: tp(f.Away), nm: derbyName(f.Home, f.Away) }));
    const fav = rows.slice().sort((a, b) => Math.max(b.w.h, b.w.a) - Math.max(a.w.h, a.w.a))[0];
    const fv = fav.w.h >= fav.w.a ? fav.h : fav.a, fp = Math.max(fav.w.h, fav.w.a);
    const topP = rows.flatMap(r => [[r.h, r.ph], [r.a, r.pa]]).sort((a, b) => b[1] - a[1])[0], same = topP[0] === fv, tpS = f1(topP[1]);
    const topA = same ? 'They carry the top projected score too, ' + tpS + '.' : 'Top projected score: ' + name(topP[0]) + ', ' + tpS + '.';
    const ko = firstKO ? 'First kick-off ' + esc(UI.dayHm(firstKO)) + '.' : '';
    const text = locked ? pick('boardL', D.gw, [
      () => S('Gameweek ' + D.gw + ' is locked.', ko, 'Biggest favourite: ' + name(fv) + ' at ' + fp + '%.', topA),
      () => S('No more changes for gameweek ' + D.gw + '.', ko, name(fv) + ' go in as the biggest favourites, ' + fp + '%.', topA),
      () => S('The deadline has passed for gameweek ' + D.gw + '.', name(fv) + ' are the strongest favourites at ' + fp + '%.', topA, ko),
    ]) : pick('board', D.gw, [
      () => S('Gameweek ' + D.gw + ', as the model sees it. Biggest favourite: ' + name(fv) + ' at ' + fp + '%.', topA),
      () => 'The model’s card for gameweek ' + D.gw + '. ' + name(fv) + ' are the strongest favourites at ' + fp + '%' + (same ? ' and project highest, on ' + tpS + '.' : '; ' + name(topP[0]) + ' project highest, on ' + tpS + '.'),
      () => S('Here’s how gameweek ' + D.gw + ' shapes up. ' + name(fv) + ', ' + fp + '%, are the surest thing on the board.', topA),
      () => S('Gameweek ' + D.gw + ' on paper.', same ? name(fv) + ' have the top projected score, ' + tpS + ', and the best win chance, ' + fp + '%.' : 'Top projected score: ' + name(topP[0]) + ', ' + tpS + '. Biggest favourite: ' + name(fv) + ', ' + fp + '%.'),
    ]);
    out.push({
      id: 'board:' + D.gw, wide: true, voice: 'malcolm', kind: 'board', ts: locked ? T(gwDeadline(D.gw), 3) : T(bu, 85), time: when, gw: D.gw, teams: rows.flatMap(r => [r.h, r.a]), players: [],
      text,
      media: { type: 'board', rows, gw: D.gw }, facts: 'Projected XIs · projected scores · win chance',
      detail: rows.map(r => ({ k: esc(r.h) + ' v ' + esc(r.a), v: f1(r.ph) + '–' + f1(r.pa) + ' · ' + r.w.h + '–' + r.w.d + '–' + r.w.a + '%' })), links: [{ label: 'All matchups', href: '#/matchday/all' }],
      share: 'GW' + D.gw + ' predictions: ' + rows.map(r => short(r.h) + ' ' + f1(r.ph) + '–' + f1(r.pa) + ' ' + short(r.a)).join(', ') + '.',
    });
    /* previews: Malcolm's angle is recent scoring (points over the last three gameweeks) and the last meeting this season */
    const win3 = finishedFxGws(3), k3 = win3.length, rng = k3 ? (k3 === 1 ? 'GW' + win3[0] : 'GW' + win3[0] + '–' + win3[k3 - 1]) : '';
    const wS = k3 === 1 ? 'in gameweek ' + win3[0] : 'over gameweeks ' + win3[0] + '–' + win3[k3 - 1];
    rows.forEach(r => {
      const mineHere = you && (r.h === you || r.a === you);
      if (!r.nm && !mineHere) return;
      const fi = fx.findIndex(x => x.Home === r.h && x.Away === r.a);
      const lab = r.nm ? esc(r.nm) : name(r.h) + ' v ' + name(r.a);
      const ph3 = k3 ? teamPtsIn(r.h, win3) : 0, pa3 = k3 ? teamPtsIn(r.a, win3) : 0;
      const lm = lastMeeting(r.h, r.a, D.gw), lmH = lm ? num(lm['Home pts']) : 0, lmA = lm ? num(lm['Away pts']) : 0;
      const lmS = lm ? 'They last met in GW' + num(lm.GW) + ': ' + name(lm.Home) + ' ' + lmH + '–' + lmA + ' ' + name(lm.Away) + '.' : '';
      const fA = k3 ? name(r.h) + ' have scored ' + ph3 + ' ' + wS + ', ' + name(r.a) + ' ' + pa3 + '.' : '';
      const fB = k3 ? cap(wS) + ' it’s ' + ph3 + ' for ' + name(r.h) + ' and ' + pa3 + ' for ' + name(r.a) + '.' : '';
      const fC = k3 ? 'Points ' + wS + ': ' + name(r.h) + ' ' + ph3 + ', ' + name(r.a) + ' ' + pa3 + '.' : '';
      const tx = pick('prev', D.gw, [
        () => S('Gameweek ' + D.gw + '. ' + lab + '.', fA, lmS),
        () => S(lab + ', gameweek ' + D.gw + '.', fB, lmS),
        () => S('Next up in the booth: ' + lab + '.', fC, lmS),
        () => S('To gameweek ' + D.gw + ' and ' + lab + '.', lmS, fA),
      ], fi);
      const dm = mineHere ? dangerMan(you) : null;
      const script = [
        'Gameweek ' + D.gw + '. ' + (r.nm || (r.h + ' against ' + r.a)) + '.',
        r.h + ', projected ' + f1(r.ph) + '. ' + r.a + ', ' + f1(r.pa) + '.',
        k3 ? (k3 === 1 ? 'Last gameweek, ' : 'Over the last ' + words(k3) + ' gameweeks, ') + r.h + ' scored ' + ph3 + ' and ' + r.a + ' ' + pa3 + '.' : '',
        lm ? 'They last met in gameweek ' + num(lm.GW) + ': ' + lm.Home + ' ' + lmH + ', ' + lm.Away + ' ' + lmA + '.' : '',
        'Win chance: ' + short(r.h) + ' ' + r.w.h + ', ' + short(r.a) + ' ' + r.w.a + '.',
        dm ? 'The danger man: ' + dm.p.Player + ', projected ' + f1(dm.ep) + ', the most in ' + possT(dm.opp) + ' eleven.' : '',
      ].filter(Boolean);
      out.push({
        id: 'prev:' + D.gw + ':' + r.h + '|' + r.a, voice: 'malcolm', kind: mineHere ? 'voicenote' : 'preview', ts: locked ? T(gwDeadline(D.gw), mineHere ? 2 : 1) : T(bu, mineHere ? 90 : 78), time: when, gw: D.gw, teams: [r.h, r.a], players: dm ? [String(dm.p.Code)] : [],
        text: tx, media: { type: mineHere ? 'voicenote' : 'scorebug', h: r.h, a: r.a, w: r.w, ph: r.ph, pa: r.pa, nm: r.nm, gw: D.gw, script, state: 'pred' },
        facts: 'Projected XIs · win chance' + (k3 ? ' · H2H Fixtures ' + rng : '') + (dm ? ' · ' + dm.p.Player + ' ' + f1(dm.ep) : ''),
        detail: [{ k: 'Predicted', v: f1(r.ph) + '–' + f1(r.pa) }, { k: 'Win chance', v: r.w.h + '% · draw ' + r.w.d + '% · ' + r.w.a + '%' }]
          .concat(k3 ? [{ k: 'Points, ' + rng, v: esc(short(r.h)) + ' ' + ph3 + ' · ' + esc(short(r.a)) + ' ' + pa3 }] : [])
          .concat(lm ? [{ k: 'Last meeting', v: 'GW' + num(lm.GW) + ' · ' + esc(lm.Home) + ' ' + lmH + '–' + lmA + ' ' + esc(lm.Away) }] : [])
          .concat(mineHere ? [{ k: 'Narration', v: script.map(esc).join('<br>') }] : []),
        links: [{ label: 'Matchup', href: mineHere ? '#/matchday/matchup' : '#/matchday/all' }], share: (r.nm ? r.nm + ': ' : '') + r.h + ' ' + f1(r.ph) + '–' + f1(r.pa) + ' ' + r.a + ' predicted.',
      });
    });
    /* NEW · THE FORM GUIDE: league points over the last three gameweeks (only the top is named; losing runs are Clark's) */
    const FG = formGuide();
    if (FG) {
      const R = FG.rows, top = R[0].lp, lead = R.filter(x => x.lp === top), nx = R.find(x => x.lp < top), nxAll = nx ? R.filter(x => x.lp === nx.lp) : [];
      const max = 3 * FG.gws.length, gS = FG.gws[0] + '–' + FG.gws[FG.gws.length - 1], one = lead.length === 1, Ld = esc(list(lead.map(x => x.team)));
      const Nx = nxAll.length ? (nxAll.length <= 2 ? esc(list(nxAll.map(x => x.team))) : Words(nxAll.length) + ' sides') : '';
      const ptsW = words(top) + ' ' + plural(top, 'point');
      const tx = pick('form', D.gw, [
        () => S('The form guide, gameweeks ' + gS + '.', Ld + ' ' + (one ? 'have ' + ptsW : 'have ' + words(top) + ' each') + ' from a possible ' + words(max) + '.', nx ? Nx + ' are next on ' + words(nx.lp) + '.' : ''),
        () => 'Form over the last three gameweeks: ' + Ld + ' top on ' + ptsW + (one ? '' : ' each') + ' from a possible ' + words(max) + (nx ? ', ' + Nx + ' next with ' + words(nx.lp) : '') + '.',
        () => S('Going into gameweek ' + D.gw + ', the in-form ' + (one ? 'side is ' : 'sides are ') + Ld + ': ' + ptsW + (one ? '' : ' each') + ' from a possible ' + words(max) + ' over gameweeks ' + gS + '.', nx ? 'Then ' + Nx + ', on ' + words(nx.lp) + '.' : ''),
        () => S('Three gameweeks, ' + words(max) + ' points available.', Ld + ' have taken ' + words(top) + (one ? '' : ' each') + ' over gameweeks ' + gS + '.', nx ? 'Next best: ' + Nx + ', ' + words(nx.lp) + '.' : ''),
      ]);
      out.push({
        id: 'form:' + D.gw, voice: 'malcolm', kind: 'form', ts: locked ? T(gwDeadline(D.gw), 0) : T(bu, 76), time: when, gw: D.gw, teams: lead.concat(nxAll.length <= 2 ? nxAll : []).map(x => x.team), players: [],
        text: tx, media: null,
        facts: 'H2H Fixtures · GW' + gS + ' · 3 for a win, 1 for a draw',
        detail: R.map((x, i) => ({ k: (i + 1) + '. ' + esc(x.team), v: x.lp + ' pts · ' + x.res.join(' ') + ' · ' + x.pf + ' scored' })),
        links: [{ label: 'Table', href: '#/league/overview' }], share: 'Form guide, GW' + gS + ': ' + list(lead.map(x => x.team)) + ' on ' + top + ' points.',
      });
    }
  }

  /* live: the board, and swings when a win chance crosses 50% */
  if (D.liveNow && anyKO && fx.length) {
    const rows = fx.map(f => { const s = ms(f), w = wp(f); return { h: f.Home, a: f.Away, hs: s.hs, as: s.as2, w, ph: tp(f.Home), pa: tp(f.Away), nm: derbyName(f.Home, f.Away), f }; });
    const at = liveTime();
    const leads = rows.filter(r => r.hs !== r.as).map(r => esc(short(r.hs > r.as ? r.h : r.a)) + ' lead ' + Math.max(r.hs, r.as) + '–' + Math.min(r.hs, r.as)).slice(0, 2);
    const lS = leads.length ? leads.join('; ') + '.' : 'All square across the board.';
    out.push({
      id: 'live:' + D.gw, wide: true, voice: 'malcolm', kind: 'board', ts: T(at, 3), time: liveLabel(), gw: D.gw, teams: rows.flatMap(r => [r.h, r.a]), players: [],
      text: pick('live', D.gw, [
        () => 'Gameweek ' + D.gw + ', live. ' + lS,
        () => 'Live from gameweek ' + D.gw + '. ' + lS,
        () => 'Here’s where we are in gameweek ' + D.gw + '. ' + lS,
        () => 'Gameweek ' + D.gw + ' is under way. ' + lS,
      ]),
      media: { type: 'board', rows, gw: D.gw, live: true }, facts: 'Live scores · projected finals · win chance',
      detail: rows.map(r => ({ k: esc(r.h) + ' v ' + esc(r.a), v: r.hs + '–' + r.as + ' · proj final ' + f1(r.ph) + '–' + f1(r.pa) + ' · ' + r.w.h + '–' + r.w.a + '%' })), links: [{ label: 'All matchups', href: '#/matchday/all' }],
      share: 'GW' + D.gw + ' live: ' + rows.map(r => short(r.h) + ' ' + r.hs + '–' + r.as + ' ' + short(r.a)).join(', ') + '.',
    });
    const swung = rows.map(r => { const pk = preKick(r.f), was = pk.h > pk.a ? 'h' : pk.a > pk.h ? 'a' : '', now = r.w.h > r.w.a ? 'h' : r.w.a > r.w.h ? 'a' : ''; return { r, pk, was, now }; }).filter(x => x.was && x.now && x.was !== x.now);
    const solo = x => (you && (x.r.h === you || x.r.a === you)) || x.r.nm || swung.length <= 2;
    const quiet = swung.filter(x => !solo(x));
    if (quiet.length) { const P = out[out.length - 1]; P.text += ' On projection, ' + list(quiet.map(x => esc(firstOf(x.now === 'h' ? x.r.h : x.r.a)))) + (quiet.length > 1 ? ' have' : ' has') + ' moved ahead.'; }
    swung.filter(solo).forEach(({ r, pk, was, now }) => {
      const t = now === 'h' ? r.h : r.a, o = now === 'h' ? r.a : r.h, fi = fx.indexOf(r.f);
      const left = mpxLeft(t).n, who = esc(firstOf(t)), leftS = left ? words(left) + ' still to play' : '', inN = r.nm ? ' in ' + esc(r.nm) : '';
      const onBoard = withNm => r.hs === r.as ? 'It’s level at ' + r.hs + ' on the board.' : esc(r.hs > r.as ? r.h : r.a) + ' lead ' + (withNm && r.nm ? esc(r.nm) + ' ' : '') + Math.max(r.hs, r.as) + '–' + Math.min(r.hs, r.as) + ' on the board.';
      out.push({
        id: 'swing:' + D.gw + ':' + r.h + '|' + r.a + ':' + now, voice: 'malcolm', kind: 'swing', ts: T(at, 2), time: liveLabel(), gw: D.gw, teams: [r.h, r.a], players: [],
        text: pick('swing', D.gw, [
          () => who + ' moves ahead on projection' + (left ? ' with ' + leftS : '') + '. ' + onBoard(true),
          () => 'A swing' + inN + ': ' + who + ' is now the projected winner' + (left ? ', ' + leftS : '') + '. ' + onBoard(false),
          () => 'The model has changed its mind' + (r.nm ? ' on ' + esc(r.nm) : '') + '. ' + who + ' is ahead on projection' + (left ? ', ' + leftS : '') + '. ' + onBoard(false),
          () => 'Turnaround on the projections' + inN + '. ' + who + ' has it now' + (left ? ', with ' + leftS : '') + '. ' + onBoard(false),
        ], fi),
        media: { type: 'scorebug', h: r.h, a: r.a, hs: r.hs, as: r.as, w: r.w, was: pk, ph: r.ph, pa: r.pa, nm: r.nm, gw: D.gw, state: 'live' },
        facts: 'Win chance before kick-off v now · ' + short(t) + ' ' + (now === 'h' ? pk.h + '% → ' + r.w.h : pk.a + '% → ' + r.w.a) + '%',
        detail: [{ k: 'Before kick-off', v: pk.h + '–' + pk.d + '–' + pk.a + '% (' + f1(pk.muH) + '–' + f1(pk.muA) + ')' }, { k: 'Now', v: r.w.h + '–' + r.w.d + '–' + r.w.a + '% (proj final ' + f1(r.ph) + '–' + f1(r.pa) + ')' }, { k: 'Score', v: r.hs + '–' + r.as }, { k: esc(t) + ' still to play', v: String(left) }],
        links: [{ label: 'Matchup', href: (you && (r.h === you || r.a === you)) ? '#/matchday/matchup' : '#/matchday/all' }], share: firstOf(t) + ' moves ahead on projection against ' + o + '.',
      });
    });
  }

  /* full time: the latest finished gameweek (or the provisional current one) card by card, older weeks as one results board */
  const ftGws = [];
  for (let g = 1; g <= done; g++) ftGws.push(g);
  if (D.provOver) ftGws.push(D.gw);
  const latest = ftGws[ftGws.length - 1];
  ftGws.forEach(g => {
    const R = results(g).filter(r => r.done); if (!R.length) return;
    const prov = g === D.gw && D.provOver;
    const at = prov ? T(kickoffs(g).slice(-1)[0], 110) : gwDoneTime(g);
    const tl = prov ? 'GW' + g + ' · provisional' : relTime(at);
    if (g === latest) {
      const FTP = [36, 31, 26, 21, 13, 12, 11, 10], gfx = fxOf(g);
      R.slice().sort((a, b) => ((b.home === you || b.away === you) - (a.home === you || a.away === you)) || ((b.nm ? 1 : 0) - (a.nm ? 1 : 0)) || b.margin - a.margin).forEach((r, i) => {
        /* slot: the fixture's place in the gameweek (never the viewer's sort), so every phone gets the same words */
        const st = r.star, w = r.win, hauls = r.hauls.slice(0, 2), fi = Math.max(0, gfx.indexOf(r.f));
        const inN = r.nm ? ' in ' + esc(r.nm) : '', H = name(r.home), A = name(r.away), Wn = w ? name(w) : '', Ln = w ? name(r.lose) : '';
        const ws = Math.max(r.hs, r.as), ls = Math.min(r.hs, r.as), sc = ws + '–' + ls;
        let tx;
        if (prov) tx = pick('ft-prov', g, [
          () => 'Provisional full time' + inN + '. ' + (w ? Wn + ' ' + ws + ', ' + Ln + ' ' + ls + '.' : H + ' and ' + A + ' level at ' + r.hs + '.'),
          () => 'On provisional scores' + inN + ', ' + (w ? Wn + ' beat ' + Ln + ' ' + sc + '.' : H + ' and ' + A + ' draw ' + r.hs + '–' + r.as + '.'),
          () => 'Subject to the final bonus, ' + (w ? Wn + ' take it' + inN + ', ' + sc + '.' : H + ' and ' + A + ' share it' + inN + ', ' + r.hs + ' apiece.'),
        ], fi);
        else if (!w) tx = pick('ft-draw', g, [
          () => 'Honours even' + inN + '. ' + H + ' and ' + A + ' share it at ' + r.hs + ' apiece.',
          () => H + ' ' + r.hs + ', ' + A + ' ' + r.as + '. Nothing to separate them' + inN + '.',
          () => 'Level at the whistle' + inN + ': ' + H + ' and ' + A + ', ' + r.hs + '–' + r.as + '.',
          () => 'A draw' + inN + '. ' + H + ' and ' + A + ' finish on ' + r.hs + ' each.',
        ], fi);
        else if (r.margin <= 3) tx = pick('ft-narrow', g, [
          () => Wn + ' edge it' + inN + ', ' + sc + '.',
          () => 'Tight one' + inN + ', and ' + Wn + ' hold on: ' + sc + ' against ' + Ln + '.',
          () => Wn + ' squeeze past ' + Ln + inN + ', ' + sc + '.',
          () => Ln + ' fall just short' + inN + '. ' + Wn + ' win ' + sc + '.',
        ], fi);
        else if (r.margin >= 10) tx = pick('ft-big', g, [
          () => Wn + ' put ' + ws + ' on ' + Ln + inN + '. ' + Ln + ' managed ' + ls + '.',
          () => 'A rout' + inN + '. ' + Wn + ' ' + ws + ', ' + Ln + ' ' + ls + '.',
          () => Wn + ' run away with it' + inN + ', ' + sc + '.',
          () => 'Emphatic from ' + Wn + ': ' + sc + ' against ' + Ln + inN + '.',
        ], fi);
        else tx = pick('ft-win', g, [
          () => 'Full time' + inN + '. ' + Wn + ' beat ' + Ln + ' ' + sc + '.',
          () => 'Job done for ' + Wn + inN + ': ' + sc + ' over ' + Ln + '.',
          () => Wn + ' take the points' + inN + ', ' + sc + '.',
          () => Ln + ' come up short' + inN + '. ' + Wn + ' win ' + sc + '.',
        ], fi);
        if (hauls.length >= 2 && hauls[0].pts === hauls[1].pts) tx += ' ' + pick('haul2', g, [
          () => esc(hauls[0].name) + ' and ' + esc(hauls[1].name) + ', ' + hauls[0].pts + ' each.',
          () => esc(hauls[0].name) + ' and ' + esc(hauls[1].name) + ' both hit ' + hauls[0].pts + '.',
          () => 'Double figures for ' + esc(hauls[0].name) + ' and ' + esc(hauls[1].name) + ': ' + hauls[0].pts + ' apiece.',
        ], fi);
        else if (hauls.length) tx += ' ' + pick('haul1', g, [
          () => esc(hauls[0].name) + ' with ' + hauls[0].pts + '.',
          () => esc(hauls[0].name) + ' the standout, on ' + hauls[0].pts + '.',
          () => hauls[0].pts + ' for ' + esc(hauls[0].name) + '.',
        ], fi);
        out.push({
          id: 'ft:' + g + ':' + r.home + '|' + r.away + (prov ? ':p' : ''), voice: 'malcolm', kind: 'ft', ts: T(at, FTP[i] || 10), time: tl, gw: g, teams: [r.home, r.away], players: st ? [st.code] : [],
          text: tx, media: { type: 'scorebug', h: r.home, a: r.away, hs: r.hs, as: r.as, nm: r.nm, gw: g, state: prov ? 'prov' : 'ft', star: st },
          facts: (prov ? 'Live scores, provisional bonus' : 'H2H Fixtures · GW Log') + ' · GW' + g + (st ? ' · star man ' + st.name + ' ' + st.pts : ''),
          detail: [{ k: 'Score', v: esc(r.home) + ' ' + r.hs + '–' + r.as + ' ' + esc(r.away) }].concat(st ? [{ k: 'Star man', v: esc(st.name) + ' · ' + esc(st.team) + ' · ' + pt(st.pts) + '' + (st.line ? ' · ' + st.line : '') }] : []).concat(r.hauls.map(h => ({ k: 'Double figures', v: esc(h.name) + ' ' + h.pts + ' (' + esc(short(h.team)) + ')' }))),
          links: [{ label: 'Results', href: '#/league/results' }], share: 'Full time, GW' + g + ': ' + r.home + ' ' + r.hs + '–' + r.as + ' ' + r.away + '.',
        });
      });
      /* the table at full time, with movement */
      if (!prov && g >= 2) {
        const now = posAfter(g), before = posAfter(g - 1), ord = Object.keys(now).sort((a, b) => now[a] - now[b]);
        const top = ord[0], st = D.st.find(s => s.Team === top), ups = ord.map(t => ({ t, d: before[t] - now[t] })).sort((a, b) => b.d - a.d), up = ups[0], upAll = ups.filter(x => up && x.d === up.d).map(x => x.t);
        const T0 = name(top), lp = st ? num(st['League Pts']) : null;
        const cl = up && up.d > 0 ? { multi: upAll.length > 1, who: esc(list(upAll)), d: words(up.d), pl: up.d === 1 ? 'place' : 'places' } : null;
        const tx = pick('table', g, [
          () => S('The table after GW' + g + ': ' + T0 + ' top' + (lp !== null ? ' on ' + lp : '') + '.', cl ? (cl.multi ? 'Biggest climbs: ' + cl.who + ', up ' + cl.d + ' each.' : 'Biggest climb: ' + cl.who + ', up ' + cl.d + '.') : ''),
          () => S(T0 + ' sit top after gameweek ' + g + (lp !== null ? ', on ' + lp + ' points' : '') + '.', cl ? cl.who + ' are the big movers, up ' + cl.d + ' ' + cl.pl + (cl.multi ? ' each.' : '.') : ''),
          () => S('Top of the pile after gameweek ' + g + ': ' + T0 + (lp !== null ? ', ' + lp + ' points' : '') + '.', cl ? 'Up ' + cl.d + ' ' + cl.pl + ': ' + cl.who + '.' : ''),
          () => S('As it stands after gameweek ' + g + ', ' + T0 + ' lead the way' + (lp !== null ? ' on ' + lp : '') + '.', cl ? 'Biggest ' + (cl.multi ? 'climbs' : 'climb') + ': ' + cl.who + ', up ' + cl.d + (cl.multi ? ' each.' : '.') : ''),
        ]);
        out.push({
          id: 'table:' + g, wide: true, voice: 'malcolm', kind: 'table', ts: T(at, 16), time: tl, gw: g, teams: ord, players: [],
          text: tx,
          media: { type: 'table', ord, now, before, gw: g }, facts: 'Table after GW' + (g - 1) + ' v after GW' + g,
          detail: ord.map(t => ({ k: now[t] + '. ' + esc(t), v: before[t] === now[t] ? 'no change' : (before[t] > now[t] ? 'up ' : 'down ') + Math.abs(before[t] - now[t]) })), links: [{ label: 'Table', href: '#/league/overview' }],
          share: 'The table after GW' + g + ': ' + top + ' top.',
        });
      }
      /* NEW · THE GAMEWEEK AGAINST THE PROJECTIONS: who beat FPL's frozen projections by most, and who fell furthest short */
      const M = !prov ? modelCheck(g) : null;
      if (M && M.length >= 2 && M[0].d > 0 && M[M.length - 1].d < 0) {
        const o = M[0], u = M[M.length - 1], oD = f1(o.d), uD = f1(-u.d);
        const tx = pick('model', g, [
          () => 'How the model did in gameweek ' + g + '. ' + name(o.team) + ' beat their projection by ' + oD + ', the most of anyone. ' + name(u.team) + ' fell ' + uD + ' short.',
          () => 'Gameweek ' + g + ', model against reality. Nobody beat their projection by more than ' + name(o.team) + ', ' + oD + ' points. ' + name(u.team) + ' missed theirs by ' + uD + ', the most of anyone.',
          () => 'Back to the projections for gameweek ' + g + '. Biggest overachievers: ' + name(o.team) + ', ' + oD + ' above. Furthest short: ' + name(u.team) + ', ' + uD + ' under.',
          () => 'Gameweek ' + g + ' against the forecast. Best: ' + name(o.team) + ', ' + oD + ' points over their projection. Worst: ' + name(u.team) + ', ' + uD + ' under.',
        ]);
        out.push({
          id: 'model:' + g, voice: 'malcolm', kind: 'model', ts: T(at, 20), time: 'After GW' + g, gw: g, teams: [o.team, u.team], players: [],
          text: tx, media: null,
          facts: 'FPL projections frozen at the GW' + g + ' deadline, summed over each selected XI · H2H Fixtures GW' + g,
          detail: M.map(x => ({ k: esc(x.team), v: 'projected ' + f1(x.proj) + ' · scored ' + x.act + ' · ' + (x.d >= 0 ? '+' : '−') + f1(Math.abs(x.d)) })),
          links: [{ label: 'Results', href: '#/league/results' }], share: 'GW' + g + ' v the model: ' + o.team + ' +' + oD + ', ' + u.team + ' −' + uD + '.',
        });
      }
    } else {
      const stars = R.map(r => r.star).filter(Boolean).sort((a, b) => b.pts - a.pts), s0 = stars[0];
      const sn = s0 ? esc(s0.name) : '', stm = s0 ? esc(s0.team) : '';
      const tx = pick('results', g, [
        () => S('Full time across gameweek ' + g + '.', s0 ? 'Star of the week: ' + sn + ', ' + s0.pts + ' for ' + stm + '.' : ''),
        () => S('Gameweek ' + g + ', all ' + words(R.length) + ' results.', s0 ? sn + ' was the star of the week with ' + s0.pts + ' for ' + stm + '.' : ''),
        () => S('That’s gameweek ' + g + ' done.', s0 ? 'The star: ' + sn + ', ' + s0.pts + ' points for ' + stm + '.' : ''),
        () => S('Results round-up, gameweek ' + g + '.', s0 ? 'Top individual score: ' + sn + ', ' + s0.pts + ' for ' + stm + '.' : ''),
        () => S('The gameweek ' + g + ' scores are in.', s0 ? 'Star of the week: ' + sn + ' with ' + s0.pts + ' for ' + stm + '.' : ''),
      ]);
      out.push({
        id: 'results:' + g, wide: true, voice: 'malcolm', kind: 'results', ts: T(at, 12), time: relTime(at), gw: g, teams: R.flatMap(r => [r.home, r.away]), players: s0 ? [s0.code] : [],
        text: tx,
        media: { type: 'results', rows: R, gw: g, star: s0 || null }, facts: 'H2H Fixtures · GW Log · GW' + g,
        detail: R.map(r => ({ k: esc(r.home) + ' v ' + esc(r.away), v: r.hs + '–' + r.as + (r.star ? ' · star ' + esc(r.star.name) + ' ' + r.star.pts : '') })), links: [{ label: 'Results', href: '#/league/results' }],
        share: 'GW' + g + ' results: ' + R.map(r => short(r.home) + ' ' + r.hs + '–' + r.as + ' ' + short(r.away)).join(', ') + '.',
      });
    }
  });

  /* articles: recaps and previews, and the Gameweek Show */
  (typeof RECAPS !== 'undefined' ? RECAPS : []).forEach(a => {
    const at = gwDoneTime(a.gw);
    out.push({ id: 'recap:' + a.gw, voice: 'malcolm', kind: 'article', ts: T(at, 40), time: 'GW' + a.gw + ' recap', gw: a.gw, teams: [], players: [], text: 'The GW' + a.gw + ' recap is up.', media: { type: 'article', kind: 'Recap', gw: a.gw, href: a.href, title: a.title, sub: a.sub }, facts: '', detail: [], links: [{ label: 'Read the recap', href: a.href, ext: true }], share: 'GW' + a.gw + ' recap: ' + a.title });
  });
  (typeof PREVIEWS !== 'undefined' ? PREVIEWS : []).forEach(a => {
    const at = buildUpTime(a.gw);
    out.push({ id: 'preview:' + a.gw, voice: 'malcolm', kind: 'article', ts: T(at, 60), time: 'GW' + a.gw + ' preview', gw: a.gw, teams: [], players: [], text: 'The GW' + a.gw + ' preview is up.', media: { type: 'article', kind: 'Preview', gw: a.gw, href: a.href, title: a.title, sub: a.sub }, facts: '', detail: [], links: [{ label: 'Read the preview', href: a.href, ext: true }], share: 'GW' + a.gw + ' preview: ' + a.title });
  });
  shows().forEach(s => {
    const at = s.at || buildUpTime(s.gw);
    out.push({
      id: 'show:' + s.gw, wide: true, voice: 'malcolm', kind: 'show', ts: T(at, 12 * 60), time: s.at ? dayMonth(s.at) : 'GW' + s.gw, gw: s.gw, teams: s.j.chapters.flatMap(c => [c.home, c.away]), players: [],
      text: 'The Gameweek ' + s.gw + ' show. ' + Words(s.j.chapters.length) + ' matchups, ' + mmss(s.dur) + ' in the booth.',
      media: { type: 'show', gw: s.gw }, facts: 'The Gameweek Show · ' + s.clips.length + ' narrated clips · ' + mmss(s.dur),
      detail: s.j.chapters.map(c => ({ k: esc(c.home) + ' v ' + esc(c.away), v: c.beats.length + ' beats' })), links: [], share: 'The Gameweek ' + s.gw + ' show, with Malcolm Tyre in the booth.',
    });
  });
}

/* ============================== JIVE (only you) ============================== */
export function jivePosts(team) {
  const out = []; if (!team || !TEAMS[team]) return out;
  const bu = buildUpTime(D.gw), pre = !D.dlPassed;
  const F = flagged(team), call = selectionCall(team), dm = dangerMan(team);
  const dismissed = (lsGet('emt-feed-kept', {}) || {});
  if (pre && call && !dismissed[callKey(call)]) out.push(callPost(call, bu));
  if (pre && (F.xi.length || F.bench.length)) {
    const d = F.xi.filter(p => p.Status === 'd'), same = d.length && d.every(p => chanceOf(p) === chanceOf(d[0]));
    let tx = F.xi.length ? 'Gaffer, ' + (F.xi.length === 1 ? esc(F.xi[0].Player) + ' carries a flag' : words(F.xi.length) + ' of your starters carry a flag') + ' into GW' + D.gw + '.' : 'Gaffer, your XI is clear. The flags are on the bench.';
    if (same && d.length === F.xi.length && d.length > 1) tx = 'Gaffer, ' + words(d.length) + ' of your starters are ' + chanceOf(d[0]) + '% for GW' + D.gw + '.';
    out.push({
      id: 'fit:' + D.gw + ':' + hash(F.xi.concat(F.bench).map(p => p.Code + statusWord(p)).join()), voice: 'jive', kind: 'fitness', ts: T(bu, 92), time: 'GW' + D.gw + ' build-up', gw: D.gw, teams: [team], players: F.xi.concat(F.bench).map(p => String(p.Code)), audience: 'you',
      text: tx, media: { type: 'fitness', xi: F.xi.map(p => String(p.Code)), bench: F.bench.map(p => String(p.Code)) },
      facts: 'FPL injury news · your projected XI', detail: F.xi.concat(F.bench).map(p => ({ k: esc(p.Player) + (F.xi.includes(p) ? ' (XI)' : ' (bench)'), v: esc(p.News) })),
      links: [{ label: 'Lineup', href: '#/team/lineup' }], share: '',
    });
  }
  if (pre && dm) {
    out.push({
      id: 'scout:' + D.gw + ':' + dm.opp + ':' + dm.p.Code, voice: 'jive', kind: 'scout', ts: T(bu, 91), time: 'GW' + D.gw + ' build-up', gw: D.gw, teams: [team, dm.opp], players: [String(dm.p.Code)], audience: 'you',
      text: 'Scouting ' + esc(theShort(dm.opp)) + ': ' + esc(dm.p.Player) + ' projects ' + f1(dm.ep) + ', the most in their XI.',
      media: { type: 'scout', code: String(dm.p.Code), ep: dm.ep, opp: dm.opp, xi: ex(dm.opp).map(p => ({ code: String(p.Code), ep: epOf(p.Code) || 0 })).sort((a, b) => b.ep - a.ep).slice(0, 3) },
      facts: 'Projections · ' + dm.opp + ' projected XI', detail: ex(dm.opp).map(p => ({ k: esc(p.Player), v: f1(epOf(p.Code) || 0) })).sort((a, b) => parseFloat(b.v) - parseFloat(a.v)).slice(0, 5),
      links: [{ label: dm.p.Player, open: 'player:' + dm.p.Code }], share: '',
    });
  }
  /* live: what the auto-subs have done so far */
  if (D.liveNow) {
    const subs = autoSubs(team).subs.filter(s => s.kind === 'locked');
    if (subs.length) {
      const at = liveTime();
      const got = s => num(s.inn['GW pts']) + ((D.pbonus || {})[String(s.inn.Code)] || 0), tot = subs.reduce((a, s) => a + got(s), 0);
      const so = subs.length === 1 ? (tot ? ' ' + esc(subs[0].inn.Player) + ' has ' + pt(tot).replace('pt', 'point') + ' so far.' : ' Nothing from him yet.') : (tot ? ' ' + pt(tot).replace('pt', 'point') + ' between them so far.' : ' Nothing from them yet.');
      out.push({
        id: 'subs:' + D.gw + ':' + subs.map(s => s.out.Code + '>' + s.inn.Code).join(','), voice: 'jive', kind: 'subs', ts: T(at, 4), time: liveLabel(), gw: D.gw, teams: [team], players: subs.flatMap(s => [String(s.out.Code), String(s.inn.Code)]), audience: 'you',
        text: 'Gaffer, the bench is doing its job: ' + list(subs.map(s => esc(s.inn.Player) + ' on for ' + esc(s.out.Player))) + '.' + so,
        media: { type: 'subs', subs: subs.map(s => ({ out: String(s.out.Code), inn: String(s.inn.Code), pts: num(s.inn['GW pts']) + ((D.pbonus || {})[String(s.inn.Code)] || 0) })) },
        facts: 'Auto-subs · confirmed only', detail: subs.map(s => ({ k: esc(s.out.Player) + ' → ' + esc(s.inn.Player), v: pt(num(s.inn['GW pts'])) + ' so far' })),
        links: [{ label: 'Matchup', href: '#/matchday/matchup' }], share: '',
      });
    }
  }
  return out;
}
export const callKey = c => c.gw + ':' + c.out.p.Code + '>' + c.alt.p.Code;
export function callPost(c, bu) {
  const o = c.out, a = c.alt, nm = o.p.Player;
  const offBench = o.starts === 0 && o.mins > 0;
  const tx = 'Gaffer, a selection call before the deadline. ' + esc(nm) + ' has ' + o.mins + ' ' + plural(o.mins, 'minute') + ' in ' + words(o.n) + ' ' + plural(o.n, 'game') + (offBench ? ', all off the bench' : '') + '.';
  return {
    id: 'call:' + callKey(c), voice: 'jive', kind: 'call', ts: T(bu || buildUpTime(D.gw), 95), time: 'GW' + D.gw + ' build-up', gw: c.gw, teams: [c.team], players: [String(o.p.Code), String(a.p.Code)], audience: 'you', pin: true,
    text: tx, media: { type: 'call', out: pack(o), alt: pack(a), kind: a.kind, pos: o.p.Pos, gw: c.gw, key: callKey(c) },
    facts: 'Start chance and projection · minutes GW' + c.win[0] + '–' + c.win[c.win.length - 1],
    detail: [{ k: esc(nm), v: o.mins + ' min · ' + o.starts + ' starts · ' + Math.round(o.ps * 100) + '% start · ' + f1(o.pts) + ' proj' }, { k: esc(a.p.Player) + (a.kind === 'free' ? ' (free agent)' : ' (your bench)'), v: a.mins + ' min · ' + a.starts + ' starts · ' + Math.round(a.ps * 100) + '% start · ' + f1(a.pts) + ' proj' }],
    links: a.kind === 'free' ? [{ label: 'Transfers', href: '#/team/transfers' }] : [{ label: 'Lineup', href: '#/team/lineup' }], share: '',
  };
}
const pack = x => ({ code: String(x.p.Code), name: x.p.Player, club: x.p.Club, mins: x.mins, starts: x.starts, n: x.n, ps: x.ps, pts: x.pts });

/* ============================== all posts ============================== */
export function build(you) {
  const out = [];
  const add = f => { try { f(out, you); } catch (e) { console.error(e); } };
  add(archizio); add(clark); add(malcolm);
  try { out.push(...jivePosts(you)); } catch (e) { console.error(e); }
  /* the league's own words: quotes, bold calls, receipts (Social tab) */
  try { out.push(...socialPosts(you)); } catch (e) { console.error(e); }
  try { out.push(...editorialPosts()); } catch (e) { console.error(e); }
  try { out.push(...aiPosts()); } catch (e) { console.error(e); }
  out.forEach(p => { p.audience = p.audience || 'league'; p.teams = [...new Set(p.teams || [])]; p.players = p.players || []; });
  /* a viral receipt rides the top for two days; everything else newest first */
  out.sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || b.ts - a.ts || (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
  return out;
}
