// Mock backend that mirrors the quipNotes server's game-scoped, join-only
// contract. Lets the client run with no server: api.js routes here when
// VITE_OFFLINE is set. Each tile is a "<id>|<word>" string so that duplicate
// words stay distinct (WordTile renders word.split("|")[1]).
//
// In offline mode there's no manager to *create* a game, so a game is
// auto-created the first time any 4-digit code is looked up or joined — that
// keeps offline play (join -> draw -> submit) meaningful. For the same reason a
// game auto-starts a round with a random prompt on first contact (there is no
// host to draw one); after answering, the player advances to the next prompt
// themselves via POST /rounds (the same next-round endpoint the server offers
// phones, with its stale-round 409 guard) so solo offline play keeps flowing.
// State is persisted to localStorage so it survives page reloads.

import { BREAK_TILE } from "./tiles.js";

// Curated bank grouped by role so a draw yields material you can actually
// string into a ransom-note quip (articles + pronouns + verbs + nouns...).
const WORD_GROUPS = {
  articles: ["the", "a", "an", "this", "that", "your", "my", "our"],
  pronouns: ["i", "you", "we", "they", "it", "someone", "nobody", "everybody"],
  verbs: [
    "demand", "stole", "hid", "wants", "needs", "found", "buried", "ate",
    "whispers", "screams", "delivers", "returns", "betrayed", "summons",
  ],
  nouns: [
    "money", "secret", "banana", "monkey", "robot", "pickle", "dragon",
    "noodle", "shadow", "spoon", "fortune", "cookie", "wizard", "gnome",
    "tribute", "cheese", "espresso", "treasure", "package", "midnight",
  ],
  adjectives: [
    "secret", "rusty", "glittery", "dangerous", "ancient", "sticky",
    "forbidden", "tiny", "enormous", "suspicious", "haunted", "golden",
  ],
  adverbs: ["quietly", "loudly", "now", "never", "always", "tonight", "slowly"],
  conjunctions: ["and", "or", "but", "because"],
  prepositions: ["into", "before", "after", "until"],
};

// Flatten into a weighted draw pool: glue words appear more often so notes
// read better, but you still get plenty of nouns/verbs to play with.
const WORD_BANK = [
  ...WORD_GROUPS.articles, ...WORD_GROUPS.articles,
  ...WORD_GROUPS.pronouns,
  ...WORD_GROUPS.verbs, ...WORD_GROUPS.verbs,
  ...WORD_GROUPS.nouns, ...WORD_GROUPS.nouns,
  ...WORD_GROUPS.adjectives,
  ...WORD_GROUPS.adverbs,
  ...WORD_GROUPS.conjunctions, ...WORD_GROUPS.conjunctions,
  ...WORD_GROUPS.prepositions, ...WORD_GROUPS.prepositions,
];

// Map each group to its standard part-of-speech tag (the server's words.txt
// tags). Articles aren't one of the nine tabs, so they land in "other".
const GROUP_POS = {
  articles: "other",
  pronouns: "pronoun",
  verbs: "verb",
  nouns: "noun",
  adjectives: "adjective",
  adverbs: "adverb",
  conjunctions: "conjunction",
  prepositions: "preposition",
};

// word -> [tags], merging words that sit in several groups ("secret" is both
// a noun and an adjective). "before"/"after"/"until" double as conjunctions so
// offline play exercises the multi-POS tabs, like the real word bank does.
const WORD_POS = (() => {
  const pos = new Map();
  for (const [group, words] of Object.entries(WORD_GROUPS)) {
    for (const word of words) {
      const tags = pos.get(word) || [];
      if (!tags.includes(GROUP_POS[group])) tags.push(GROUP_POS[group]);
      pos.set(word, tags);
    }
  }
  for (const word of ["before", "after", "until"]) {
    pos.get(word).push("conjunction");
  }
  return pos;
})();

// Build the wire's pos map for a set of tiles, keyed by the full
// "<id>|<word>" token exactly like the server's draw/tiles responses.
// Exported for tests.
export function posFor(tiles) {
  const pos = {};
  for (const tile of tiles) {
    const word = tile.slice(tile.indexOf("|") + 1);
    if (WORD_POS.has(word)) pos[tile] = [...WORD_POS.get(word)];
  }
  return pos;
}

