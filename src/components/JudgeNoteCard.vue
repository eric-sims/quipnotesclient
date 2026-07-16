<template>
  <div class="judge-card" :class="{ 'judge-card--picked': picked }">
    <!-- Face-down: tap to turn the note over. The flip is broadcast so the
         host screen turns the same card at the same time. -->
    <button
      v-if="!note.flipped"
      type="button"
      class="judge-card__cover"
      @click="$emit('flip', note.id)"
    >
      <span class="judge-card__hint">Tap to reveal</span>
    </button>

    <!-- Face-up: the note as word tiles, one row per cluster, plus the pick
         button while the round's favorite is still open. -->
    <template v-else>
      <div class="judge-card__note" :aria-label="ariaText">
        <span v-for="(line, li) in lines" :key="li" class="judge-card__line">
          <span
            v-for="word in line"
            :key="word.key"
            class="judge-card__magnet"
            :style="{ '--rot': word.rot + 'deg' }"
            >{{ word.text }}</span
          >
        </span>
      </div>
      <span v-if="picked" class="judge-card__badge">Favorite!</span>
      <button
        v-else-if="pickable"
        type="button"
        class="game-btn game-btn--primary judge-card__pick"
        @click="$emit('pick', note.id)"
      >
        Pick as favorite
      </button>
    </template>
  </div>
</template>

<script>
import { parseTile, isBreak } from '../tiles.js';

export default {
  name: 'JudgeNoteCard',
  props: {
    // One note off the board: { id, tokens, flipped }. Tokens are wire format
    // (tile keys plus break markers), parsed here at the boundary — the same
    // pattern as the host's NoteSlate.
    note: {
      type: Object,
      required: true,
    },
    // True when this note was picked as the round's favorite.
    picked: {
      type: Boolean,
      default: false,
    },
    // True while the judge may still pick a favorite (none chosen yet).
    pickable: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['flip', 'pick'],
  computed: {
    // Split the token list into clusters on each break; a running index gives
    // each magnet a stable, gentle jitter (deterministic, no re-render twitch).
    lines() {
      const out = [];
      let current = [];
      let i = 0;
      for (const token of this.note.tokens || []) {
        if (isBreak(token)) {
          if (current.length) out.push(current);
          current = [];
          continue;
        }
        const { word } = parseTile(token);
        current.push({ key: i, text: word, rot: ((i * 37) % 7) - 3 });
        i += 1;
      }
      if (current.length) out.push(current);
      return out;
    },
    ariaText() {
      return this.lines.map((line) => line.map((w) => w.text).join(' ')).join('. ');
    },
  },
};
</script>

<style scoped>
.judge-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 96px;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.05), transparent 60%),
    linear-gradient(160deg, #2c2f33 0%, #1c1e21 100%);
  border: 3px solid #0f1012;
  box-shadow:
    inset 0 0 0 2px rgba(255, 255, 255, 0.04),
    inset 0 2px 14px rgba(0, 0, 0, 0.6),
    var(--shadow-card);
}

.judge-card--picked {
  border-color: var(--color-accent);
  box-shadow:
    0 0 0 3px var(--color-accent),
    inset 0 2px 14px rgba(0, 0, 0, 0.6),
    var(--shadow-card);
}

/* The face-down cover fills the card and invites the tap. */
.judge-card__cover {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 72px;
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.78);
}

.judge-card__cover:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.judge-card__hint {
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.7;
}

.judge-card__cover:hover .judge-card__hint {
  opacity: 1;
}

.judge-card__note {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: center;
  width: 100%;
}

.judge-card__line {
  display: flex;
  flex-wrap: wrap;
  column-gap: var(--space-2);
  row-gap: var(--space-1);
  align-items: center;
  justify-content: center;
}

.judge-card__magnet {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-tile);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-tile-text);
  background-color: var(--color-tile);
  border: 1px solid var(--color-tile-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-tile);
  transform: rotate(var(--rot, 0deg));
}

.judge-card__badge {
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-tile);
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-accent-contrast);
  background-color: var(--color-accent);
  border-radius: var(--radius-sm);
}

.judge-card__pick {
  flex: 0 0 auto;
  max-width: none;
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  font-size: 0.95rem;
}
</style>
