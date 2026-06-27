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
