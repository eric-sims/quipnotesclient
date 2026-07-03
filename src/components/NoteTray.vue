<template>
  <section class="note-tray" :class="{ 'note-tray--flash': flash }">
    <header class="note-tray__head">
      <h2 class="note-tray__title">Your note</h2>
      <div v-if="tiles.length > 0" class="note-tray__actions">
        <button
          type="button"
          class="link-btn"
          @click="$emit('add-break')"
        >
          + Add line
        </button>
        <button
          v-if="confirming"
          type="button"
          class="link-btn"
          @click="confirming = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="link-btn link-btn--danger"
          @click="onClear"
        >
          {{ confirming ? 'Confirm clear?' : 'Clear note' }}
        </button>
      </div>
    </header>

    <p v-if="tiles.length === 0" class="note-tray__hint">
      Tap tiles above to build your sentence — their order is the note.
    </p>

    <ol v-else class="note-tray__list">
      <li v-for="(tile, index) in tiles" :key="tile.id" class="note-tray__item">
        <button
          type="button"
          class="nudge"
          :disabled="index === 0"
          :aria-label="`Move ${labelFor(tile)} left`"
          @click="$emit('move', { id: tile.id, dir: -1 })"
        >
          ◀
        </button>
        <button
          v-if="tile.isBreak"
          type="button"
          class="break-chip"
          aria-label="Remove line break"
          title="Line break — tap to remove"
          @click="$emit('remove', tile.id)"
        >
          ↵ line
        </button>
        <WordTile
          v-else
          :word="tile.word"
          variant="note"
          @select="$emit('remove', tile.id)"
        />
        <button
          type="button"
          class="nudge"
          :disabled="index === tiles.length - 1"
          :aria-label="`Move ${labelFor(tile)} right`"
          @click="$emit('move', { id: tile.id, dir: 1 })"
        >
          ▶
        </button>
      </li>
    </ol>

    <p v-if="tiles.length > 0" class="note-tray__preview" aria-live="polite">
      <span class="note-tray__preview-label">Preview:</span>
      <span class="note-tray__preview-text">{{ preview }}</span>
    </p>
  </section>
</template>

<script>
import WordTile from './WordTile.vue';

// Notes at least this long ask for confirmation before being wiped.
const CONFIRM_THRESHOLD = 5;

export default {
  name: 'NoteTray',
  components: {
    WordTile,
  },
  props: {
    // Ordered tiles in the note: [{ id, word }].
    tiles: {
      type: Array,
      required: true,
      default: () => [],
    },
    // The assembled one-line sentence.
    preview: {
      type: String,
      default: '',
    },
    // Briefly highlights the tray (e.g. after a successful submit).
    flash: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['remove', 'move', 'clear', 'add-break'],
  data() {
    return {
      confirming: false,
    };
  },
  watch: {
    // If the note empties out (cleared/submitted), reset the confirm prompt.
    tiles(next) {
      if (next.length === 0) this.confirming = false;
    },
  },
  methods: {
    labelFor(tile) {
      return tile.isBreak ? 'line break' : tile.word;
    },
    onClear() {
      // Short notes clear immediately; long ones take a second confirming tap
      // (an inline, non-blocking confirm rather than window.confirm).
      if (this.tiles.length >= CONFIRM_THRESHOLD && !this.confirming) {
        this.confirming = true;
        return;
      }
      this.$emit('clear');
      this.confirming = false;
    },
  },
};
</script>

<style scoped>
.note-tray {
  width: 100%;
  margin-top: var(--space-4);
  padding: var(--space-4);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  transition: box-shadow 0.2s ease;
}

.note-tray--flash {
  animation: tray-flash 0.6s ease;
}

@keyframes tray-flash {
  0% {
    box-shadow: 0 0 0 0 var(--color-accent);
  }
  100% {
    box-shadow: var(--shadow-card);
  }
}

.note-tray__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.note-tray__title {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.note-tray__actions {
  display: flex;
  gap: var(--space-2);
}

.note-tray__hint {
  margin: var(--space-3) 0 0;
  color: var(--color-muted);
  font-size: 0.95rem;
}

.note-tray__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.note-tray__item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.nudge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  min-height: 44px;
  padding: 0;
  font-size: 0.85rem;
  color: var(--color-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color 0.12s ease, background-color 0.12s ease;
}

.nudge:hover:not(:disabled) {
  color: var(--color-text);
  background-color: var(--color-bg);
}

.nudge:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 1px;
}

.nudge:disabled {
  opacity: 0.25;
  cursor: default;
}

/* A line-break marker sitting inline in the note, tap to remove. Styled as a
   subtle "return" pill so it reads as a gap, not a word tile. */
.break-chip {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-2);
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-muted);
  background: repeating-linear-gradient(
    -45deg,
    var(--color-bg),
    var(--color-bg) 4px,
    var(--color-surface) 4px,
    var(--color-surface) 8px
  );
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color 0.12s ease, border-color 0.12s ease;
}

.break-chip:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.break-chip:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 1px;
}

.note-tray__preview {
  margin: var(--space-4) 0 0;
  padding-top: var(--space-3);
  border-top: 1px dashed var(--color-border);
  text-align: left;
}

.note-tray__preview-label {
  margin-right: var(--space-2);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
}

.note-tray__preview-text {
  font-family: var(--font-tile);
  font-weight: 700;
  color: var(--color-text);
}

.link-btn {
  padding: var(--space-1) var(--space-2);
  font-size: 0.85rem;
  color: var(--color-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color 0.12s ease, background-color 0.12s ease;
}

.link-btn:hover {
  background-color: var(--color-bg);
}

.link-btn--danger {
  color: var(--color-accent);
  font-weight: 600;
}

.link-btn:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 1px;
}
</style>
