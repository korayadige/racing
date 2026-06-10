import Phaser from 'phaser'
import type { SoundManager } from './SoundManager'

const COLORS = ['#ff4444', '#ffcc00', '#44ff44', '#ffd700']
const SIZES  = ['160px',   '160px',   '160px',   '320px'  ]
const STEPS  = ['3',       '2',       '1',       'GO!'    ]

/**
 * Displays a 3-2-1-GO! countdown overlay with sound effects.
 * Calls onComplete after GO! fades, at which point the race should start.
 */
export function startCountdown(
  scene: Phaser.Scene,
  sfx: SoundManager,
  onComplete: () => void,
): void {
  const cx = scene.scale.width / 2
  const cy = scene.scale.height / 2

  const label = scene.add.text(cx, cy, '', {
    fontSize: SIZES[0],
    stroke: '#000000',
    strokeThickness: 10,
  }).setOrigin(0.5).setDepth(50)

  let step = 0

  const tick = () => {
    label.setText(STEPS[step])
    label.setFontSize(SIZES[step])
    label.setColor(COLORS[step])
    label.setScale(1.5)
    scene.tweens.add({ targets: label, scale: 1, duration: 700, ease: 'Back.Out' })

    if (step < STEPS.length - 1) {
      sfx.playCountdownBeep()
    } else {
      sfx.playCountdownGo()
    }

    step++
    if (step < STEPS.length) {
      scene.time.delayedCall(1000, tick)
    } else {
      scene.time.delayedCall(700, () => {
        label.destroy()
        onComplete()
      })
    }
  }

  tick()
}
