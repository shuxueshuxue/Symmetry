// What a player has found and solved. Where it is kept is the front end's business: a Store is any place to load from and save to.
import type { GroupInfo } from '../core/groups.ts'
import { leadingNormalSubgroups } from '../core/structure.ts'
import type { Session } from './session.ts'

export interface Progress {
  found: string[]
  solved: Record<string, number> // "<order>:<difficulty>" -> count
}

export interface Store<T> {
  load(): T
  save(value: T): void
}

export const emptyProgress = (): Progress => ({ found: [], solved: {} })

/** arranging a normal subgroup to the front of a finished table finds that subgroup too */
export function recordArrangement(p: Progress, s: Session): GroupInfo[] {
  const fresh: GroupInfo[] = []
  if (!s.solved) return fresh
  for (const step of leadingNormalSubgroups(s.n, s.cells)) {
    if (step.group && !p.found.includes(step.group.id)) { p.found.push(step.group.id); fresh.push(step.group) }
  }
  return fresh
}

/** call once when a table has just been completed */
export function recordSolve(p: Progress, s: Session, group: GroupInfo): { isNew: boolean; newSubgroups: GroupInfo[] } {
  const isNew = !p.found.includes(group.id)
  if (isNew) p.found.push(group.id)
  if (s.mode === 'puzzle') { const k = `${s.n}:${s.difficulty}`; p.solved[k] = (p.solved[k] ?? 0) + 1 }
  return { isNew, newSubgroups: recordArrangement(p, s) }
}
