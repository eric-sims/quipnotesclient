<template>
  <section class="judge">
    <p class="judge__title">You're the judge this round!</p>

    <!-- Waiting: notes are still coming in. -->
    <template v-if="!judgingOpen">
      <p class="judge__lede">
        Sit back while everyone writes — then read the notes aloud and pick
        your favorite.
      </p>
      <p class="judge__progress">Notes in: {{ count }} / {{ total }}</p>
      <button
        v-if="count > 0"
        type="button"
        class="game-btn game-btn--ghost"
        @click="$emit('force')"
      >
        Start judging anyway
      </button>
    </template>

    <!-- Judging: flip each card, read it to the room, pick one. -->
    <template v-else>
      <p v-if="winnerId" class="judge__lede">
        You picked {{ winnerId }}'s note — start the next round when everyone's
        ready.
      </p>
      <p v-else class="judge__lede">
        Tap a card to flip it and read it aloud — the host screen flips with
        you. Then pick your favorite.
      </p>
      <div class="judge__board">
        <JudgeNoteCard
          v-for="note in notes"
          :key="note.id"
          :note="note"
          :picked="note.id === favoriteNoteId"
          :pickable="!favoriteNoteId"
          @flip="$emit('flip', $event)"
          @pick="$emit('pick', $event)"
        />
      </div>

      <!-- After the pick, the judge moves the game along — the host screen
           can be left alone. -->
      <button
        v-if="canAdvance"
        type="button"
        class="game-btn game-btn--primary"
        :disabled="advancing"
        @click="$emit('next')"
      >
        {{ advancing ? 'Starting…' : 'Next round' }}
      </button>
    </template>
  </section>
</template>

<script>
import JudgeNoteCard from './JudgeNoteCard.vue';

export default {
  name: 'JudgeView',
  components: { JudgeNoteCard },
  props: {
    // The note board: [{ id, tokens, flipped }] in the shared shuffled order.
    notes: {
      type: Array,
      default: () => [],
    },
    // False while notes are still coming in; true once judging is open.
    judgingOpen: {
      type: Boolean,
      default: false,
    },
    // Live submission progress while waiting (count of total).
    count: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    // The picked favorite (0 = none yet) and the round's winner.
    favoriteNoteId: {
      type: Number,
      default: 0,
    },
    winnerId: {
      type: String,
      default: '',
    },
    // Whether this judge may start the next round (true once they've picked),
    // and whether that request is in flight.
    canAdvance: {
      type: Boolean,
      default: false,
    },
    advancing: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['force', 'flip', 'pick', 'next'],
};
</script>

<style scoped>
.judge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-4);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.judge__title {
  margin: 0;
  font-family: var(--font-tile);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-accent);
}

.judge__lede {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-muted);
}

.judge__progress {
  margin: 0;
  font-family: var(--font-tile);
  font-size: 1.2rem;
  font-weight: 700;
}

.judge__board {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
}

/* .game-btn's flex-basis is meant for the row layouts of the play surface; in
   this column it would become a 160px *height*, so pin the buttons here to
   their natural size. */
.judge .game-btn {
  flex: 0 0 auto;
  width: 100%;
  max-width: 240px;
}
</style>
