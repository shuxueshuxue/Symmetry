// Puzzle generation. A puzzle is a set of given cells with exactly one completion to a group table.
// "Cannot lose another cell" is relative to a difficulty: dropping any given would push the puzzle past it.
import { groupsOfOrder, relabel, type GroupInfo } from './groups.ts'
import { cluesOf, isUnique, solvesAt, type Clue } from './solve.ts'

export type Difficulty = 'easy' | 'normal' | 'expert'
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'expert']

export interface Puzzle {
  n: number
  difficulty: Difficulty
  groupId: string
  givens: Clue[]
  solution: Int8Array
}

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(xs: T[], rng: Rng): T[] {
  for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]] }
  return xs
}

/** how many "suppose" eliminations a normal puzzle may need, by order */
export const normalBudget = (n: number) => Math.max(2, Math.floor(n / 2))

// What each difficulty promises. The harder two are judged with the theorem shortcuts switched on (see Grid.theory):
// a puzzle only counts as needing a supposition if it still needs one after everything a student of groups
// would see at a glance. Otherwise a whole family of "hard" puzzles falls to one observation.
//   easy    the two rules alone finish it, cell by cell
//   normal  the two rules and the shortcuts do not finish it; a few suppositions do
//   expert  no given can be removed, and a few suppositions are not enough even with the shortcuts
export function meets(n: number, difficulty: Difficulty, givens: Clue[]): boolean {
  if (difficulty === 'easy') return solvesAt(n, givens, 2).solved
  if (solvesAt(n, givens, 2, Infinity, true).solved) return false
  const few = solvesAt(n, givens, 3, normalBudget(n), true).solved
  return difficulty === 'normal' ? few : !few && isUnique(n, givens)
}

/** drop givens in random order for as long as `ok` still holds */
function strip(clues: Clue[], ok: (c: Clue[]) => boolean, rng: Rng): Clue[] {
  clues = shuffle(clues.slice(), rng)
  for (let k = 0; k < clues.length;) {
    const trial = clues.slice(0, k).concat(clues.slice(k + 1))
    if (ok(trial)) clues = trial; else k++
  }
  return clues
}

function build(n: number, difficulty: Difficulty, rng: Rng, g: GroupInfo): Puzzle {
  // a random numbering of the elements, and sometimes the mirror image (the opposite group, which is the same group)
  const p = shuffle([...Array(n).keys()], rng)
  let solution = relabel(g.table, n, p)
  if (rng() < 0.5) {
    const t = new Int8Array(n * n)
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) t[b * n + a] = solution[a * n + b]
    solution = t
  }
  let givens = strip(cluesOf(solution, n), (c) => solvesAt(n, c, 2).solved, rng)
  if (difficulty === 'normal') givens = strip(givens, (c) => solvesAt(n, c, 3, normalBudget(n), true).solved, rng)
  if (difficulty === 'expert') givens = strip(givens, (c) => isUnique(n, c), rng)
  givens.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return { n, difficulty, groupId: g.id, givens, solution }
}

/** how many tables to try before deciding this group has no puzzle of this difficulty; small tables are cheap and need more luck */
const tries = (n: number) => (n <= 7 ? 400 : 40)

/**
 * Which difficulties exist at which order. Measured with `symmetry audit`, not assumed:
 * the two-element group has nothing to deduce; with three elements there is no expert puzzle;
 * and C₂×C₂ has no normal or expert puzzle at all (the shortcuts always finish it), so at order 4 those come from C₄ only.
 * From order 5 up, every group gives every difficulty.
 */
export const offered = (n: number, difficulty: Difficulty) => difficulty === 'easy' || n >= (difficulty === 'normal' ? 3 : 4)

/** A puzzle that keeps the difficulty's promise, or undefined when this group cannot give one. */
export function generateFor(g: GroupInfo, difficulty: Difficulty, rng: Rng): Puzzle | undefined {
  for (let attempt = 0, most = tries(g.order); attempt < most; attempt++) {
    const p = build(g.order, difficulty, rng, g)
    if (meets(g.order, difficulty, p.givens)) return p
  }
  return undefined
}

/** A puzzle of this order and difficulty, from a group chosen at random among those that can give one. */
export function generate(n: number, difficulty: Difficulty, rng: Rng): Puzzle | undefined {
  if (!offered(n, difficulty)) return undefined
  const order = shuffle(groupsOfOrder(n).slice(), rng)
  for (const g of order) { const p = generateFor(g, difficulty, rng); if (p) return p }
  return undefined
}
