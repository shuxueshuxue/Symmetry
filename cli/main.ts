#!/usr/bin/env node
// symmetry in a terminal. The same game as the page, over the same core: for people, and for programs that
// want to play it one command at a time.
import readline from 'node:readline'
import { GROUPS, LABELS, ORDERS, groupById, groupsOfOrder } from '../src/core/groups.ts'
import { rate, cluesOf } from '../src/core/solve.ts'
import { DIFFICULTIES, generateFor, mulberry32, type Difficulty } from '../src/core/generate.ts'
import { elementFacts } from '../src/core/structure.ts'
import { advise, fromJSON, inspect, newBuild, newPuzzle, parseCode, place, restart, swapElements, toJSON, undo, type Report, type Session } from '../src/game/session.ts'
import { emptyProgress, recordArrangement, recordSolve, type Progress } from '../src/game/progress.ts'
import { conflictText, hintText, mistakeText } from '../src/game/words.ts'
import { about, orderOf, setLang, t } from '../src/i18n.ts'
import { fileStore, home } from './files.ts'
import { drawTable } from './draw.ts'

const HELP = `symmetry — fill in a multiplication table, find out which group you made

  symmetry                         play here, typing moves (needs a terminal)
  symmetry new [order] [easy|normal|expert]   start a puzzle   (--code 8-n-k3f9, --seed 42, --build for an empty table)
  symmetry show                    the table as it stands
  symmetry put A B C               write A·B = C               (also: symmetry "A*B=C")
  symmetry erase A B               clear the cell A·B
  symmetry swap X Y                exchange the numbers of two elements
  symmetry hint [--fill]           the next step and why; --fill also writes it
  symmetry undo | restart
  symmetry facts X                 what the table says about element X
  symmetry rate                    how hard the current puzzle is, by the layered solver
  symmetry progress                the groups found so far
  symmetry audit [--orders 4,8] [--count 20]   what the generator really produces, per group and difficulty
  symmetry rules

  --json     machine-readable output          --plain    no colour
  --home D   keep state in D (default ~/.symmetry, or $SYMMETRY_HOME)      --lang en|zh

The rules: each element appears once in every row and every column, and (a·b)·c = a·(b·c).
The saved table never contains the solution.`

// ------------------------------------------------------------------ arguments

const argv = process.argv.slice(2), flags: Record<string, string | true> = {}, words: string[] = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a.startsWith('--')) { const k = a.slice(2); if (['home', 'lang', 'code', 'seed', 'orders', 'count'].includes(k)) flags[k] = argv[++i] ?? ''; else flags[k] = true }
  else words.push(a)
}
setLang(flags.lang === 'zh' || (!flags.lang && /^zh/i.test(process.env.LANG ?? '')) ? 'zh' : 'en')
const json = !!flags.json, colour = !json && !flags.plain && !!process.stdout.isTTY && !process.env.NO_COLOR
const dir = home(typeof flags.home === 'string' ? flags.home : undefined)
const tableFile = fileStore<unknown>(dir, 'table.json', () => undefined)
const progressFile = fileStore<Progress>(dir, 'progress.json', emptyProgress)

const label = (text: string, n: number): number => { const v = LABELS.indexOf(text.toUpperCase()); return text.length === 1 && v >= 0 && v < n ? v : -1 }
class Refused extends Error {}
const refuse = (why: string): never => { throw new Refused(why) }

// ------------------------------------------------------------------ what gets printed

interface Reply { ok: boolean; message: string; session?: Session; marks?: number[]; extra?: Record<string, unknown> }

function describe(s: Session): string {
  const filled = s.cells.filter((v) => v >= 0).length
  const what = s.mode === 'build' ? `${t('build')} · ${orderOf(s.n)}` : `${orderOf(s.n)} · ${s.solved ? s.solved.name : '???'} · ${t(s.difficulty)}${s.code ? ` · #${s.code}` : ''}`
  return `${what} · ${filled}/${s.n * s.n}${s.hints ? ` · ${t('hintsUsed')} ${s.hints}` : ''}`
}

