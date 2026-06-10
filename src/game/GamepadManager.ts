export interface GamepadInput {
  steer: number    // -1 (left) .. 1 (right)
  throttle: number // 0 .. 1
  brake: number    // 0 .. 1
}

export class GamepadManager {
  private readonly deadzone = 0.12

  /**
   * Returns normalised input from the first connected gamepad, or null if none is connected.
   * Gamepad axes and buttons are mapped as follows:
   *   - Left stick X  → steer
   *   - Left stick Y  → throttle / brake (push up = throttle, push down = brake)
   *   - RT / R2       → throttle (analog)
   *   - LT / L2       → brake (analog)
   *   - D-pad         → digital fallback for steer / throttle / brake
   */
  getInput(): GamepadInput | null {
    const gp = this.activeGamepad()
    if (!gp) return null

    const steer = this.applyDeadzone(gp.axes[0] ?? 0)

    const rtValue = gp.buttons[7]?.value ?? 0
    const ltValue = gp.buttons[6]?.value ?? 0

    // Left stick Y: negative = up = throttle, positive = down = brake
    const stickY = gp.axes[1] ?? 0
    const stickThrottle = stickY < -this.deadzone ? -stickY : 0
    const stickBrake    = stickY > this.deadzone  ?  stickY : 0

    // D-pad digital fallback
    const dUp    = gp.buttons[12]?.pressed ? 1  : 0
    const dDown  = gp.buttons[13]?.pressed ? 1  : 0
    const dLeft  = gp.buttons[14]?.pressed ? -1 : 0
    const dRight = gp.buttons[15]?.pressed ? 1  : 0
    const dSteer = dLeft + dRight

    return {
      steer:    this.clamp(steer !== 0 ? steer : dSteer),
      throttle: Math.max(rtValue, stickThrottle, dUp),
      brake:    Math.max(ltValue, stickBrake,    dDown),
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

  /**
   * Removes the dead zone from a raw axis value and rescales the remaining range to -1..1.
   */
  private applyDeadzone(v: number): number {
    if (Math.abs(v) < this.deadzone) return 0
    return (v - Math.sign(v) * this.deadzone) / (1 - this.deadzone)
  }

  private clamp(v: number): number {
    return Math.max(-1, Math.min(1, v))
  }
}
