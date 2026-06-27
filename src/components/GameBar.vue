<template>
  <div class="game-bar">
    <span class="game-bar__label">Game</span>
    <span class="game-bar__code">{{ code }}</span>
    <button class="game-bar__leave" @click="$emit('leave')" title="Leave this game">
      Leave
    </button>
  </div>
</template>

<script>
export default {
  name: 'GameBar',
  props: {
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
  align-items: center;
  gap: var(--space-3);
}

.game-bar__label {
  color: var(--color-muted);
  font-size: 0.85rem;
}

.game-bar__code {
  font-family: var(--font-tile);
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--color-text);
}

.game-bar__leave {
  margin-left: var(--space-2);
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
