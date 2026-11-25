import type { Difficulty } from './core/generate.ts'
import type { Lang } from './i18n.ts'

export interface Save {
  lang: Lang
  difficulty: Difficulty
  sound: boolean
  music: boolean
  autofill: boolean
  found: string[]
  solved: Record<string, number> // "<order>:<difficulty>" -> count
}

const KEY = 'symmetry.v2'

export function load(): Save {
  const base: Save = {
    lang: navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en',
    difficulty: 'easy', sound: true, music: true, autofill: false, found: [], solved: {},
  }
  try { return { ...base, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return base }
}

export function store(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: play without saving */ }
}
