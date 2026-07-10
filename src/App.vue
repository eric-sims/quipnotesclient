<template>
  <div class="table">
    <header class="masthead">
      <h1 class="app-title">quipNotes</h1>
      <p v-if="isOffline" class="offline-badge">Offline mode — no server</p>
    </header>

    <!-- Onboarding: collect Player ID + game code, then verify by joining. -->
    <Onboarding
      v-if="!inGame"
      :initial-player-id="playerID"
      :initial-code="initialCode"
      :is-joining="isJoining"
      @join="onJoin"
    />

    <!-- In a game: show the compact identity bar and the play surface. -->
    <template v-else>
      <GameBar :player="playerID" :code="gameCode" @leave="leaveGame" />

      <PromptBanner :round="round" :prompt="prompt" />

      <!-- Judge mode: this round's judge doesn't write a note — they wait for
           the others, then flip the notes over and pick a favorite. -->
      <JudgeView
        v-if="isJudge"
        :notes="judgeNotes"
        :judging-open="judgingOpen"
        :count="submissionCount"
        :total="submissionTotal"
        :favorite-note-id="favoriteNoteId"
        :winner-id="winnerId"
        @force="forceJudging"
        @flip="flipNote"
        @pick="pickFavorite"
      />

      <!-- Writing mode: draw tiles, arrange the note, submit. -->
      <template v-else>
        <p v-if="judgeId" class="pool-meta pool-meta--judge">
          {{ judgeId }} is judging this round.
        </p>

        <div class="controls">
          <button
            class="game-btn game-btn--ghost"
            :disabled="isDrawing"
            @click="draw"
          >
            {{ isDrawing ? 'Drawing…' : 'Draw' }}
          </button>
        </div>

        <p v-if="round === 0" class="pool-meta">
          Waiting for the host to draw a prompt…
        </p>
        <p v-else-if="winnerId" class="pool-meta">
          {{ winnerId }} won this round — waiting for the next prompt.
        </p>
        <p v-else-if="judgingOpen" class="pool-meta">
          Judging has started — watch the host screen!
        </p>
        <p v-else-if="hasSubmittedThisRound" class="pool-meta">
          Answer submitted — waiting for the judge.
        </p>
        <p class="pool-meta">{{ remainingCount }} tiles available</p>

        <TileContainer :tiles="pool" :used-ids="usedIds" @add="addToNote" />

        <NoteTray
          :tiles="noteTiles"
          :preview="notePreview"
          :flash="flash"
          @remove="removeFromNote"
          @move="onMove"
          @clear="clearNote"
          @add-break="addBreak"
        />

        <!-- Submit lives with the note, not next to Draw. -->
        <div class="submit-row">
          <button
            class="game-btn game-btn--primary"
            :disabled="isSubmitting || noteTiles.length === 0 || round === 0 || hasSubmittedThisRound || judgingOpen"
            @click="onSubmit"
          >
            {{ submitLabel }}
          </button>
        </div>
      </template>
    </template>

    <!-- Confetti on the winner's own screen when their note is picked. -->
    <ConfettiBurst v-if="celebrate" />

    <ToastStack :toasts="toasts" @dismiss="dismiss" />
  </div>
</template>

<script>
import { onMounted, onUnmounted, computed, ref, watch } from 'vue';
import TileContainer from './components/TileContainer.vue';
import Onboarding from './components/OnboardingScreen.vue';
import GameBar from './components/GameBar.vue';
import NoteTray from './components/NoteTray.vue';
import PromptBanner from './components/PromptBanner.vue';
import ToastStack from './components/ToastStack.vue';
import JudgeView from './components/JudgeView.vue';
import ConfettiBurst from './components/ConfettiBurst.vue';
import { IS_OFFLINE } from './api.js';
import { codeFromUrl } from './urlParams.js';
import { createGameSocket } from './socket.js';
import { useGame } from './composables/useGame.js';
import { useToasts } from './composables/useToasts.js';

// Offline mode has no server socket, so poll the current round on an interval.
const OFFLINE_POLL_MS = 1500;

