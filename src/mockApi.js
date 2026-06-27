// Mock backend that mirrors the quipNotes server.
//
// Lets the client run with no server: api.js routes here when
// VITE_OFFLINE is set. Each tile is a "<id>|<word>" string so that
// duplicate words stay distinct (WordTile renders word.split("|")[1]).
// State is persisted to localStorage so it survives page reloads.

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

const STORAGE_KEY = "quipnotes.mock.v1";

let players = new Map();
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
    players = new Map(Object.entries(data.players || {}));
  } catch (e) {
    console.warn("[mockApi] could not load saved state", e);
  }
}

function save() {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({ tileCounter, players: Object.fromEntries(players) })
    );
  } catch (e) {
    console.warn("[mockApi] could not save state", e);
  }
}

load();

function ensurePlayer(id) {
  if (!players.has(id)) {
    players.set(id, { tiles: [] });
  }
  return players.get(id);
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

const routes = [
  {
    method: "POST",
    match: (url) => url === "/players",
    handle: (body) => {
      if (!body || !body.id) return jsonResponse({ error: "id required" }, 400);
      ensurePlayer(String(body.id));
      save();
      return jsonResponse({ id: body.id }, 201);
    },
  },
  {
    method: "POST",
    match: (url) => url === "/game/draw",
    handle: (body) => {
      const player = ensurePlayer(String(body.id));
      const count = Number(body.count) || 0;
      for (let i = 0; i < count; i++) {
        player.tiles.push(makeTile());
      }
      save();
      return jsonResponse({ words: [...player.tiles] });
    },
  },
  {
    method: "POST",
    match: (url) => url === "/game/submit",
    handle: (body) => {
      const player = ensurePlayer(String(body.id));
      const note = new Set(body.note || []);
      player.tiles = player.tiles.filter((tile) => !note.has(tile));
      save();
      return jsonResponse({ ok: true });
    },
  },
  {
    method: "GET",
    match: (url) => /^\/players\/[^/]+\/tiles$/.test(url),
    handle: (_body, url) => {
      const id = url.split("/")[2];
      const player = ensurePlayer(id);
      return jsonResponse({ words: [...player.tiles] });
    },
  },
];

// Drop-in replacement for api.js#apiRequest's network call.
export async function mockApiRequest(method, url, body = null) {
  const route = routes.find((r) => r.method === method && r.match(url));
  if (!route) {
    console.warn(`[mockApi] unhandled ${method} ${url}`);
    return jsonResponse({ error: "not found" }, 404);
  }
  return route.handle(body, url);
}
