import { ref, computed } from 'vue';
import { api, ApiError } from '../api.js';
import { parseTile, formatTile } from '../tiles.js';

// Persist the Player ID so a refresh doesn't drop the session (the mock
// already persists tiles; without this the id was lost on reload).
const PLAYER_ID_KEY = 'quipnotes.playerId';

// How many tiles a single Draw deals (inclusive range).
const DRAW_MIN = 3;
const DRAW_MAX = 12;

function loadPlayerId() {
  try {
    return window.localStorage.getItem(PLAYER_ID_KEY) || '';
  } catch {
    return '';
  }
}

function savePlayerId(id) {
  try {
    window.localStorage.setItem(PLAYER_ID_KEY, id);
  } catch {
    // localStorage can throw in private-mode / sandboxed contexts; ignore.
  }
}

function randomDrawCount() {
  return Math.floor(Math.random() * (DRAW_MAX - DRAW_MIN + 1)) + DRAW_MIN;
}

// All game state and the operations on it, kept out of the components so the
// rules are testable without a DOM. `notify(message, type)` lets the caller
// surface user-facing messages (toasts) without this layer knowing about UI.
export function useGame({ notify = () => {} } = {}) {
  const playerID = ref(loadPlayerId());
  const pool = ref([]); // every tile the player holds: [{ id, word }]
  const noteIds = ref([]); // ordered tile ids — the order *is* the sentence
  const isDrawing = ref(false);
  const isSubmitting = ref(false);

  // Tiles placed in the note, in order, resolved back to { id, word }.
  const noteTiles = computed(() =>
    noteIds.value
      .map((id) => pool.value.find((t) => t.id === id))
      .filter(Boolean)
  );

  // The set of ids currently in the note, for marking pool tiles "in use".
  const usedIds = computed(() => new Set(noteIds.value));

  // Live one-line preview of the assembled note.
  const notePreview = computed(() =>
    noteTiles.value.map((t) => t.word).join(' ')
  );

  // Tiles still available to place (not yet in the note).
  const remainingCount = computed(
    () => pool.value.filter((t) => !usedIds.value.has(t.id)).length
  );

  function setPool(rawTiles) {
    pool.value = (rawTiles || []).map(parseTile);
    // Drop any note ids whose tiles no longer exist (e.g. after a submit).
    const live = new Set(pool.value.map((t) => t.id));
    noteIds.value = noteIds.value.filter((id) => live.has(id));
  }

  function messageFor(error) {
    return error instanceof ApiError
      ? error.message
      : 'Something went wrong. Please try again.';
  }

  function requirePlayer() {
    if (!playerID.value) {
      notify('Set your Player ID first.', 'error');
      return false;
    }
    return true;
  }

  async function refreshTiles({ silent = false } = {}) {
    if (!playerID.value) return;
    try {
      const data = await api.getTiles(playerID.value);
      setPool(data && data.words);
    } catch (error) {
      if (!silent) notify(messageFor(error), 'error');
    }
  }

  async function setPlayerID(id) {
    const trimmed = String(id).trim();
    if (!trimmed) {
      notify('Enter a Player ID first.', 'error');
      return;
    }
    try {
      await api.createPlayer(trimmed);
      playerID.value = trimmed;
      savePlayerId(trimmed);
      // Pull any tiles this player already holds (e.g. a returning session).
      await refreshTiles({ silent: true });
    } catch (error) {
      notify(messageFor(error), 'error');
    }
  }

  async function draw() {
    if (!requirePlayer() || isDrawing.value) return;
    isDrawing.value = true;
    try {
      const count = randomDrawCount();
      const data = await api.draw(playerID.value, count);
      setPool(data && data.words);
      notify(`Drew ${count} tiles.`, 'success');
    } catch (error) {
      notify(messageFor(error), 'error');
    } finally {
      isDrawing.value = false;
    }
  }

  async function submit() {
    if (!requirePlayer() || isSubmitting.value) return;
    if (noteIds.value.length === 0) {
      notify('Add some words to your note first.', 'error');
      return;
    }
    isSubmitting.value = true;
    try {
      const note = noteTiles.value.map(formatTile);
      await api.submit(playerID.value, note);
      noteIds.value = [];
      // Re-fetch instead of splicing locally: the server is the source of
      // truth for which tiles remain.
      await refreshTiles({ silent: true });
      notify('Ransom note submitted!', 'success');
    } catch (error) {
      notify(messageFor(error), 'error');
    } finally {
      isSubmitting.value = false;
    }
  }

  // --- Note construction (order matters) ---

  function addToNote(id) {
    if (!noteIds.value.includes(id)) {
      noteIds.value = [...noteIds.value, id];
    }
  }

  function removeFromNote(id) {
    noteIds.value = noteIds.value.filter((x) => x !== id);
  }

  // dir: -1 to nudge left, +1 to nudge right. No-op at the ends.
  function moveTile(id, dir) {
    const from = noteIds.value.indexOf(id);
    const to = from + dir;
    if (from === -1 || to < 0 || to >= noteIds.value.length) return;
    const next = noteIds.value.slice();
    [next[from], next[to]] = [next[to], next[from]];
    noteIds.value = next;
  }

  function clearNote() {
    noteIds.value = [];
  }

  // Restore a persisted session on startup.
  async function init() {
    await refreshTiles({ silent: true });
  }

  return {
    // state
    playerID,
    pool,
    isDrawing,
    isSubmitting,
    // derived
    noteTiles,
    usedIds,
    notePreview,
    remainingCount,
    // actions
    init,
    setPlayerID,
    draw,
    submit,
    addToNote,
    removeFromNote,
    moveTile,
    clearNote,
    refreshTiles,
  };
}
