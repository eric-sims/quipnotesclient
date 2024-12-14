<template>
    <div 
      :class="['tile', { clicked: this.isClicked }]"
      @click="toggleClicked"
    >
      {{ displayWord }}
    </div>
  </template>
  
  <script>
  export default {
    name: "WordTile",
    props: {
      word: {
        type: String,
        required: true,
      },
      clickable: {
        type: Boolean,
        required: true,
      },
      isClicked: {
        type: Boolean,
        required: true,
      }
    },
    computed: {
      displayWord() {
        return this.word.split("|")[1]
      }
    },
    methods: {
      toggleClicked() {
        if (this.clickable) {
          this.$emit("tile-selected", this.word);
          console.log("Clicked: ", this.word);
        }
      },
    },
  };
  </script>
  
  <style scoped>
  .tile {
    display: inline-flex;
    padding: 10px 20px;
    margin: 5px;
    font: 20px Courier;
    font-weight: bold;
    font-size: 1.2rem;
    text-align: center;
    color: #000000;
    background-color: #dadada;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.1s ease;
    transform-origin: center;
  }
  
  .tile.clicked {
    background-color: #8c8c8c;
    font-size: 1rem;
    padding: 8px 16px;
    transform: scale(0.95);
  }
  </style>
  