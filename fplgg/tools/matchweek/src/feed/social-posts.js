/* feed/social-posts.js — what the voices do with the league's own words: every quote goes on Everyone's feed,
   bold calls get flagged, and when the data settles a claim the receipts come out (and, now and then, go viral). */
import { esc, short, firstOf, mgrOf, pick, relTime, hash, gwDoneTime } from './util.js';
import { quotes, rumours } from './social.js';
import { settle, viral, claimLabel, claimClause, claimChip, pct, ordinal } from './claims.js';

const strong = s => '<strong>' + s + '</strong>';
const T = (d, min) => new Date((d ? +d : 0) + (min || 0) * 60e3);
const who = t => mgrOf(t) || t;
const oppOfQ = q => q.re || (q.claim && q.claim.opp) || null;
const nmFor = q => { const o = oppOfQ(q); return o ? derbyName(q.team, o) : null; };
const HOT_H = 48;                                       /* a viral post rides the top of Everyone for two days */

export const quoteId = q => (q.re ? 'reply:' : 'quote:') + q.target + ':' + q.team;

function quotePost(q, s, slot) {
  const opp = oppOfQ(q), nm = nmFor(q), id = quoteId(q), m = who(q.team);
  let text;
  if (q.re) text = pick('qreply', q.gw, [strong('RESPONSE.') + ' ' + esc(m) + ' answers ' + esc(who(q.re)) + '.', strong('HERE WE GO.') + ' ' + esc(m) + ' has seen what ' + esc(firstOf(q.re)) + ' said.', strong('BACK AT YOU.') + ' ' + esc(short(q.team)) + ' respond to ' + esc(short(q.re)) + '.'], slot);
  else text = pick('quote', q.gw, [strong('ON THE RECORD.') + ' ' + esc(m) + ', ' + esc(q.team) + ', before ' + (nm ? esc(nm) : 'GW' + q.gw) + '.', strong('PRESS CONFERENCE.') + ' ' + esc(m) + ' on ' + (nm ? esc(nm) : 'facing ' + esc(short(opp || ''))) + '.', strong('QUOTE.') + ' ' + esc(m) + ' had something to say before GW' + q.gw + '.'], slot);
  const orig = q.re ? quotes().find(x => x.team === q.re && x.target === 'q:' + q.gw) : null;
  return {
    id, voice: 'archizio', kind: 'presser', ts: T(q.at), time: relTime(new Date(q.at)), gw: q.gw, teams: [q.team].concat(opp ? [opp] : []), players: q.claim && q.claim.code ? [q.claim.code] : [],
    text, media: { type: 'quote', line: q.line, team: q.team, who: m, nm, chip: claimChip(q.claim), p: q.p, verdict: s.state, re: orig ? { team: orig.team, who: who(orig.team), line: orig.line } : null },
    facts: 'Press conference · ' + (q.src === 'own' ? 'in their own words' : 'picked from Archizio’s lines') + (q.claim ? ' · calling: ' + claimLabel(q.claim) + (q.p != null ? ', the model said ' + pct(q.p) : '') : ''),
    detail: [{ k: 'Said', v: '“' + esc(q.line) + '”' }].concat(q.claim ? [{ k: 'Calling', v: esc(claimLabel(q.claim)) }] : []).concat(q.p != null ? [{ k: 'The model at the time', v: pct(q.p) }] : [])
      .concat(s.state === 'won' || s.state === 'lost' || s.state === 'live' || s.state === 'running' ? [{ k: s.state === 'won' ? 'Came true' : s.state === 'lost' ? 'Didn’t happen' : 'So far', v: s.line }] : []),
    links: opp ? [{ label: short(opp), open: 'manager:' + opp }] : [], share: '“' + q.line + '” ' + m + ', ' + q.team + '. Via @archizio', social: q,
  };
}
function boldPost(q, slot) {
  const m = who(q.team), lab = claimLabel(q.claim), cl = claimClause(q.claim);
  return {
    id: 'bold:' + q.target + ':' + q.team, voice: 'clark', kind: 'bold', ts: T(q.at, 7), time: relTime(T(q.at, 7)), gw: q.gw, teams: [q.team], players: [],
    text: pick('bold', q.gw, [strong('BOLD.') + ' ' + esc(m) + ' says ' + esc(cl) + '. The model gives it ' + pct(q.p) + '.', 'Screenshotting this. ' + esc(firstOf(q.team)) + ' says ' + esc(cl) + '. The model: ' + pct(q.p) + '.', strong(pct(q.p) + '.') + ' That’s what the model gives ' + esc(possQ(q.team)) + ' call: ' + esc(cl) + '. Saved for later.'], slot),
    media: { type: 'qt', ref: quoteId(q) }, facts: 'The model’s chance when the quote went out', detail: [{ k: 'The call', v: esc(cl) }, { k: 'The model', v: pct(q.p) }], links: [], share: m + ' says ' + cl + '. The model gives it ' + pct(q.p) + '.',
  };
}
const possQ = t => /s$/.test(short(t)) ? short(t) + '’' : short(t) + '’s';
function receiptPost(q, s, slot, hot) {
  const m = who(q.team), won = s.state === 'won', id = (won ? 'called:' : 'receipt:') + q.target + ':' + q.team;
  const when = s.when || new Date(q.at), at = T(when, won ? 42 : 47);
  const said = '“' + esc(q.line) + '”';
  const text = won
    ? pick('called', q.gw, [strong('CALLED IT.') + ' ' + esc(m) + ' said ' + said + '. ' + s.line + '.', strong('HE SAID IT.') + ' ' + said + ' ' + esc(m) + ', before GW' + q.gw + '. ' + s.line + '.', strong('ON THE RECORD, AND RIGHT.') + ' ' + s.line + '. ' + esc(firstOf(q.team)) + ' called it.'], slot)
    : pick('receipt', q.gw, [strong('RECEIPTS.') + ' ' + esc(m) + ' before GW' + q.gw + ': ' + said + ' ' + s.line + '.', 'Remember this, ' + esc(firstOf(q.team)) + '? ' + said + ' ' + s.line + '.', strong('AGED LIKE MILK.') + ' ' + said + ' ' + esc(m) + ', GW' + q.gw + '. ' + s.line + '.'], slot);
  return {
    id, voice: won ? 'archizio' : 'clark', kind: won ? 'called' : 'receipt', ts: at, time: relTime(at), gw: q.claim.gw || q.gw, teams: [q.team].concat(oppOfQ(q) ? [oppOfQ(q)] : []), players: [], viral: hot, hot: hot && Date.now() - +at < HOT_H * 3600e3,
    text, media: { type: 'receipt', verdict: won ? 'won' : 'lost', line: q.line, team: q.team, who: m, chip: claimChip(q.claim), p: q.p, result: s.plain || '', gw: q.gw },
    facts: 'The quote · the result' + (q.p != null ? ' · the model gave it ' + pct(q.p) : ''), detail: [{ k: 'Said', v: said }, { k: 'Calling', v: esc(claimLabel(q.claim)) }, { k: won ? 'Came true' : 'What happened', v: s.line }].concat(q.p != null ? [{ k: 'The model at the time', v: pct(q.p) }] : []),
    links: [{ label: short(q.team), open: 'manager:' + q.team }], share: (won ? 'Called it. ' : 'Receipts. ') + '“' + q.line + '” ' + m + '. ' + (s.plain || '') + '.', social: q,
  };
}
function pileOn(q, s, rec, slot) {
  const m = who(q.team), won = s.state === 'won', out = [];
  const at = T(rec.ts, 18);
  out.push({
    id: 'pile:a:' + rec.id, voice: 'archizio', kind: 'pile', ts: at, time: relTime(at), gw: rec.gw, teams: [q.team], players: [],
    text: won ? pick('pileaw', q.gw, [strong('UNDERSTAND.') + ' ' + esc(possQ(q.team)) + ' GW' + q.gw + ' call is all over the league.', strong('EXCLUSIVE.') + ' The ' + esc(short(q.team)) + ' dressing room has the quote framed.'], slot)
      : pick('pileal', q.gw, [strong('UNDERSTAND.') + ' ' + esc(possQ(q.team)) + ' GW' + q.gw + ' quote is doing numbers. Not the good kind.', strong('EXCLUSIVE.') + ' ' + esc(m) + ' is not taking questions today.', strong('HERE WE GO.') + ' The quote, the result, the replies.'], slot),
    media: { type: 'qt', ref: rec.id }, facts: 'The receipt above', detail: [], links: [], share: '',
  });
  const at2 = T(rec.ts, 31);
  out.push({
    id: 'pile:m:' + rec.id, voice: 'malcolm', kind: 'pile', ts: at2, time: relTime(at2), gw: rec.gw, teams: [q.team], players: [],
    text: won ? pick('pilemw', q.gw, ['From the booth: say it, then do it. ' + esc(m) + ' did both.', 'Give the man his flowers. ' + s.plain + '.'], slot)
      : pick('pileml', q.gw, ['From the booth: some quotes age better than others. ' + s.plain + '.', 'They’ll be playing that one back for a while. ' + s.plain + '.'], slot),
    media: null, facts: 'The receipt', detail: [], links: [{ label: short(q.team), open: 'manager:' + q.team }], share: '',
  });
  return out;
}
function runningPost(q, s, slot) {
  const m = who(q.team), id = 'remember:' + q.target + ':' + q.team + ':' + s.upTo, ts = T(gwDoneTime(s.upTo), 52);
  return {
    id, voice: 'clark', kind: 'remember', ts, time: 'After GW' + s.upTo, gw: s.upTo, teams: [q.team], players: [],
    text: pick('remember', s.upTo, ['Remember this? “' + esc(q.line) + '” ' + esc(m) + ', GW' + q.gw + '. ' + s.line + '.', strong('HOW’S THAT GOING?') + ' “' + esc(q.line) + '” ' + s.line + '.'], slot),
    media: { type: 'receipt', verdict: 'running', line: q.line, team: q.team, who: m, chip: claimChip(q.claim), p: q.p, result: s.line.replace(/<[^>]+>/g, ''), gw: q.gw },
    facts: 'Manager of the Month race · points for', detail: [{ k: 'Said', v: '“' + esc(q.line) + '”' }, { k: 'So far', v: s.line }], links: [{ label: 'Money', href: '#/league/money' }], share: '', social: q,
  };
}

