import Phaser from 'phaser'

/**
 * Renders and manages the in-game pause overlay (Resume / Restart / Main Menu).
 */
export class PauseMenu {
  private readonly scene: Phaser.Scene
  private overlay: Phaser.GameObjects.Container | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Builds and displays the pause overlay.
   * @param onResume  Called when the player clicks Resume.
   * @param onRestart Called when the player clicks Restart.
   * @param onMenu    Called when the player clicks Main Menu.
   */
  show(onResume: () => void, onRestart: () => void, onMenu: () => void): void {
    if (this.overlay) return

    const cx = this.scene.scale.width / 2
    const cy = this.scene.scale.height / 2
    const W = 320
    const H = 260

    const bg = this.scene.add.rectangle(0, 0, W, H, 0x000000, 0.82).setOrigin(0)
    const title = this.scene.add.text(W / 2, 36, 'PAUSED', {
      fontSize: '32px', color: '#ffffff', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5)

    const btnStyle = { fontSize: '20px', color: '#000000' }
    const makeBtn = (y: number, label: string, color: number, cb: () => void) => {
      const btn = this.scene.add.rectangle(W / 2, y, 220, 44, color).setOrigin(0.5).setInteractive()
      const txt = this.scene.add.text(W / 2, y, label, btnStyle).setOrigin(0.5)
      btn.on('pointerover',  () => btn.setAlpha(0.8))
      btn.on('pointerout',   () => btn.setAlpha(1))
      btn.on('pointerdown',  cb)
      return [btn, txt]
    }

    const resumeObjs  = makeBtn(110, 'Resume',    0x44ff88, onResume)
    const restartObjs = makeBtn(165, 'Restart',   0xffdd00, onRestart)
    const menuObjs    = makeBtn(220, 'Main Menu', 0xff6644, onMenu)

    this.overlay = this.scene.add.container(cx - W / 2, cy - H / 2, [
      bg, title, ...resumeObjs, ...restartObjs, ...menuObjs,
    ]).setDepth(100)
  }

  /** Removes the pause overlay from the scene. */
  hide(): void {
    this.overlay?.destroy()
    this.overlay = null
  }
}
