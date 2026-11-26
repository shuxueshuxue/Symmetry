// One table being worked on: the rules of play, with no screen and no sound.
// The web page and the terminal are two front ends over this.
import { groupsOfOrder, isGroupTable, relabel, type GroupInfo } from '../core/groups.ts'
import { conflicts, forced, hint, identify, type Conflict, type Hint } from '../core/solve.ts'
import { DIFFICULTIES, generate, mulberry32, type Difficulty } from '../core/generate.ts'

interface Snapshot { cells: Int8Array; given: Uint8Array; solution: Int8Array | undefined; perm: number[] }

export interface Session {
  mode: 'puzzle' | 'build'
  n: number
  difficulty: Difficulty
  /** names the puzzle: the same code gives the same puzzle anywhere */
  code: string | undefined
  cells: Int8Array
  given: Uint8Array
  solution: Int8Array | undefined
  /** how the elements have been renumbered since the start: perm[original] = current */
  perm: number[]
  history: Snapshot[]
  hints: number
  /** set once the table is complete and is a group */
  solved: GroupInfo | undefined
}

/** what the table looks like after a move */
export interface Report {
  /** cells whose value is new since before the move */
  changed: number[]
  conflicts: Conflict[]
  full: boolean
  /** the table has just been completed as this group */
  won: GroupInfo | undefined
}

// ------------------------------------------------------------------ puzzle codes: "8-n-k3f9"

export const puzzleCode = (n: number, difficulty: Difficulty, seed: number) => `${n}-${difficulty[0]}-${(seed >>> 0).toString(36)}`

export function parseCode(code: string): { n: number; difficulty: Difficulty; seed: number } | undefined {
  const m = /^(\d+)-([a-z])-([0-9a-z]+)$/.exec(code.trim().toLowerCase())
  if (!m) return undefined
  const n = +m[1], difficulty = DIFFICULTIES.find((d) => d[0] === m[2]), seed = parseInt(m[3], 36)
  if (!difficulty || !groupsOfOrder(n).length || !Number.isFinite(seed)) return undefined
  return { n, difficulty, seed: seed >>> 0 }
}

export const randomSeed = () => (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0

// ------------------------------------------------------------------ starting

export function newPuzzle(n: number, difficulty: Difficulty, seed: number = randomSeed()): Session {
  const p = generate(n, difficulty, mulberry32(seed))
  const cells = new Int8Array(n * n).fill(-1), given = new Uint8Array(n * n)
  for (const [r, c, v] of p.givens) { cells[r * n + c] = v; given[r * n + c] = 1 }
  return { mode: 'puzzle', n, difficulty, code: puzzleCode(n, difficulty, seed), cells, given, solution: p.solution, perm: [...Array(n).keys()], history: [], hints: 0, solved: undefined }
}

export function newBuild(n: number): Session {
  return { mode: 'build', n, difficulty: 'easy', code: undefined, cells: new Int8Array(n * n).fill(-1), given: new Uint8Array(n * n), solution: undefined, perm: [...Array(n).keys()], history: [], hints: 0, solved: undefined }
}

// ------------------------------------------------------------------ moves

function remember(s: Session) {
  s.history.push({ cells: s.cells.slice(), given: s.given.slice(), solution: s.solution?.slice(), perm: s.perm.slice() })
  if (s.history.length > 400) s.history.shift()
}

/** the state of the table right now; notices a finished group */
export function inspect(s: Session, before?: Int8Array): Report {
  const broken = conflicts(s.n, s.cells), full = !s.cells.includes(-1)
  let won: GroupInfo | undefined
  if (full && !broken.length && !s.solved && isGroupTable(s.cells, s.n)) won = s.solved = identify(s.cells, s.n)
  const changed: number[] = []
  if (before) s.cells.forEach((x, i) => { if (x >= 0 && x !== before[i]) changed.push(i) })
  return { changed, conflicts: broken, full, won }
}

/** write a value (or -1 to erase). Undefined if the move is not allowed. */
export function place(s: Session, at: number, v: number, opts: { autofill?: boolean } = {}): Report | undefined {
  if (s.solved || at < 0 || at >= s.n * s.n || v < -1 || v >= s.n || s.given[at] || s.cells[at] === v) return undefined
  remember(s)
  const before = s.cells.slice()
  s.cells[at] = v
  let report = inspect(s, before)
  if (!report.conflicts.length && v >= 0 && opts.autofill && !s.solved) {
    const f = forced(s.n, s.cells)
    if (f) { s.cells.set(f); report = inspect(s, before) }
  }
  return report
}

/** exchange the numbers of two elements: the same group, written differently */
export function swapElements(s: Session, a: number, b: number): void {
  remember(s)
  const n = s.n, p = [...Array(n).keys()]
  p[a] = b; p[b] = a
  s.cells = relabel(s.cells, n, p)
  if (s.solution) s.solution = relabel(s.solution, n, p)
  const given = new Uint8Array(n * n)
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) given[p[r] * n + p[c]] = s.given[r * n + c]
  s.given = given
  s.perm = s.perm.map((x) => p[x])
}

export function undo(s: Session): Report | undefined {
  if (s.solved) return undefined
  const last = s.history.pop()
  if (!last) return undefined
  s.cells = last.cells; s.given = last.given; s.solution = last.solution; s.perm = last.perm
  return inspect(s)
}

export function restart(s: Session): boolean {
  if (!s.history.length) return false
  const first = s.history[0]
  s.cells = first.cells; s.given = first.given; s.solution = first.solution; s.perm = first.perm; s.history = []; s.solved = undefined
  return true
}

// ------------------------------------------------------------------ hints

export type Advice = { kind: 'mistake'; at: number } | { kind: 'step'; hint: Hint }

/** the next step, or the first wrong cell if there is one. Counts as a hint used. */
export function advise(s: Session): Advice | undefined {
  if (s.solved || !s.solution) return undefined
  const wrong = s.cells.findIndex((v, i) => v >= 0 && v !== s.solution![i])
  if (wrong >= 0) return { kind: 'mistake', at: wrong }
  const h = hint(s.n, s.cells, s.solution)
  if (!h) return undefined
  s.hints++
  return { kind: 'step', hint: h }
}

// ------------------------------------------------------------------ keeping a session between runs

// The solution is never written out: a puzzle's code and the renumbering are enough to work it out again,
// so a saved session can be read without giving the answer away.

export function toJSON(s: Session): unknown {
  const snap = (h: { cells: Int8Array; given: Uint8Array; perm: number[] }) => ({ cells: [...h.cells], given: [...h.given], perm: h.perm })
  return { mode: s.mode, n: s.n, difficulty: s.difficulty, code: s.code, ...snap(s), hints: s.hints, solved: s.solved?.id, history: s.history.map(snap) }
}

export function fromJSON(j: any): Session {
  const named = j.code ? parseCode(j.code) : undefined
  const original = named ? generate(named.n, named.difficulty, mulberry32(named.seed)).solution : undefined
  const snap = (h: any): Snapshot => ({ cells: Int8Array.from(h.cells), given: Uint8Array.from(h.given), perm: h.perm, solution: original && relabel(original, j.n, h.perm) })
  return { mode: j.mode, n: j.n, difficulty: j.difficulty, code: j.code, ...snap(j), hints: j.hints ?? 0,
    solved: j.solved ? groupsOfOrder(j.n).find((g) => g.id === j.solved) : undefined, history: (j.history ?? []).map(snap) }
}
