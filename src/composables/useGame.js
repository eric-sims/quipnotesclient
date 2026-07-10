import { ref, computed } from 'vue';
import { api, ApiError } from '../api.js';
import { parseTile, formatTile, BREAK_TILE, isBreakId, newBreakId } from '../tiles.js';

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

  // Round state. round is 0 until the host draws the first prompt.
  // hasSubmittedThisRound gates a player to one note per round.
  const round = ref(0);
  const prompt = ref('');
  const hasSubmittedThisRound = ref(false);

  // Judging state. Each round the server assigns one player as judge ("" when
  // the round has none, e.g. fewer than 2 players): the judge doesn't write a
  // note — they wait for everyone else, then flip the notes over and pick a
  // favorite, whose author scores a point.
  const judgeId = ref('');
  const judgingOpen = ref(false);
  const submissionCount = ref(0); // notes in so far this round
  const submissionTotal = ref(0); // players expected to answer (judge excluded)
  // The note board, fetched when this player judges: [{ id, tokens, flipped }]
  // in the server's shuffled display order (the same order the host shows).
  // Tokens stay in wire format here; JudgeNoteCard parses them at its boundary,
  // mirroring how the host's NoteSlate renders a note.
  const judgeNotes = ref([]);
  const favoriteNoteId = ref(0); // 1-based id of the picked note (0 = none yet)
  const winnerId = ref('');
  // Briefly true on the winner's own screen after a favorite is picked —
  // drives the confetti burst.
  const celebrate = ref(false);
  let celebrateTimer = null;

  const isJudge = computed(
    () => !!judgeId.value && judgeId.value === playerID.value
  );

  // Entries placed in the note, in order. Real tile ids resolve back to
  // { id, word }; break ids become { id, isBreak: true } (a line break the
  // player inserted between clusters).
  const noteTiles = computed(() =>
    noteIds.value
      .map((id) =>
        isBreakId(id) ? { id, isBreak: true } : pool.value.find((t) => t.id === id)
      )
      .filter(Boolean)
  );

  // The set of ids currently in the note, for marking pool tiles "in use".
  const usedIds = computed(() => new Set(noteIds.value));

  // Live one-line preview of the assembled note. Line breaks render as a " / "
  // separator so the player can see how their clusters split.
  const notePreview = computed(() =>
    noteTiles.value
      .map((t) => (t.isBreak ? '/' : t.word))
      .join(' ')
      .replace(/\s*\/\s*/g, ' / ')
      .trim()
  );

  // Tiles still available to place (not yet in the note).
  const remainingCount = computed(
    () => pool.value.filter((t) => !usedIds.value.has(t.id)).length
  );

  function setPool(rawTiles) {
    pool.value = (rawTiles || []).map(parseTile);
    // Drop any note ids whose tiles no longer exist (e.g. after a submit), but
    // keep break ids — they aren't tiles and belong to the note layout.
    const live = new Set(pool.value.map((t) => t.id));
    noteIds.value = noteIds.value.filter((id) => isBreakId(id) || live.has(id));
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

  // Reset everything scoped to a single round's judging phase.
  function resetJudgingState() {
    judgingOpen.value = false;
    submissionCount.value = 0;
    submissionTotal.value = 0;
    judgeNotes.value = [];
    favoriteNoteId.value = 0;
    winnerId.value = '';
    celebrate.value = false;
    if (celebrateTimer) {
      clearTimeout(celebrateTimer);
      celebrateTimer = null;
    }
  }

  // Clear everything tied to the current game but keep the player identity.
  function clearGameState() {
    gameCode.value = '';
    saveKey(GAME_CODE_KEY, '');
    pool.value = [];
    noteIds.value = [];
    round.value = 0;
    prompt.value = '';
    hasSubmittedThisRound.value = false;
    judgeId.value = '';
    resetJudgingState();
  }

  // Pull the current round state from the server. Used on join and, in offline
  // mode, on a poll interval (the WebSocket handles this online). Restores the
  // whole judging phase too, so a refreshed judge lands back mid-judging.
  //
  // Within a round the judging phase only ever advances, so apply the fields
  // monotonically: a response captured just before a judging_ready /
  // favorite_picked event landed must not regress the state that event set.
  // (setRound already resets everything when the round number changes.)
  async function fetchRound({ silent = true } = {}) {
    if (!gameCode.value) return;
    try {
      const data = await api.getRound(gameCode.value);
      if (!data) return;
      setRound(data.round, data.prompt, data.judgeId);
      if (data.judgingOpen) judgingOpen.value = true;
      submissionCount.value = Math.max(
        submissionCount.value,
        Number(data.count) || 0
      );
      if (Number(data.total)) submissionTotal.value = Number(data.total);
      if (Number(data.favoriteNoteId)) {
        favoriteNoteId.value = Number(data.favoriteNoteId);
      }
      if (data.winnerId) winnerId.value = data.winnerId;
      if (isJudge.value && judgingOpen.value && !judgeNotes.value.length) {
        await fetchNotes();
      }
    } catch (error) {
      handleGameError(error, { silent });
    }
  }

  // Apply a round snapshot. Advancing to a new round re-enables submission and
  // starts a fresh judging phase; the same round can be re-announced with a new
  // judge (the previous one left), which must not reset judging progress.
  function setRound(nextRound, nextPrompt, nextJudge) {
    const r = Number(nextRound) || 0;
    if (r !== round.value) {
      hasSubmittedThisRound.value = false;
      resetJudgingState();
    }
    round.value = r;
    prompt.value = nextPrompt || '';
    judgeId.value = nextJudge || '';
  }

  // Handle a server event pushed over the WebSocket (see socket.js).
  function handleRoundEvent(evt) {
    if (!evt || !evt.type) return;
    switch (evt.type) {
      case 'round_started':
        setRound(evt.round, evt.prompt, evt.judgeId);
        // The event carries no submission counts; the judge's waiting screen
        // shows them, so pull the full round state (count/total — and, for a
        // judge replaced mid-round, any judging already in progress).
        if (isJudge.value) fetchRound();
        break;
      case 'submission':
        // Live "n of m answered" — shown to the waiting judge.
        submissionCount.value = Number(evt.count) || 0;
        submissionTotal.value = Number(evt.total) || 0;
        break;
      case 'judging_ready':
        judgingOpen.value = true;
        if (isJudge.value) {
          fetchNotes();
          notify('All notes are in — start judging!', 'success');
        }
        break;
      case 'note_flipped':
        markFlipped(evt.noteId);
        break;
      case 'favorite_picked':
        applyFavorite(evt.noteId, evt.winnerId);
        break;
      case 'game_ended':
        clearGameState();
        notify('This game has ended.', 'error');
        break;
    }
  }

  // Record the round's winner. The winning author's own screen celebrates
  // (confetti); everyone gets the announcement toast. Idempotent: the judge
  // applies their pick locally and then receives the same reveal broadcast.
  function applyFavorite(noteId, winner) {
    if (favoriteNoteId.value === (Number(noteId) || 0) && winnerId.value === (winner || '')) {
      return;
    }
    favoriteNoteId.value = Number(noteId) || 0;
    winnerId.value = winner || '';
    markFlipped(noteId);
    if (!winner) return;
    if (winner === playerID.value) {
      celebrate.value = true;
      if (celebrateTimer) clearTimeout(celebrateTimer);
      celebrateTimer = setTimeout(() => (celebrate.value = false), 5000);
      notify('Your note won this round!', 'success');
    } else {
      notify(`${winner}'s note won this round!`, 'success');
    }
  }

  function markFlipped(noteId) {
    const note = judgeNotes.value.find((n) => n.id === Number(noteId));
    if (note) note.flipped = true;
  }

  // --- Judge actions ---

  // Fetch the note board (judge only). Notes arrive in the server's shuffled
  // display order, matching the host screen.
  async function fetchNotes({ silent = true } = {}) {
    if (!gameCode.value) return;
    try {
      const data = await api.getNotes(gameCode.value);
      judgeNotes.value = (data && data.notes) || [];
    } catch (error) {
      handleGameError(error, { silent });
    }
  }

  // The judge's override: start judging before every player has answered
  // (an AFK player shouldn't stall the round).
  async function forceJudging() {
    if (!requireGame() || !isJudge.value) return;
    try {
      await api.openJudging(gameCode.value);
      judgingOpen.value = true;
      await fetchNotes();
    } catch (error) {
      handleGameError(error);
    }
  }

  // Turn a note face-up. The server broadcasts note_flipped so the host screen
  // flips the same card; we also flip locally so the judge isn't waiting on
  // their own echo.
  async function flipNote(noteId) {
    if (!requireGame() || !isJudge.value || !judgingOpen.value) return;
    try {
      await api.flipNote(gameCode.value, noteId);
      markFlipped(noteId);
    } catch (error) {
      handleGameError(error);
    }
  }

  // Pick the favorite (one per round; the note must be face-up). The reveal
  // itself arrives for everyone via the favorite_picked broadcast, but apply
  // it locally too so the judge's screen never lags behind their own tap.
  async function pickFavorite(noteId) {
    if (!requireGame() || !isJudge.value || !judgingOpen.value) return;
    if (favoriteNoteId.value) return; // already picked this round
    try {
      const data = await api.pickFavorite(gameCode.value, noteId);
      applyFavorite(noteId, data && data.winnerId);
    } catch (error) {
      handleGameError(error);
    }
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
      hasSubmittedThisRound.value = false;
      // Pull any tiles this player already holds (e.g. a returning session)
      // and the current round/prompt so the banner shows immediately.
      await refreshTiles({ silent: true });
      await fetchRound({ silent: true });
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
    if (round.value === 0) {
      notify('Wait for the host to draw a prompt.', 'error');
      return;
    }
    if (isJudge.value) {
      notify("You're the judge this round — no note to write.", 'error');
      return;
    }
    if (judgingOpen.value) {
      notify('Judging has started — submissions are closed this round.', 'error');
      return;
    }
    if (hasSubmittedThisRound.value) {
      notify('You already answered this round.', 'error');
      return;
    }
    if (!noteTiles.value.some((t) => !t.isBreak)) {
      notify('Add some words to your note first.', 'error');
      return;
    }
    isSubmitting.value = true;
    try {
      const note = noteTiles.value.map((t) =>
        t.isBreak ? BREAK_TILE : formatTile(t)
      );
      await api.submit(gameCode.value, playerID.value, note);
      hasSubmittedThisRound.value = true;
      noteIds.value = [];
      // Re-fetch instead of splicing locally: the server is the source of
      // truth for which tiles remain.
      await refreshTiles({ silent: true });
      notify('Ransom note submitted!', 'success');
    } catch (error) {
      // 409 = the server rejected the submission as a rule conflict (no active
      // round / already answered). Surface it and lock the button, but don't
      // treat it as the game ending.
      if (error instanceof ApiError && error.status === 409) {
        hasSubmittedThisRound.value = true;
        notify(error.message, 'error');
      } else {
        handleGameError(error);
      }
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

  // Insert a line break at the end of the note. It's a movable, removable entry
  // like any tile (nudged with the same controls) and renders as a new line on
  // the host's slate.
  function addBreak() {
    noteIds.value = [...noteIds.value, newBreakId()];
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
    round,
    prompt,
    hasSubmittedThisRound,
    // judging state
    judgeId,
    judgingOpen,
    submissionCount,
    submissionTotal,
    judgeNotes,
    favoriteNoteId,
    winnerId,
    celebrate,
    // derived
    isJudge,
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
    addBreak,
    removeFromNote,
    moveTile,
    clearNote,
    refreshTiles,
    fetchRound,
    handleRoundEvent,
    // judge actions
    fetchNotes,
    forceJudging,
    flipNote,
    pickFavorite,
  };
}
