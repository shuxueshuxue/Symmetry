import './style.css'
import { GROUPS, LABELS, ORDERS, groupsOfOrder, isGroupTable, relabel, type GroupInfo } from './core/groups.ts'
import { conflicts, forced, hint, identify, type Conflict, type Hint } from './core/solve.ts'
import { DIFFICULTIES, generate, mulberry32, type Difficulty } from './core/generate.ts'
import { elementFacts, leadingNormalSubgroups, orderCounts } from './core/structure.ts'
import { about, getLang, orderOf, setLang, t, type Key } from './i18n.ts'
import { load, store } from './store.ts'
import { audio } from './audio.ts'
import { BLUE, INK, PINK, RED, SOFT, Pen, hatchDefs, stroke, tint } from './sketch.ts'

type Tab = 'puzzles' | 'build' | 'collection'

interface Snapshot { cells: Int8Array; given: Uint8Array; solution: Int8Array | undefined }

interface Game {
  mode: 'puzzle' | 'build'
  n: number
  difficulty: Difficulty
  cells: Int8Array
  given: Uint8Array
  solution: Int8Array | undefined
  sel: number        // selected cell, or -1
  head: number       // selected header element, or -1
  history: Snapshot[]
  hints: number
  marks: number[]    // cells a hint points at
  target: number     // the cell a hint is about, or -1
  say: { text: string; tone: '' | 'bad' | 'tip' }
  done: { group: GroupInfo; isNew: boolean; newSubgroups: GroupInfo[] } | undefined
}

const save = load()
setLang(save.lang)
audio.soundOn = save.sound
const rng = mulberry32((Date.now() ^ (Math.random() * 2 ** 31)) >>> 0)

let tab: Tab = 'puzzles'
let game: Game | undefined

const app = document.getElementById('app')!
const L = (v: number) => LABELS[v]
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// ------------------------------------------------------------------------------------------ game

function start(mode: Game['mode'], n: number) {
  const cells = new Int8Array(n * n).fill(-1), given = new Uint8Array(n * n)
  let solution: Int8Array | undefined
  if (mode === 'puzzle') {
    const p = generate(n, save.difficulty, rng)
    for (const [r, c, v] of p.givens) { cells[r * n + c] = v; given[r * n + c] = 1 }
    solution = p.solution
  }
  game = { mode, n, difficulty: save.difficulty, cells, given, solution, sel: -1, head: -1, history: [], hints: 0, marks: [], target: -1, say: { text: t('pickCell'), tone: '' }, done: undefined }
  render()
}

function remember(g: Game) {
  g.history.push({ cells: g.cells.slice(), given: g.given.slice(), solution: g.solution?.slice() })
  if (g.history.length > 400) g.history.shift()
}

function describe(c: Conflict): string {
  if (c.kind === 'assoc') return t('conflictAssoc', { a: L(c.a), b: L(c.b), c: L(c.c) })
  return t(c.kind === 'row' ? 'conflictRow' : 'conflictCol')
}

/** after any change to the cells: mark what is broken, or notice that the table is finished */
function settle(g: Game) {
  g.marks = []; g.target = -1
  const broken = conflicts(g.n, g.cells)
  if (broken.length) { g.say = { text: describe(broken[0]), tone: 'bad' }; return false }
  g.say = { text: '', tone: '' }
  if (!g.cells.includes(-1)) {
    if (isGroupTable(g.cells, g.n)) finish(g)
    else g.say = { text: t('notGroupYet'), tone: 'bad' }
  }
  return true
}

function finish(g: Game) {
  const group = identify(g.cells, g.n)
  if (!group) return
  const isNew = !save.found.includes(group.id)
  if (isNew) save.found.push(group.id)
  if (g.mode === 'puzzle') { const k = `${g.n}:${g.difficulty}`; save.solved[k] = (save.solved[k] ?? 0) + 1 }
  g.done = { group, isNew, newSubgroups: [] }
  g.sel = -1
  collectSubgroups(g)
  store(save)
  audio.win(g.n, g.cells)
}

/** arranging a normal subgroup to the front finds that subgroup too */
function collectSubgroups(g: Game) {
  for (const step of leadingNormalSubgroups(g.n, g.cells)) {
    if (step.group && !save.found.includes(step.group.id)) { save.found.push(step.group.id); g.done!.newSubgroups.push(step.group) }
  }
}

