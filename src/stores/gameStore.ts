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

function loadBestTimes(): LapRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem('racing-best-times') ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(
      (r): r is LapRecord => typeof r?.playerName === 'string' && typeof r?.time === 'number',
    )
  } catch {
    return []
  }
}

export const gameStore = reactive<GameState>({
  screen: 'menu',
  playerName: '',
  currentLap: 0,
  totalLaps: 3,
  bestTimes: loadBestTimes(),
  lastRaceTime: 0,
})

export function startGame(name: string) {
  gameStore.playerName = name || 'Anonymous'
  gameStore.currentLap = 0
  gameStore.screen = 'game'
}

const LIMIT_BEST_TIMES = 10

export function finishRace(totalTime: number) {
  gameStore.lastRaceTime = totalTime
  gameStore.bestTimes.push({ playerName: gameStore.playerName, time: totalTime })
  gameStore.bestTimes.sort((a, b) => a.time - b.time)
  gameStore.bestTimes = gameStore.bestTimes.slice(0, LIMIT_BEST_TIMES)
  localStorage.setItem('racing-best-times', JSON.stringify(gameStore.bestTimes))
  gameStore.screen = 'gameover'
}

export function goToMenu() {
  gameStore.screen = 'menu'
}

export function formatTime(ms: number): string {
  const m  = Math.floor(ms / 60000)
  const s  = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}