// The terminal front end keeps its state in files: one for the table in play, one for progress.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Store } from '../src/game/progress.ts'

export const home = (dir?: string) => dir ?? process.env.SYMMETRY_HOME ?? path.join(os.homedir(), '.symmetry')

export function fileStore<T>(dir: string, name: string, fallback: () => T): Store<T> & { clear(): void; exists(): boolean } {
  const file = path.join(dir, name)
  return {
    exists: () => fs.existsSync(file),
    load() { try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T } catch { return fallback() } },
    save(value) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)) },
    clear() { fs.rmSync(file, { force: true }) },
  }
}
