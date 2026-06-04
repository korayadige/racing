import Phaser from 'phaser'
import { gameStore, finishRace, goToMenu } from '../../stores/gameStore'
import { SoundManager } from '../SoundManager'
import { GamepadManager } from '../GamepadManager'
import { renderTrack } from '../TrackRenderer'
import { HUD } from '../HUD'
import { PauseMenu } from '../PauseMenu'
import { startCountdown } from '../Countdown'
import { OUTER, INNER, ellipseValue, isOnTrack } from '../trackConstants'

export class RaceScene extends Phaser.Scene {
  private car!: Phaser.GameObjects.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys

  // ── Physics constants ─────────────────────────────────────────
  private readonly maxSpeed            = 7
  private readonly acceleration        = 0.24
  private readonly friction            = 0.94
  private readonly turnSpeed           = 3.2
  private readonly grassAccelPenalty   = 0.65
  private readonly minSpeedToTurn      = 0.2
  private readonly corneringSlowdown   = 0.018  // speed loss per frame when steering hard
  private readonly reverseSpeedDivider = 2
  private readonly bounceDamping       = 0.3    // fraction of speed retained (inverted) after wall impact
  private readonly wallPushStep        = 3      // pixels pushed per iteration when resolving overlap
  private readonly wallPushMaxIters    = 20     // safety cap to prevent infinite loop on deep penetration

  // ── Timing constants ──────────────────────────────────────────
  private readonly initialFinishCooldown = 3000
  private readonly lapCooldown           = 2000
  private readonly gameoverDelay         = 1200
  private readonly cpTextDuration        = 1800
  private readonly finishZoneHalfWidth   = 25

  // ── Checkpoint config ─────────────────────────────────────────
  /** Left, bottom, and right gates — must all be passed in order before a lap counts. */
  private readonly checkpoints = [
    { x: 173, y: 375 },
    { x: 550, y: 613 },
    { x: 927, y: 375 },
  ] as const
  private readonly cpRadius = 55

  // ── Mutable state ─────────────────────────────────────────────
  private speed           = 0
  private carAngle        = 0
  private lapCount        = 0
  private raceStartTime   = 0
  private finishCooldown  = this.initialFinishCooldown
  private nextCheckpoint  = 0
  private raceFinished    = false
  private countdownActive = true
  private paused          = false
  private pausedElapsed   = 0

  // ── Subsystems ────────────────────────────────────────────────
  private sfx!: SoundManager
  private gamepad!: GamepadManager
  private hud!: HUD
  private pauseMenu!: PauseMenu

  constructor() {
    super({ key: 'RaceScene' })
  }

  create() {
    renderTrack(this)
    this.generateCarTexture()
    this.createCar()

    this.cursors = this.input.keyboard!.createCursorKeys()

    // Reset all mutable state so scene.restart() works correctly
    this.speed           = 0
    this.carAngle        = -90
    this.lapCount        = 0
    this.nextCheckpoint  = 0
    this.finishCooldown  = this.initialFinishCooldown
    this.raceFinished    = false
    this.countdownActive = true
    this.paused          = false
    this.pausedElapsed   = 0
    gameStore.currentLap = 0

    this.sfx       = new SoundManager()
    this.gamepad   = new GamepadManager()
    this.hud       = new HUD(this, this.cpTextDuration)
    this.pauseMenu = new PauseMenu(this)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sfx.destroy())
    this.input.keyboard!.on('keydown-ESC', () => this.togglePause())

