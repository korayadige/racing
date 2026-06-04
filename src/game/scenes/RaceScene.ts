import Phaser from 'phaser'
import { gameStore, finishRace } from '../../stores/gameStore'
import { SoundManager } from '../SoundManager'
import { GamepadManager } from '../GamepadManager'

const SCREEN_CENTER_X = 550
const SCREEN_CENTER_Y = 375

const OUTER_TRACK_RADIUS_X = 485
const OUTER_TRACK_RADIUS_Y = 310

const INNER_TRACK_RADIUS_X = 270
const INNER_TRACK_RADIUS_Y = 165

const OUTER = {
  cx: SCREEN_CENTER_X,
  cy: SCREEN_CENTER_Y,
  a: OUTER_TRACK_RADIUS_X,
  b: OUTER_TRACK_RADIUS_Y,
}

const INNER = {
  cx: SCREEN_CENTER_X,
  cy: SCREEN_CENTER_Y,
  a: INNER_TRACK_RADIUS_X,
  b: INNER_TRACK_RADIUS_Y,
}

/**
 * Returns a value < 1 if the point is inside the ellipse, = 1 on the boundary, > 1 outside.
 */
function ellipseValue(x: number, y: number, e: typeof OUTER): number {
  return ((x - e.cx) / e.a) ** 2 + ((y - e.cy) / e.b) ** 2
}

/**
 * Returns true if the point is within the drivable track surface (between inner and outer ellipses).
 */
function isOnTrack(x: number, y: number): boolean {
  return ellipseValue(x, y, OUTER) <= 1 && ellipseValue(x, y, INNER) >= 1
}

export class RaceScene extends Phaser.Scene {
  private car!: Phaser.GameObjects.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys

  private speed = 0
  private carAngle = 0
  private readonly maxSpeed = 9
  private readonly acceleration = 0.28
  private readonly friction = 0.94
  private readonly turnSpeed = 3.2
  private readonly grassAccelPenalty = 0.65
  private readonly minSpeedToTurn = 0.2
  private readonly reverseSpeedDivider = 2
  private readonly bounceDamping = 0.3      // fraction of speed retained (inverted) after wall impact
  private readonly wallPushStep = 3         // pixels pushed per iteration when resolving overlap
  private readonly wallPushMaxIters = 20    // safety cap to prevent infinite loop on deep penetration

  private lapCount = 0
  private raceStartTime = 0
  private timerText!: Phaser.GameObjects.Text
  private lapText!: Phaser.GameObjects.Text
  private speedText!: Phaser.GameObjects.Text

  private sfx!: SoundManager
  private gamepad!: GamepadManager
  private gamepadText!: Phaser.GameObjects.Text
  private finishCooldown = 3000
  private raceFinished = false

