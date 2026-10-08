/* feed/voices.js — the four fictional voices: names, handles, tags, avatars, beats.
   El Matador's names; other leagues would rename them in league settings. Each look stays inside its own posts. */
const MEGA = '<path d="M3 10v4h3l7 4V6L6 10H3z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>';
const MIC = '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>';
const CLIP = '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12l2 2 4-4"/>';
const svg = (inner, px, stroke, sw = 2) => '<svg width="' + px + '" height="' + px + '" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';

export const VOICES = {
  archizio: {
    id: 'archizio', name: 'Archizio Poblano', first: 'Archizio', handle: '@archizio', tag: 'INSIDER', role: 'the insider',
    beat: 'Signings, failed claims, injuries, the free-agent market, records, title odds, the Baha market and derby build-up.',
    glyph: px => '<b class="ap-ini" style="font-size:' + Math.round(px * .4) + 'px">AP</b>',
  },
  clark: {
    id: 'clark', name: 'Clark Moldridge', first: 'Clark', handle: '@ClarkMoldridge', tag: 'THE TERRACE', role: 'the terrace',
    beat: 'Bench disasters, losing runs, luck, the worst picks of the draft and derby polls.',
    glyph: px => svg(MEGA, Math.round(px * .55), '#FFD60A', 2.2),
  },
  malcolm: {
    id: 'malcolm', name: 'Malcolm Tyre', first: 'Malcolm', handle: '@tyrebooth', tag: 'BOOTH', role: 'the booth',
    beat: 'Previews of every matchup, live swings in win chance, full time and the star man, and the weekly show.',
    glyph: px => svg(MIC, Math.round(px * .5), '#FFFFFF'),
  },
  jive: {
    id: 'jive', name: 'Jive Tidlsey', first: 'Jive', handle: 'Assistant manager', tag: 'ONLY YOU', role: 'assistant manager',
    beat: 'Selection calls, the fitness board, your to-do list and the opponent’s danger man. Only you see Jive.',
    glyph: px => svg(CLIP, Math.round(px * .5), '#EEF3EA'),
  },
};
export const ORDER = ['archizio', 'clark', 'malcolm', 'jive'];

/* the voice's profile picture (voices/<id>.jpg at the repo root, 256 px, AI-generated original faces; Parker, 8 Oct 2026)
   over its glyph: if the picture fails to load it removes itself and the glyph shows */
export const pic = (v, px) => '<img class="fav-pic" src="voices/' + v + '.jpg" alt="" decoding="async" onerror="this.remove()">' + VOICES[v].glyph(px);
export function avatar(v, px = 40) {
  return '<span class="fav fav-' + v + '" style="width:' + px + 'px;height:' + px + 'px" aria-hidden="true">' + pic(v, px) + '</span>';
}
export const tagChip = v => '<span class="ftag ftag-' + v + '">' + VOICES[v].tag + '</span>';
