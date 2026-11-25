// The space behind everything: a few layers of stars and chalk marks that drift, and shift a little with the pointer.
const GLYPHS = ['·', '∘', 'e', 'a·b', '△', '□', '(ab)c', '≅', '◁', '?', 'a⁻¹', '⟲', '×', 'ab = ba ?']

interface Mote { x: number; y: number; depth: number; glyph: string | undefined; size: number; phase: number; spin: number }

export function startSky(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let w = 0, h = 0, px = 0, py = 0, tx = 0, ty = 0
  let seed = 20221006
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const motes: Mote[] = []
  for (let i = 0; i < 150; i++) {
    const glyph = i < 26 ? GLYPHS[i % GLYPHS.length] : undefined
    const depth = glyph ? 0.35 + rnd() * 0.65 : 0.15 + rnd() * 0.85
    motes.push({ x: rnd(), y: rnd(), depth, glyph, size: glyph ? 13 + depth * 20 : 0.5 + depth * 1.3, phase: rnd() * 6.28, spin: (rnd() - 0.5) * 0.5 })
  }
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth; h = window.innerHeight
    canvas.width = w * dpr; canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  const draw = (time: number) => {
    const t = time / 1000
    px += (tx - px) * 0.04; py += (ty - py) * 0.04
    ctx.clearRect(0, 0, w, h)
    for (const m of motes) {
      // nearer things move further, both with time and with the pointer
      const x = ((m.x + t * 0.004 * m.depth) % 1) * (w + 80) - 40 - px * 34 * m.depth
      const y = ((m.y + Math.sin(t * 0.05 + m.phase) * 0.012 * m.depth + 1) % 1) * (h + 80) - 40 - py * 34 * m.depth
      const twinkle = 0.55 + 0.45 * Math.sin(t * (0.6 + m.depth) + m.phase)
      if (m.glyph) {
        ctx.save()
        ctx.translate(x, y); ctx.rotate(m.spin + Math.sin(t * 0.07 + m.phase) * 0.12)
        ctx.font = `${m.size}px Virgil, cursive`
        ctx.fillStyle = `rgba(190, 200, 235, ${0.035 + 0.075 * m.depth * twinkle})`
        ctx.fillText(m.glyph, 0, 0)
        ctx.restore()
      } else {
        ctx.fillStyle = `rgba(225, 230, 255, ${0.12 + 0.5 * m.depth * twinkle})`
        ctx.beginPath(); ctx.arc(x, y, m.size, 0, 6.2832); ctx.fill()
      }
    }
    if (!still) requestAnimationFrame(draw)
  }
  window.addEventListener('resize', () => { resize(); if (still) draw(0) })
  window.addEventListener('pointermove', (e) => { tx = e.clientX / w - 0.5; ty = e.clientY / h - 0.5 })
  resize()
  // the handwriting font may arrive after the first frame; the loop simply picks it up
  requestAnimationFrame(draw)
}
