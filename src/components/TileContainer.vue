<template>
    <div class="tile-container">
        <div v-for="(word, index) in words" :key="index" class="tile-wrapper">
            <WordTile :word="word" @tile-selected="selectTile" :clickable="true" :is-clicked="isClicked(word)"/>
        </div>
    </div>
  </template>
  
  <script>
  import WordTile from './WordTile.vue';
  
  export default {
    name: "TileContainer",
    components: {
      WordTile,
    },
    props: {
      words: {
        type: Array,
        required: true,
      },
      selectedWords: {
        type: Array,
        required: true,
      }
    },
    methods: {
      selectTile(word) {
        this.$emit('tile-selected', word);
      },
      isClicked(word) {
        return this.selectedWords.includes(word);
      }
    },
  };
  </script>
  
  <style scoped>
  .tile-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px;
  justify-content: center; /* Align tiles to the left */
  align-items: center;
  }

  .tile-container > * {
  flex-shrink: 0; /* Prevent the tile from resizing unexpectedly */
  }
  .tile-wrapper {
  display: flex; /* Center the tile inside its wrapper */
  align-items: center;
  justify-content: center;
  }
  </style>
  