// The table as text. With colour it is the same picture as the page: one colour per element.
import { LABELS } from '../src/core/groups.ts'
import type { Session } from '../src/game/session.ts'

const hue = (v: number, n: number) => Math.round((v * 360) / n + 205) % 360
function rgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l), f = (k: number) => { const x = (k + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(x - 3, 9 - x, 1)))) }
  return [f(0), f(8), f(4)]
}
const paint = (text: string, fg: [number, number, number], bg?: [number, number, number], bold = false) =>
  `\x1b[${bold ? '1;' : ''}38;2;${fg.join(';')}${bg ? `;48;2;${bg.join(';')}` : ''}m${text}\x1b[0m`

export function drawTable(s: Session, colour: boolean, marks: number[] = []): string {
  const n = s.n, lines: string[] = []
  const head = (v: number) => (colour ? paint(` ${LABELS[v]} `, rgb(hue(v, n), 0.85, 0.72)) : ` ${LABELS[v]}`)
  lines.push((colour ? '   ' : ' · |') + [...Array(n).keys()].map(head).join(''))
  if (!colour) lines.push('---+' + '--'.repeat(n))
  for (let r = 0; r < n; r++) {
    let row = colour ? head(r) : `${head(r)} |`
    for (let c = 0; c < n; c++) {
      const at = r * n + c, v = s.cells[at], mark = marks.includes(at)
      if (!colour) row += v < 0 ? (mark ? ' ?' : ' .') : ` ${LABELS[v]}`
      else if (v < 0) row += paint(mark ? ' ? ' : ' · ', mark ? [116, 192, 252] : [70, 76, 100], [22, 24, 36])
      else row += paint(` ${LABELS[v]} `, s.given[at] ? [255, 255, 255] : [160, 215, 255], rgb(hue(v, n), 0.45, mark ? 0.42 : 0.28), !!s.given[at])
    }
    lines.push(row)
  }
  return lines.join('\n')
}
