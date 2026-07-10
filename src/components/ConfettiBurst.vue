<template>
  <!-- Full-screen celebratory confetti for the round's winner. Pure CSS
       animation over generated pieces: no canvas, no dependency. The parent
       v-ifs this in and out (useGame's `celebrate` flag), so pieces are
       generated fresh each win. Decorative only — hidden from the
       accessibility tree; the winner announcement itself is a toast. -->
  <div class="confetti" aria-hidden="true">
    <span
      v-for="piece in pieces"
      :key="piece.key"
      class="confetti__piece"
      :style="piece.style"
    />
  </div>
</template>

<script>
// A small palette that pops on both the light and dark paper backgrounds.
const COLORS = ['#c0392b', '#e67e22', '#f1c40f', '#2e7d52', '#3a6ea5', '#8e44ad'];
const PIECE_COUNT = 120;

export default {
  name: 'ConfettiBurst',
  data() {
    return {
      pieces: Array.from({ length: PIECE_COUNT }, (_, i) => ({
        key: i,
        style: {
          '--x': `${Math.random() * 100}vw`,
          '--delay': `${Math.random() * 0.8}s`,
          '--duration': `${2.4 + Math.random() * 1.6}s`,
          '--spin': `${Math.random() > 0.5 ? '' : '-'}${420 + Math.random() * 540}deg`,
          '--drift': `${(Math.random() - 0.5) * 30}vw`,
          '--size': `${6 + Math.random() * 7}px`,
          background: COLORS[i % COLORS.length],
        },
      })),
    };
  },
};
</script>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow: hidden;
  pointer-events: none;
}

.confetti__piece {
  position: absolute;
  top: -4vh;
  left: var(--x);
  width: var(--size);
  height: calc(var(--size) * 1.6);
  border-radius: 2px;
  opacity: 0;
  animation: confetti-fall var(--duration) ease-in var(--delay) forwards;
}

@keyframes confetti-fall {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  90% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--drift), 106vh, 0) rotate(var(--spin));
  }
}

@media (prefers-reduced-motion: reduce) {
  .confetti__piece {
    animation-duration: 0.8s;
  }
}
</style>
