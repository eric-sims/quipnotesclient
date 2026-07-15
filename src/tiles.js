// The server (and the mock) speak tiles as "<id>|<word>" strings so that
// duplicate words stay distinct. That wire format is an implementation
// detail of the transport, not something the views should know about.
// Parse it into a structured { id, word } at the boundary and format it
// back only when we hand a note to the server.

export function parseTile(raw) {
  const str = String(raw);
  const sep = str.indexOf('|');
  if (sep === -1) {
    // No id prefix: treat the whole thing as the word, id == word.
    return { id: str, word: str };
  }
  return { id: str.slice(0, sep), word: str.slice(sep + 1) };
}

export function formatTile(tile) {
  return `${tile.id}|${tile.word}`;
}

// A note may contain line breaks between clusters of tiles. On the wire (and in
// the server's stored note) a break is this reserved token: it carries no
// "<id>|<word>" tile, so it can never collide with a real tile. The server
// (BreakToken in game.go) and the manager parse the same token.
export const BREAK_TILE = '\n';

// True when a submitted/wire token is a line break rather than a tile.
export function isBreak(token) {
  return token === BREAK_TILE;
}

// In the note-building UI a break is held as a *unique* id (so repeated breaks
// have distinct keys and move/remove-by-id keep working); it serializes to
// BREAK_TILE on submit. Real tile ids are the CSV row index and never start
// with the break token.
export function isBreakId(id) {
  return String(id).startsWith(BREAK_TILE);
}

let breakSeq = 0;
export function newBreakId() {
  breakSeq += 1;
  return `${BREAK_TILE}#${breakSeq}`;
}

// --- Parts of speech ---------------------------------------------------------
// The draw/tiles responses carry a parallel `pos` map ({ "<id>|<word>": [tags] })
// so a word can belong to several parts of speech. Tags ride next to the tile,
// never inside the "<id>|<word>" token itself.

// Display order for the POS tabs. "other" (punctuation, suffix tiles like
// "ing", articles) always sorts last.
export const POS_ORDER = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'other',
];

// Tab label + a plain-English one-liner for players who don't live and
// breathe grammar.
export const POS_INFO = {
  noun: { label: 'Noun', definition: 'A person, place, or thing — like "banana" or "wizard".' },
  verb: { label: 'Verb', definition: 'An action word — something you do, like "steal" or "whisper".' },
  adjective: { label: 'Adjective', definition: 'Describes a thing — like "sticky" or "haunted".' },
  adverb: { label: 'Adverb', definition: 'Says how, when, or where — like "quietly" or "never".' },
  pronoun: { label: 'Pronoun', definition: 'Stands in for a name — like "you", "they", or "nobody".' },
  preposition: { label: 'Preposition', definition: 'Places things in space or time — like "into", "under", or "before".' },
  conjunction: { label: 'Conjunction', definition: 'A joining word — like "and", "but", or "because".' },
  interjection: { label: 'Interjection', definition: 'A little burst of feeling — like "wow", "ugh", or "hey"!' },
  other: { label: 'Other', definition: `The odd bits that don't fit a box — like "!" and "ing".` },
};

// Normalize a raw tag list from the wire: lowercase, drop unknown tags, and
// default to ["other"] when nothing usable remains (including tiles from an
// older server that sends no pos map at all).
export function normalizePos(tags) {
  const known = (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag).toLowerCase())
    .filter((tag) => POS_ORDER.includes(tag));
  return known.length > 0 ? known : ['other'];
}

// Group parsed tiles ({ id, word, pos }) for the tabbed browse view: one
// { pos, label, definition, tiles } group per non-empty part of speech, in
// POS_ORDER. A tile with several tags appears in each matching group.
export function groupTilesByPos(tiles) {
  const byPos = new Map();
  for (const tile of tiles || []) {
    for (const tag of normalizePos(tile.pos)) {
      if (!byPos.has(tag)) byPos.set(tag, []);
      byPos.get(tag).push(tile);
    }
  }
  return POS_ORDER.filter((tag) => byPos.has(tag)).map((tag) => ({
    pos: tag,
    label: POS_INFO[tag].label,
    definition: POS_INFO[tag].definition,
    tiles: byPos.get(tag),
  }));
}
