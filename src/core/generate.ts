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

function keeps(n: number, difficulty: Difficulty): (clues: Clue[]) => boolean {
  if (difficulty === 'easy') return (c) => solvesAt(n, c, 2).solved
  if (difficulty === 'normal') return (c) => solvesAt(n, c, 3, normalBudget(n)).solved
  return (c) => isUnique(n, c)
}

/** drop givens in random order for as long as the puzzle stays within the difficulty */
function strip(clues: Clue[], ok: (c: Clue[]) => boolean, rng: Rng): Clue[] {
  clues = shuffle(clues.slice(), rng)
  for (let k = 0; k < clues.length;) {
    const trial = clues.slice(0, k).concat(clues.slice(k + 1))
    if (ok(trial)) clues = trial; else k++
  }
  return clues
}

export function generate(n: number, difficulty: Difficulty, rng: Rng, group?: GroupInfo): Puzzle {
  // a normal puzzle should really need a supposition; small orders sometimes cannot, so give up after a few tries
  for (let attempt = 0; ; attempt++) {
    const p = build(n, difficulty, rng, group)
    if (difficulty !== 'normal' || attempt >= 8 || !solvesAt(n, p.givens, 2).solved) return p
  }
}

function build(n: number, difficulty: Difficulty, rng: Rng, group?: GroupInfo): Puzzle {
  const choices = groupsOfOrder(n)
  const g = group ?? choices[Math.floor(rng() * choices.length)]
  // a random numbering of the elements, and sometimes the mirror image (the opposite group, which is the same group)
  const p = shuffle([...Array(n).keys()], rng)
  let solution = relabel(g.table, n, p)
  if (rng() < 0.5) {
    const t = new Int8Array(n * n)
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) t[b * n + a] = solution[a * n + b]
    solution = t
  }
  let givens = strip(cluesOf(solution, n), keeps(n, 'easy'), rng)
  if (difficulty !== 'easy') givens = strip(givens, keeps(n, difficulty), rng)
  givens.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return { n, difficulty, groupId: g.id, givens, solution }
}
