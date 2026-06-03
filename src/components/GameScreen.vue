<template>
  <div class="relative w-full h-screen flex items-center justify-center bg-[#1a1a2e]">
    <div ref="gameContainer" class="border-2 border-white/10 rounded" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { createPhaserGame } from '../game/PhaserGame'
import type Phaser from 'phaser'

const gameContainer = ref<HTMLElement>()
let game: Phaser.Game | null = null

onMounted(() => {
  if (gameContainer.value) {
    game = createPhaserGame(gameContainer.value)
  }
})

onUnmounted(() => {
  game?.destroy(true)
  game = null
})
</script>
