# quipnotesclient

Vue 3 client for the quipNotes game.

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```
Talks to the real server at `VUE_APP_API_URL` (see `.env`, default `http://localhost:8081`).

### Run without a server (offline mode)
```
npm run serve:offline
```
Routes all API calls to an in-memory mock backend (`src/mockApi.js`) instead of
`fetch`, so the client runs with no server. Useful for UI work, demos, and
manual testing. State is persisted to `localStorage` and survives reloads. An
"Offline mode" badge appears in the UI so it's obvious you're on the mock.

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

## Testing

This project does not yet have an automated test runner wired up. The sections
below cover what's available today and the recommended setup for adding one.

### Manual / exploratory testing (available now)

Use offline mode so you can exercise the full UI without standing up a server:

```
npm run serve:offline
```

Then walk the core flows:

- **Set Player ID** → the badge and player ID display appear.
- **Draw 10 Tiles / Draw 1 Tile** → tiles render; drawing again appends.
- **Select tiles** → they move to the selected list; removing returns them.
- **Submit Ransom Note** → submitted tiles disappear from the board.
- **Reload the page** → drawn tiles persist (localStorage).

Reset mock state between runs:

```js
// in the browser devtools console
localStorage.removeItem('quipnotes.mock.v1')
```

or just use a private/incognito window for a clean slate.

### Linting (available now)

Keep lint green before pushing — CI-style gate for style and obvious errors:

```
npm run lint
```

### Recommended: unit & component tests (not yet set up)

For Vue 3 + Vue CLI, the recommended stack is **Vitest** + **@vue/test-utils**.
To add it:

```
npm install -D vitest @vue/test-utils @vue/vue3-jest jsdom
```

Then add a script to `package.json`:

```json
"scripts": {
  "test:unit": "vitest"
}
```

Suggested first targets, in priority order:

1. **`src/mockApi.js`** — pure logic with no DOM, the easiest high-value win.
   Cover: drawing appends N tiles and returns the full set; submitting removes
   exactly the submitted tiles; tile IDs stay unique; persistence round-trips
   through a mocked `localStorage`; unknown routes return `404`.
2. **`src/api.js`** — assert it dispatches to the mock when `IS_OFFLINE` and
   calls `fetch` otherwise (mock `global.fetch`).
3. **Components** (`WordTile`, `TileContainer`, `SelectedWords`,
   `PlayerIdInput`) — mount with `@vue/test-utils`, assert rendering and that
   the right events (`tile-selected`, `update-player-id`, …) fire on
   interaction. Note `WordTile` displays `word.split("|")[1]`, so feed it
   `"<id>|<word>"` strings.

### Best practices

- **Test against the contract, not the server.** The four endpoints
  (`POST /players`, `POST /game/draw`, `POST /game/submit`,
  `GET /players/:id/tiles`) are the seam. `mockApi.js` already encodes that
  contract — keep it and the real server in sync so offline tests stay
  meaningful.
- **Keep logic out of components.** Game rules in `mockApi.js` are testable
  without a DOM; favor that over asserting through the UI.
- **Make tests deterministic.** `mockApi.js` uses `Math.random()` for draws —
  stub it (or assert on counts/shape rather than specific words) so tests don't
  flake.
- **Reset state between tests.** Clear `localStorage` (or the `players` map) in
  a `beforeEach` so cases don't leak into each other.

## Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
