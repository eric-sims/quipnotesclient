<template>
  <div class="toast-stack" aria-live="polite" aria-atomic="false">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="`toast--${toast.type}`"
      role="status"
    >
      <span class="toast__msg">{{ toast.message }}</span>
      <button
        type="button"
        class="toast__close"
        aria-label="Dismiss"
        @click="$emit('dismiss', toast.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ToastStack',
  props: {
    // [{ id, message, type }] — see useToasts.
    toasts: {
      type: Array,
      required: true,
      default: () => [],
    },
  },
  emits: ['dismiss'],
};
</script>

<style scoped>
.toast-stack {
  position: fixed;
  left: 50%;
  bottom: var(--space-4);
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(92vw, 420px);
  z-index: 1000;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--color-toast-text);
  background-color: var(--color-toast-bg);
  border-left: 4px solid var(--color-muted);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  font-size: 0.95rem;
  text-align: left;
  pointer-events: auto;
  animation: toast-in 0.18s ease;
}

.toast--success {
  border-left-color: var(--color-success);
}

.toast--error {
  border-left-color: var(--color-accent);
}

.toast__msg {
  flex: 1;
}

.toast__close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  font-size: 1.1rem;
  line-height: 1;
  color: var(--color-toast-text);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: 0.7;
}

.toast__close:hover {
  opacity: 1;
}

.toast__close:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 1px;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
