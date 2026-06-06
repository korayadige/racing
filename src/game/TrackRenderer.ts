import Phaser from 'phaser'
import { OUTER, INNER } from './trackConstants'

/**
 * Renders the full track (background, road, kerbs, barriers, trees, finish line, checkpoints)
 * onto the given scene. Called once during scene creation.
 */
export function renderTrack(scene: Phaser.Scene): void {
  const g = scene.add.graphics()

  // Mowed grass stripes
  const stripeH = 30
  const W = scene.scale.width
  const H = scene.scale.height
  for (let y = 0; y < H; y += stripeH) {
    g.fillStyle(Math.floor(y / stripeH) % 2 === 0 ? 0x2d6e22 : 0x347a28)
    g.fillRect(0, y, W, stripeH)
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

  drawKerbs(g)

  // White edge lines (on top of kerbs)
  g.lineStyle(4, 0xffffff, 0.85)
  g.strokeEllipse(OUTER.cx, OUTER.cy, (OUTER.a - 16) * 2, (OUTER.b - 16) * 2)
  g.strokeEllipse(INNER.cx, INNER.cy, (INNER.a + 16) * 2, (INNER.b + 16) * 2)

  drawDashedCenterLine(g)

  // Trees before barriers so barriers render on top
  drawTrees(g)
  drawTireBarriers(g)
  drawFinishLine(g)
  drawCheckpointGates(g, scene)

  // Starting position marker
  g.fillStyle(0xffffff, 0.3)
  g.fillRect(OUTER.cx - 4, OUTER.cy - OUTER.b + 2, 8, 38)
}

function drawKerbs(g: Phaser.GameObjects.Graphics): void {
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

function drawTireBarriers(g: Phaser.GameObjects.Graphics): void {
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

function drawTrees(g: Phaser.GameObjects.Graphics): void {
  // Outside trees
  for (let i = 0; i < 30; i++) {
    const t = (i / 30) * Math.PI * 2
    if (Math.sin(t) < -0.72) continue // leave space near finish line (top of oval)

    const offset = 58 + (i % 4) * 16
    const x = OUTER.cx + (OUTER.a + offset) * Math.cos(t)
    const y = OUTER.cy + (OUTER.b + offset * 0.7) * Math.sin(t)
    const sz = 13 + (i % 5) * 4

    g.fillStyle(0x000000, 0.22); g.fillCircle(x + 4, y + 4, sz)
    g.fillStyle(0x1a5014);       g.fillCircle(x, y, sz)
    g.fillStyle(0x267820);       g.fillCircle(x - 2, y - 2, sz * 0.72)
    g.fillStyle(0x38a030);       g.fillCircle(x - 4, y - 4, sz * 0.42)
  }

  // Inside island trees
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2
    const rFrac = 0.42 + (i % 3) * 0.18
    const x = INNER.cx + INNER.a * rFrac * Math.cos(t)
    const y = INNER.cy + INNER.b * rFrac * Math.sin(t)
    const sz = 14 + (i % 4) * 5

    g.fillStyle(0x000000, 0.22); g.fillCircle(x + 3, y + 3, sz)
    g.fillStyle(0x1a5014);       g.fillCircle(x, y, sz)
    g.fillStyle(0x267820);       g.fillCircle(x - 2, y - 2, sz * 0.72)
    g.fillStyle(0x38a030);       g.fillCircle(x - 4, y - 4, sz * 0.42)
  }
}

function drawDashedCenterLine(g: Phaser.GameObjects.Graphics): void {
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

function drawFinishLine(g: Phaser.GameObjects.Graphics): void {
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

function drawCheckpointGates(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  const color = 0x00ddff
  g.lineStyle(5, color, 0.9)

  // Gate positions derived from track ellipse — left, bottom, right
  const leftX1 = OUTER.cx - OUTER.a;  const leftX2 = OUTER.cx - INNER.a
  const rightX1 = OUTER.cx + INNER.a; const rightX2 = OUTER.cx + OUTER.a
  const botY1 = OUTER.cy + INNER.b;   const botY2 = OUTER.cy + OUTER.b

  g.beginPath(); g.moveTo(leftX1,    OUTER.cy); g.lineTo(leftX2,    OUTER.cy); g.strokePath() // left gate
  g.beginPath(); g.moveTo(OUTER.cx,  botY1);    g.lineTo(OUTER.cx,  botY2);    g.strokePath() // bottom gate
  g.beginPath(); g.moveTo(rightX1,   OUTER.cy); g.lineTo(rightX2,   OUTER.cy); g.strokePath() // right gate

  const labelStyle = { fontSize: '13px', color: '#00ddff', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }
  scene.add.text(leftX1 - 30,    OUTER.cy - 7, 'CP1', labelStyle).setDepth(5)
  scene.add.text(OUTER.cx + 4,   botY2 + 3,    'CP2', labelStyle).setDepth(5)
  scene.add.text(rightX2 + 3,    OUTER.cy - 7, 'CP3', labelStyle).setDepth(5)
}
