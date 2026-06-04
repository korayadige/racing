import Phaser from 'phaser'
import { gameStore } from '../stores/gameStore'
import { isOnTrack } from './trackConstants'
import type { SoundManager } from './SoundManager'
import type { GamepadManager } from './GamepadManager'

interface HUDUpdateParams {
  speed: number
  maxSpeed: number
  lapCount: number
  raceStartTime: number
  raceFinished: boolean
  steer: number
  throttle: number
  carX: number
  carY: number
  sfx: SoundManager
  gamepad: GamepadManager
}

/**
 * Owns all in-game overlay text objects and keeps them up to date each frame.
 */
export class HUD {
  private readonly scene: Phaser.Scene
  private readonly cpTextDuration: number

  private timerText: Phaser.GameObjects.Text
  private lapText: Phaser.GameObjects.Text
  private speedText: Phaser.GameObjects.Text
  private gamepadText: Phaser.GameObjects.Text
  private checkpointText: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, cpTextDuration: number) {
    this.scene = scene
    this.cpTextDuration = cpTextDuration

    const style = {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 },
    }

    this.timerText     = scene.add.text(10, 10,  'Time: 0:00.00', style).setDepth(20)
    this.lapText       = scene.add.text(10, 40,  `Lap: 0 / ${gameStore.totalLaps}`, style).setDepth(20)
    this.speedText     = scene.add.text(10, 70,  'Speed: 0', style).setDepth(20)
    this.gamepadText   = scene.add.text(10, 100, '🎮 Not connected', { ...style, color: '#888888' }).setDepth(20)
    this.checkpointText = scene.add.text(10, 130, '', { ...style, color: '#00ddff' }).setDepth(20)
  }

  /**
   * Briefly flashes a checkpoint-passed notification then fades it out.
   */
  showCheckpointFlash(passed: number, total: number): void {
    this.checkpointText.setText(`CP ${passed}/${total} ✓`).setAlpha(1)
    this.scene.time.delayedCall(this.cpTextDuration, () => {
      if (this.checkpointText?.active) this.checkpointText.setAlpha(0)
    })
  }

  /**
   * Refreshes all HUD text and drives engine/screech audio each frame.
   */
  update(p: HUDUpdateParams): void {
    if (!p.raceFinished) {
      const elapsed = this.scene.time.now - p.raceStartTime
      const m  = Math.floor(elapsed / 60000)
      const s  = Math.floor((elapsed % 60000) / 1000)
      const cs = Math.floor((elapsed % 1000) / 10)
      this.timerText.setText(`Time: ${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`)
    }

    this.lapText.setText(`Lap: ${p.lapCount} / ${gameStore.totalLaps}`)
    this.speedText.setText(`Speed: ${Math.abs(p.speed * 40).toFixed(0)} km/h`)

    if (p.gamepad.isConnected()) {
      const name      = p.gamepad.connectedName() ?? ''
      const shortName = name.length > 30 ? name.slice(0, 30) + '…' : name
      this.gamepadText.setColor('#44ff88').setText(`🎮 ${shortName}`)
    } else {
      this.gamepadText.setColor('#888888').setText('🎮 Not connected')
    }

    p.sfx.updateEngine(p.speed / p.maxSpeed)
    const onGrass  = !isOnTrack(p.carX, p.carY)
    const hardTurn = Math.abs(p.steer) > 0.5 && Math.abs(p.speed) > p.maxSpeed * 0.5
    p.sfx.setScreech(hardTurn || (onGrass && p.throttle > 0 && Math.abs(p.speed) > 1))
  }
}
