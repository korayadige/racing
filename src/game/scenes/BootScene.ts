import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Placeholder: asset yüklemeleri buraya gelecek
  }

  create() {
    this.scene.start('RaceScene')
  }
}