function put(at: number, v: number) {
  const g = game
  if (!g || g.done || at < 0 || g.given[at] || g.cells[at] === v) return
  remember(g)
  g.cells[at] = v
  const ok = settle(g)
  if (v < 0) audio.erase(); else if (ok) audio.place(v); else audio.wrong()
  if (ok && v >= 0 && g.mode === 'build' && save.autofill && !g.done) {
    const f = forced(g.n, g.cells)
    if (f) { g.cells.set(f); settle(g) }
  }
  render()
}

function swap(a: number, b: number) {
  const g = game!
  remember(g)
  const n = g.n, p = [...Array(n).keys()]
  p[a] = b; p[b] = a
  g.cells = relabel(g.cells, n, p)
  if (g.solution) g.solution = relabel(g.solution, n, p)
  const given = new Uint8Array(n * n)
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) given[p[r] * n + p[c]] = g.given[r * n + c]
  g.given = given
  g.head = -1; g.sel = -1; g.marks = []; g.target = -1
  audio.swap(a, b)
  if (g.done) { collectSubgroups(g); store(save) }
  render()
}

function undo() {
  const g = game, s = g?.history.pop()
  if (!g || !s || g.done) return
  g.cells = s.cells; g.given = s.given; g.solution = s.solution
  settle(g); audio.erase(); render()
}

function restart() {
  const g = game
  if (!g || !g.history.length) return
  const s = g.history[0]
  g.cells = s.cells; g.given = s.given; g.solution = s.solution; g.history = []; g.done = undefined; g.sel = -1; g.head = -1
  settle(g); g.say = { text: t('pickCell'), tone: '' }; render()
}

function hintText(h: Hint): string {
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

function askHint() {
  const g = game
  if (!g || g.done || !g.solution) return
  const n = g.n
  // a second press on the same hint fills the cell in
  if (g.target >= 0 && g.cells[g.target] < 0 && g.say.tone === 'tip') return put(g.target, g.solution[g.target])
  const wrong = g.cells.findIndex((v, i) => v >= 0 && v !== g.solution![i])
  if (wrong >= 0) {
    g.marks = [wrong]; g.target = -1; g.sel = wrong
    g.say = { text: t('hintMistake', { r: Math.floor(wrong / n) + 1, c: (wrong % n) + 1 }), tone: 'bad' }
  } else {
    const h = hint(n, g.cells, g.solution)
    if (!h) return
    g.hints++
    g.target = h.r * n + h.c; g.sel = g.target; g.head = -1
    g.marks = h.kind === 'assoc' ? [h.a * n + h.b, h.b * n + h.c3, h.x * n + h.c3, h.a * n + h.y].filter((i) => i !== g.target) : []
    g.say = { text: hintText(h) + ' ' + t('hintAgain'), tone: 'tip' }
  }
  audio.hint(); render()
}

// ---------------------------------------------------------------------------------------- drawing

const SIZE = 640

function board(g: Game): string {
  const n = g.n, u = SIZE / (n + 1), pen = new Pen(n * 7919)
  const font = u * 0.52, base = (i: number) => (i + 1) * u + u / 2 + font * 0.34
  let fills = '', texts = '', over = ''
  const selR = g.sel >= 0 ? Math.floor(g.sel / n) : -1, selC = g.sel >= 0 ? g.sel % n : -1
  for (let i = 0; i < n; i++) {
    const on = g.head === i
    fills += `<rect x="${(i + 1) * u}" y="0" width="${u}" height="${u}" fill="${tint(i, n)}"/><rect x="0" y="${(i + 1) * u}" width="${u}" height="${u}" fill="${tint(i, n)}"/>`
    texts += `<text x="${(i + 1.5) * u}" y="${base(-1)}" font-size="${font * 0.82}" fill="${on ? PINK : SOFT}">${L(i)}</text><text x="${u / 2}" y="${base(i)}" font-size="${font * 0.82}" fill="${on ? PINK : SOFT}">${L(i)}</text>`
    if (on) over += new Pen(i + 1).circle((i + 1.5) * u, u / 2, u * 0.36, PINK, 2.2) + new Pen(i + 50).circle(u / 2, (i + 1.5) * u, u * 0.36, PINK, 2.2)
  }
  texts += `<text x="${u / 2}" y="${u / 2 + font * 0.3}" font-size="${font}" fill="${SOFT}">·</text>`
  if (g.sel >= 0) fills += `<rect x="${u}" y="${(selR + 1) * u}" width="${n * u}" height="${u}" fill="${INK}" opacity=".06"/><rect x="${(selC + 1) * u}" y="${u}" width="${u}" height="${n * u}" fill="${INK}" opacity=".06"/>`
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const v = g.cells[r * n + c]
    if (v < 0) continue
    fills += `<rect x="${(c + 1) * u}" y="${(r + 1) * u}" width="${u}" height="${u}" fill="url(#h${v})"/>`
    texts += `<text x="${(c + 1.5) * u}" y="${base(r)}" font-size="${font}" fill="${g.given[r * n + c] || g.done ? INK : BLUE}">${L(v)}</text>`
  }
  let lines = ''
  for (let i = 0; i <= n; i++) {
    const p = (i + 1) * u, w = i === 0 || i === n ? 2.2 : 1.2
    lines += pen.line(i === 0 ? 0 : u, p, SIZE, p, INK, w, 1.1, i === 0 || i === n ? 2 : 1) + pen.line(p, i === 0 ? 0 : u, p, SIZE, INK, w, 1.1, i === 0 || i === n ? 2 : 1)
  }
  lines += pen.line(u, u, u, SIZE, INK, 2.2) + pen.line(u, u, SIZE, u, INK, 2.2)
  const ring = (at: number, color: string, seed: number) => new Pen(at * 31 + seed).circle(((at % n) + 1.5) * u, (Math.floor(at / n) + 1.5) * u, u * 0.43, color, 2.2)
  for (const at of g.marks) over += ring(at, g.say.tone === 'bad' ? RED : BLUE, 3)
  if (g.say.tone === 'bad' && !g.marks.length) for (const c of conflicts(n, g.cells).slice(0, 1)) for (const at of c.cells) over += ring(at, RED, 5)
  if (g.sel >= 0) over += new Pen(g.sel + 11).rect((selC + 1) * u + 3, (selR + 1) * u + 3, u - 6, u - 6, g.target === g.sel ? BLUE : PINK, 2.8, 2)
  return `<svg class="board" id="board" viewBox="-6 -6 ${SIZE + 12} ${SIZE + 12}" role="grid" aria-label="multiplication table"><defs>${hatchDefs(n, 'h')}</defs>${fills}${lines}${texts}${over}</svg>`
}

