<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-6">
    <h1 class="text-5xl font-bold text-green-400">RACE FINISHED!</h1>

    <div class="text-center">
      <p class="text-white/60 text-lg">{{ gameStore.playerName }}</p>
      <p class="text-4xl font-mono text-yellow-300 mt-2">{{ formatTime(gameStore.lastRaceTime) }}</p>
    </div>

    <div v-if="rank !== null" class="text-white/50">
      Your rank: <span class="text-white font-bold">#{{ rank }}</span>
    </div>

    <div class="flex gap-4 mt-4">
      <button
        class="px-6 py-3 bg-yellow-400 text-black font-bold rounded-lg text-lg hover:bg-yellow-300 active:scale-95 transition"
        @click="playAgain"
      >
        Play Again
      </button>
      <button
        class="px-6 py-3 bg-white/10 text-white rounded-lg text-lg hover:bg-white/20 active:scale-95 transition"
        @click="goToMenu"
      >
        Main Menu
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { gameStore, startGame, goToMenu, formatTime } from '../stores/gameStore'

const rank = computed(() => {
  const idx = gameStore.bestTimes.findIndex(r => r.time === gameStore.lastRaceTime)
  return idx === -1 ? null : idx + 1
})

function playAgain() {
  startGame(gameStore.playerName)
}
</script>
