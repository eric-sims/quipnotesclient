# Quipnotes — player client

The phone-facing **player client** for [Quipnotes](#the-system), a party game where you
arrange word tiles into a "ransom note" answering a prompt. A player enters their name and
the 4-digit game code from the host, then draws tiles, assembles and submits a note each
round, and — when it's their turn to judge — flips the notes face-up and picks a favorite.

Built with **Vue 3 + Vite**. It's a pure client: the [game server](#the-system) owns all
state, and this app talks to it over REST plus a live WebSocket event stream.

## The system

Quipnotes is three independently-versioned projects (each its own git repo):

| Project | Role |
| --- | --- |
| `quipnotes` | Go + Gin game server — the source of truth for all game state |
| **`quipnotesclient`** (this repo) | Player client — join with a name + code, draw, submit, judge |
| `quipnotesmanager` | Host/manager client — start a game, show the code, drive the board |

## Quick start

```bash
npm install
npm run dev            # dev server on http://localhost:8080
```

`npm run dev` talks to the real backend at `VITE_API_URL` (default
`http://localhost:8081` — start the `quipnotes` server first).

### Run without a server (offline mode)

```bash
npm run dev:offline
```

Routes every API call to an in-memory mock backend ([`src/mockApi.js`](src/mockApi.js))
instead of `fetch`, so the client runs with **no server** — ideal for UI work, demos, and
manual testing. Because there's no host to start a game, the mock **auto-creates a game on
first contact with a code**, and offline rounds are always judge-less. State persists to
`localStorage` and survives reloads, and an "Offline mode" badge shows in the UI so it's
obvious you're on the mock.

### Other scripts

```bash
npm run build          # production build (Vite)
npm run preview        # preview the production build locally
npm run lint           # eslint --fix — keep this green before pushing
npm test               # Vitest, single run
npm run test:watch     # Vitest, watch mode
```

## Configuration

Vite loads these from mode-specific `.env` files:

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `.env`, `.env.production` | Backend base URL. The WebSocket URL is derived from it (`http`→`ws`), so `https` yields a secure `wss`. |
| `VITE_OFFLINE` | `.env.offline` | `true` routes all calls to `mockApi.js` (set by `dev:offline`). |

## Architecture

The app is layered so the game rules stay out of the components and can be tested without a
DOM:

- **`src/api.js`** — one `request()` wrapper that returns parsed data or throws a single
  `ApiError` for every failure. When `VITE_OFFLINE=true` it routes to `mockApi.js`. The
  exported `api` object is the game-scoped, join-only surface (`getGame`, `joinGame`,
  `draw`, `submit`, `getTiles`, `getRound`, `nextRound`, and the judge actions `getNotes`,
  `openJudging`, `flipNote`, `pickFavorite`).
- **`src/composables/useGame.js`** — **all game state and rules**: draw count (3–12), note
  ordering, one-note-per-round submit gating, round state, and the judging/scoring state
  (judge, judging-open, live submission counts, the note board, favorite, winner, and the
  confetti trigger). Treats a `404` as "this game ended" and returns to the join screen.
- **`src/socket.js`** — a resilient `WebSocket` wrapper with backoff reconnect. `App.vue`
  opens it when a game is joined (online) or falls back to polling `getRound` (offline) and
  feeds events to `useGame.handleRoundEvent`.
- **`src/mockApi.js`** — the in-memory offline backend, persisted to `localStorage`
  (key `quipnotes.mock.v2`); mirrors the server's contract.
- **`src/tiles.js`** — parses the `"<id>|<word>"` tile wire format (and the `"\n"` break
  token) at the boundary so raw strings never leak into views.
- **`src/components/`** — presentational only. Judge mode swaps the writing surface for
  `JudgeView.vue` (waiting screen → face-down board → "Next round"), and `ConfettiBurst.vue`
  is the pure-CSS winner confetti.

The player, manager, and server all speak the same wire protocol; keep `mockApi.js` in sync
with the server whenever an endpoint changes.

## Testing

Unit and component tests run on **Vitest** + **@vue/test-utils** (jsdom). Tests sit next to
the code they cover (`src/**/*.test.js`).

```bash
npm test               # single run
npm run test:watch     # watch mode
```

Guidelines:

- **Test the contract, not the server.** `mockApi.js` and `useGame.js` encode the game
  rules — assert against those rather than driving the DOM.
- **Keep draws deterministic.** Draws use `Math.random()`; stub it, or assert on
  counts/shape rather than specific words, so tests don't flake.
- **Reset state between tests.** Clear `localStorage` in a `beforeEach` so cases don't leak.
  jsdom doesn't provide Web Storage here, so `src/test-setup.js` installs an in-memory
  polyfill that `mockApi.js` persists against.

To reset the offline mock manually, run `localStorage.removeItem('quipnotes.mock.v2')` in
the devtools console, or just use a private window.

## Development notes

This is its own git repo — branch off the latest `master` and open a PR rather than
committing straight to `master`. See [Vite Configuration Reference](https://vite.dev/config/)
to customize the build.

## License

The code in this repository is licensed under the [MIT License](LICENSE).

The Ransom Notes word tiles and prompt cards are **proprietary** to Very Special Games and
are **not** covered by this license — none are committed here. Offline mode uses a built-in
curated word bank instead.
