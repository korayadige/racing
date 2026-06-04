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
  bestTimes: (() => { try { const d = JSON.parse(localStorage.getItem('racing-best-times') ?? '[]'); return Array.isArray(d) ? d : [] } catch { return [] } })(),
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
 
  const MS_PER_SECOND = 1000       // 1 second = 1000 ms
  const MS_PER_MINUTE = 60000      // 1 min = 60  * 1000 ms = 60.000 ms
  const MS_PER_CENTISECOND = 10    // 1 centisecond  = 10 ms

  const minutes = Math.floor(ms / MS_PER_MINUTE)
  const seconds = Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND)
  const centiseconds = Math.floor((ms % MS_PER_SECOND) / MS_PER_CENTISECOND)
  
  // String Padding
  // for example 7 to "07"
  const paddedSeconds = String(seconds).padStart(2, '0')
  const paddedCentiseconds = String(centiseconds).padStart(2, '0')
  
  // template: "1:15.42"
  return `${minutes}:${paddedSeconds}.${paddedCentiseconds}`
}