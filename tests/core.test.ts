import { describe, expect, it } from 'vitest'
import { GROUPS, ORDERS, groupsOfOrder, isGroupTable, relabel } from '../src/core/groups.ts'
import { cluesOf, conflicts, hint, identify, isUnique, rate, solvesAt, tables, type Clue } from '../src/core/solve.ts'
import { DIFFICULTIES, generate, mulberry32, normalBudget, shuffle } from '../src/core/generate.ts'

const COUNT: Record<number, number> = { 2: 1, 3: 1, 4: 2, 5: 1, 6: 2, 7: 1, 8: 5, 9: 2, 10: 2, 11: 1, 12: 5 }

describe('catalogue', () => {
  it('has the right number of groups of each order, all of them groups', () => {
    for (const n of ORDERS) expect(groupsOfOrder(n).length).toBe(COUNT[n])
    for (const g of GROUPS) expect(isGroupTable(g.table, g.order)).toBe(true)
  })
  it('names every group as itself after any renumbering, so no two entries are the same group', () => {
    const rng = mulberry32(1)
    for (const g of GROUPS) {
      const p = shuffle([...Array(g.order).keys()], rng)
      expect(identify(relabel(g.table, g.order, p), g.order)?.id).toBe(g.id)
    }
  })
})

describe('uniqueness', () => {
  it('agrees with listing every numbered table, on random givens', () => {
    const rng = mulberry32(2)
    for (const n of [4, 5, 6]) {
      const all = new Map<string, Int8Array>()
      const perm = (p: number[], rest: number[]): void => {
        if (!rest.length) { for (const g of groupsOfOrder(n)) { const t = relabel(g.table, n, p); all.set(t.join(), t) } return }
        rest.forEach((x, i) => perm([...p, x], rest.filter((_, j) => j !== i)))
      }
      perm([], [...Array(n).keys()])
      const list = [...all.values()]
      for (let k = 0; k < 150; k++) {
        const t = list[Math.floor(rng() * list.length)]
        const clues = shuffle(cluesOf(t, n), rng).slice(0, 1 + Math.floor(rng() * 5))
        const brute = list.filter((x) => clues.every(([r, c, v]) => x[r * n + c] === v)).length
        expect(tables(n, clues, 1e9).length).toBe(brute)
      }
    }
  })
  it('knows the smallest puzzles found by exhaustive search', () => {
    expect(isUnique(4, [[0, 0, 1], [0, 1, 3]])).toBe(true)                  // the original game's order-4 puzzle
    expect(isUnique(5, [[1, 1, 2], [2, 3, 0]])).toBe(true)
    expect(isUnique(5, [[1, 1, 2]])).toBe(false)
    expect(tables(6, [[0, 3, 3], [1, 1, 2], [1, 3, 4]], 99).length).toBe(6) // the original order-6 puzzle: S3 once, C6 five times
    expect(isUnique(8, [[1, 1, 2], [1, 2, 3], [5, 7, 4], [6, 7, 5]])).toBe(true)
  })
})

describe('generated puzzles', () => {
  const rng = mulberry32(3)
  for (const n of [4, 6, 8]) for (const d of DIFFICULTIES) {
    it(`order ${n} ${d}: one solution, the stated difficulty, and no given to spare`, () => {
      const p = generate(n, d, rng)
      expect(isGroupTable(p.solution, n)).toBe(true)
      expect(p.givens.every(([r, c, v]) => p.solution[r * n + c] === v)).toBe(true)
      const only = tables(n, p.givens, 2)
      expect(only.length).toBe(1)
      expect([...only[0].table]).toEqual([...p.solution])
      const ok = (c: Clue[]) => d === 'easy' ? solvesAt(n, c, 2).solved : d === 'normal' ? solvesAt(n, c, 3, normalBudget(n)).solved : isUnique(n, c)
      expect(ok(p.givens)).toBe(true)
      for (let k = 0; k < p.givens.length; k++) expect(ok(p.givens.filter((_, i) => i !== k))).toBe(false)
    })
  }
})

