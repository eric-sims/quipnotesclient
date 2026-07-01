<template>
  <div class="game-bar">
    <span class="game-bar__group">
      <span class="game-bar__label">Player</span>
      <span class="game-bar__player">{{ player }}</span>
    </span>
    <span class="game-bar__group">
      <span class="game-bar__label">Game</span>
      <span class="game-bar__code">{{ code }}</span>
    </span>
    <button class="game-bar__leave" @click="$emit('leave')" title="Leave this game">
      Leave
    </button>
  </div>
</template>

<script>
export default {
  name: 'GameBar',
  props: {
    player: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
  },
  emits: ['leave'],
};
</script>

<style scoped>
.game-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2) var(--space-4);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.game-bar__group {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2);
}

.game-bar__label {
  color: var(--color-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.game-bar__player {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

.game-bar__code {
  font-family: var(--font-tile);
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--color-text);
}

.game-bar__leave {
  margin-left: auto;
  padding: 2px var(--space-2);
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-muted);
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.game-bar__leave:hover {
  color: var(--color-text);
  border-color: var(--color-muted);
}
</style>