  /** Right, bottom, and left gates — must all be passed in order before a lap counts. */
  private readonly checkpoints = [
    { x: 927, y: 375 },
    { x: 550, y: 613 },
    { x: 173, y: 375 },
  ] as const
  private readonly cpRadius = 55
  private nextCheckpoint = 0
  private checkpointText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'RaceScene' })
  }

  create() {
    this.drawTrack()
    this.generateCarTexture()
    this.createCar()
    this.createHUD()
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.raceStartTime = this.time.now
    this.lapCount = 0
    this.nextCheckpoint = 0
    gameStore.currentLap = 0

    this.sfx = new SoundManager()
    this.sfx.start()
    this.gamepad = new GamepadManager()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sfx.destroy())
  }

  // ── Track drawing ──────────────────────────────────────────────

  private drawTrack() {
    const g = this.add.graphics()

    // Mowed grass stripes
    const stripeH = 30
    for (let y = 0; y < 750; y += stripeH) {
      g.fillStyle(Math.floor(y / stripeH) % 2 === 0 ? 0x2d6e22 : 0x347a28)
      g.fillRect(0, y, 1100, stripeH)
    }

    // Road surface
    g.fillStyle(0x2e2e2e)
    g.fillEllipse(OUTER.cx, OUTER.cy, OUTER.a * 2, OUTER.b * 2)

    // Subtle lighter band in the middle of the road
    const midA = (OUTER.a + INNER.a) / 2
    const midB = (OUTER.b + INNER.b) / 2
    g.fillStyle(0x333333)
    g.fillEllipse(OUTER.cx, OUTER.cy, (midA + 45) * 2, (midB + 45) * 2)
    g.fillStyle(0x2e2e2e)
    g.fillEllipse(OUTER.cx, OUTER.cy, (midA - 45) * 2, (midB - 45) * 2)

    // Inner grass island
    g.fillStyle(0x307224)
    g.fillEllipse(INNER.cx, INNER.cy, INNER.a * 2, INNER.b * 2)

    // Kerb stripes (polygon per segment)
    this.drawKerbs(g)

    // White edge lines (on top of kerbs)
    g.lineStyle(4, 0xffffff, 0.85)
    g.strokeEllipse(OUTER.cx, OUTER.cy, (OUTER.a - 16) * 2, (OUTER.b - 16) * 2)
    g.strokeEllipse(INNER.cx, INNER.cy, (INNER.a + 16) * 2, (INNER.b + 16) * 2)

    // Dashed center line
    this.drawDashedCenterLine(g)

    // Trees (before barriers so barriers render on top)
    this.drawTrees(g)

    // Tire barriers
    this.drawTireBarriers(g)

    // Finish line
    this.drawFinishLine(g)

    // Checkpoint gates
    this.drawCheckpointGates(g)

    // Starting position marker
    g.fillStyle(0xffffff, 0.3)
    g.fillRect(546, OUTER.cy - OUTER.b + 2, 8, 38)
  }

  private drawKerbs(g: Phaser.GameObjects.Graphics) {
    const steps = 80
    const kerbW = 16
    for (let i = 0; i < steps; i++) {
      const t0 = (i / steps) * Math.PI * 2
      const t1 = ((i + 1) / steps) * Math.PI * 2
      g.fillStyle(i % 2 === 0 ? 0xff2222 : 0xffffff)

      // Outer kerb — inside the outer ellipse edge
      g.fillPoints([
        { x: OUTER.cx + OUTER.a * Math.cos(t0),           y: OUTER.cy + OUTER.b * Math.sin(t0) },
        { x: OUTER.cx + OUTER.a * Math.cos(t1),           y: OUTER.cy + OUTER.b * Math.sin(t1) },
        { x: OUTER.cx + (OUTER.a - kerbW) * Math.cos(t1), y: OUTER.cy + (OUTER.b - kerbW) * Math.sin(t1) },
        { x: OUTER.cx + (OUTER.a - kerbW) * Math.cos(t0), y: OUTER.cy + (OUTER.b - kerbW) * Math.sin(t0) },
      ] as unknown as Array<Phaser.Math.Vector2>, true)

      // Inner kerb — outside the inner ellipse edge
      g.fillPoints([
        { x: INNER.cx + INNER.a * Math.cos(t0),           y: INNER.cy + INNER.b * Math.sin(t0) },
        { x: INNER.cx + INNER.a * Math.cos(t1),           y: INNER.cy + INNER.b * Math.sin(t1) },
        { x: INNER.cx + (INNER.a + kerbW) * Math.cos(t1), y: INNER.cy + (INNER.b + kerbW) * Math.sin(t1) },
        { x: INNER.cx + (INNER.a + kerbW) * Math.cos(t0), y: INNER.cy + (INNER.b + kerbW) * Math.sin(t0) },
      ] as unknown as Array<Phaser.Math.Vector2>, true)
    }
  }

  private drawTireBarriers(g: Phaser.GameObjects.Graphics) {
    const steps = 110
    const r = 6
    const colors = [0xcc1100, 0xffffff, 0xcc1100, 0xffffff, 0x1144cc]
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2
      const color = colors[i % colors.length]

      g.fillStyle(0x000000, 0.3)
      g.fillCircle(OUTER.cx + (OUTER.a + 24) * Math.cos(t) + 2, OUTER.cy + (OUTER.b + 24) * Math.sin(t) + 2, r)
      g.fillStyle(color)
      g.fillCircle(OUTER.cx + (OUTER.a + 24) * Math.cos(t), OUTER.cy + (OUTER.b + 24) * Math.sin(t), r)

      g.fillStyle(0x000000, 0.3)
      g.fillCircle(INNER.cx + (INNER.a - 24) * Math.cos(t) + 2, INNER.cy + (INNER.b - 24) * Math.sin(t) + 2, r)
      g.fillStyle(color)
      g.fillCircle(INNER.cx + (INNER.a - 24) * Math.cos(t), INNER.cy + (INNER.b - 24) * Math.sin(t), r)
    }
  }

  private drawTrees(g: Phaser.GameObjects.Graphics) {
    // Outside trees
    for (let i = 0; i < 30; i++) {
      const t = (i / 30) * Math.PI * 2
      if (Math.sin(t) < -0.72) continue // leave space near finish line (top of oval)

      const offset = 58 + (i % 4) * 16
      const x = OUTER.cx + (OUTER.a + offset) * Math.cos(t)
      const y = OUTER.cy + (OUTER.b + offset * 0.7) * Math.sin(t)
      const sz = 13 + (i % 5) * 4

      g.fillStyle(0x000000, 0.22)
      g.fillCircle(x + 4, y + 4, sz)
      g.fillStyle(0x1a5014)
      g.fillCircle(x, y, sz)
      g.fillStyle(0x267820)
      g.fillCircle(x - 2, y - 2, sz * 0.72)
      g.fillStyle(0x38a030)
      g.fillCircle(x - 4, y - 4, sz * 0.42)
    }

    // Inside island trees
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2
      const rFrac = 0.42 + (i % 3) * 0.18
      const x = INNER.cx + INNER.a * rFrac * Math.cos(t)
      const y = INNER.cy + INNER.b * rFrac * Math.sin(t)
      const sz = 14 + (i % 4) * 5

      g.fillStyle(0x000000, 0.22)
      g.fillCircle(x + 3, y + 3, sz)
      g.fillStyle(0x1a5014)
      g.fillCircle(x, y, sz)
      g.fillStyle(0x267820)
      g.fillCircle(x - 2, y - 2, sz * 0.72)
      g.fillStyle(0x38a030)
      g.fillCircle(x - 4, y - 4, sz * 0.42)
    }
  }

  private drawDashedCenterLine(g: Phaser.GameObjects.Graphics) {
    const midA = (OUTER.a + INNER.a) / 2
    const midB = (OUTER.b + INNER.b) / 2
    const steps = 72
    g.lineStyle(2, 0xffffff, 0.35)
    for (let i = 0; i < steps; i++) {
      if (i % 3 === 2) continue
      const t0 = (i / steps) * Math.PI * 2
      const t1 = ((i + 1) / steps) * Math.PI * 2
      g.beginPath()
      g.moveTo(OUTER.cx + midA * Math.cos(t0), OUTER.cy + midB * Math.sin(t0))
      g.lineTo(OUTER.cx + midA * Math.cos(t1), OUTER.cy + midB * Math.sin(t1))
      g.strokePath()
    }
  }

  private drawFinishLine(g: Phaser.GameObjects.Graphics) {
    const sq = 8
    const cols = 5
    const rows = 18
    const startX = OUTER.cx - (cols * sq) / 2
    const startY = OUTER.cy - OUTER.b + 2
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        g.fillStyle((row + col) % 2 === 0 ? 0xffffff : 0x000000)
        g.fillRect(startX + col * sq, startY + row * sq, sq, sq)
      }
    }
  }

  private drawCheckpointGates(g: Phaser.GameObjects.Graphics) {
    const color = 0x00ddff
    g.lineStyle(5, color, 0.9)

    g.beginPath(); g.moveTo(820, 375);  g.lineTo(1035, 375); g.strokePath() // right gate
    g.beginPath(); g.moveTo(550, 540);  g.lineTo(550, 685);  g.strokePath() // bottom gate
    g.beginPath(); g.moveTo(65,  375);  g.lineTo(280, 375);  g.strokePath() // left gate

    const labelStyle = { fontSize: '13px', color: '#00ddff', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }
    this.add.text(1038, 368, 'CP1', labelStyle).setDepth(5)
    this.add.text(554,  688, 'CP2', labelStyle).setDepth(5)
    this.add.text(20,   368, 'CP3', labelStyle).setDepth(5)
  }

  // ── Car ───────────────────────────────────────────────────────

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
    this.carAngle = 0
  }

  // ── HUD ───────────────────────────────────────────────────────

  private createHUD() {
    const style = {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 },
    }
    this.timerText = this.add.text(10, 10, 'Time: 0:00.00', style).setDepth(20)
    this.lapText = this.add.text(10, 40, `Lap: 0 / ${gameStore.totalLaps}`, style).setDepth(20)
    this.speedText = this.add.text(10, 70, 'Speed: 0', style).setDepth(20)
    this.gamepadText = this.add.text(10, 100, '🎮 Not connected', {
      ...style,
      color: '#888888',
    }).setDepth(20)
    this.checkpointText = this.add.text(10, 130, '', {
      ...style,
      color: '#00ddff',
    }).setDepth(20)
  }

  // ── Game loop ─────────────────────────────────────────────────

  update(_time: number, delta: number) {
    const { steer, throttle, brake } = this.readInput()
    this.applyInput(steer, throttle, brake)
    this.moveCar()
    this.applyTrackPhysics()
    this.checkCheckpoints()
    this.checkFinishLine(delta)
    this.updateHUD(steer, throttle)
  }

  /**
   * Reads input from keyboard and gamepad. Gamepad takes priority when connected.
   * @returns Normalized steer (-1..1), throttle (0..1), and brake (0..1).
   */
  private readInput(): { steer: number; throttle: number; brake: number } {
    const gp = this.gamepad.getInput()
    if (gp) return gp

    const steer = this.cursors.left.isDown ? -1 : this.cursors.right.isDown ? 1 : 0
    const throttle = this.cursors.up.isDown ? 1 : 0
    const brake = this.cursors.down.isDown ? 1 : 0
    return { steer, throttle, brake }
  }

  /**
   * Applies acceleration, braking, and steering based on input and current speed.
   * Off-road reduces acceleration by GRASS_ACCEL_PENALTY. Steering is reversed in reverse gear.
   * @param steer -1 (left) to 1 (right)
   * @param throttle 0 to 1
   * @param brake 0 to 1
   */
  private applyInput(steer: number, throttle: number, brake: number) {
    const onRoad = isOnTrack(this.car.x, this.car.y)
    const accel = onRoad ? this.acceleration : this.acceleration * this.grassAccelPenalty

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
    }
  }

  /**
   * Moves the car forward along its current heading each frame.
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
   *   1. Speed is reversed and damped by BOUNCE_DAMPING (simulates an inelastic wall hit).
   *   2. The car is pushed back onto the track along the ellipse surface normal,
   *      WALL_PUSH_STEP pixels per iteration, until it is fully inside the boundary
   *      or WALL_PUSH_MAX_ITERS is reached (prevents infinite loops on deep penetration).
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
      const passed = this.nextCheckpoint
      const total = this.checkpoints.length
      this.checkpointText.setText(`CP ${passed}/${total} ✓`).setAlpha(1)
      this.time.delayedCall(1800, () => {
        if (this.checkpointText?.active) this.checkpointText.setAlpha(0)
      })
    }
  }

  /**
   * Detects finish line crossings and increments the lap counter.
   * A lap is only counted when all checkpoints have been passed in order.
   */
  private checkFinishLine(delta: number) {
    this.finishCooldown -= delta
    if (this.finishCooldown > 0) return

    const x = this.car.x
    const y = this.car.y
    const finishTop = OUTER.cy - OUTER.b
    const finishBottom = OUTER.cy - INNER.b

    if (x > OUTER.cx - 25 && x < OUTER.cx + 25 && y > finishTop && y < finishBottom && this.speed > 0) {
      if (this.nextCheckpoint < this.checkpoints.length) return
      this.nextCheckpoint = 0
      this.lapCount++
      gameStore.currentLap = this.lapCount
      this.finishCooldown = 2000

      if (this.lapCount >= gameStore.totalLaps) {
        this.raceFinished = true
        this.sfx.playRaceFinish()
        this.sfx.stop()
        const totalTime = this.time.now - this.raceStartTime
        this.time.delayedCall(1200, () => {
          finishRace(totalTime)
          this.scene.stop()
        })
      } else {
        this.sfx.playLapComplete()
      }
    }
  }

  private updateHUD(steer: number, throttle: number) {
    if (!this.raceFinished) {
      const elapsed = this.time.now - this.raceStartTime
      const m = Math.floor(elapsed / 60000)
      const s = Math.floor((elapsed % 60000) / 1000)
      const cs = Math.floor((elapsed % 1000) / 10)
      this.timerText.setText(`Time: ${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`)
    }
    this.lapText.setText(`Lap: ${this.lapCount} / ${gameStore.totalLaps}`)
    this.speedText.setText(`Speed: ${Math.abs(this.speed * 40).toFixed(0)} km/h`)

    if (this.gamepad.isConnected()) {
      const name = this.gamepad.connectedName() ?? ''
      const shortName = name.length > 30 ? name.slice(0, 30) + '…' : name
      this.gamepadText.setColor('#44ff88').setText(`🎮 ${shortName}`)
    } else {
      this.gamepadText.setColor('#888888').setText('🎮 Not connected')
    }

    this.sfx.updateEngine(this.speed / this.maxSpeed)
    const onGrass = !isOnTrack(this.car.x, this.car.y)
    const hardTurn = Math.abs(steer) > 0.5 && Math.abs(this.speed) > this.maxSpeed * 0.5
    this.sfx.setScreech(hardTurn || (onGrass && throttle > 0 && Math.abs(this.speed) > 1))
  }
}