function print(r: Reply) {
  const s = r.session
  if (json) {
    const n = s?.n ?? 0, rows = s ? [...Array(n).keys()].map((a) => [...Array(n).keys()].map((b) => (s.cells[a * n + b] < 0 ? null : LABELS[s.cells[a * n + b]]))) : undefined
    console.log(JSON.stringify({ ok: r.ok, message: r.message, ...(s ? { order: n, mode: s.mode, difficulty: s.difficulty, code: s.code, elements: [...LABELS.slice(0, n)], table: rows,
      given: [...Array(n).keys()].map((a) => [...Array(n).keys()].map((b) => !!s.given[a * n + b])), filled: s.cells.filter((v) => v >= 0).length, cells: n * n,
      conflicts: inspect(s).conflicts.map(conflictText), solved: !!s.solved, group: s.solved ? { id: s.solved.id, name: s.solved.name } : null, hints: s.hints } : {}), ...r.extra }))
    return
  }
  if (s) console.log(`${describe(s)}\n\n${drawTable(s, colour, r.marks)}\n`)
  if (r.message) console.log(r.message)
}

// ------------------------------------------------------------------ commands

function current(): Session {
  const saved = tableFile.load()
  return saved ? fromJSON(saved) : refuse('No table yet. Start one with: symmetry new 6')
}

/** the message for a move, and the bookkeeping when the table has just been finished */
function after(s: Session, r: Report): string {
  if (r.conflicts.length) return conflictText(r.conflicts[0])
  if (!r.won) return ''
  const p = progressFile.load(), got = recordSolve(p, s, r.won)
  progressFile.save(p)
  const also = got.newSubgroups.length ? ` (${t('newFind')}: ${got.newSubgroups.map((g) => g.name).join(', ')})` : ''
  return `${t(s.mode === 'puzzle' ? 'itIs' : 'youMade')} ${r.won.name}${got.isNew ? ` — ${t('newFind')}` : ''}${also}. ${about(r.won.id, s.n)}`
}

