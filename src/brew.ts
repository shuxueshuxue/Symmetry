// Making a puzzle can take a few seconds at the larger orders, so it happens off the page's own thread.
import { generate, mulberry32, type Difficulty } from './core/generate.ts'

self.onmessage = (ev: MessageEvent<{ ticket: number; n: number; difficulty: Difficulty; seed: number }>) => {
  const { ticket, n, difficulty, seed } = ev.data
  self.postMessage({ ticket, seed, puzzle: generate(n, difficulty, mulberry32(seed)) })
}
