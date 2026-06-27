import { ref } from 'vue';

// Non-blocking replacement for alert(): a small reactive stack of messages
// that auto-dismiss. Components render them; anything can push one via notify.
let counter = 0;

export function useToasts(timeout = 4000) {
  const toasts = ref([]);

  function dismiss(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  // type is one of 'info' | 'success' | 'error' (drives styling).
  function notify(message, type = 'info') {
    const id = ++counter;
    toasts.value.push({ id, message, type });
    if (timeout > 0) {
      setTimeout(() => dismiss(id), timeout);
    }
    return id;
  }

  return { toasts, notify, dismiss };
}
