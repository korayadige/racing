<template>
  <MenuScreen v-if="gameStore.screen === 'menu'" />
  <GameScreen v-else-if="gameStore.screen === 'game'" />
  <GameOverScreen v-else-if="gameStore.screen === 'gameover'" />
</template>

<script setup lang="ts">
import { gameStore } from './stores/gameStore'
import MenuScreen from './components/MenuScreen.vue'
import GameScreen from './components/GameScreen.vue'
import GameOverScreen from './components/GameOverScreen.vue'
</script>
