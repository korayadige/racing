import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Placeholder: asset preloads go here
  }

  create() {
    this.scene.start('RaceScene')
  }
}
