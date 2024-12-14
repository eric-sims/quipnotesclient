<template>
  <div class="selected-words">
    <h1>Selected Words:</h1>
    <WordTile v-for="word in selectedWords"
       :word="word"
       :key="word"
       :clickable="true"
       :is-clicked="false"
       @tile-selected="removeFromSelectedWords"/>
  </div>
</template>

<script>
import WordTile from "@/components/WordTile.vue";

export default {
  name: "SelectedWords",
  components: {
    WordTile,
  },
  props: {
    selectedWords: {
      type: Array,
      required: true,
      default: () => [],
    },
  },
  methods: {
    removeFromSelectedWords(word) {
      this.$emit("remove-from-selected-words", word);
    },
    isClicked(word) {
      return this.selectedWords.includes(word);
    }
  },
};
</script>


<style scoped>

</style>