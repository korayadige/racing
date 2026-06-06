import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { RaceScene } from './scenes/RaceScene'

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#2d6e22',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1920,
      height: 900,
    },
    scene: [BootScene, RaceScene],
  })
}