function run(cmd: string, args: string[]): Reply {
  // "2*6=7" and "2 6 7" are moves
  const move = /^([0-9a-z])\s*[*·.x]\s*([0-9a-z])\s*=\s*([0-9a-z.?])$/i.exec([cmd, ...args].join(''))
  if (move) { args = [move[1], move[2], move[3]]; cmd = /[.?]/.test(move[3]) ? 'erase' : 'put' }
  else if (/^[0-9a-z]$/i.test(cmd) && args.length === 2) { args = [cmd, ...args]; cmd = 'put' }

  switch (cmd) {
    case 'new': {
      const named = typeof flags.code === 'string' ? parseCode(flags.code) ?? refuse(`Not a puzzle code: ${flags.code}`) : undefined
      const n = named?.n ?? +(args.find((a) => /^\d+$/.test(a)) ?? 6)
      if (!groupsOfOrder(n).length) refuse(`Orders ${ORDERS[0]} to ${ORDERS[ORDERS.length - 1]} are available.`)
      const difficulty = named?.difficulty ?? (args.find((a) => (DIFFICULTIES as string[]).includes(a)) as Difficulty | undefined) ?? 'easy'
      const seed = named?.seed ?? (typeof flags.seed === 'string' ? +flags.seed >>> 0 : undefined)
      const s = flags.build ? newBuild(n) : newPuzzle(n, difficulty, seed) ?? refuse(`There is no ${difficulty} puzzle with ${n} elements: nothing at that size is that hard.`)
      tableFile.save(toJSON(s))
      return { ok: true, message: `${t('rule1')} ${t('rule2')}`, session: s }
    }
    case 'show': return { ok: true, message: '', session: current() }
    case 'put': case 'erase': {
      const s = current(), [a, b] = [label(args[0] ?? '', s.n), label(args[1] ?? '', s.n)], v = cmd === 'erase' ? -1 : label(args[2] ?? '', s.n)
      if (a < 0 || b < 0 || (cmd === 'put' && v < 0)) refuse(`Elements are ${LABELS.slice(0, s.n).split('').join(' ')}. Usage: symmetry put A B C  (A·B = C)`)
      const at = a * s.n + b
      if (s.solved) refuse('This table is finished. Start another with: symmetry new')
      if (s.given[at]) refuse(`${LABELS[a]}·${LABELS[b]} is given and cannot be changed.`)
      const r = place(s, at, v) ?? refuse('Nothing to change there.')
      tableFile.save(toJSON(s))
      return { ok: !r.conflicts.length, message: after(s, r), session: s }
    }
    case 'swap': {
      const s = current(), [x, y] = [label(args[0] ?? '', s.n), label(args[1] ?? '', s.n)]
      if (x < 0 || y < 0 || x === y) refuse('Usage: symmetry swap X Y')
      swapElements(s, x, y)
      let message = ''
      if (s.solved) { const p = progressFile.load(), fresh = recordArrangement(p, s); progressFile.save(p); if (fresh.length) message = `${t('newFind')}: ${fresh.map((g) => g.name).join(', ')}` }
      tableFile.save(toJSON(s))
      return { ok: true, message, session: s }
    }
    case 'hint': {
      const s = current()
      if (s.mode === 'build') refuse('There are no hints when building: any group will do.')
      const a = advise(s) ?? refuse('Nothing left to hint at.')
      if (a.kind === 'mistake') return { ok: true, message: mistakeText(s.n, a.at), session: s, marks: [a.at], extra: { hint: { kind: 'mistake', row: Math.floor(a.at / s.n), column: a.at % s.n } } }
      const h = a.hint, at = h.r * s.n + h.c
      let message = hintText(h)
      if (flags.fill) { const r = place(s, at, h.v)!; message += ' ' + after(s, r) }
      tableFile.save(toJSON(s))
      return { ok: true, message, session: s, marks: flags.fill ? [] : [at], extra: { hint: { kind: h.kind, row: LABELS[h.r], column: LABELS[h.c], value: LABELS[h.v] } } }
    }
    case 'undo': { const s = current(); if (!undo(s)) refuse('Nothing to undo.'); tableFile.save(toJSON(s)); return { ok: true, message: '', session: s } }
    case 'restart': { const s = current(); restart(s); tableFile.save(toJSON(s)); return { ok: true, message: '', session: s } }
    case 'facts': {
      const s = current(), x = label(args[0] ?? '', s.n)
      if (x < 0) refuse('Usage: symmetry facts X')
      const f = elementFacts(s.n, s.cells, x), list = (xs: number[]) => xs.map((v) => LABELS[v]).join(' ') || '?'
      const lines = { [t('elOrder')]: f.order ?? '?', [t('elInverse')]: f.inverse === undefined ? '?' : LABELS[f.inverse], [t('elCommutes')]: list(f.commutesWith), [t('elConj')]: list(f.conjugates) }
      return { ok: true, message: `${t('element')} ${LABELS[x]}\n` + Object.entries(lines).map(([k, v]) => `  ${k}: ${v}`).join('\n'), extra: { facts: lines } }
    }
    case 'rate': {
      const s = current(), givens = cluesOf(s.cells.map((v, i) => (s.given[i] ? v : -1)), s.n), r = rate(s.n, givens)
      const words = ['', 'rows and columns alone', 'rows, columns and associativity', `supposing, ${r.supposes} time${r.supposes === 1 ? '' : 's'}`, 'more than one supposition at a time'][r.level]
      return { ok: true, message: `${givens.length} givens. The layered solver needs: ${words}.`, extra: { rating: { givens: givens.length, level: r.level, supposes: r.supposes } } }
    }
    case 'progress': {
      const p = progressFile.load()
      const lines = ORDERS.map((n) => `  ${String(n).padStart(2)}  ${groupsOfOrder(n).map((g) => (p.found.includes(g.id) ? g.name : '???')).join('  ')}`)
      return { ok: true, message: `${p.found.length} / ${GROUPS.length}\n${lines.join('\n')}`, extra: { found: p.found.map((id) => groupById(id).name), solved: p.solved } }
    }
    case 'audit': return audit()
    case 'rules': return { ok: true, message: `1. ${t('rule1')}\n2. ${t('rule2')}\n${t('rulesMore')}` }
    case 'help': case undefined: return { ok: true, message: HELP }
    default: return refuse(`Unknown command: ${cmd}. Try: symmetry help`)
  }
}

