<template>
  <div class="game-join">
    <p class="game-join__hint">Enter the 4-digit code from your host to join.</p>
    <div class="game-join__row">
      <input
        type="text"
        inputmode="numeric"
        maxlength="4"
        v-model="inputValue"
        placeholder="0000"
        aria-label="Game code"
        @keydown.enter="join"
        @input="onInput"
        :disabled="isDisabled"
      />
      <button @click="join" :disabled="isDisabled">
        {{ isDisabled ? 'Joining…' : 'Join game' }}
      </button>
    </div>
    <p v-if="error" class="game-join__error" role="alert">{{ error }}</p>
  </div>
</template>

<script>
export default {
  name: 'GameJoin',
  props: {
    isDisabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['join'],
  data() {
    return {
      inputValue: '',
      error: '',
    };
  },
  methods: {
    onInput() {
      // Keep digits only so the field can't drift from the 4-digit contract.
      this.inputValue = this.inputValue.replace(/\D/g, '').slice(0, 4);
      this.error = '';
    },
    join() {
      if (this.isDisabled) return;
      if (/^\d{4}$/.test(this.inputValue)) {
        this.error = '';
        this.$emit('join', this.inputValue);
      } else {
        this.error = 'Enter a 4-digit game code.';
      }
    },
  },
};
</script>

<style scoped>
.game-join {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;
}

.game-join__hint {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.game-join__row {
  display: flex;
  gap: var(--space-2);
  width: 100%;
  max-width: 360px;
}

input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  min-height: 44px;
  font-family: var(--font-tile);
  font-size: 1.3rem;
  letter-spacing: 0.3em;
  text-align: center;
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

button:disabled,
input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.game-join__error {
  margin: 0;
  color: var(--color-accent);
  font-size: 0.85rem;
}
</style>
