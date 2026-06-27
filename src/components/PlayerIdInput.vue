<template>
  <div class="player-id-input">
    <div class="player-id-input__row">
      <input
        type="text"
        v-model="inputValue"
        placeholder="Enter Player ID"
        aria-label="Player ID"
        @keydown.enter="setPlayerID"
        @input="error = ''"
        :disabled="isDisabled"
      />
      <button @click="setPlayerID" :disabled="isDisabled">
        Set Player ID
      </button>
    </div>
    <p v-if="error" class="player-id-input__error" role="alert">{{ error }}</p>
  </div>
</template>

<script>
export default {
  name: 'PlayerIDInput',
  props: {
    isDisabled: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['update-player-id'],
  data() {
    return {
      inputValue: '',
      error: '',
    };
  },
  methods: {
    setPlayerID() {
      if (this.isDisabled) return;
      if (this.inputValue.trim()) {
        this.error = '';
        this.$emit('update-player-id', this.inputValue.trim());
      } else {
        // Inline, non-blocking validation instead of alert().
        this.error = 'Player ID cannot be empty!';
      }
    },
  },
};
</script>

<style scoped>
.player-id-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;
}

.player-id-input__row {
  display: flex;
  gap: var(--space-2);
  width: 100%;
  max-width: 360px;
}

input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  min-height: 44px;
  font-family: var(--font-ui);
  font-size: 1rem;
  color: var(--color-text);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

input:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 1px;
}

button {
  padding: var(--space-2) var(--space-4);
  min-height: 44px;
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-accent-contrast);
  background-color: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

button:hover:not(:disabled) {
  background-color: var(--color-accent-strong);
}

button:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.player-id-input__error {
  margin: 0;
  color: var(--color-accent);
  font-size: 0.85rem;
}
</style>
