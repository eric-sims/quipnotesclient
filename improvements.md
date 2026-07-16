# quipNotes client — improvements

Legend: **[now]** = client-only, doable today · **[server]** = needs server
changes later · priorities P1 (high) → P3 (nice-to-have).

## 1. Visual redesign — modern "paper" theme
Goal: ditch the wood-grain skin for a clean, minimalist look that keeps a
tasteful nod to the cut-out / magnet-tile ransom-note vibe. Mobile-first.

- **[now] P1** Replace the wood `body` background with a calm neutral surface
  (soft off-white / paper texture or flat light-grey). Remove `bin/wood.jpg`.
- **[now] P1** Introduce CSS custom properties (design tokens) for color,
  spacing, radius, shadow in one place (`:root`) instead of hard-coded hex
  values scattered across components (`#2c3e50`, `#dadada`, `#007bff`, …).
- **[now] P1** Tiles styled as modern "cut-out" word tiles: subtle paper shadow,
  slight rotation/jitter for character, clear pressed/selected state, large tap
  targets (≥44px) for mobile.
- **[now] P2** Adopt one type system: a clean UI font for chrome + a single
  accent (mono or stencil) reserved for the tiles themselves, rather than
  `Courier` everywhere.
- **[now] P2** Responsive, mobile-first layout: fluid buttons (not fixed 200px),
  sensible breakpoints, tile pool and note tray stack cleanly on phones.
- **[now] P3** Light/dark friendly palette via tokens; respect
  `prefers-color-scheme`. (Commented out for now because the author doesn't like the color scheme.)
- **[now] P3** Polish: focus-visible outlines, hover/active transitions, an empty
  state for the tile pool before the first draw.

## 2. Tile & sentence-construction UX
Goal: let players actually *build a sentence* (order matters), with a flow that
works great on a phone.

- **[now] P1** Replace `Draw 1` / `Draw 10` with a single **Draw** button that
  draws a random number of tiles between **3 and 12**. (Mock supports any
  `count`; real server already takes `count`.)
- **[now] P1** **Ordered note tray.** Selected tiles go into a dedicated note
  area where their **order is the sentence**. Show a live one-line preview of the
  assembled note.
- **[now] P1** **Reordering.** Let players rearrange tiles in the tray. Mobile-
  friendly approach (recommend: tap-to-place + drag handle / long-press drag,
  with left/right "nudge" as a fallback) rather than desktop-only drag-drop.
- **[now] P1** Tap a tray tile to remove it (return to pool); tapped pool tiles
  show as "in use." Today `selectWord` only de-dupes and never reorders
  (`App.vue:101-105`).
- **[now] P2** **Clear / reset note** button; confirm before wiping a long note.
- **[now] P2** Replace all blocking `alert()`s with inline, non-blocking
  toasts/banners (errors, "set Player ID first", "select words first").
- **[now] P2** Loading + disabled states on Draw / Submit while a request is in
  flight; prevent double-submits.
- **[now] P3** Optional: duplicate-word handling cue, small count of tiles
  remaining, subtle success animation on submit.
- **[server] P2** Per-tile drawing vs. returning the full hand: `/game/draw`
  currently returns the player's *entire* tile list each call; a delta/hand
  model would simplify client state. (Note for later server work.)

## 3. Code robustness
Goal: make the client easier to evolve as the game grows.

- **[now] P1** Persist Player ID to `localStorage` so a refresh doesn't drop the
  session (mock already persists tiles; the ID is lost on reload — `App.vue:59`).
- **[now] P1** Centralize fetch error handling in `api.js` (parse JSON, throw on
  `!ok`, surface a clean message) so each call site isn't re-implementing the
  `response.ok` / `alert` dance (`App.vue` draw/submit/getTiles).
- **[now] P2** Decouple the `"<id>|<word>"` tile format. WordTile reaches in with
  `word.split("|")[1]` (`WordTile.vue:29`); pass a structured `{ id, word }` so
  the wire format isn't baked into the view.
- **[now] P2** Remove leftover/debug code: `console.log("Clicked: …")` in
  `WordTile.vue:36`, and reconcile `removeFromWordList` usage after submit with
  the post-submit `getTiles()` refetch (`App.vue:112,140`) — today it both
  splices locally *and* refetches.
- **[now] P3** Default/validate `VITE_API_URL`; show a friendly message when the
  server is unreachable instead of a raw fetch error.
- **[now] P3** Extract a small composable/store for game state if the note-tray
  work grows `App.vue` further.

## Out of scope for now (needs server — capture later)
Tracked but deferred per current focus: **prompt cards** to respond to, **rounds
& phases** (draw → compose → submit → read → vote), a **read/vote screen** (the
Quiplash judging step the server README TODO calls out), **lobbies/rooms**,
**timer**, and **scoreboard**. These define the multiplayer game and will each
need server endpoints + real-time updates.
