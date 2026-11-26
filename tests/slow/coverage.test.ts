// The whole catalogue, every difficulty. Minutes, not seconds: `npm run test:all`.
import { describe, expect, it } from 'vitest'
import { GROUPS, ORDERS } from '../../src/core/groups.ts'
import { Grid, solvesAt } from '../../src/core/solve.ts'
import { DIFFICULTIES, generate, generateFor, meets, mulberry32, normalBudget, offered } from '../../src/core/generate.ts'

describe('coverage, orders 2 to 20', () => {
  const rng = mulberry32(31)
  it('leaves no group out: from order 5 up every group gives every difficulty, and each puzzle keeps its promise', () => {
    for (const g of GROUPS) if (g.order >= 5) for (const d of DIFFICULTIES) {
      const p = generateFor(g, d, rng)
      expect(p, `${g.id} ${d}`).toBeDefined()
      expect(meets(g.order, d, p!.givens), `${g.id} ${d}`).toBe(true)
      if (d !== 'easy') expect(solvesAt(g.order, p!.givens, 3, normalBudget(g.order), true).solved, `${g.id} ${d}`).toBe(d === 'normal')
      // the shortcuts never write a wrong cell
      const grid = new Grid(g.order, p!.givens)
      grid.theorems = true
      grid.run(2)
      for (let i = 0; i < g.order * g.order; i++) if (grid.val[i] >= 0) expect(grid.val[i]).toBe(p!.solution[i])
    }
  }, 1_800_000)
  it('what is offered at an order can be made, and what is not offered cannot', () => {
    for (const n of ORDERS) for (const d of DIFFICULTIES) expect(generate(n, d, rng) !== undefined, `order ${n} ${d}`).toBe(offered(n, d))
  }, 1_800_000)
})
