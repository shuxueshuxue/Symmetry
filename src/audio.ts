// All sound is synthesised. Each element has a pitch; the music is the table itself, read cell by cell,
// so it starts sparse and fills in as the table does.

let ctx: AudioContext | undefined
let master: GainNode, echo: DelayNode, sfxGain: GainNode, musicGain: GainNode
let timer: number | undefined

const SCALE = [0, 2, 4, 7, 9] // pentatonic: any two elements sound fine together
const freq = (v: number, base = 196) => base * 2 ** ((SCALE[v % 5] + 12 * Math.floor(v / 5)) / 12)

function ensure(): AudioContext | undefined {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return undefined
  ctx = new AC()
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination)
  echo = ctx.createDelay(1); echo.delayTime.value = 0.42
  const feedback = ctx.createGain(); feedback.gain.value = 0.38
  const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1800
  echo.connect(damp); damp.connect(feedback); feedback.connect(echo); damp.connect(master)
  sfxGain = ctx.createGain(); sfxGain.connect(master)
  musicGain = ctx.createGain(); musicGain.connect(master); musicGain.connect(echo)
  return ctx
}

function tone(out: AudioNode, f: number, at: number, dur: number, peak: number, type: OscillatorType = 'triangle', slideTo?: number) {
  const c = ctx!, o = c.createOscillator(), g = c.createGain()
  o.type = type; o.frequency.setValueAtTime(f, at)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + 0.05)
}

export const audio = {
  soundOn: true,
  musicOn: true,
  /** what the music reads: the current table, or nothing */
  source: undefined as undefined | (() => { n: number; cells: ArrayLike<number> }),

  /** browsers only allow sound after a click or key press */
  wake() {
    const c = ensure()
    if (!c) return
    if (c.state === 'suspended') void c.resume()
    if (timer === undefined) this.startMusic()
  },

  place(v: number) { if (this.soundOn && ensure()) { tone(sfxGain, freq(v, 392), ctx!.currentTime, 0.5, 0.16); tone(echo, freq(v, 392), ctx!.currentTime, 0.3, 0.05) } },
  erase() { if (this.soundOn && ensure()) tone(sfxGain, 180, ctx!.currentTime, 0.12, 0.1, 'sine', 90) },
  select() { if (this.soundOn && ensure()) tone(sfxGain, 1200, ctx!.currentTime, 0.04, 0.025, 'sine') },
  swap(a: number, b: number) {
    if (!this.soundOn || !ensure()) return
    const now = ctx!.currentTime
    tone(sfxGain, freq(a, 392), now, 0.22, 0.12, 'triangle', freq(b, 392))
    tone(sfxGain, freq(b, 392), now + 0.1, 0.3, 0.12, 'triangle', freq(a, 392))
  },
  wrong() {
    if (!this.soundOn || !ensure()) return
    const now = ctx!.currentTime
    tone(sfxGain, 110, now, 0.28, 0.14, 'sine', 82); tone(sfxGain, 116.5, now, 0.28, 0.1, 'sine', 87)
  },
  hint() { if (this.soundOn && ensure()) { const now = ctx!.currentTime; tone(sfxGain, 880, now, 0.5, 0.06, 'sine'); tone(echo, 1320, now + 0.08, 0.5, 0.04, 'sine') } },
  /** the finished table, played through once, row by row, quickly */
  win(n: number, cells: ArrayLike<number>) {
    if (!this.soundOn || !ensure()) return
    const now = ctx!.currentTime, step = Math.min(0.09, 1.6 / n)
    for (let r = 0; r < Math.min(n, 3); r++) for (let c = 0; c < n; c++) tone(sfxGain, freq(cells[r * n + c], 392), now + (r * n + c) * step, 0.5, 0.07)
    const end = now + Math.min(n, 3) * n * step
    for (const v of [0, 2, 4]) { tone(sfxGain, freq(v, 196), end, 2.2, 0.1, 'sine'); tone(echo, freq(v, 392), end, 1.6, 0.05) }
  },

  startMusic() {
    const c = ctx!
    let next = c.currentTime + 0.1, step = 0
    const beat = 0.34
    timer = window.setInterval(() => {
      musicGain.gain.setTargetAtTime(this.musicOn ? 1 : 0, c.currentTime, 0.2)
      while (next < c.currentTime + 0.25) {
        const src = this.source?.()
        if (src) {
          const { n, cells } = src, v = cells[step % (n * n)]
          if (v >= 0) tone(musicGain, freq(v, 196), next, 1.1, 0.035, 'sine')
          // a low note at the start of each row keeps time while the table is still empty
          if (step % n === 0) tone(musicGain, 98 * (Math.floor(step / n) % 2 ? 1.5 : 1), next, beat * n * 0.9, 0.05, 'sine')
        } else if (step % 8 === 0) tone(musicGain, 98 * [1, 1.5, 1.125, 1.5][(step / 8) % 4 | 0], next, beat * 7, 0.045, 'sine')
        step++; next += beat
      }
    }, 80)
  },
}
