export interface GamepadInput {
  steer: number    // -1 (sol) .. 1 (sağ)
  throttle: number // 0 .. 1
  brake: number    // 0 .. 1
}

export class GamepadManager {
  private readonly DEADZONE = 0.12

  /** Bağlı ilk gamepad'den normalize edilmiş input döner, yoksa null */
  getInput(): GamepadInput | null {
    const gp = this.activeGamepad()
    if (!gp) return null

    // Sol stick X → direksiyon
    const steer = this.deadzone(gp.axes[0] ?? 0)

    // RT (button[7]) → gaz, LT (button[6]) → fren
    // Analog trigger değeri button.value üzerinden gelir (0..1)
    const rtValue = gp.buttons[7]?.value ?? 0
    const ltValue = gp.buttons[6]?.value ?? 0

    // Sol stick Y de çalışsın (yukarı = gaz, aşağı = fren)
    const stickY = gp.axes[1] ?? 0
    const stickThrottle = stickY < -this.DEADZONE ? -stickY : 0
    const stickBrake = stickY > this.DEADZONE ? stickY : 0

    // D-pad desteği (dijital fallback)
    const dUp = gp.buttons[12]?.pressed ? 1 : 0
    const dDown = gp.buttons[13]?.pressed ? 1 : 0
    const dLeft = gp.buttons[14]?.pressed ? -1 : 0
    const dRight = gp.buttons[15]?.pressed ? 1 : 0
    const dSteer = dLeft + dRight

    return {
      steer: this.clamp(steer !== 0 ? steer : dSteer),
      throttle: Math.max(rtValue, stickThrottle, dUp),
      brake: Math.max(ltValue, stickBrake, dDown),
    }
  }

  isConnected(): boolean {
    return this.activeGamepad() !== null
  }

  connectedName(): string | null {
    return this.activeGamepad()?.id ?? null
  }

  private activeGamepad(): Gamepad | null {
    for (const gp of navigator.getGamepads()) {
      if (gp && gp.connected) return gp
    }
    return null
  }

  private deadzone(v: number): number {
    if (Math.abs(v) < this.DEADZONE) return 0
    return (v - Math.sign(v) * this.DEADZONE) / (1 - this.DEADZONE)
  }

  private clamp(v: number): number {
    return Math.max(-1, Math.min(1, v))
  }
}
