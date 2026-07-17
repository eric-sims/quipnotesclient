import { mockApiRequest } from './mockApi.js';

// VITE_API_URL points at the real server; fall back to the local default so a
// missing/empty env doesn't produce "fetch('undefined/...')" surprises.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

// When VITE_OFFLINE is set, requests are served by the in-memory mock
// backend (mockApi.js) so the client runs with no server. See the
// `dev:offline` npm script / .env.offline.
export const IS_OFFLINE = import.meta.env.VITE_OFFLINE === 'true';

// One error type for every failure mode (HTTP !ok, unreachable server, bad
// JSON) so call sites can `catch` a single thing and show `error.message`
// instead of each re-implementing the response.ok / status dance.
export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function rawRequest(method, url, body) {
  if (IS_OFFLINE) {
    return mockApiRequest(method, url, body);
  }

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    return await fetch(`${API_URL}${url}`, options);
  } catch {
    // fetch only rejects on network-level failures (server down, DNS, CORS).
    throw new ApiError('Cannot reach the server. Is it running?', 0);
  }
}

// Centralized request: performs the call, parses the JSON body, and throws a
// clean ApiError on a non-2xx response so callers get either parsed data or a
// thrown error — never a raw Response to inspect.
async function request(method, url, body = null) {
  const response = await rawRequest(method, url, body);

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Some endpoints (e.g. submit) may answer with no body; leave data null.
  }

  if (!response.ok) {
    const message =
      (data && data.error) || `Request failed (status ${response.status})`;
    throw new ApiError(message, response.status);
  }

  return data;
}

// The game-scoped, join-only contract. The player joins an existing game (the
// manager creates/ends games) and then draws/submits within it. Each call
// returns parsed JSON (or throws ApiError); no caller touches fetch directly.
export const api = {
  getGame: (code) => request('GET', `/games/${code}`),
  joinGame: (code, id) =>
    request('POST', `/games/${code}/players`, { id: String(id) }),
  // Leave the game: removes the player from the server's roster so the host's
  // scoreboard drops them (the server broadcasts the updated `players` roster).
  leaveGame: (code, id) =>
    request('DELETE', `/games/${code}/players/${id}`),
  draw: (code, id, count) =>
    request('POST', `/games/${code}/draw`, { id: String(id), count }),
  submit: (code, id, note) =>
    request('POST', `/games/${code}/submit`, { id: String(id), note }),
  getTiles: (code, id) =>
    request('GET', `/games/${code}/players/${id}/tiles`),
  // Current round for the game: the full round state { round, prompt, judgeId,
  // judgingOpen, count, total, favoriteNoteId, winnerId } (round 0 before any
  // prompt).
  getRound: (code) => request('GET', `/games/${code}/round`),
  // Advance to the next prompt from a phone (so a game can run without the
  // host after creating it). `round` is the round being advanced *from*: the
  // server 409s a stale value (someone advanced first) instead of skipping a
  // prompt, and — while the round has a judge — only the judge may advance.
  // Returns the new RoundState.
  nextRound: (code, id, round) =>
    request('POST', `/games/${code}/rounds`, { id: String(id), round }),
  // --- Judge actions (used only by the round's judge) ---
  // The note board: { notes: [{ id, tokens, flipped }] } in the same shuffled
  // order every screen sees. Note ids are 1-based and stable for the round.
  getNotes: (code) => request('GET', `/games/${code}/submitted-notes`),
  // Force judging open before every player has answered (it opens
  // automatically when the last one submits).
  openJudging: (code) => request('POST', `/games/${code}/judging`),
  // Turn a note face-up. One-way; the server broadcasts note_flipped so the
  // host screen flips the same card.
  flipNote: (code, noteId) =>
    request('POST', `/games/${code}/notes/${noteId}/flip`),
  // Pick the round's favorite note: { winnerId }. Its author scores a point.
  pickFavorite: (code, noteId) =>
    request('POST', `/games/${code}/favorite`, { noteId }),
};
