export class SoundManager {
  private ctx: AudioContext

  // Engine chain: osc1 + osc2 → distortion → filter → gain → out
  private engineOsc1: OscillatorNode
  private engineOsc2: OscillatorNode
  private engineGain: GainNode
  private engineFilter: BiquadFilterNode

  // Screech chain: noise → bandpass → gain → out
  private screechSource: AudioBufferSourceNode | null = null
  private screechGain: GainNode
  private screechFilter: BiquadFilterNode

  private running = false

  private readonly engineStartVol = 0.18  // gain applied when race starts
  private readonly audioSmoothing = 0.06  // time-constant (s) for all per-frame parameter ramps

  constructor() {
    this.ctx = new AudioContext()

    // ── Engine ──────────────────────────────────────────────────
    this.engineOsc1 = this.ctx.createOscillator()
    this.engineOsc2 = this.ctx.createOscillator()
    const distortion = this.createDistortion(60)
    this.engineFilter = this.ctx.createBiquadFilter()
    this.engineGain = this.ctx.createGain()

    this.engineOsc1.type = 'sawtooth'
    this.engineOsc1.frequency.value = 80
    this.engineOsc2.type = 'sawtooth'
    this.engineOsc2.frequency.value = 83 // slight detune for thickness

    this.engineFilter.type = 'lowpass'
    this.engineFilter.frequency.value = 400
    this.engineGain.gain.value = 0

    this.engineOsc1.connect(distortion)
    this.engineOsc2.connect(distortion)
    distortion.connect(this.engineFilter)
    this.engineFilter.connect(this.engineGain)
    this.engineGain.connect(this.ctx.destination)

    this.engineOsc1.start()
    this.engineOsc2.start()

    // ── Screech ─────────────────────────────────────────────────
    this.screechFilter = this.ctx.createBiquadFilter()
    this.screechFilter.type = 'bandpass'
    this.screechFilter.frequency.value = 3200
    this.screechFilter.Q.value = 0.8

    this.screechGain = this.ctx.createGain()
    this.screechGain.gain.value = 0

    this.screechFilter.connect(this.screechGain)
    this.screechGain.connect(this.ctx.destination)

    this.startScreechNoise()
  }

  // ── Setup helpers ────────────────────────────────────────────

  private createDistortion(amount: number): WaveShaperNode {
    const ws = this.ctx.createWaveShaper()
    const n = 256
    const curve = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x))
    }
    ws.curve = curve
    ws.oversample = '2x'
    return ws
  }

  private startScreechNoise() {
    const rate = this.ctx.sampleRate
    const buf = this.ctx.createBuffer(1, rate * 3, rate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

    this.screechSource = this.ctx.createBufferSource()
    this.screechSource.buffer = buf
    this.screechSource.loop = true
    this.screechSource.connect(this.screechFilter)
    this.screechSource.start()
  }

  // ── Public API ────────────────────────────────────────────────

  start() {
    if (this.ctx.state === 'suspended') this.ctx.resume()
    this.running = true
    this.engineGain.gain.setTargetAtTime(this.engineStartVol, this.ctx.currentTime, 0.1)
  }

  stop() {
    this.running = false
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4)
    this.screechGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1)
  }

  /** Call every frame with current speed (−1..1 normalised) */
  updateEngine(normalizedSpeed: number) {
    if (!this.running) return
    const t = Math.abs(normalizedSpeed)
    const baseFreq = 75 + t * 200
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, this.audioSmoothing)
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.04, this.ctx.currentTime, this.audioSmoothing)
    this.engineFilter.frequency.setTargetAtTime(300 + t * 900, this.ctx.currentTime, this.audioSmoothing)
    const vol = 0.12 + t * 0.1
    this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, this.audioSmoothing)
  }

  /** Call when screeching (hard turn + speed, or on grass) */
  setScreech(active: boolean) {
    if (!this.running) return
    const target = active ? 0.01 : 0
    this.screechGain.gain.setTargetAtTime(target, this.ctx.currentTime, active ? 0.05 : 0.12)
  }

  /** Short thump for wall collision */
  playHit() {
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const dist = this.createDistortion(80)

    osc.type = 'sine'
    osc.frequency.value = 130
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.18)

    gain.gain.value = 0.5
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22)

    osc.connect(dist)
    dist.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.25)
  }

  /** Short beep for countdown numbers (3, 2, 1) */
  playCountdownBeep() {
    if (this.ctx.state === 'suspended') this.ctx.resume()
    this.scheduleBeep(440, 'sine', 0.25, 0, 0.12)
  }

  /** Longer high-pitched double beep for GO! */
  playCountdownGo() {
    if (this.ctx.state === 'suspended') this.ctx.resume()
    this.scheduleBeep(880, 'sine', 0.35, 0,    0.18)
    this.scheduleBeep(880, 'sine', 0.25, 0.22, 0.28)
  }

  /** Ascending arpeggio on lap complete */
  playLapComplete() {
    ;[523, 659, 784, 1047].forEach((freq, i) => {
      this.scheduleBeep(freq, 'square', 0.09, i * 0.11, 0.13)
    })
  }

  /** Victory fanfare on race finish */
  playRaceFinish() {
    const melody = [
      [523, 0],
      [523, 0.1],
      [523, 0.2],
      [659, 0.35],
      [784, 0.55],
      [1047, 0.75],
    ] as const
    melody.forEach(([freq, t]) => this.scheduleBeep(freq, 'square', 0.12, t, 0.18))
  }

  private scheduleBeep(
    freq: number,
    type: OscillatorType,
    vol: number,
    startOffset: number,
    duration: number,
  ) {
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.value = 0
    const t = this.ctx.currentTime + startOffset
    gain.gain.setTargetAtTime(vol, t, 0.01)
    gain.gain.setTargetAtTime(0, t + duration * 0.7, 0.03)
    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + duration + 0.1)
  }

  destroy() {
    this.screechSource?.stop()
    this.engineOsc1.stop()
    this.engineOsc2.stop()
    this.ctx.close()
  }
}