    startCountdown(this, this.sfx, () => {
      this.countdownActive = false
      this.raceStartTime   = this.time.now
      this.sfx.start()
    })
  }

  // ── Pause ─────────────────────────────────────────────────────

  private togglePause() {
    if (this.countdownActive || this.raceFinished) return
    if (this.paused) {
      this.paused        = false
      this.raceStartTime = this.time.now - this.pausedElapsed
      this.sfx.start()
      this.pauseMenu.hide()
    } else {
      this.paused        = true
      this.pausedElapsed = this.time.now - this.raceStartTime
      this.sfx.stop()
      this.pauseMenu.show(
        () => this.togglePause(),
        () => this.scene.restart(),
        () => { this.scene.stop(); goToMenu() },
      )
    }
  }

  // ── Game loop ─────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.countdownActive || this.paused) return

    const { steer, throttle, brake } = this.readInput()
    this.applyInput(steer, throttle, brake)
    this.moveCar()
    this.applyTrackPhysics()
    this.checkCheckpoints()
    this.checkFinishLine(delta)
    this.hud.update({
      speed: this.speed, maxSpeed: this.maxSpeed,
      lapCount: this.lapCount, raceStartTime: this.raceStartTime,
      raceFinished: this.raceFinished, steer, throttle,
      carX: this.car.x, carY: this.car.y,
      sfx: this.sfx, gamepad: this.gamepad,
    })
  }

  // ── Input ─────────────────────────────────────────────────────

  /**
   * Reads input from keyboard and gamepad. Gamepad takes priority when connected.
   * @returns Normalized steer (-1..1), throttle (0..1), and brake (0..1).
   */
  private readInput(): { steer: number; throttle: number; brake: number } {
    const gp = this.gamepad.getInput()
    if (gp) return gp

    const steer    = this.cursors.left.isDown  ? -1 : this.cursors.right.isDown ? 1 : 0
    const throttle = this.cursors.up.isDown    ? 1  : 0
    const brake    = this.cursors.down.isDown  ? 1  : 0
    return { steer, throttle, brake }
  }

  /**
   * Applies acceleration, braking, and steering based on input and current speed.
   * Off-road reduces acceleration by grassAccelPenalty. Steering is reversed in reverse gear.
   * @param steer    -1 (left) to 1 (right)
   * @param throttle 0 to 1
   * @param brake    0 to 1
   */
  private applyInput(steer: number, throttle: number, brake: number) {
    const onRoad = isOnTrack(this.car.x, this.car.y)
    const accel  = onRoad ? this.acceleration : this.acceleration * this.grassAccelPenalty

    if (throttle > 0) {
      this.speed = Math.min(this.speed + accel * throttle, this.maxSpeed)
    } else if (brake > 0) {
      const maxReverseSpeed = -(this.maxSpeed / this.reverseSpeedDivider)
      this.speed = Math.max(this.speed - accel * brake, maxReverseSpeed)
    } else {
      this.speed *= this.friction
    }

    if (Math.abs(this.speed) > this.minSpeedToTurn) {
      const direction = this.speed > 0 ? 1 : -1
      this.carAngle += steer * this.turnSpeed * direction

      // Cornering slowdown: harder the turn, more speed is bled off
      if (Math.abs(steer) > 0.1) {
        this.speed *= 1 - Math.abs(steer) * this.corneringSlowdown
      }
    }
  }

  /** Moves the car forward along its current heading each frame. */
  private moveCar() {
    const rad = Phaser.Math.DegToRad(this.carAngle)
    this.car.x += Math.sin(rad) * this.speed
    this.car.y -= Math.cos(rad) * this.speed
    this.car.setRotation(rad)
  }

  /**
   * Resolves collisions with the outer and inner track boundaries.
   *
   * When the car leaves the track, two things happen:
   *   1. Speed is reversed and damped by bounceDamping (simulates an inelastic wall hit).
   *   2. The car is pushed back onto the track along the ellipse surface normal,
   *      wallPushStep pixels per iteration, until it is fully inside the boundary
   *      or wallPushMaxIters is reached (prevents infinite loops on deep penetration).
   *
   * The push direction is derived from the ellipse gradient ∇f = (dx/a², dy/b²),
   * which points perpendicular to the ellipse surface — more accurate than a plain
   * center-to-point vector for non-circular ellipses.
   *
   * A collision sound is played only when the car is moving fast enough to be noticeable.
   */
  private applyTrackPhysics() {
    if (ellipseValue(this.car.x, this.car.y, OUTER) > 1) {
      if (Math.abs(this.speed) > 1) this.sfx.playHit()
      this.speed *= -this.bounceDamping
      const nx = (this.car.x - OUTER.cx) / (OUTER.a * OUTER.a)
      const ny = (this.car.y - OUTER.cy) / (OUTER.b * OUTER.b)
      const len = Math.sqrt(nx * nx + ny * ny)
      let iters = 0
      while (ellipseValue(this.car.x, this.car.y, OUTER) > 1 && iters++ < this.wallPushMaxIters) {
        this.car.x -= (nx / len) * this.wallPushStep
        this.car.y -= (ny / len) * this.wallPushStep
      }
    }

    if (ellipseValue(this.car.x, this.car.y, INNER) < 1) {
      if (Math.abs(this.speed) > 1) this.sfx.playHit()
      this.speed *= -this.bounceDamping
      const nx = (this.car.x - INNER.cx) / (INNER.a * INNER.a)
      const ny = (this.car.y - INNER.cy) / (INNER.b * INNER.b)
      const len = Math.sqrt(nx * nx + ny * ny)
      let iters = 0
      while (ellipseValue(this.car.x, this.car.y, INNER) < 1 && iters++ < this.wallPushMaxIters) {
        this.car.x += (nx / len) * this.wallPushStep
        this.car.y += (ny / len) * this.wallPushStep
      }
    }
  }

  // ── Checkpoints & lap ─────────────────────────────────────────

  /**
   * Checks if the car has reached the next checkpoint in sequence.
   * Shows a brief HUD notification on each pass.
   */
  private checkCheckpoints() {
    if (this.nextCheckpoint >= this.checkpoints.length) return

    const cp = this.checkpoints[this.nextCheckpoint]
    const dx = this.car.x - cp.x
    const dy = this.car.y - cp.y

    if (Math.sqrt(dx * dx + dy * dy) < this.cpRadius) {
      this.nextCheckpoint++
      this.hud.showCheckpointFlash(this.nextCheckpoint, this.checkpoints.length)
    }
  }

  /**
   * Detects finish line crossings and increments the lap counter.
   * A lap is only counted when all checkpoints have been passed in order.
   */
  private checkFinishLine(delta: number) {
    this.finishCooldown -= delta
    if (this.finishCooldown > 0) return

    const x            = this.car.x
    const y            = this.car.y
    const finishTop    = OUTER.cy - OUTER.b
    const finishBottom = OUTER.cy - INNER.b

    if (
      x > OUTER.cx - this.finishZoneHalfWidth &&
      x < OUTER.cx + this.finishZoneHalfWidth &&
      y > finishTop && y < finishBottom &&
      this.speed > 0
    ) {
      if (this.nextCheckpoint < this.checkpoints.length) return
      this.nextCheckpoint  = 0
      this.lapCount++
      gameStore.currentLap = this.lapCount
      this.finishCooldown  = this.lapCooldown

      if (this.lapCount >= gameStore.totalLaps) {
        this.raceFinished = true
        this.sfx.playRaceFinish()
        this.sfx.stop()
        const totalTime = this.time.now - this.raceStartTime
        this.time.delayedCall(this.gameoverDelay, () => {
          finishRace(totalTime)
          this.scene.stop()
        })
      } else {
        this.sfx.playLapComplete()
      }
    }
  }

  // ── Car setup ─────────────────────────────────────────────────

  private generateCarTexture() {
    const W = 48
    const H = 72
    const g = this.make.graphics({ x: 0, y: 0 })

    g.fillStyle(0x000000, 0.25)
    g.fillEllipse(W / 2 + 2, H / 2 + 3, W - 8, H - 14)

    g.fillStyle(0x1a1a1a)
    g.fillRoundedRect(3, H - 22, 10, 16, 2)
    g.fillRoundedRect(W - 13, H - 22, 10, 16, 2)
    g.fillRoundedRect(3, 8, 10, 16, 2)
    g.fillRoundedRect(W - 13, 8, 10, 16, 2)

    g.fillStyle(0x555555)
    g.fillRect(5, 10, 6, 3)
    g.fillRect(W - 11, 10, 6, 3)
    g.fillRect(5, H - 20, 6, 3)
    g.fillRect(W - 11, H - 20, 6, 3)

    g.fillStyle(0xcc1100)
    g.fillRoundedRect(10, 4, W - 20, H - 8, 6)

    g.fillStyle(0xaa0e00)
    g.fillRoundedRect(10, 4, 5, H - 8, { tl: 6, bl: 6, tr: 0, br: 0 })
    g.fillRoundedRect(W - 15, 4, 5, H - 8, { tl: 0, bl: 0, tr: 6, br: 6 })

    g.fillStyle(0x880c00)
    g.fillRoundedRect(14, 22, W - 28, 28, 4)

    g.fillStyle(0x99ddff, 0.85)
    g.fillRoundedRect(14, 10, W - 28, 14, 3)

    g.fillStyle(0x336688, 0.5)
    g.fillRect(14, 10, W - 28, 4)

    g.fillStyle(0x99ddff, 0.65)
    g.fillRoundedRect(16, 50, W - 32, 10, 2)

    g.fillStyle(0xffffcc)
    g.fillRoundedRect(13, 5, 8, 5, 1)
    g.fillRoundedRect(W - 21, 5, 8, 5, 1)

    g.fillStyle(0xffffff)
    g.fillRect(15, 6, 4, 3)
    g.fillRect(W - 19, 6, 4, 3)

    g.fillStyle(0xff2200)
    g.fillRoundedRect(13, H - 10, 8, 5, 1)
    g.fillRoundedRect(W - 21, H - 10, 8, 5, 1)

    g.fillStyle(0xff6644)
    g.fillRect(15, H - 9, 4, 3)
    g.fillRect(W - 19, H - 9, 4, 3)

    g.lineStyle(1, 0x991100, 0.8)
    g.beginPath()
    g.moveTo(W / 2, 8)
    g.lineTo(W / 2, 22)
    g.strokePath()

    g.generateTexture('car', W, H)
    g.destroy()
  }

  private createCar() {
    this.car = this.add.sprite(OUTER.cx, OUTER.cy - OUTER.b + 55, 'car')
    this.car.setScale(0.65)
    this.car.setDepth(10)
    this.carAngle = -90
    this.car.setRotation(Phaser.Math.DegToRad(this.carAngle))
  }
}
