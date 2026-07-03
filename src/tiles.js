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
