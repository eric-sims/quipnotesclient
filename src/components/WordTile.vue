<template>
  <button
    type="button"
    class="tile"
    :class="[`tile--${variant}`, { 'tile--in-use': inUse }]"
    :style="{ '--rot': rotation + 'deg' }"
    :disabled="!clickable || inUse"
    @click="onClick"
  >
    {{ word }}
  </button>
</template>

<script>
export default {
  name: 'WordTile',
  props: {
    // The display word only — the "<id>|<word>" wire format is parsed away
    // before it reaches the view (see tiles.js / useGame).
    word: {
      type: String,
      required: true,
    },
    clickable: {
      type: Boolean,
      default: true,
    },
    // 'pool' tiles sit in the draw pool; 'note' tiles sit in the note tray.
    variant: {
      type: String,
      default: 'pool',
    },
    // A pool tile already placed in the note: shown dimmed, not clickable.
    inUse: {
      type: Boolean,
      default: false,
    },
    // Small per-tile rotation (deg) for the hand-cut "ransom note" jitter.
    rotation: {
      type: Number,
      default: 0,
    },
  },
  emits: ['select'],
  methods: {
    onClick() {
      if (this.clickable && !this.inUse) {
        this.$emit('select');
      }
    },
  },
};
</script>

<style scoped>
.tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px; /* comfortable mobile tap target */
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-tile);
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1;
  color: var(--color-tile-text);
  background-color: var(--color-tile);
  border: 1px solid var(--color-tile-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-tile);
  cursor: pointer;
  transform: rotate(var(--rot, 0deg));
  transition: transform 0.12s ease, box-shadow 0.12s ease,
    background-color 0.12s ease, opacity 0.12s ease;
}

.tile:hover {
  transform: rotate(0deg) translateY(-2px);
  box-shadow: var(--shadow-tile-hover);
}

.tile:active {
  transform: rotate(0deg) translateY(0) scale(0.97);
  box-shadow: var(--shadow-tile);
}

.tile:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

/* Note-tray tiles read as a continuous sentence: flatter, no jitter. */
.tile--note {
  transform: none;
  background-color: var(--color-tile-note);
}

.tile--in-use {
  opacity: 0.4;
  cursor: default;
  box-shadow: none;
  transform: rotate(0deg);
}

.tile:disabled {
  cursor: default;
}
</style>
