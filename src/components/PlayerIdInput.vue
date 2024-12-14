<template>
    <div class="player-id-input">
      <input 
        type="text" 
        v-model="inputValue" 
        placeholder="Enter Player ID" 
        @keydown.enter="setPlayerID"
        :disabled="isDisabled"
      />
      <button @click="setPlayerID" :disabled="isDisabled">
        Set Player ID
      </button>
    </div>
  </template>
  
  <script>
  export default {
    name: "PlayerIDInput",
    props: {
      isDisabled: {
        type: Boolean,
        required: true,
      },
    },
    data() {
      return {
        inputValue: "",
      };
    },
    methods: {
    setPlayerID() {
        if (!this.isDisabled && this.inputValue.trim()) {
          this.$emit("update-player-id", this.inputValue.trim());
        } else if (!this.isDisabled) {
          alert("Player ID cannot be empty!");
        }
      },
    },
  };
  </script>
  
  <style scoped>
  .player-id-input {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  input {
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
    flex: 1;
  }
  
  button {
    padding: 8px 16px;
    background-color: #007bff;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.3s ease;
  }
  
  button:disabled {
    background-color: #aaa;
    cursor: not-allowed;
  }
  
  input:disabled {
    background-color: #f9f9f9;
    cursor: not-allowed;
  }
  </style>
  