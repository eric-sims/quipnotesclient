// Mock backend that mirrors the quipNotes server's game-scoped, join-only
// contract. Lets the client run with no server: api.js routes here when
// VITE_OFFLINE is set. Each tile is a "<id>|<word>" string so that duplicate
// words stay distinct (WordTile renders word.split("|")[1]).
//
// In offline mode there's no manager to *create* a game, so a game is
// auto-created the first time any 4-digit code is looked up or joined — that
// keeps offline play (join -> draw -> submit) meaningful. State is persisted to
// localStorage so it survives page reloads.

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
  connectors: ["and", "or", "but", "before", "after", "until", "because", "into"],
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
  ...WORD_GROUPS.connectors, ...WORD_GROUPS.connectors,
];

const STORAGE_KEY = "quipnotes.mock.v2";

// games: Map<code, { players: Map<id, { tiles: string[] }>, submittedNotes: string[] }>
let games = new Map();
let tileCounter = 0;

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

// Auto-create the game on first contact (offline has no manager to create it).
function ensureGame(code) {
  if (!games.has(code)) {
    games.set(code, { players: new Map(), submittedNotes: [] });
  }
  return games.get(code);
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
    return jsonResponse({ words: [...player.tiles] });
  }

  // Submit a note.
  if (method === "POST" && (m = url.match(SUBMIT_RE))) {
    const game = ensureGame(m[1]);
    const player = ensurePlayer(game, String(body.id));
    const note = body.note || [];
    const noteSet = new Set(note);
    const legible = note
      .map((tile) => String(tile).split("|")[1])
      .join(" ");
    if (legible.trim()) game.submittedNotes.push(legible);
    player.tiles = player.tiles.filter((tile) => !noteSet.has(tile));
    save();
    return jsonResponse({ ok: true });
  }

  // Get a player's current tiles.
  if (method === "GET" && (m = url.match(TILES_RE))) {
    const game = ensureGame(m[1]);
    const player = ensurePlayer(game, m[2]);
    return jsonResponse({ words: [...player.tiles] });
  }

  console.warn(`[mockApi] unhandled ${method} ${url}`);
  return jsonResponse({ error: "not found" }, 404);
}