function mini(g: GroupInfo): string {
  const n = g.order, u = 96 / n
  let out = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out += `<rect x="${c * u}" y="${r * u}" width="${u + 0.3}" height="${u + 0.3}" fill="${stroke(g.table[r * n + c], n)}"/>`
  return `<svg viewBox="-2 -2 100 100">${out}${new Pen(n).rect(0, 0, 96, 96, INK, 1.6, 2)}</svg>`
}

// ---------------------------------------------------------------------------------------- screens

function top(): string {
  const nav = (id: Tab, key: Key) => `<button data-tab="${id}" class="${!game && tab === id ? 'on' : ''}">${t(key)}</button>`
  const flag = (on: boolean) => `<b>${t(on ? 'on' : 'off')}</b>`
  return `<header class="top"><button class="word" data-tab="puzzles">symmetry</button>
    <nav>${nav('puzzles', 'puzzles')}${nav('build', 'build')}${nav('collection', 'collection')}</nav>
    <div class="toggles"><button data-toggle="sound">${t('sound')} ${flag(save.sound)}</button><button data-toggle="lang">${getLang() === 'en' ? '中文' : 'English'}</button></div></header>`
}

function home(): string {
  if (tab === 'collection') {
    const entries = GROUPS.map((g) => save.found.includes(g.id)
      ? `<div class="entry">${mini(g)}<div><div class="name">${g.name}<small>${orderOf(g.order)}</small></div><p>${esc(about(g.id, g.order))}</p></div></div>`
      : `<div class="entry missing"><div class="q">?</div><div><div class="name">?<small>${orderOf(g.order)}</small></div><p>${t('notFound')}</p></div></div>`).join('')
    return `<p class="lede">${save.found.length} / ${GROUPS.length}</p><p class="note">${t('collectionIntro')}</p><div class="collection">${entries}</div>`
  }
  const puzzles = tab === 'puzzles'
  const cards = ORDERS.map((n) => {
    const gs = groupsOfOrder(n)
    const names = gs.map((g) => (save.found.includes(g.id) ? `<b>${g.name}</b>` : '?')).join(' · ')
    const count = save.solved[`${n}:${save.difficulty}`] ?? 0
    return `<button class="card" data-start="${n}"><span class="n">${n}<small>${t('order')}</small></span><span class="names">${names}</span>${puzzles && count ? `<span class="done">${t('solved')} ${count}</span>` : ''}</button>`
  }).join('')
  const levels = DIFFICULTIES.map((d) => `<button data-level="${d}" class="${save.difficulty === d ? 'on' : ''}">${t(d)}</button>`).join('')
  return `<p class="lede">${t(puzzles ? 'tagline' : 'buildIntro')}</p>
    ${puzzles ? `<div class="levels">${levels}</div><p class="note">${t((save.difficulty + 'Note') as Key)}</p>` : ''}
    <div class="orders">${cards}</div>
    <div class="rules"><h3>${t('rules')}</h3><ol><li>${t('rule1')}</li><li>${t('rule2')}</li></ol><p>${t('rulesMore')}</p></div>`
}