// A small built-in prompt bank so offline play has prompts to reference.
const PROMPT_BANK = [
  "The worst possible thing to say on a first date",
  "A rejected slogan for an energy drink",
  "What the villain monologues about before losing",
  "A terrible name for a boat",
  "What your pet is really thinking about you",
  "The last text message before the world ended",
  "A motivational poster nobody asked for",
  "What the fortune cookie should have said",
  "A newspaper headline from the year 3000",
  "The title of your unauthorized autobiography",
];

const STORAGE_KEY = "quipnotes.mock.v2";

// games: Map<code, {
//   players: Map<id, { tiles: string[] }>,
//   submittedNotes: string[][],   // each note is its ordered token list
//   round: number,
//   prompt: string,
//   submitted: Set<id>,   // players who submitted this round
// }>
let games = new Map();
let tileCounter = 0;

function randomPrompt() {
  return PROMPT_BANK[Math.floor(Math.random() * PROMPT_BANK.length)];
}

// Mirror the server: trim leading/trailing line breaks and collapse runs of
// consecutive breaks to a single one so the host never renders blank lines.
function normalizeNote(note) {
  const out = [];
  for (const token of note) {
    if (token === BREAK_TILE) {
      if (out.length === 0 || out[out.length - 1] === BREAK_TILE) continue;
    }
    out.push(token);
  }
  if (out.length && out[out.length - 1] === BREAK_TILE) out.pop();
  return out;
}

function storage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // localStorage can throw in private-mode / sandboxed contexts
  }
}

function load() {
  const store = storage();
  if (!store) return;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    tileCounter = data.tileCounter || 0;
    games = new Map(
      Object.entries(data.games || {}).map(([code, game]) => [
        code,
        {
          players: new Map(Object.entries(game.players || {})),
          submittedNotes: game.submittedNotes || [],
          round: game.round || 0,
          prompt: game.prompt || "",
          submitted: new Set(game.submitted || []),
        },
      ])
    );
  } catch (e) {
    console.warn("[mockApi] could not load saved state", e);
  }
}

function save() {
  const store = storage();
  if (!store) return;
  try {
    const serializable = {};
    for (const [code, game] of games) {
      serializable[code] = {
        players: Object.fromEntries(game.players),
        submittedNotes: game.submittedNotes,
        round: game.round,
        prompt: game.prompt,
        submitted: [...game.submitted],
      };
    }
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({ tileCounter, games: serializable })
    );
  } catch (e) {
    console.warn("[mockApi] could not save state", e);
  }
}

load();

// Auto-create the game on first contact (offline has no manager to create it),
// and auto-start round 1 with a random prompt (offline has no host to draw one).
function ensureGame(code) {
  if (!games.has(code)) {
    games.set(code, {
      players: new Map(),
      submittedNotes: [],
      round: 0,
      prompt: "",
      submitted: new Set(),
    });
  }
  const game = games.get(code);
  if (!game.round) {
    game.round = 1;
    game.prompt = randomPrompt();
    game.submitted = new Set();
  }
  return game;
}

// Advance to the next prompt: a new round, cleared submissions and notes.
// Offline has no host, so the player drives this via POST /rounds.
function advanceRound(game) {
  game.round += 1;
  game.prompt = randomPrompt();
  game.submitted = new Set();
  game.submittedNotes = [];
}

// The wire RoundState for GET /round and the POST /rounds response. Offline
// rounds are judge-less, so the judging fields always carry their zero shape.
function roundState(game) {
  return {
    round: game.round,
    prompt: game.prompt,
    judgeId: "",
    judgingOpen: false,
    count: game.submitted.size,
    total: game.players.size,
    favoriteNoteId: 0,
    winnerId: "",
  };
}

function ensurePlayer(game, id) {
  if (!game.players.has(id)) {
    game.players.set(id, { tiles: [] });
  }
  return game.players.get(id);
}

function randomWord() {
  return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
}

function makeTile() {
  return `${tileCounter++}|${randomWord()}`;
}

// Wrap a payload so it quacks like a fetch Response for the client's
// usage: response.ok, response.status, response.json().
function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