export default {
  name: 'App',
  components: {
    TileContainer,
    Onboarding,
    GameBar,
    NoteTray,
    PromptBanner,
    ToastStack,
    JudgeView,
    ConfettiBurst,
  },
  setup() {
    const { toasts, notify, dismiss } = useToasts();
    const game = useGame({ notify });
    const flash = ref(false);

    // The play surface is unlocked only once both identity and game are set.
    const inGame = computed(() => !!game.playerID.value && !!game.gameCode.value);

    // Prefill the join form's code from a scanned QR deep link (?code=1234),
    // falling back to any persisted code. This only seeds the form field — the
    // joined-session gameCode ref is untouched, so a scan can't auto-join.
    const initialCode = computed(() => codeFromUrl() || game.gameCode.value);

    onMounted(game.init);

    // --- Round event stream: WebSocket online, poll the mock offline. ---
    let socket = null;
    let pollTimer = null;

    function stopStream() {
      if (socket) {
        socket.close();
        socket = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function startStream(code) {
      stopStream();
      if (!code) return;
      if (IS_OFFLINE) {
        game.fetchRound();
        pollTimer = setInterval(() => game.fetchRound(), OFFLINE_POLL_MS);
      } else {
        socket = createGameSocket(code, (evt) => game.handleRoundEvent(evt));
      }
    }

    // Follow the joined game: open/close the stream as the code changes.
    watch(game.gameCode, (code) => startStream(code), { immediate: true });
    onUnmounted(stopStream);

    const submitLabel = computed(() => {
      if (game.isSubmitting.value) return 'Submitting…';
      if (game.hasSubmittedThisRound.value) return 'Answer submitted';
      if (game.judgingOpen.value) return 'Judging in progress';
      return 'Submit note';
    });

    // The onboarding screen submits both fields at once: set the local identity,
    // then join (which verifies the code against the server).
    async function onJoin({ playerId, code }) {
      game.setPlayerID(playerId);
      await game.joinGame(code);
    }

    function onMove({ id, dir }) {
      game.moveTile(id, dir);
    }

    async function onSubmit() {
      const before = game.noteTiles.value.length;
      await game.submit();
      // Brief celebratory flash when the note actually went through.
      if (before > 0 && game.noteTiles.value.length === 0) {
        flash.value = true;
        setTimeout(() => (flash.value = false), 600);
      }
    }

    return {
      isOffline: IS_OFFLINE,
      toasts,
      dismiss,
      flash,
      inGame,
      initialCode,
      submitLabel,
      onJoin,
      onMove,
      onSubmit,
      ...game,
    };
  },
};
</script>

<style>
:root {
  /* --- Spacing scale --- */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;

  /* --- Radius & shadow --- */
  --radius-sm: 6px;
  --radius-md: 12px;
  --shadow-tile: 1px 2px 4px rgba(0, 0, 0, 0.16);
  --shadow-tile-hover: 2px 4px 10px rgba(0, 0, 0, 0.22);
  --shadow-card: 0 6px 20px rgba(0, 0, 0, 0.08);

  /* --- Typography --- */
  --font-ui: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial,
    sans-serif;
  --font-tile: 'Courier New', ui-monospace, 'SF Mono', Menlo, monospace;

  /* --- Light palette (paper) --- */
  --color-bg: #f3efe6;
  --color-surface: #ffffff;
  --color-text: #2b2b2b;
  --color-muted: #7a7468;
  --color-border: #e4ddcf;

  --color-accent: #c0392b; /* ransom red */
  --color-accent-strong: #a5301f;
  --color-accent-contrast: #ffffff;
  --color-success: #2e7d52;
  --color-focus: #3a6ea5;

  --color-tile: #fffdf7;
  --color-tile-note: #fbf3e4;
  --color-tile-text: #1a1a1a;
  --color-tile-border: #e0d8c6;

  --color-toast-bg: #2b2b2b;
  --color-toast-text: #f7f4ee;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1b1a17;
    --color-surface: #262420;
    --color-text: #ece7db;
    --color-muted: #a39a89;
    --color-border: #3a352d;

    --color-accent: #e05a4a;
    --color-accent-strong: #f06a59;
    --color-accent-contrast: #1b1a17;
    --color-success: #5cc08a;
    --color-focus: #7aa7d6;

    --color-tile: #f3ecdd;
    --color-tile-note: #e7dcc4;
    --color-tile-text: #1a1a1a;
    --color-tile-border: #cabfa8;

    --color-toast-bg: #f3ecdd;
    --color-toast-text: #1b1a17;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background-color: var(--color-bg);
  /* Subtle layered tint for a soft "paper" surface, no image asset needed. */
  background-image: radial-gradient(
    circle at 20% 10%,
    rgba(255, 255, 255, 0.5),
    transparent 60%
  );
  background-attachment: fixed;
}

#app {
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: var(--color-text);
}

.table {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.masthead {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.app-title {
  margin: 0;
  font-family: var(--font-tile);
  font-size: clamp(1.8rem, 6vw, 2.6rem);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.offline-badge {
  display: inline-block;
  margin: 0;
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-tile);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-accent-contrast);
  background-color: var(--color-accent);
  border-radius: var(--radius-sm);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: center;
  width: 100%;
}

.submit-row {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: var(--space-3);
}

.submit-row .game-btn {
  flex: 1 1 240px;
}

.game-btn {
  flex: 1 1 160px;
  max-width: 240px;
  min-height: 48px;
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-ui);
  font-size: 1.05rem;
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.2s ease, opacity 0.2s ease,
    transform 0.1s ease;
}

.game-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.game-btn--primary {
  color: var(--color-accent-contrast);
  background-color: var(--color-accent);
}

.game-btn--primary:hover:not(:disabled) {
  background-color: var(--color-accent-strong);
}

.game-btn--ghost {
  color: var(--color-text);
  background-color: var(--color-surface);
  border-color: var(--color-border);
}

.game-btn--ghost:hover:not(:disabled) {
  border-color: var(--color-muted);
}

.game-btn:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.game-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pool-meta {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-muted);
}

/* Who's judging — slightly louder than the other meta lines so players know
   whose favor they're writing for. */
.pool-meta--judge {
  font-family: var(--font-tile);
  font-weight: 700;
  color: var(--color-text);
}
</style>