function facts(g: Game): string {
  const x = g.head >= 0 ? g.head : g.sel >= 0 ? g.cells[g.sel] : -1
  if (x < 0) return ''
  const f = elementFacts(g.n, g.cells, x), list = (xs: number[]) => xs.map(L).join(' ') || t('unknown')
  const order = f.order === 1 ? `1 (${t('elIdentity')})` : f.order ?? t('unknown')
  return `<div class="facts"><h4><span class="tag" style="background:${tint(x, g.n)}">${L(x)}</span>${t('element')}</h4><dl>
    <dt>${t('elOrder')}</dt><dd>${order}</dd><dt>${t('elInverse')}</dt><dd>${f.inverse === undefined ? t('unknown') : L(f.inverse)}</dd>
    <dt>${t('elCommutes')}</dt><dd>${list(f.commutesWith)}</dd><dt>${t('elConj')}</dt><dd>${list(f.conjugates)}</dd></dl></div>`
}

function reveal(g: Game): string {
  const d = g.done!, n = g.n
  const counts = [...orderCounts(n, g.cells)].map(([o, k]) => `${o}: ${k}`).join(' · ')
  const chain = leadingNormalSubgroups(n, g.cells)
  const steps = chain.length
    ? chain.map((s) => `${s.group?.name ?? '?'} ◁ ${d.group.name}, ${t('quotient')} ${s.quotient?.name ?? '?'}`).join('<br>')
    : t('chainNone')
  const extra = d.newSubgroups.length ? `<p><span class="new">${t('newFind')}: ${d.newSubgroups.map((s) => s.name).join(', ')}</span></p>` : ''
  return `<div class="reveal"><div class="small">${t(g.mode === 'puzzle' ? 'itIs' : 'youMade')}</div>
    <div class="name">${d.group.name}${d.isNew ? `<span class="new">${t('newFind')}</span>` : ''}</div>
    <p>${esc(about(d.group.id, n))}</p>
    <p class="small">${t(d.group.abelian ? 'abelian' : 'nonAbelian')} · ${t('elementsOfOrder')} — ${counts}</p>
    ${n > 3 ? `<p class="small">${t('arrange')}</p><p class="chain">${t('chain')}:<br>${steps}</p>${extra}` : ''}</div>`
}

function play(g: Game): string {
  const n = g.n
  const chips = [...Array(n).keys()].map((v) => `<button data-put="${v}" style="background:${tint(v, n)}">${L(v)}</button>`).join('')
  const title = g.mode === 'puzzle' ? `${orderOf(n)} · ${t(g.difficulty)}` : `${t('build')} · ${orderOf(n)}`
  const say = g.head >= 0 && !g.say.text ? t('swapHint') : g.say.text
  return `<div class="playhead"><button data-back class="meta">← ${t('back')}</button><h2>${title}</h2>${g.hints ? `<span class="meta">${t('hintsUsed')} ${g.hints}</span>` : ''}</div>
    <div class="play"><div class="boardcol">${board(g)}${g.done ? '' : `<div class="chips">${chips}<button class="wide" data-put="-1">${t('erase')}</button></div>`}</div>
    <div class="side">
      ${g.done ? `<div class="actions"><button data-act="next" class="main">${t(g.mode === 'puzzle' ? 'next' : 'restart')}</button></div>${reveal(g)}` : `<div class="say ${g.say.tone}">${esc(say)}</div>
      <div class="actions">
        ${g.mode === 'puzzle' ? `<button data-act="hint">${t('hint')}</button>` : ''}<button data-act="undo" ${g.history.length ? '' : 'disabled'}>${t('undo')}</button><button data-act="restart" ${g.history.length ? '' : 'disabled'}>${t('restart')}</button>
        ${g.mode === 'puzzle' ? `<button data-act="next">${t('next')}</button>` : ''}
        ${g.mode === 'build' ? `<label title="${t('autofillNote')}"><input type="checkbox" data-autofill ${save.autofill ? 'checked' : ''}>${t('autofill')}</label>` : ''}
      </div>`}
      ${facts(g)}
    </div></div>`
}