const GAME_RE = /^\/games\/(\d{4})$/;
const PLAYERS_RE = /^\/games\/(\d{4})\/players$/;
const TILES_RE = /^\/games\/(\d{4})\/players\/([^/]+)\/tiles$/;
const DRAW_RE = /^\/games\/(\d{4})\/draw$/;
const SUBMIT_RE = /^\/games\/(\d{4})\/submit$/;
const ROUND_RE = /^\/games\/(\d{4})\/round$/;
const ROUNDS_RE = /^\/games\/(\d{4})\/rounds$/;

// Drop-in replacement for api.js#rawRequest's network call.
export async function mockApiRequest(method, url, body = null) {
  let m;

  // Game info / join validation.
  if (method === "GET" && (m = url.match(GAME_RE))) {
    const game = ensureGame(m[1]);
    save();
    return jsonResponse({ code: m[1], players: [...game.players.keys()] });
  }

  // Join a game.
  if (method === "POST" && (m = url.match(PLAYERS_RE))) {
    if (!body || !body.id) return jsonResponse({ error: "id required" }, 400);
    const game = ensureGame(m[1]);
    ensurePlayer(game, String(body.id));
    save();
    return jsonResponse({ id: body.id }, 201);
  }

  // Draw tiles.
  if (method === "POST" && (m = url.match(DRAW_RE))) {
    const game = ensureGame(m[1]);
    const player = ensurePlayer(game, String(body.id));
    const count = Number(body.count) || 0;
    for (let i = 0; i < count; i++) {
      player.tiles.push(makeTile());
    }
    save();
    return jsonResponse({ words: [...player.tiles], pos: posFor(player.tiles) });
  }

  // Current round. Offline rounds are always judge-less (there's no room of
  // players to judge), so the judging fields mirror the server's judge-less
  // shape: play works exactly as it did before judging existed, and judge mode
  // never activates offline.
  if (method === "GET" && (m = url.match(ROUND_RE))) {
    const game = ensureGame(m[1]);
    save();
    return jsonResponse(roundState(game));
  }

  // Advance to the next prompt (the player-driven POST /rounds). Mirrors the
  // server's AdvanceRound guards: the caller must have joined and cite the
  // round they're advancing from (a stale value 409s instead of skipping a
  // prompt). Offline rounds are judge-less, so any joined player may advance —
  // the judge-only rule never applies here.
  if (method === "POST" && (m = url.match(ROUNDS_RE))) {
    const game = ensureGame(m[1]);
    const id = String((body && body.id) || "");
    if (!game.players.has(id)) {
      return jsonResponse({ error: `player ${id} not found` }, 500);
    }
    if (Number(body.round) !== game.round) {
      return jsonResponse(
        { error: "the next round has already started" },
        409
      );
    }
    advanceRound(game);
    save();
    return jsonResponse(roundState(game), 201);
  }

  // Submit a note.
  if (method === "POST" && (m = url.match(SUBMIT_RE))) {
    const game = ensureGame(m[1]);
    const id = String(body.id);
    const player = ensurePlayer(game, id);

    // One note per round (mirrors the server's 409).
    if (game.submitted.has(id)) {
      return jsonResponse(
        { error: "you already submitted a note this round" },
        409
      );
    }

    // A note is the ordered token list: tile keys plus BREAK_TILE markers.
    // Break tokens carry no tile, so they're skipped when releasing the
    // player's tiles; the note itself is stored as its token array (mirroring
    // the server), not flattened to a string.
    const note = body.note || [];
    const tiles = note.filter((token) => token !== BREAK_TILE);
    if (tiles.length === 0) {
      return jsonResponse({ error: "no wordTiles found" }, 500);
    }
    const tileSet = new Set(tiles);
    game.submittedNotes.push(normalizeNote(note));
    player.tiles = player.tiles.filter((tile) => !tileSet.has(tile));
    game.submitted.add(id);
    save();
    return jsonResponse({ ok: true });
  }

  // Get a player's current tiles.
  if (method === "GET" && (m = url.match(TILES_RE))) {
    const game = ensureGame(m[1]);
    const player = ensurePlayer(game, m[2]);
    return jsonResponse({ words: [...player.tiles], pos: posFor(player.tiles) });
  }

  console.warn(`[mockApi] unhandled ${method} ${url}`);
  return jsonResponse({ error: "not found" }, 404);
}
