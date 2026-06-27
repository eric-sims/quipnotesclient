import { ref, computed } from 'vue';
import { api, ApiError } from '../api.js';
import { parseTile, formatTile } from '../tiles.js';

// Persist the Player ID and the joined game code so a refresh doesn't drop the
// session (the mock already persists tiles).
const PLAYER_ID_KEY = 'quipnotes.playerId';
const GAME_CODE_KEY = 'quipnotes.gameCode';

// How many tiles a single Draw deals (inclusive range).
const DRAW_MIN = 3;
const DRAW_MAX = 12;

// A valid game code is exactly four digits.
const CODE_RE = /^\d{4}$/;

function loadKey(key) {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function saveKey(key, value) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
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
  const playerID = ref(loadKey(PLAYER_ID_KEY));
  const gameCode = ref(loadKey(GAME_CODE_KEY));
  const pool = ref([]); // every tile the player holds: [{ id, word }]
  const noteIds = ref([]); // ordered tile ids — the order *is* the sentence
  const isJoining = ref(false);
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

  function requireGame() {
    if (!gameCode.value) {
      notify('Join a game first.', 'error');
      return false;
    }
    return true;
  }

  // Centralized error handling: a 404 means the game is gone (the host ended
  // it), so bounce the player back to the join screen. Otherwise surface the
  // message unless the caller asked to stay silent.
  function handleGameError(error, { silent = false } = {}) {
    if (error instanceof ApiError && error.status === 404 && gameCode.value) {
      clearGameState();
      notify('This game has ended.', 'error');
      return;
    }
    if (!silent) notify(messageFor(error), 'error');
  }

  // Clear everything tied to the current game but keep the player identity.
  function clearGameState() {
    gameCode.value = '';
    saveKey(GAME_CODE_KEY, '');
    pool.value = [];
    noteIds.value = [];
  }

  async function refreshTiles({ silent = false } = {}) {
    if (!playerID.value || !gameCode.value) return;
    try {
      const data = await api.getTiles(gameCode.value, playerID.value);
      setPool(data && data.words);
    } catch (error) {
      handleGameError(error, { silent });
    }
  }

  // Set the local player identity. Registration with the server happens on
  // join (the manager owns game creation), so this is purely local.
  function setPlayerID(id) {
    const trimmed = String(id).trim();
    if (!trimmed) {
      notify('Enter a Player ID first.', 'error');
      return;
    }
    playerID.value = trimmed;
    saveKey(PLAYER_ID_KEY, trimmed);
  }

  async function joinGame(rawCode) {
    if (!requirePlayer() || isJoining.value) return;
    const code = String(rawCode).trim();
    if (!CODE_RE.test(code)) {
      notify('Enter a 4-digit game code.', 'error');
      return;
    }
    isJoining.value = true;
    try {
      // Verify the game exists for a clear error, then register as a player.
      await api.getGame(code);
      await api.joinGame(code, playerID.value);
      gameCode.value = code;
      saveKey(GAME_CODE_KEY, code);
      // Pull any tiles this player already holds (e.g. a returning session).
      await refreshTiles({ silent: true });
      notify(`Joined game ${code}.`, 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        notify(`Game ${code} not found.`, 'error');
      } else {
        notify(messageFor(error), 'error');
      }
    } finally {
      isJoining.value = false;
    }
  }

  // Leave the current game locally and return to the join screen.
  function leaveGame() {
    clearGameState();
  }

  async function draw() {
    if (!requirePlayer() || !requireGame() || isDrawing.value) return;
    isDrawing.value = true;
    try {
      const count = randomDrawCount();
      const data = await api.draw(gameCode.value, playerID.value, count);
      setPool(data && data.words);
      notify(`Drew ${count} tiles.`, 'success');
    } catch (error) {
      handleGameError(error);
    } finally {
      isDrawing.value = false;
    }
  }

  async function submit() {
    if (!requirePlayer() || !requireGame() || isSubmitting.value) return;
    if (noteIds.value.length === 0) {
      notify('Add some words to your note first.', 'error');
      return;
    }
    isSubmitting.value = true;
    try {
      const note = noteTiles.value.map(formatTile);
      await api.submit(gameCode.value, playerID.value, note);
      noteIds.value = [];
      // Re-fetch instead of splicing locally: the server is the source of
      // truth for which tiles remain.
      await refreshTiles({ silent: true });
      notify('Ransom note submitted!', 'success');
    } catch (error) {
      handleGameError(error);
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

  // Clear all local state so the user can register with a new server session.
  function resetPlayer() {
    saveKey(PLAYER_ID_KEY, '');
    playerID.value = '';
    clearGameState();
  }

  return {
    // state
    playerID,
    gameCode,
    pool,
    isJoining,
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
    resetPlayer,
    joinGame,
    leaveGame,
    draw,
    submit,
    addToNote,
    removeFromNote,
    moveTile,
    clearNote,
    refreshTiles,
  };
}
