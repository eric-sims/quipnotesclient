<template>
  <div class="onboarding">
    <p class="onboarding__lead">
      Enter your name and the 4-digit code from your host to join the game.
    </p>

    <div class="onboarding__field">
      <label class="onboarding__label" for="onboarding-player">Player ID</label>
      <input
        id="onboarding-player"
        type="text"
        class="onboarding__input"
        v-model="playerId"
        placeholder="Enter Player ID"
        autocomplete="off"
        :disabled="isJoining"
        @input="error = ''"
        @keydown.enter="join"
      />
    </div>

    <div class="onboarding__field">
      <label class="onboarding__label" for="onboarding-code">Game code</label>
      <input
        id="onboarding-code"
        type="text"
        class="onboarding__input onboarding__input--code"
        inputmode="numeric"
        maxlength="4"
        v-model="code"
        placeholder="0000"
        autocomplete="off"
        :disabled="isJoining"
        @input="onCodeInput"
        @keydown.enter="join"
      />
    </div>

    <button class="onboarding__submit" :disabled="isJoining" @click="join">
      {{ isJoining ? 'Joining…' : 'Join game' }}
    </button>

    <p v-if="error" class="onboarding__error" role="alert">{{ error }}</p>
  </div>
</template>

<script>
export default {
  name: 'OnboardingScreen',
  props: {
    // Prefill values (e.g. a returning player after leaving a game).
    initialPlayerId: {
      type: String,
      default: '',
    },
    initialCode: {
      type: String,
      default: '',
    },
    // True while a join is in flight; disables the form.
    isJoining: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['join'],
  data() {
    return {
      playerId: this.initialPlayerId,
      code: this.initialCode,
      error: '',
    };
  },
  methods: {
    onCodeInput() {
      // Keep digits only so the field can't drift from the 4-digit contract.
      this.code = this.code.replace(/\D/g, '').slice(0, 4);
      this.error = '';
    },
    join() {
      if (this.isJoining) return;
      const playerId = this.playerId.trim();
      if (!playerId) {
        this.error = 'Enter a Player ID.';
        return;
      }
      if (!/^\d{4}$/.test(this.code)) {
        this.error = 'Enter a 4-digit game code.';
        return;
      }
      this.error = '';
      this.$emit('join', { playerId, code: this.code });
    },
  },
};
</script>

<style scoped>
.onboarding {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: stretch;
  padding: var(--space-5) var(--space-4);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.onboarding__lead {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.95rem;
  text-align: center;
}

.onboarding__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  text-align: left;
}

.onboarding__label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
}

.onboarding__input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  min-height: 44px;
  font-family: var(--font-ui);
  font-size: 1rem;
  color: var(--color-text);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.onboarding__input--code {
  font-family: var(--font-tile);
  font-size: 1.3rem;
  letter-spacing: 0.3em;
  text-align: center;
}

.onboarding__input:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 1px;
}

.onboarding__submit {
  min-height: 48px;
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-ui);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-accent-contrast);
  background-color: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

.onboarding__submit:hover:not(:disabled) {
  background-color: var(--color-accent-strong);
}

.onboarding__submit:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.onboarding__input:disabled,
.onboarding__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.onboarding__error {
  margin: 0;
  color: var(--color-accent);
  font-size: 0.85rem;
  text-align: center;
}
</style>
