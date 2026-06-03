import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { RaceScene } from './scenes/RaceScene'

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 1100,
    height: 750,
    parent,
    backgroundColor: '#1a1a2e',
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scene: [BootScene, RaceScene],
  })
}
