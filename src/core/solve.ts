// Two solvers.
//  1. tables(): which completed group tables agree with some given cells? Exact, by searching
//     "catalogue group x way of numbering its elements". Decides uniqueness and names a finished table.
//  2. Grid: the reasoning a player does, in layers. Decides how hard a puzzle is and produces hints.
import { GROUPS, type GroupInfo } from './groups.ts'

export type Clue = readonly [row: number, col: number, value: number]

const divCache = new Map<string, { L: Int8Array; R: Int8Array }>()
function divisions(g: GroupInfo) {
  let d = divCache.get(g.id)
  if (!d) {
    const n = g.order, M = g.table, L = new Int8Array(n * n), R = new Int8Array(n * n)
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { const c = M[a * n + b]; L[a * n + c] = b; R[b * n + c] = a }
    divCache.set(g.id, (d = { L, R }))
  }
  return d
}

/** every numbering phi (label -> element of g) under which all clues hold; visit returns true to stop */
function numberings(g: GroupInfo, clues: readonly Clue[], order: number[], visit: (phi: Int8Array) => boolean): boolean {
  const n = g.order, M = g.table, { L, R } = divisions(g)
  const phi = new Int8Array(n).fill(-1), used = new Uint8Array(n)
  const trail: number[] = []
  const set = (label: number, el: number) => {
    if (used[el]) return false
    phi[label] = el; used[el] = 1; trail.push(label); return true
  }
  const propagate = () => {
    for (let changed = true; changed;) {
      changed = false
      for (const [i, j, k] of clues) {
        const a = phi[i], b = phi[j], c = phi[k]
        if (a >= 0 && b >= 0) {
          const t = M[a * n + b]
          if (c >= 0) { if (c !== t) return false } else { if (!set(k, t)) return false; changed = true }
        } else if (a >= 0 && c >= 0) { if (!set(j, L[a * n + c])) return false; changed = true }
        else if (b >= 0 && c >= 0) { if (!set(i, R[b * n + c])) return false; changed = true }
      }
    }
    return true
  }
  const rec = (): boolean => {
    const label = order.find((x) => phi[x] < 0)
    if (label === undefined) return visit(phi)
    for (let el = 0; el < n; el++) {
      if (used[el]) continue
      const mark = trail.length
      set(label, el)
      if (propagate() && rec()) return true
      while (trail.length > mark) { const x = trail.pop()!; used[phi[x]] = 0; phi[x] = -1 }
    }
    return false
  }
  return rec()
}

export interface Completion { table: Int8Array; group: GroupInfo }

/** distinct completed group tables of order n that agree with the clues (at most `limit`) */
export function tables(n: number, clues: readonly Clue[], limit = 2): Completion[] {
  const weight = new Array(n).fill(0)
  for (const c of clues) for (const x of c) weight[x]++
  const order = [...Array(n).keys()].sort((a, b) => weight[b] - weight[a])
  const seen = new Map<string, Completion>()
  for (const g of GROUPS) {
    if (g.order !== n) continue
    const M = g.table
    const stop = numberings(g, clues, order, (phi) => {
      const inv = new Int8Array(n)
      for (let i = 0; i < n; i++) inv[phi[i]] = i
      const t = new Int8Array(n * n)
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) t[i * n + j] = inv[M[phi[i] * n + phi[j]]]
      const key = t.join(',')
      if (!seen.has(key)) seen.set(key, { table: t, group: g })
      return seen.size >= limit
    })
    if (stop) break
  }
  return [...seen.values()]
}

export const isUnique = (n: number, clues: readonly Clue[]) => tables(n, clues, 2).length === 1

export function cluesOf(t: ArrayLike<number>, n: number): Clue[] {
  const out: Clue[] = []
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (t[a * n + b] >= 0) out.push([a, b, t[a * n + b]])
  return out
}

/** which catalogue group is this complete table? (undefined if it is not a group of a known order) */
export function identify(t: ArrayLike<number>, n: number): GroupInfo | undefined {
  return tables(n, cluesOf(t, n), 1)[0]?.group
}

// ---------------------------------------------------------------------------------------------

class Contradiction extends Error {}
const BAD = new Contradiction()

/** Layers of reasoning. 1: rows and columns. 2: plus associativity. 3: plus "suppose..., contradiction". */
export type Level = 1 | 2 | 3

export class Grid {
  n: number
  val: Int8Array
  cand: Int32Array
  filled = 0
  /** how many candidates had to be ruled out by supposing them */
  supposes = 0

  constructor(n: number, clues: readonly Clue[] = []) {
    this.n = n
    this.val = new Int8Array(n * n).fill(-1)
    this.cand = new Int32Array(n * n).fill((1 << n) - 1)
    for (const [r, c, v] of clues) this.put(r, c, v)
  }

  copy(): Grid {
    const g: Grid = Object.create(Grid.prototype)
    g.n = this.n; g.val = this.val.slice(); g.cand = this.cand.slice(); g.filled = this.filled; g.supposes = 0
    return g
  }