/** What the generator really makes: for every group and difficulty, whether it can keep the promise, and how hard the result is. */
function audit(): Reply {
  const orders = typeof flags.orders === 'string' ? flags.orders.split(',').map(Number) : ORDERS
  const count = typeof flags.count === 'string' ? +flags.count : 20
  const rng = mulberry32(2022), lines: string[] = [], data: unknown[] = []
  const mid = (xs: number[]) => (xs.length ? xs.sort((a, b) => a - b)[xs.length >> 1] : '-')
  for (const n of orders) for (const g of groupsOfOrder(n)) {
    const row: string[] = []
    for (const d of DIFFICULTIES) {
      const plain: number[] = [], shrewd: number[] = [], givens: number[] = []
      let made = 0, deep = 0
      for (let k = 0; k < count; k++) {
        const p = generateFor(g, d, rng)
        if (!p) continue
        made++; givens.push(p.givens.length)
        // suppositions needed without and with the theorem shortcuts
        const a = rate(n, p.givens), b = rate(n, p.givens, true)
        if (a.level === 3) plain.push(a.supposes)
        if (b.level === 3) shrewd.push(b.supposes); else if (b.level > 3) deep++
      }
      row.push(`${d} ${String(made).padStart(2)}/${count}  givens ${String(mid(givens)).padStart(2)}  supposes ${String(mid(plain)).padStart(3)} → ${String(mid(shrewd)).padStart(3)}${deep ? ` (+${deep} deeper)` : ''}`.padEnd(54))
      data.push({ order: n, group: g.id, difficulty: d, made, of: count, medianGivens: mid(givens), medianSupposes: mid(plain), medianSupposesWithTheorems: mid(shrewd), beyond: deep })
    }
    lines.push(`${String(n).padStart(2)} ${g.name.padEnd(9)} ${row.join(' | ')}`)
  }
  return { ok: true, message: `Per group and difficulty: puzzles made out of ${count} asked for, median givens, and median suppositions needed\nwithout → with the theorem shortcuts ("deeper": one supposition at a time is not enough).\n` + lines.join('\n'), extra: { audit: data } }
}

// ------------------------------------------------------------------ run once, or sit and play

function once(cmd: string, args: string[]): boolean {
  try { const r = run(cmd, args); print(r); return r.ok }
  catch (e) { if (!(e instanceof Refused)) throw e; print({ ok: false, message: e.message }); return false }
}

if (words.length || !process.stdin.isTTY) {
  process.exitCode = once(words[0] ?? 'help', words.slice(1)) ? 0 : 1
} else {
  if (!tableFile.exists()) once('new', [])
  else once('show', [])
  console.log('Moves look like 2*6=7. Also: hint, undo, swap 1 2, facts 3, new 8 normal, quit.')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })
  rl.prompt()
  rl.on('line', (line) => {
    const parts = line.trim().split(/\s+/).filter(Boolean)
    if (['quit', 'exit', 'q'].includes(parts[0])) return rl.close()
    if (parts.length) { delete flags.fill; if (parts.includes('--fill')) flags.fill = true; once(parts[0] === 'h' ? 'hint' : parts[0], parts.slice(1).filter((p) => !p.startsWith('--'))) }
    rl.prompt()
  })
}
