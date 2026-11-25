// Hand-drawn strokes: every line is drawn twice, a little off, with a slight bow.
import { mulberry32, type Rng } from './core/generate.ts'

export const INK = '#1e1e1e', SOFT = '#868e96', BLUE = '#1971c2', PINK = '#c2255c', RED = '#e03131', PAPER = '#fdfcf8'

export class Pen {
  private r: Rng
  constructor(seed: number) { this.r = mulberry32(seed) }
  j(amount: number) { return (this.r() * 2 - 1) * amount }

  line(x1: number, y1: number, x2: number, y2: number, color = INK, width = 1.8, rough = 1.1, passes = 2): string {
    let out = ''
    for (let i = 0; i < passes; i++) {
      const bow = Math.min(Math.hypot(x2 - x1, y2 - y1) * 0.012, 3) * rough
      const mx = (x1 + x2) / 2 + this.j(bow), my = (y1 + y2) / 2 + this.j(bow)
      out += `<path d="M${(x1 + this.j(rough)).toFixed(1)},${(y1 + this.j(rough)).toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${(x2 + this.j(rough)).toFixed(1)},${(y2 + this.j(rough)).toFixed(1)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`
    }
    return out
  }

  rect(x: number, y: number, w: number, h: number, color = INK, width = 1.8, over = 3): string {
    return this.line(x - over, y, x + w + this.j(over), y, color, width) + this.line(x + w, y - over, x + w, y + h + this.j(over), color, width)
      + this.line(x + w + over, y + h, x + this.j(over), y + h, color, width) + this.line(x, y + h + over, x, y + this.j(over), color, width)
  }

  circle(cx: number, cy: number, r: number, color = INK, width = 1.8): string {
    let out = ''
    for (let k = 0; k < 2; k++) {
      const start = this.r() * 6.28, pts: string[] = []
      for (let i = 0; i < 19; i++) {
        const a = start + (i / 18) * 2.08 * Math.PI
        pts.push(`${(cx + (r + this.j(1.2)) * Math.cos(a)).toFixed(1)},${(cy + (r + this.j(1.2)) * Math.sin(a)).toFixed(1)}`)
      }
      out += `<path d="M${pts.join(' L')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`
    }
    return out
  }
}

/** one colour per element, spread around the wheel and kept pale: the labels carry the meaning, the colour shows the pattern */
export const hue = (v: number, n: number) => Math.round((v * 360) / n + 205) % 360
export const tint = (v: number, n: number) => `hsl(${hue(v, n)} 85% 93%)`
export const stroke = (v: number, n: number) => `hsl(${hue(v, n)} 62% 74%)`
export const deep = (v: number, n: number) => `hsl(${hue(v, n)} 55% 42%)`

/** pencil hatching for each element, as SVG patterns */
export function hatchDefs(n: number, prefix: string): string {
  let out = ''
  for (let v = 0; v < n; v++) {
    const angle = -42 + ((v * 37) % 13) - 6, gap = 8 + (v % 3)
    out += `<pattern id="${prefix}${v}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">`
      + `<rect width="${gap}" height="${gap}" fill="${tint(v, n)}"/><line x1="0" y1="${gap / 2}" x2="${gap}" y2="${gap / 2}" stroke="${stroke(v, n)}" stroke-width="3" stroke-linecap="round"/></pattern>`
  }
  return out
}