  put(r: number, c: number, v: number): boolean {
    const n = this.n, at = r * n + c
    if (this.val[at] >= 0) { if (this.val[at] !== v) throw BAD; return false }
    const bit = 1 << v
    if (!(this.cand[at] & bit)) throw BAD
    this.val[at] = v; this.cand[at] = bit; this.filled++
    for (let x = 0; x < n; x++) {
      if (x !== c && !(this.cand[r * n + x] &= ~bit)) throw BAD
      if (x !== r && !(this.cand[x * n + c] &= ~bit)) throw BAD
    }
    return true
  }

  private latin(): boolean {
    const n = this.n, val = this.val, cand = this.cand
    let changed = false
    for (let at = 0; at < n * n; at++) {
      const m = cand[at]
      if (val[at] < 0 && (m & (m - 1)) === 0) { this.put((at / n) | 0, at % n, 31 - Math.clz32(m)); changed = true }
    }
    for (let v = 0; v < n; v++) {
      const bit = 1 << v
      for (let r = 0; r < n; r++) {
        let count = 0, where = -1
        for (let c = 0; c < n; c++) if (cand[r * n + c] & bit) { count++; where = c }
        if (!count) throw BAD
        if (count === 1 && val[r * n + where] < 0) { this.put(r, where, v); changed = true }
      }
      for (let c = 0; c < n; c++) {
        let count = 0, where = -1
        for (let r = 0; r < n; r++) if (cand[r * n + c] & bit) { count++; where = r }
        if (!count) throw BAD
        if (count === 1 && val[where * n + c] < 0) { this.put(where, c, v); changed = true }
      }
    }
    return changed
  }

  /** (a·b)·c and a·(b·c) are the same cell value */
  private assoc(): boolean {
    const n = this.n, val = this.val, cand = this.cand
    let changed = false
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const x = val[a * n + b]
      if (x < 0) continue
      for (let c = 0; c < n; c++) {
        const y = val[b * n + c]
        if (y < 0) continue
        const pa = x * n + c, qa = a * n + y, p = val[pa], q = val[qa]
        if (p >= 0 && q >= 0) { if (p !== q) throw BAD }
        else if (p >= 0) { if (this.put(a, y, p)) changed = true }
        else if (q >= 0) { if (this.put(x, c, q)) changed = true }
        else {
          const m = cand[pa] & cand[qa]
          if (!m) throw BAD
          if (m !== cand[pa] || m !== cand[qa]) { cand[pa] = m; cand[qa] = m; changed = true }
        }
      }
    }
    return changed
  }

  private suppose(maxSupposes: number): boolean {
    const n = this.n
    let changed = false
    for (let at = 0; at < n * n; at++) {
      if (this.val[at] >= 0) continue
      for (let v = 0; v < n; v++) {
        if (!((this.cand[at] >> v) & 1)) continue
        const g = this.copy()
        try { g.put((at / n) | 0, at % n, v); g.run(2) } catch (e) {
          if (e !== BAD) throw e
          if (!(this.cand[at] &= ~(1 << v))) throw BAD
          changed = true
          if (++this.supposes > maxSupposes) return false
        }
      }
      // let the cheap rules use what was just learned before supposing further
      if (changed) return true
    }
    return changed
  }

  /** reason at the given level until nothing more follows; throws Contradiction if the cells are inconsistent */
  run(level: Level, maxSupposes = Infinity): void {
    for (;;) {
      let changed = this.latin()
      if (level >= 2 && this.assoc()) changed = true
      if (changed) continue
      if (level >= 3 && this.filled < this.n * this.n && this.supposes <= maxSupposes && this.suppose(maxSupposes)) continue
      return
    }
  }

  get solved() { return this.filled === this.n * this.n }
}

/** does reasoning at this level finish the table? */
export function solvesAt(n: number, clues: readonly Clue[], level: Level, maxSupposes = Infinity): { solved: boolean; supposes: number } {
  const g = new Grid(n, clues)
  try { g.run(level, maxSupposes) } catch (e) { if (e !== BAD) throw e; return { solved: false, supposes: g.supposes } }
  return { solved: g.solved, supposes: g.supposes }
}

/** the lowest level that finishes the table (4 = none of them) */
export function rate(n: number, clues: readonly Clue[]): { level: number; supposes: number } {
  for (const level of [1, 2, 3] as const) {
    const r = solvesAt(n, clues, level)
    if (r.solved) return { level, supposes: r.supposes }
  }
  return { level: 4, supposes: 0 }
}

// ---------------------------------------------------------------------------------------------

