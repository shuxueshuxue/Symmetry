// What can be read off a table, finished or not.
import { identify } from './solve.ts'
import type { GroupInfo } from './groups.ts'

export interface ElementFacts {
  identity: number | undefined
  order: number | undefined
  inverse: number | undefined
  commutesWith: number[]
  conjugates: number[]
}

export function identityOf(n: number, t: ArrayLike<number>): number | undefined {
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (t[a * n + b] === b || t[b * n + a] === b) return a
  return undefined
}

export function elementFacts(n: number, t: ArrayLike<number>, x: number): ElementFacts {
  const e = identityOf(n, t)
  let order: number | undefined, inverse: number | undefined
  if (e !== undefined) {
    if (x === e) order = 1
    else for (let k = 2, p = x; k <= n; k++) {
      p = t[p * n + x]
      if (p < 0) break
      if (p === e) { order = k; break }
    }
    for (let y = 0; y < n; y++) if (t[x * n + y] === e || t[y * n + x] === e) inverse = y
  }
  const commutesWith: number[] = [], conj = new Set<number>([x])
  for (let y = 0; y < n; y++) {
    if (y === x || (t[x * n + y] >= 0 && t[x * n + y] === t[y * n + x])) commutesWith.push(y)
    if (e === undefined) continue
    let yInv = -1
    for (let z = 0; z < n; z++) if (t[y * n + z] === e || t[z * n + y] === e) yInv = z
    if (yInv < 0) continue
    const yx = t[y * n + x]
    if (yx >= 0 && t[yx * n + yInv] >= 0) conj.add(t[yx * n + yInv])
  }
  return { identity: e, order, inverse, commutesWith, conjugates: [...conj].sort((a, b) => a - b) }
}

export interface ChainStep { size: number; group: GroupInfo | undefined; quotient: GroupInfo | undefined }

/** Normal subgroups that sit as a leading block {0..k-1} of a finished table, smallest first. */
export function leadingNormalSubgroups(n: number, t: ArrayLike<number>): ChainStep[] {
  const out: ChainStep[] = []
  const e = identityOf(n, t)
  if (e === undefined) return out
  const inv = new Int8Array(n)
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (t[a * n + b] === e) inv[a] = b
  for (let k = 2; k < n; k++) {
    if (n % k) continue
    let ok = true
    for (let a = 0; a < k && ok; a++) for (let b = 0; b < k; b++) if (t[a * n + b] >= k) { ok = false; break }
    for (let g = 0; g < n && ok; g++) for (let h = 0; h < k; h++) if (t[t[g * n + h] * n + inv[g]] >= k) { ok = false; break }
    if (!ok) continue
    const sub = new Int8Array(k * k)
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) sub[a * k + b] = t[a * n + b]
    // the quotient: cosets numbered by their smallest member
    const cosetOf = new Int8Array(n).fill(-1)
    let m = 0
    for (let g = 0; g < n; g++) {
      if (cosetOf[g] >= 0) continue
      for (let h = 0; h < k; h++) cosetOf[t[g * n + h]] = m
      m++
    }
    const q = new Int8Array(m * m)
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) q[cosetOf[a] * m + cosetOf[b]] = cosetOf[t[a * n + b]]
    out.push({ size: k, group: identify(sub, k), quotient: identify(q, m) })
  }
  return out
}

/** how many elements of each order a finished table has */
export function orderCounts(n: number, t: ArrayLike<number>): Map<number, number> {
  const m = new Map<number, number>()
  for (let x = 0; x < n; x++) { const o = elementFacts(n, t, x).order ?? 0; m.set(o, (m.get(o) ?? 0) + 1) }
  return new Map([...m].sort((a, b) => a[0] - b[0]))
}