/* ---------- the rumour mill: Archizio runs it, Clark spreads it, someone rules on it. Three posts at most per rumour ---------- */
function rumourPosts(out) {
  let R = []; try { R = rumours(); } catch (e) { console.error(e); return; }
  /* phrasing slot = the rumour's place in the order they started, so neighbours differ and a new one never rewords an old one */
  const chron = R.slice().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  R.forEach(g => {
    const slot = chron.indexOf(g), src = g.anon ? 'a source close to the league' : who(g.by), about = g.about ? [g.about] : [];
    const said = '“' + esc(g.text) + '”';
    out.push({
      id: 'rumour:' + g.id, voice: 'archizio', kind: 'rumour', ts: T(g.at), time: relTime(new Date(g.at)), gw: D.gw, teams: about, players: [],
      text: pick('rumour', slot, [strong('UNDERSTAND.') + ' Hearing from ' + esc(src) + ': ' + said + ' Developing.', strong('EXCLUSIVE.') + ' Whispers around El Matador Tire: ' + said + ' More to follow.', strong('NOT CONFIRMED.') + ' But ' + esc(src) + ' says ' + said]),
      media: { type: 'whisper', text: g.latest, first: g.text, about: g.about, src: g.anon ? 'A SOURCE CLOSE TO THE LEAGUE' : who(g.by).toUpperCase(), hops: g.hops, confirms: g.confirms, denies: g.denies, status: g.status },
      facts: 'The rumour mill · started ' + (g.anon ? 'anonymously' : 'by ' + who(g.by)) + ' · heard ' + g.hops + (g.hops === 1 ? ' time' : ' times') + ' · ' + g.confirms + ' confirm, ' + g.denies + ' deny',
      detail: [{ k: 'First heard', v: said }].concat(g.passes.filter(p => p.kind === 'twist').map((p, k) => ({ k: 'Version ' + (k + 2), v: '“' + esc(p.text) + '”' }))).concat([{ k: 'Confirm · deny', v: g.confirms + ' · ' + g.denies }]),
      links: [{ label: 'Pass it on', href: '#/feed/messages/rumours' }], share: 'Hearing: “' + g.latest + '” Via @archizio', rumour: g.id,
    });
    const tw = g.passes.filter(p => p.kind === 'twist');
    if (tw.length) {
      const at = tw[tw.length - 1].at;
      out.push({
        id: 'rumour-mill:' + g.id, voice: 'clark', kind: 'thumb', ts: T(at, 1), time: relTime(new Date(at)), gw: D.gw, teams: about, players: [],
        text: pick('rumourmill', slot, [strong('IT’S SPREADING.') + ' Now hearing: “' + esc(g.latest) + '” Who started this?', 'The rumour mill is going. First it was ' + said + ' Now it’s “' + esc(g.latest) + '”', strong('VERSION ' + g.hops + '.') + ' “' + esc(g.latest) + '” Somebody stop this.']),
        media: { type: 'thumb', t1: g.status === 'confirmed' ? 'IT’S TRUE?!' : 'IS IT TRUE?!', t2: g.about ? 'THE ' + firstOf(g.about).toUpperCase() + ' RUMOUR' : 'THE RUMOUR MILL', lo: 'VERSION ' + g.hops, team: g.about || '', chip: g.hops + ' SOURCES' },
        facts: 'The rumour mill · version ' + g.hops, detail: [{ k: 'Now', v: '“' + esc(g.latest) + '”' }, { k: 'First heard', v: said }], links: [{ label: 'Pass it on', href: '#/feed/messages/rumours' }], share: '',
      });
    }
    if (g.status !== 'spreading') {
      const dec = g.passes.filter(p => p.kind === (g.status === 'confirmed' ? 'confirm' : 'deny'))[1], at = dec ? dec.at : g.last;
      out.push(g.status === 'confirmed' ? {
        id: 'rumour-verdict:' + g.id, voice: 'archizio', kind: 'rumour', ts: T(at, 2), time: relTime(new Date(at)), gw: D.gw, teams: about, players: [], hot: Date.now() - at < 48 * 3600e3, viral: true,
        text: pick('rumourok', slot, [strong('HERE WE GO.') + ' ' + g.confirms + ' sources now confirm: “' + esc(g.latest) + '”', strong('CONFIRMED.') + ' “' + esc(g.latest) + '” ' + g.confirms + ' managers stand behind it.']),
        media: null, facts: 'The rumour mill · ' + g.confirms + ' confirm, ' + g.denies + ' deny', detail: [], links: [{ label: 'The rumour mill', href: '#/feed/messages/rumours' }], share: '',
      } : {
        id: 'rumour-verdict:' + g.id, voice: 'malcolm', kind: 'rumour', ts: T(at, 2), time: relTime(new Date(at)), gw: D.gw, teams: about, players: [],
        text: pick('rumourno', slot, ['The booth has asked around. Nobody will stand behind ' + said + ' Rumour dead.', g.denies + ' managers deny it outright. ' + said + ' goes in the bin.']),
        media: null, facts: 'The rumour mill · ' + g.confirms + ' confirm, ' + g.denies + ' deny', detail: [], links: [], share: '',
      });
    }
  });
}

