<template>
  <div class="tile-pool">
    <div v-if="tiles.length === 0" class="tile-pool__empty">
      No tiles yet — press <strong>Draw</strong> to deal your hand.
    </div>
    <div v-else class="tile-pool__tiles">
      <WordTile
        v-for="tile in tiles"
        :key="tile.id"
        :word="tile.word"
        :in-use="isUsed(tile.id)"
        :rotation="rotationFor(tile.id)"
        @select="$emit('add', tile.id)"
      />
    </div>
  </div>
</template>

<script>
import WordTile from './WordTile.vue';

export default {
  name: 'TileContainer',
  components: {
    WordTile,
  },
  props: {
    // The player's full hand: [{ id, word }].
    tiles: {
      type: Array,
      required: true,
    },
    // Ids already placed in the note (Set or Array) — shown as "in use".
    usedIds: {
      type: [Set, Array],
      default: () => new Set(),
    },
  },
  emits: ['add'],
  methods: {
    isUsed(id) {
      return this.usedIds instanceof Set
        ? this.usedIds.has(id)
        : this.usedIds.includes(id);
    },
    // Deterministic small rotation per tile so the jitter is stable across
    // re-renders instead of twitching on every reactive update.
    rotationFor(id) {
      let hash = 0;
      const str = String(id);
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
      }
      // Map to roughly [-4, 4] degrees.
      return (Math.abs(hash) % 9) - 4;
    },
  },
};
</script>

<style scoped>
.tile-pool {
  width: 100%;
}

.tile-pool__tiles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
  align-items: center;
  padding: var(--space-3);
}

.tile-pool__empty {
  padding: var(--space-5) var(--space-3);
  color: var(--color-muted);
  font-size: 0.95rem;
}
</style>
