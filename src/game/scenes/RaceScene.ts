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

  // ── Physics constants ─────────────────────────────────────────//
  private readonly maxSpeed            = 9
  private readonly acceleration        = 0.15
  private readonly friction            = 0.90
  private readonly turnSpeed           = 3.0
  private readonly grassAccelPenalty   = 0.75
  private readonly minSpeedToTurn      = 0.2
  private readonly corneringSlowdown   = 0.03  // speed loss per frame when steering hard
  private readonly reverseSpeedDivider = 2
  private readonly bounceDamping       = 0.3    // fraction of speed retained (inverted) after wall impact
  private readonly wallPushStep        = 3      // pixels pushed per iteration when resolving overlap
  private readonly wallPushMaxIters    = 25     // safety cap to prevent infinite loop on deep penetration
  private readonly wallShakeDuration   = 110    // ms of camera shake on wall hit
  private readonly wallShakeIntensity  = 0.005  // fraction of screen size for shake amplitude

  // ── Timing constants ──────────────────────────────────────────//
  private readonly initialFinishCooldown = 3000
  private readonly lapCooldown           = 2000
  private readonly gameoverDelay         = 600
  private readonly cpTextDuration        = 2000
  private readonly finishZoneHalfWidth   = 25

  // ── Checkpoint config ─────────────────────────────────────────//
  /** Left, bottom, and right gates — must all be passed in order before a lap counts. */
  private readonly checkpoints = [
    { x: OUTER.cx - (OUTER.a + INNER.a) / 2, y: OUTER.cy },
    { x: OUTER.cx,                            y: OUTER.cy + (OUTER.b + INNER.b) / 2 },
    { x: OUTER.cx + (OUTER.a + INNER.a) / 2, y: OUTER.cy },
  ]
  private readonly cpRadius = 130

  // ── Mutable state ─────────────────────────────────────────────//
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

  // ── Subsystems ────────────────────────────────────────────────//
  private sfx!: SoundManager
  private gamepad!: GamepadManager
  private hud!: HUD
  private pauseMenu!: PauseMenu

  // ── Visual effects ────────────────────────────────────────────//
  private skidMarks!: Phaser.GameObjects.RenderTexture
  private skidStamp!: Phaser.GameObjects.Graphics

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
    this.carAngle        = -90 // start facing left
    this.lapCount        = 0
    this.raceStartTime   = 0
    this.nextCheckpoint  = 0
    this.finishCooldown  = this.initialFinishCooldown
    this.raceFinished    = false
    this.countdownActive = true
    this.paused          = false
    this.pausedElapsed   = 0

    this.sfx       = new SoundManager()
    this.gamepad   = new GamepadManager()
    this.hud       = new HUD(this, this.cpTextDuration)
    this.pauseMenu = new PauseMenu(this)

    this.skidMarks = this.add.renderTexture(0, 0, this.scale.width, this.scale.height).setDepth(5)
    this.skidStamp = new Phaser.GameObjects.Graphics(this)
    this.skidStamp.fillStyle(0x666666, 0.8)
    this.skidStamp.fillCircle(0, 0, 9)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sfx.destroy()
      this.skidStamp.destroy()
    })
    this.input.keyboard!.on('keydown-ESC', () => this.togglePause())

    startCountdown(this, this.sfx, () => {
      this.countdownActive = false
      this.raceStartTime   = this.time.now
      this.sfx.start()
    })
  }

  // ── Pause ─────────────────────────────────────────────────────//

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

  // ── Game loop ─────────────────────────────────────────────────//

  update(_time: number, delta: number) {
    if (this.countdownActive || this.paused) return

    const { steer, throttle, brake } = this.readInput()
    this.applyInput(steer, throttle, brake)
    this.moveCar()
    this.applyTrackPhysics()
    this.drawSkidMarks(steer)
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

  // ── Input ─────────────────────────────────────────────────────//

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

      // Cornering slowdown: skip at near-zero steer to avoid bleed on straight-line driving
      if (Math.abs(steer) > 0.1) {
        this.speed *= 1 - Math.abs(steer) * this.corneringSlowdown
      }
    }
  }

  /**
   * Moves the car forward along its current heading each frame.
   *
   * Angle-based movement model (each wheel moves only in the direction it points):
   * https://engineeringdotnet.blogspot.com/2010/04/simple-2d-car-physics-in-games.html
   */
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
   *   1. Speed is damped by bounceDamping (simulates scraping the wall).
   *   2. The car is pushed back onto the track along the ellipse surface normal,
   *      wallPushStep pixels per iteration, until it is fully inside the boundary
   *      or wallPushMaxIters is reached (prevents infinite loops on deep penetration).
   *
   * The push direction is derived from the ellipse gradient ∇f = (dx/a², dy/b²),
   * which points perpendicular to the ellipse surface — more accurate than a plain
   * center-to-point vector for non-circular ellipses.
   *
   * Screen shake on impact inspired by:
   * https://medium.com/@copet80/how-i-built-an-f1-top-down-racer-in-48-hours-3fc1a66a4716
   */
  private applyTrackPhysics() {
    if (ellipseValue(this.car.x, this.car.y, OUTER) > 1) {
      if (Math.abs(this.speed) > 1) {
        this.sfx.playHit()
        this.cameras.main.shake(this.wallShakeDuration, this.wallShakeIntensity)
      }
      this.speed *= this.bounceDamping
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
      if (Math.abs(this.speed) > 1) {
        this.sfx.playHit()
        this.cameras.main.shake(this.wallShakeDuration, this.wallShakeIntensity)
      }
      this.speed *= this.bounceDamping
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

  /**
   * Stamps a dark smear onto the persistent skid-mark texture when the car is drifting
   * hard or driving on grass. The RenderTexture accumulates marks across frames.
   *
   * Skid-mark technique inspired by:
   * https://medium.com/@romanvinnick/building-a-2d-drift-racing-game-with-react-pixi-js-and-physics-d9f9074c4d0c
   */
  private drawSkidMarks(steer: number) {
    const hardTurn = Math.abs(steer) > 0.5 && Math.abs(this.speed) > this.maxSpeed * 0.45
    const onGrass  = !isOnTrack(this.car.x, this.car.y)
    if (hardTurn || (onGrass && Math.abs(this.speed) > 1)) {
      this.skidMarks.draw(this.skidStamp, this.car.x, this.car.y)
    }
  }

  // ── Checkpoints & lap ─────────────────────────────────────────//

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
      this.nextCheckpoint = 0
      this.lapCount++
      this.finishCooldown = this.lapCooldown

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

  // ── Car setup ─────────────────────────────────────────────────//

  private generateCarTexture() {
    const W = 58
    const H = 90
    const g = this.make.graphics({ x: 0, y: 0 })

    // Drop shadow
    g.fillStyle(0x000000, 0.22)
    g.fillEllipse(W / 2 + 3, H / 2 + 5, W - 4, H - 12)

    // Rear wing (full width, behind body)
    g.fillStyle(0x880c00)
    g.fillRoundedRect(1, H - 14, W - 2, 10, 3)
    g.fillStyle(0x660900)
    g.fillRect(12, H - 14, W - 24, 4)

    // Tires
    g.fillStyle(0x111111)
    g.fillRoundedRect(2, H - 32, 13, 22, 3)
    g.fillRoundedRect(W - 15, H - 32, 13, 22, 3)
    g.fillRoundedRect(2, 12, 13, 20, 3)
    g.fillRoundedRect(W - 15, 12, 13, 20, 3)

    // Wheel rims (dark outer)
    g.fillStyle(0x444444)
    g.fillCircle(8,      H - 21, 6)
    g.fillCircle(W - 8,  H - 21, 6)
    g.fillCircle(8,      22,     6)
    g.fillCircle(W - 8,  22,     6)

    // Wheel rims (silver inner)
    g.fillStyle(0xaaaaaa)
    g.fillCircle(8,      H - 21, 4)
    g.fillCircle(W - 8,  H - 21, 4)
    g.fillCircle(8,      22,     4)
    g.fillCircle(W - 8,  22,     4)

    // Rim center dot
    g.fillStyle(0x333333)
    g.fillCircle(8,      H - 21, 1)
    g.fillCircle(W - 8,  H - 21, 1)
    g.fillCircle(8,      22,     1)
    g.fillCircle(W - 8,  22,     1)

    // Front wing (full width)
    g.fillStyle(0xcc1100)
    g.fillRoundedRect(1, 6, W - 2, 8, 3)

    // Main body
    g.fillStyle(0xcc1100)
    g.fillRoundedRect(13, 4, W - 26, H - 8, 9)

    // Body side panels
    g.fillStyle(0xaa0e00)
    g.fillRoundedRect(13, 4, 6, H - 8, { tl: 9, bl: 9, tr: 0, br: 0 })
    g.fillRoundedRect(W - 19, 4, 6, H - 8, { tl: 0, bl: 0, tr: 9, br: 9 })

    // Cockpit recess
    g.fillStyle(0x880c00)
    g.fillRoundedRect(17, 30, W - 34, 32, 6)

    // White racing stripe
    g.fillStyle(0xffffff, 0.18)
    g.fillRect(W / 2 - 3, 4, 6, H - 8)

    // Windshield
    g.fillStyle(0x99ddff, 0.9)
    g.fillRoundedRect(17, 14, W - 34, 18, 5)
    g.fillStyle(0x336688, 0.35)
    g.fillRect(17, 14, W - 34, 6)

    // Rear window
    g.fillStyle(0x99ddff, 0.7)
    g.fillRoundedRect(19, 64, W - 38, 10, 3)

    // Headlights
    g.fillStyle(0xffffcc)
    g.fillRoundedRect(14, 6, 10, 6, 2)
    g.fillRoundedRect(W - 24, 6, 10, 6, 2)
    g.fillStyle(0xffffff)
    g.fillRect(16, 7, 5, 4)
    g.fillRect(W - 21, 7, 5, 4)

    // Tail lights
    g.fillStyle(0xff2200)
    g.fillRoundedRect(14, H - 13, 10, 6, 2)
    g.fillRoundedRect(W - 24, H - 13, 10, 6, 2)
    g.fillStyle(0xff7755)
    g.fillRect(16, H - 12, 5, 4)
    g.fillRect(W - 21, H - 12, 5, 4)

    // Hood center line
    g.lineStyle(1, 0x991100, 0.7)
    g.beginPath()
    g.moveTo(W / 2, 14)
    g.lineTo(W / 2, 30)
    g.strokePath()

    g.generateTexture('car', W, H)
    g.destroy()
  }

  private createCar() {
    this.car = this.add.sprite(OUTER.cx, OUTER.cy - OUTER.b + 55, 'car') // 55 px inside the top edge, just past the finish line
    this.car.setScale(0.82)
    this.car.setDepth(10)
    this.car.setRotation(Phaser.Math.DegToRad(-90))
  }
}