export function socialPosts(you) {
  const out = [], hotBy = {};
  let Q = []; try { Q = quotes(); } catch (e) { console.error(e); return out; }
  Q.forEach((q, i) => {
    const slot = hash(q.team) % 7;
    let s = { state: 'none' }; try { s = settle(q); } catch (e) { console.error(e); }
    out.push(quotePost(q, s, slot));
    if (!q.claim) return;
    if (q.p != null && q.p <= .35 && (s.state === 'open' || s.state === 'live')) out.push(boldPost(q, slot));
    if (s.state === 'won' || s.state === 'lost') {
      const hot = viral(q, s), rec = receiptPost(q, s, slot, hot);
      out.push(rec);
      if (hot) { const g = rec.gw, sc = (s.sev || 0) + (q.p != null ? 1 - q.p : 0); if (!hotBy[g] || sc > hotBy[g].sc) hotBy[g] = { q, s, rec, sc }; }
    }
    if (s.state === 'running' && s.rank >= 6) out.push(runningPost(q, s, slot));
  });
  rumourPosts(out);
  /* the voices pile on to the gameweek's biggest one only */
  Object.keys(hotBy).forEach(g => { const h = hotBy[g]; out.push(...pileOn(h.q, h.s, h.rec, hash(h.q.team + g) % 5)); });
  out.forEach(p => { p.social = true; });
  return out;
}