describe('hints and conflicts', () => {
  it('every hint is a correct cell, and following hints finishes an easy puzzle without supposing', () => {
    const rng = mulberry32(4)
    const p = generate(8, 'easy', rng)
    const cells = new Int8Array(64).fill(-1)
    for (const [r, c, v] of p.givens) cells[r * 8 + c] = v
    for (let step = 0; step < 64 && cells.includes(-1); step++) {
      const h = hint(8, cells, p.solution)!
      expect(h.kind).not.toBe('suppose')
      expect(p.solution[h.r * 8 + h.c]).toBe(h.v)
      cells[h.r * 8 + h.c] = h.v
    }
    expect(cells.includes(-1)).toBe(false)
    expect(rate(8, p.givens).level).toBeLessThanOrEqual(2)
  })
  it('reports a repeated value and a broken associativity', () => {
    const t = new Int8Array(9).fill(-1)
    t[0] = 1; t[1] = 1
    expect(conflicts(3, t)[0].kind).toBe('row')
    // (0·0)·0 = 1·0 = 2 but 0·(0·0) = 0·1 = 0
    const u = new Int8Array(9).fill(-1)
    u[0] = 1; u[3] = 2; u[1] = 0
    expect(conflicts(3, u).some((c) => c.kind === 'assoc')).toBe(true)
  })
})

import { elementFacts, leadingNormalSubgroups } from '../src/core/structure.ts'
import { groupById } from '../src/core/groups.ts'

describe('structure', () => {
  it('finds the rotations of the square as a leading normal subgroup with quotient C2', () => {
    // numbered e, r, r², r³, then the flips: {e, r} is not a subgroup, the four rotations are
    const d4 = groupById('D4')
    const chain = (t: ArrayLike<number>) => leadingNormalSubgroups(8, t).map((s) => [s.size, s.group?.id, s.quotient?.id])
    expect(chain(d4.table)).toEqual([[4, 'C4', 'C2']])
    // swap r and r²: now the centre {e, r²} leads too
    expect(chain(relabel(d4.table, 8, [0, 2, 1, 3, 4, 5, 6, 7]))).toEqual([[2, 'C2', 'V4'], [4, 'C4', 'C2']])
  })
  it('reads orders and inverses off a table', () => {
    const f = elementFacts(8, groupById('Q8').table, 4)
    expect([f.identity, f.order, f.inverse]).toEqual([0, 4, 6])
  })
})

import { advise, fromJSON, newPuzzle, parseCode, place, puzzleCode, swapElements, toJSON, undo } from '../src/game/session.ts'

describe('sessions', () => {
  it('a code names one puzzle', () => {
    const a = newPuzzle(8, 'normal', 12345), b = newPuzzle(8, 'normal', 12345)
    expect(a.code).toBe(puzzleCode(8, 'normal', 12345))
    expect([...a.cells]).toEqual([...b.cells])
    expect(parseCode(a.code!)).toEqual({ n: 8, difficulty: 'normal', seed: 12345 })
    expect(parseCode('nonsense')).toBeUndefined()
    expect(parseCode(puzzleCode(8, 'expert', 5))?.difficulty).toBe('expert')
    expect(parseCode(puzzleCode(8, 'easy', 5))?.difficulty).toBe('easy')
  })
  it('hints lead to the end, and the win is reported once', () => {
    const s = newPuzzle(6, 'easy', 7)
    let won
    for (let i = 0; i < 40 && !s.solved; i++) {
      const a = advise(s)!
      expect(a.kind).toBe('step')
      if (a.kind === 'step') won = place(s, a.hint.r * 6 + a.hint.c, a.hint.v)!.won
    }
    expect(s.solved).toBeDefined()
    expect(won?.id).toBe(s.solved!.id)
    expect(place(s, 0, 0)).toBeUndefined() // a finished table does not change
  })
  it('refuses to overwrite a given, reports a conflict, and undoes', () => {
    const s = newPuzzle(6, 'easy', 7), given = s.given.indexOf(1), free = s.cells.indexOf(-1)
    expect(place(s, given, 0)).toBeUndefined()
    const row = Math.floor(free / 6), taken = [...s.cells.slice(row * 6, row * 6 + 6)].find((v) => v >= 0)
    if (taken !== undefined) expect(place(s, free, taken)!.conflicts.length).toBeGreaterThan(0)
    undo(s)
    expect(s.cells[free]).toBe(-1)
  })
  it('a saved session holds no solution and comes back the same, even after renumbering', () => {
    const s = newPuzzle(8, 'easy', 99)
    const a = advise(s)!
    if (a.kind === 'step') place(s, a.hint.r * 8 + a.hint.c, a.hint.v)
    swapElements(s, 1, 5)
    const text = JSON.stringify(toJSON(s))
    expect(text).not.toContain('solution')
    const back = fromJSON(JSON.parse(text))
    expect([...back.cells]).toEqual([...s.cells])
    expect([...back.solution!]).toEqual([...s.solution!])
    expect(back.history.length).toBe(s.history.length)
  })
})
