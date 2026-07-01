<template>
  <div class="prompt-banner" :class="{ 'prompt-banner--waiting': round === 0 }">
    <template v-if="round > 0">
      <span class="prompt-banner__round">Round {{ round }}</span>
      <p class="prompt-banner__text">{{ prompt }}</p>
    </template>
    <p v-else class="prompt-banner__waiting">
      Waiting for the host to draw a prompt…
    </p>
  </div>
</template>

<script>
export default {
  name: 'PromptBanner',
  props: {
    round: {
      type: Number,
      required: true,
    },
    prompt: {
      type: String,
      default: '',
    },
  },
};
</script>

<style scoped>
/* Sticks to the top of the play area so a player can reference the prompt while
   arranging tiles. Shares the paper/accent vocabulary with the rest of the UI. */
.prompt-banner {
  position: sticky;
  top: 0;
  z-index: 5;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.prompt-banner--waiting {
  background-color: transparent;
  box-shadow: none;
  border-style: dashed;
}

.prompt-banner__round {
  font-family: var(--font-tile);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--color-muted);
}

.prompt-banner__text {
  margin: 0;
  font-size: clamp(1.15rem, 4.5vw, 1.6rem);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-accent);
}

.prompt-banner__waiting {
  margin: 0;
  font-size: 1rem;
  color: var(--color-muted);
}
</style>