export type Hint =
  | { kind: 'cell'; r: number; c: number; v: number }                      // only value left for this cell
  | { kind: 'row' | 'col'; r: number; c: number; v: number }                 // only place left for v in the row / column
  | { kind: 'assoc'; r: number; c: number; v: number; a: number; b: number; c3: number; x: number; y: number }
  | { kind: 'chain'; r: number; c: number; v: number }                       // follows from the rules, several steps
  | { kind: 'suppose'; r: number; c: number; v: number; wrong: number[] }    // the other candidates lead to contradictions

/** the easiest next step from a position (cells must be correct so far) */
export function hint(n: number, cells: ArrayLike<number>, solution: ArrayLike<number>): Hint | undefined {
  const at = (r: number, c: number) => cells[r * n + c]
  // direct candidates: what the filled row and column leave
  const cand = new Int32Array(n * n)
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (at(r, c) >= 0) continue
    let m = (1 << n) - 1
    for (let x = 0; x < n; x++) {
      if (at(r, x) >= 0) m &= ~(1 << at(r, x))
      if (at(x, c) >= 0) m &= ~(1 << at(x, c))
    }
    cand[r * n + c] = m
  }
  // associativity first: it is the rule the game is about
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const x = at(a, b)
    if (x < 0) continue
    for (let c = 0; c < n; c++) {
      const y = at(b, c)
      if (y < 0) continue
      const p = at(x, c), q = at(a, y)
      if (p >= 0 && q < 0) return { kind: 'assoc', r: a, c: y, v: p, a, b, c3: c, x, y }
      if (q >= 0 && p < 0) return { kind: 'assoc', r: x, c, v: q, a, b, c3: c, x, y }
    }
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const m = cand[r * n + c]
    if (at(r, c) < 0 && m && (m & (m - 1)) === 0) return { kind: 'cell', r, c, v: 31 - Math.clz32(m) }
  }
  for (let v = 0; v < n; v++) for (let r = 0; r < n; r++) {
    let count = 0, where = -1, placed = false
    for (let c = 0; c < n; c++) { if (at(r, c) === v) placed = true; else if (cand[r * n + c] >> v & 1) { count++; where = c } }
    if (!placed && count === 1) return { kind: 'row', r, c: where, v }
    count = 0; where = -1; placed = false
    for (let c = 0; c < n; c++) { if (at(c, r) === v) placed = true; else if (cand[c * n + r] >> v & 1) { count++; where = c } }
    if (!placed && count === 1) return { kind: 'col', r: where, c: r, v }
  }
  const clues = cluesOf(cells, n)
  const g = new Grid(n, clues)
  try { g.run(2) } catch { return undefined }
  for (let i = 0; i < n * n; i++) if (cells[i] < 0 && g.val[i] >= 0) return { kind: 'chain', r: (i / n) | 0, c: i % n, v: g.val[i] }
  // nothing follows directly: take the cell with the fewest candidates and say which of them fail
  let best = -1, bestCount = 99
  for (let i = 0; i < n * n; i++) {
    if (cells[i] >= 0) continue
    let k = 0
    for (let m = g.cand[i]; m; m &= m - 1) k++
    if (k < bestCount) { bestCount = k; best = i }
  }
  if (best < 0) return undefined
  const wrong: number[] = []
  for (let v = 0; v < n; v++) if ((g.cand[best] >> v) & 1 && v !== solution[best]) wrong.push(v)
  return { kind: 'suppose', r: (best / n) | 0, c: best % n, v: solution[best], wrong }
}

/** first broken rule among the filled cells, for marking it on the board */
export type Conflict =
  | { kind: 'row' | 'col'; cells: number[] }
  | { kind: 'assoc'; cells: number[]; a: number; b: number; c: number }

export function conflicts(n: number, cells: ArrayLike<number>): Conflict[] {
  const out: Conflict[] = []
  for (let r = 0; r < n; r++) for (let c1 = 0; c1 < n; c1++) for (let c2 = c1 + 1; c2 < n; c2++) {
    if (cells[r * n + c1] >= 0 && cells[r * n + c1] === cells[r * n + c2]) out.push({ kind: 'row', cells: [r * n + c1, r * n + c2] })
    if (cells[c1 * n + r] >= 0 && cells[c1 * n + r] === cells[c2 * n + r]) out.push({ kind: 'col', cells: [c1 * n + r, c2 * n + r] })
  }
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const x = cells[a * n + b]
    if (x < 0) continue
    for (let c = 0; c < n; c++) {
      const y = cells[b * n + c]
      if (y < 0) continue
      const p = cells[x * n + c], q = cells[a * n + y]
      if (p >= 0 && q >= 0 && p !== q) out.push({ kind: 'assoc', cells: [a * n + b, b * n + c, x * n + c, a * n + y], a, b, c })
    }
  }
  return out
}

/** what the filled cells already force (levels 1 and 2), used by "fill what follows" in free building */
export function forced(n: number, cells: ArrayLike<number>): Int8Array | undefined {
  const g = new Grid(n)
  try { for (const [r, c, v] of cluesOf(cells, n)) g.put(r, c, v); g.run(2) } catch { return undefined }
  return g.val
}
