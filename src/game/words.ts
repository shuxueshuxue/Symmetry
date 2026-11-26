// How the game talks about a hint or a broken rule, for any front end.
import { LABELS } from '../core/groups.ts'
import type { Conflict, Hint } from '../core/solve.ts'
import { getLang, t } from '../i18n.ts'

const L = (v: number) => LABELS[v]

export function hintText(h: Hint): string {
  const v = { r: h.r + 1, c: h.c + 1, v: L(h.v) }
  switch (h.kind) {
    case 'cell': return t('hintCell', v)
    case 'row': return t('hintRow', v)
    case 'col': return t('hintCol', v)
    case 'assoc': return t('hintAssoc', { a: L(h.a), b: L(h.b), c: L(h.c3), x: L(h.x), y: L(h.y), v: L(h.v) })
    case 'chain': return t('hintChain', v)
    case 'suppose': return h.wrong.length ? t('hintSuppose', { ...v, wrong: h.wrong.map(L).join(getLang() === 'zh' ? ' 或 ' : ' or ') }) : t('hintSupposeNone', v)
  }
}

export function conflictText(c: Conflict): string {
  if (c.kind === 'assoc') return t('conflictAssoc', { a: L(c.a), b: L(c.b), c: L(c.c) })
  return t(c.kind === 'row' ? 'conflictRow' : 'conflictCol')
}
