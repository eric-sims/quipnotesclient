# quipnotesclient

Vue 3 client for the quipNotes game.

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run dev
```
Talks to the real server at `VITE_API_URL` (see `.env`, default `http://localhost:8081`).

### Run without a server (offline mode)
```
npm run dev:offline
```
Routes all API calls to an in-memory mock backend (`src/mockApi.js`) instead of
`fetch`, so the client runs with no server. Useful for UI work, demos, and
manual testing. State is persisted to `localStorage` and survives reloads. An
"Offline mode" badge appears in the UI so it's obvious you're on the mock.

### Compiles and minifies for production
```
npm run build
```
Preview the production build locally with `npm run preview`.

### Lints and fixes files
```
npm run lint
```

## Testing

Unit and component tests run on **Vitest** + **@vue/test-utils** (jsdom
environment). Run them with:

```
npm test          # single run
npm run test:watch  # watch mode
```

Tests live next to the code they cover (`src/**/*.test.js`). Current coverage:
the mock backend contract (`src/mockApi.test.js`), the `apiRequest` offline /
fetch dispatch (`src/api.test.js`), and all four components. jsdom doesn't
expose Web Storage here, so `src/test-setup.js` installs a small in-memory
`localStorage` polyfill that `mockApi.js` persists against.

### Manual / exploratory testing

Use offline mode so you can exercise the full UI without standing up a server:

```
npm run dev:offline
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

### Linting

Keep lint green before pushing — CI-style gate for style and obvious errors:

```
npm run lint
```

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
See the [Vite Configuration Reference](https://vite.dev/config/).
