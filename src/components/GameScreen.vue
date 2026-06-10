<template>
  <div class="w-full h-screen bg-[#2d6e22]">
    <div ref="gameContainer" class="w-full h-full" />
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
