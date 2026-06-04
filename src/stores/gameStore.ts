import { reactive } from 'vue'

export type GameScreen = 'menu' | 'game' | 'gameover'

interface LapRecord {
  playerName: string
  time: number // milliseconds
}

interface GameState {
  screen: GameScreen
  playerName: string
  currentLap: number
  totalLaps: number
  bestTimes: LapRecord[]
  lastRaceTime: number
}

export const gameStore = reactive<GameState>({
  screen: 'menu',
  playerName: '',
  currentLap: 0,
  totalLaps: 3,
  bestTimes: (() => { try { return JSON.parse(localStorage.getItem('racing-best-times') ?? '[]') } catch { return [] } })(),
  lastRaceTime: 0,
})

export function startGame(name: string) {
  gameStore.playerName = name || 'Anonymous'
  gameStore.currentLap = 0
  gameStore.screen = 'game'
}

export function finishRace(totalTime: number) {
  gameStore.lastRaceTime = totalTime
  gameStore.bestTimes.push({ playerName: gameStore.playerName, time: totalTime })
  gameStore.bestTimes.sort((a, b) => a.time - b.time)
  gameStore.bestTimes = gameStore.bestTimes.slice(0, 10)
  localStorage.setItem('racing-best-times', JSON.stringify(gameStore.bestTimes))
  gameStore.screen = 'gameover'
}

export function goToMenu() {
  gameStore.screen = 'menu'
}

export function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const centiseconds = Math.floor((ms % 1000) / 10)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}
