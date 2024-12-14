<template>
  <div class="table">
    <h1 style="font: 20px Courier; font-weight: bold;">quipNotes</h1>
    <PlayerIDInput
        :isDisabled="!!playerID"
        @update-player-id="setPlayerID"
    />
    <p
        v-if="playerID"
        style="font-weight: bold">
      Player ID: {{ playerID }}
    </p>
    <button
        @click="drawTiles(10)"
        class="gameButton">
      Draw 10 Tiles
    </button>
    <button
        @click="drawTiles(1)"
        class="gameButton">
      Draw 1 Tile
    </button>
    <button
        @click="submitSelected"
        class="gameButton">
      Submit Ransom Note
    </button>

    <TileContainer
        :words="wordList"
        :selected-words="selectedWords"
        @tile-selected="selectWord"
    />

    <SelectedWords
        v-if="selectedWords.length > 0"
        :selected-words="selectedWords"
        @remove-from-selected-words="removeFromSelectedWords"
    />
  </div>
</template>

<script>
import TileContainer from './components/TileContainer.vue';
import PlayerIDInput from './components/PlayerIdInput.vue';
import SelectedWords from './components/SelectedWords.vue';
import {apiRequest} from './api.js'

export default {
  name: 'App',
  components: {
    TileContainer,
    PlayerIDInput,
    SelectedWords,
  },
  data() {
    return {
      selectedWords: [],
      wordList: [],
      playerID: "",
    };
  },
  methods: {
    setPlayerID(id) {
      apiRequest("POST", "/players", {id: String(id)}, {"Content-Type": "application/json"})
          .then(response => {
            if (response.ok) {
              console.debug("successfully added player", id)
              this.playerID = id;
            }
          }).catch(error => {
            alert(`There seems to be a server error.... bug Eric! ${error}`);
            console.log("this is the error", error);
      })
    },
    drawTiles(numTiles) {
      if (this.playerID === "") {
        alert("Please set up playerID first!");
        return;
      }
      // fetch("http://192.168.68.56:8081/game/draw", {
      //   method: "POST",
      //   body: JSON.stringify({ count: numTiles, id: String(this.playerID) }),
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      // })
      apiRequest("POST", "/game/draw", { count: numTiles, id: String(this.playerID) }, {"Content-Type": "application/json"})
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            if (data.words) {
              this.wordList = data.words;
              console.debug('Words received:', data.words);
            } else {
              console.warn('No words in response:', data);
            }
          })
          .catch(error => {
            alert(`Error fetching data: ${error.message}`);
            console.error(error);
          });
    },
    selectWord(word) {
      if (!this.selectedWords.includes(word)) {
        this.selectedWords.push(word);
      }
    },
    removeFromSelectedWords(word) {
      const index = this.selectedWords.indexOf(word);
      if (index > -1) {
        this.selectedWords.splice(index, 1);
      }
    },
    removeFromWordsWords(word) {
      const index = this.wordList.indexOf(word);
      if (index > -1) {
        this.wordList.splice(index, 1);
      }
    },
    submitSelected() {
      if (this.playerID === "") {
        alert("Please set up playerID first!");
        return;
      }

      if (this.selectedWords.length === 0) {
        alert("Please select words first!");
        return;
      }

      apiRequest("POST", "/game/submit", {id: String(this.playerID), note:this.selectedWords},{'Content-Type': 'application/json'})
          .then(response => {
        if (response.ok) {
          console.debug("successfully submitted note");
          for (const w in this.selectedWords) {
            this.removeFromWordsWords(w);
          }
          this.selectedWords = [];
        }
      }).catch(error => {
        alert(`Error submitting: ${error.message}`);
      }).finally(this.getTiles)
    },
    getTiles() {
      apiRequest("GET", `/players/${this.playerID}/tiles`, null, {'Content-Type': 'application/json'})
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
              this.wordList = data.words;
          }).catch(error => {
            alert(`Error fetching data: ${error.message}`);
          })
    }
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
  margin-bottom: 60px;
}
.gameButton {
  width: 200px; /* Set button width in pixels */
  height: 50px; /* Set button height in pixels */
  padding: 10px; /* Add padding around text */
  font-size: 18px; /* Adjust text size within the button */
}

body {
  background-image: url('../bin/wood.jpg');
  background-size: cover;
  background-repeat: repeat-y;
  background-position: center;
}
</style>
