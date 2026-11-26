import type { Difficulty } from './core/generate.ts'
import type { Lang } from './i18n.ts'
import type { Progress } from './game/progress.ts'

/** progress, plus this front end's own settings; kept in the browser */
export interface Save extends Progress {
  lang: Lang
  difficulty: Difficulty
  sound: boolean
  autofill: boolean
}

const KEY = 'symmetry.v2'

export function load(): Save {
  const base: Save = {
    lang: navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en',
    difficulty: 'easy', sound: true, autofill: false, found: [], solved: {},
  }
  try { return { ...base, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return base }
}

export function store(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: play without saving */ }
}
