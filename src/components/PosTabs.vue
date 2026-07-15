<template>
  <div class="pos-tabs">
    <div v-if="groups.length === 0" class="pos-tabs__empty">
      No tiles yet — press <strong>Draw</strong> to deal your hand.
    </div>
    <template v-else>
      <div class="pos-tabs__bar" role="tablist" aria-label="Tiles by part of speech">
        <button
          v-for="group in groups"
          :key="group.pos"
          class="pos-tabs__tab"
          :class="{ 'pos-tabs__tab--active': group.pos === activePos }"
          role="tab"
          :aria-selected="group.pos === activePos"
          @click="activePos = group.pos"
        >
          {{ group.label }}
          <span class="pos-tabs__count">{{ group.tiles.length }}</span>
        </button>
      </div>
      <p class="pos-tabs__definition">{{ activeGroup.definition }}</p>
      <TileContainer
        :tiles="activeGroup.tiles"
        :used-ids="usedIds"
        @add="$emit('add', $event)"
      />
    </template>
  </div>
</template>

<script>
import TileContainer from './TileContainer.vue';
import { groupTilesByPos } from '../tiles.js';

export default {
  name: 'PosTabs',
  components: {
    TileContainer,
  },
  props: {
    // The player's full hand: [{ id, word, pos }]. A tile with several
    // parts of speech appears under each matching tab.
    tiles: {
      type: Array,
      required: true,
    },
    // Ids already placed in the note (Set or Array) — passed through.
    usedIds: {
      type: [Set, Array],
      default: () => new Set(),
    },
  },
  emits: ['add'],
  data() {
    return { activePos: null };
  },
  computed: {
    groups() {
      return groupTilesByPos(this.tiles);
    },
    activeGroup() {
      return (
        this.groups.find((g) => g.pos === this.activePos) || this.groups[0]
      );
    },
  },
  watch: {
    // Keep the selection on a tab that still exists (e.g. after a submit
    // empties the active part of speech).
    groups: {
      immediate: true,
      handler(groups) {
        if (!groups.some((g) => g.pos === this.activePos)) {
          this.activePos = groups.length > 0 ? groups[0].pos : null;
        }
      },
    },
  },
};
</script>

<style scoped>
.pos-tabs {
  width: 100%;
}

/* Horizontally scrollable pill bar so all tabs stay reachable on a phone. */
.pos-tabs__bar {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding: var(--space-2) var(--space-3);
  -webkit-overflow-scrolling: touch;
}

.pos-tabs__tab {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text);
  font-size: 0.95rem;
  cursor: pointer;
}

.pos-tabs__tab--active {
  border-color: var(--color-accent);
  color: var(--color-accent);
  font-weight: 600;
}

.pos-tabs__count {
  font-size: 0.8em;
  padding: 0.1em 0.55em;
  border-radius: 999px;
  background: var(--color-border);
  color: var(--color-text);
}

.pos-tabs__definition {
  margin: 0;
  padding: 0 var(--space-3);
  color: var(--color-muted);
  font-size: 0.9rem;
}

.pos-tabs__empty {
  padding: var(--space-5) var(--space-3);
  color: var(--color-muted);
  font-size: 0.95rem;
}
</style>
