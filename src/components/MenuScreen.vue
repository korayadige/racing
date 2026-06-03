<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-8">
    <h1 class="text-6xl font-bold text-yellow-400 tracking-widest drop-shadow-lg">
      🏎️ RACING GAME
    </h1>

    <div class="flex flex-col gap-4 w-72">
      <input
        v-model="playerName"
        type="text"
        placeholder="İsminizi girin..."
        maxlength="20"
        class="px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 text-lg outline-none focus:border-yellow-400 transition"
        @keyup.enter="handleStart"
      />
      <button
        class="px-6 py-3 bg-yellow-400 text-black font-bold rounded-lg text-xl hover:bg-yellow-300 active:scale-95 transition"
        @click="handleStart"
      >
        BAŞLA
      </button>
    </div>

    <div v-if="bestTimes.length" class="mt-4 w-80">
      <h2 class="text-xl font-semibold text-white/70 mb-3 text-center">En İyi Süreler</h2>
      <div
        v-for="(record, i) in bestTimes"
        :key="i"
        class="flex justify-between px-4 py-2 rounded mb-1"
        :class="i === 0 ? 'bg-yellow-400/20 text-yellow-300' : 'bg-white/5 text-white/60'"
      >
        <span>{{ i + 1 }}. {{ record.playerName }}</span>
        <span>{{ formatTime(record.time) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { gameStore, startGame, formatTime } from '../stores/gameStore'

const playerName = ref('')
const bestTimes = computed(() => gameStore.bestTimes)

function handleStart() {
  startGame(playerName.value.trim())
}
</script>