function render() {
  app.classList.toggle('playing', !!game)
  app.innerHTML = top() + (game ? play(game) : home())
}

// ----------------------------------------------------------------------------------------- input

function boardClick(ev: MouseEvent, svg: SVGSVGElement) {
  const g = game!, n = g.n, u = SIZE / (n + 1)
  const at = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svg.getScreenCTM()!.inverse())
  const c = Math.floor(at.x / u) - 1, r = Math.floor(at.y / u) - 1
  if (r >= n || c >= n || (r < 0 && c < 0)) return
  if (r < 0 || c < 0) {
    const x = r < 0 ? c : r
    if (g.head >= 0 && g.head !== x) return swap(g.head, x)
    g.head = g.head === x ? -1 : x; g.sel = -1
  } else {
    g.head = -1
    g.sel = g.sel === r * n + c ? -1 : r * n + c
  }
  audio.select(); render()
}

app.addEventListener('click', (ev) => {
  audio.wake()
  const el = ev.target as Element
  const svg = el.closest<SVGSVGElement>('#board')
  if (svg && game) return boardClick(ev as MouseEvent, svg)
  const b = el.closest<HTMLElement>('button, input')
  if (!b) return
  const d = b.dataset
  if (d.tab) { game = undefined; tab = d.tab as Tab; render() }
  else if (d.level) { save.difficulty = d.level as Difficulty; store(save); render() }
  else if (d.start) start(tab === 'build' ? 'build' : 'puzzle', +d.start)
  else if (d.put !== undefined && game) put(game.sel, +d.put)
  else if ('back' in d) { tab = game?.mode === 'build' ? 'build' : 'puzzles'; game = undefined; render() }
  else if ('autofill' in d) { save.autofill = (b as HTMLInputElement).checked; store(save) }
  else if (d.act === 'hint') askHint()
  else if (d.act === 'undo') undo()
  else if (d.act === 'restart') restart()
  else if (d.act === 'next' && game) start(game.mode, game.n)
  else if (d.toggle === 'sound') { save.sound = audio.soundOn = !save.sound; store(save); render() }
  else if (d.toggle === 'lang') { save.lang = getLang() === 'en' ? 'zh' : 'en'; setLang(save.lang); store(save); if (game && !game.say.tone) game.say.text = ''; render() }
})

window.addEventListener('keydown', (ev) => {
  const g = game
  if (!g || ev.metaKey || ev.ctrlKey || ev.altKey) { if (g && (ev.metaKey || ev.ctrlKey) && ev.key === 'z') { ev.preventDefault(); undo() } return }
  audio.wake()
  const n = g.n, move = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[ev.key]
  if (move !== undefined) {
    ev.preventDefault()
    const from = g.sel < 0 ? 0 : g.sel, r = Math.floor(from / n), c = from % n
    const nr = (r + (Math.abs(move) === n ? Math.sign(move) : 0) + n) % n, nc = (c + (Math.abs(move) === 1 ? move : 0) + n) % n
    g.sel = g.sel < 0 ? 0 : nr * n + nc; g.head = -1
    return render()
  }
  if (ev.key === 'Escape') { g.sel = -1; g.head = -1; return render() }
  if (ev.key === 'Backspace' || ev.key === 'Delete') return put(g.sel, -1)
  if (ev.key === '?' || ev.key === 'h') return askHint()
  const v = LABELS.indexOf(ev.key.toUpperCase())
  if (ev.key.length === 1 && v >= 0 && v < n) put(g.sel, v)
})

render()
