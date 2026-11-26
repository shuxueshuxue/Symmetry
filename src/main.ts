import './style.css'
import { GROUPS, LABELS, ORDERS, groupsOfOrder, type GroupInfo } from './core/groups.ts'
import { conflicts } from './core/solve.ts'
import { DIFFICULTIES, type Difficulty } from './core/generate.ts'
import { advise, newBuild, newPuzzle, parseCode, place, restart as restartSession, swapElements, undo as undoMove, type Report, type Session } from './game/session.ts'
import { recordArrangement, recordSolve } from './game/progress.ts'
import { conflictText, hintText } from './game/words.ts'
import { elementFacts, leadingNormalSubgroups, orderCounts } from './core/structure.ts'
import { about, getLang, orderOf, setLang, t, type Key } from './i18n.ts'
import { load, store } from './store.ts'
import { audio } from './audio.ts'
import { BLUE, INK, NIGHT, PINK, RED, SOFT, Pen, glow, hatchDefs, stroke, tint } from './sketch.ts'
import { startSky } from './sky.ts'

type Tab = 'puzzles' | 'build' | 'collection'

/** a session, plus what only the screen cares about */
interface Game extends Session {
  sel: number        // selected cell, or -1
  head: number       // selected header element, or -1
  marks: number[]    // cells a hint points at
  target: number     // the cell a hint is about, or -1
  say: { text: string; tone: '' | 'bad' | 'tip' }
  /** on a small screen, whether the note is unfolded */
  info: boolean
  done: { group: GroupInfo; isNew: boolean; newSubgroups: GroupInfo[] } | undefined
  /** what should animate on the next draw, and only that one */
  fx: { fresh: boolean; put: number[]; hint: boolean; bad: boolean; won: boolean }
}

const save = load()
setLang(save.lang)
audio.soundOn = save.sound

let tab: Tab = 'puzzles'
let game: Game | undefined
/** the screen has just changed, so it may make an entrance */
let fresh = true
/** which group the collection is showing */
let picked: string | undefined

/** A small window has no room for a side column: what the game has to say goes in a note that unfolds. */
const compact = () => window.innerWidth < 760 || window.innerHeight < 520

const app = document.getElementById('app')!
const L = (v: number) => LABELS[v]
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// ------------------------------------------------------------------------------------------ game

function open(session: Session) {
  game = Object.assign(session, { sel: -1, head: -1, marks: [], target: -1, say: { text: '', tone: '' as const }, info: false, done: undefined,
    fx: { fresh: true, put: [], hint: false, bad: false, won: false } })
  // the address names the puzzle, so it can be passed on
  history.replaceState(null, '', session.code ? '#' + session.code : location.pathname + location.search)
  render()
}

const start = (mode: Session['mode'], n: number) => open(mode === 'puzzle' ? newPuzzle(n, save.difficulty) : newBuild(n))

/** show what a move did: what is broken, or that the table is finished */
function show(g: Game, r: Report) {
  g.marks = []; g.target = -1
  g.fx.put = r.changed
  if (r.conflicts.length) { g.say = { text: conflictText(r.conflicts[0]), tone: 'bad' }; g.fx.bad = true; g.info = true; return }
  g.say = { text: '', tone: '' }; g.info = false
  if (r.won) {
    g.done = { group: r.won, ...recordSolve(save, g, r.won) }
    g.sel = -1; g.fx.won = true; g.info = true
    store(save)
    audio.win(g.n, g.cells)
  }
}

function put(at: number, v: number) {
  const g = game
  if (!g) return
  const r = place(g, at, v, { autofill: g.mode === 'build' && save.autofill })
  if (!r) return
  show(g, r)
  if (v < 0) audio.erase(); else if (r.conflicts.length) audio.wrong(); else if (!r.won) audio.place(v)
  render()
}

function swap(a: number, b: number) {
  const g = game!
  swapElements(g, a, b)
  g.head = -1; g.sel = -1; g.marks = []; g.target = -1
  audio.swap(a, b)
  if (g.done) { g.done.newSubgroups.push(...recordArrangement(save, g)); store(save) }
  render()
}

function undo() {
  const g = game, r = g && undoMove(g)
  if (!g || !r) return
  show(g, r); g.fx.put = []
  audio.erase(); render()
}

function restart() {
  const g = game
  if (!g || !restartSession(g)) return
  g.done = undefined; g.sel = -1; g.head = -1; g.marks = []; g.target = -1; g.fx.fresh = true
  g.say = { text: '', tone: '' }; g.info = false; render()
}

function askHint() {
  const g = game
  if (!g || g.done || !g.solution) return
  const n = g.n
  // a second press on the same hint fills the cell in
  if (g.target >= 0 && g.cells[g.target] < 0 && g.say.tone === 'tip') return put(g.target, g.solution[g.target])
  const a = advise(g)
  if (!a) return
  if (a.kind === 'mistake') {
    g.marks = [a.at]; g.target = -1; g.sel = a.at
    g.say = { text: t('hintMistake', { r: Math.floor(a.at / n) + 1, c: (a.at % n) + 1 }), tone: 'bad' }
  } else {
    const h = a.hint
    g.target = h.r * n + h.c; g.sel = g.target; g.head = -1
    g.marks = h.kind === 'assoc' ? [h.a * n + h.b, h.b * n + h.c3, h.x * n + h.c3, h.a * n + h.y].filter((i) => i !== g.target) : []
    g.say = { text: hintText(h), tone: 'tip' }
  }
  g.fx.hint = true; g.info = true
  audio.hint(); render()
}

// ---------------------------------------------------------------------------------------- drawing

const SIZE = 640

function board(g: Game): string {
  const n = g.n, u = SIZE / (n + 1), pen = new Pen(n * 7919), fx = g.fx
  const font = u * 0.52, base = (i: number) => (i + 1) * u + u / 2 + font * 0.34
  let fills = '', texts = '', over = ''
  const selR = g.sel >= 0 ? Math.floor(g.sel / n) : -1, selC = g.sel >= 0 ? g.sel % n : -1
  for (let i = 0; i < n; i++) {
    const on = g.head === i
    fills += `<rect x="${(i + 1) * u}" y="0" width="${u}" height="${u}" fill="${tint(i, n)}" opacity=".7"/><rect x="0" y="${(i + 1) * u}" width="${u}" height="${u}" fill="${tint(i, n)}" opacity=".7"/>`
    texts += `<text x="${(i + 1.5) * u}" y="${base(-1)}" font-size="${font * 0.82}" fill="${on ? PINK : glow(i, n)}" opacity="${on ? 1 : 0.75}">${L(i)}</text><text x="${u / 2}" y="${base(i)}" font-size="${font * 0.82}" fill="${on ? PINK : glow(i, n)}" opacity="${on ? 1 : 0.75}">${L(i)}</text>`
    if (on) over += new Pen(i + 1).circle((i + 1.5) * u, u / 2, u * 0.36, PINK, 2.2) + new Pen(i + 50).circle(u / 2, (i + 1.5) * u, u * 0.36, PINK, 2.2)
  }
  texts += `<text x="${u / 2}" y="${u / 2 + font * 0.3}" font-size="${font}" fill="${SOFT}">·</text>`
  if (g.sel >= 0) fills += `<rect x="${u}" y="${(selR + 1) * u}" width="${n * u}" height="${u}" fill="#fff" opacity=".05"/><rect x="${(selC + 1) * u}" y="${u}" width="${u}" height="${n * u}" fill="#fff" opacity=".05"/>`
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const at = r * n + c, v = g.cells[at]
    if (v < 0) continue
    // a cell just written drops in; a finished table ripples from its top-left corner
    const move = fx.won ? ` class="wave" style="animation-delay:${(r + c) * 45}ms"` : fx.put.includes(at) ? ' class="drop"' : ''
    fills += `<rect${move} x="${(c + 1) * u}" y="${(r + 1) * u}" width="${u}" height="${u}" fill="url(#h${v})"/>`
    texts += `<text${move} x="${(c + 1.5) * u}" y="${base(r)}" font-size="${font}" fill="${g.given[at] || g.done ? INK : BLUE}">${L(v)}</text>`
  }
  let lines = ''
  for (let i = 0; i <= n; i++) {
    const p = (i + 1) * u, edge = i === 0 || i === n
    lines += pen.line(i === 0 ? 0 : u, p, SIZE, p, INK, edge ? 2.2 : 1, 1.1, edge ? 2 : 1) + pen.line(p, i === 0 ? 0 : u, p, SIZE, INK, edge ? 2.2 : 1, 1.1, edge ? 2 : 1)
  }
  lines += pen.line(u, u, u, SIZE, INK, 2.2) + pen.line(u, u, SIZE, u, INK, 2.2)
  const ring = (at: number, color: string, seed: number) => new Pen(at * 31 + seed).circle(((at % n) + 1.5) * u, (Math.floor(at / n) + 1.5) * u, u * 0.43, color, 2.2)
  let rings = ''
  for (const at of g.marks) rings += ring(at, g.say.tone === 'bad' ? RED : BLUE, 3)
  if (g.say.tone === 'bad' && !g.marks.length) for (const c of conflicts(n, g.cells).slice(0, 1)) for (const at of c.cells) rings += ring(at, RED, 5)
  // rings are drawn in one stroke the moment they appear
  over += fx.hint || fx.bad ? `<g class="inked">${rings.replace(/<path /g, '<path pathLength="1" ')}</g>` : rings
  if (g.sel >= 0) over += `<g class="cursor">${new Pen(g.sel + 11).rect((selC + 1) * u + 3, (selR + 1) * u + 3, u - 6, u - 6, g.target === g.sel ? BLUE : PINK, 2.8, 2)}</g>`
  return `<svg class="board${fx.bad ? ' shake' : ''}" id="board" viewBox="-6 -6 ${SIZE + 12} ${SIZE + 12}" role="grid" aria-label="multiplication table"><defs>${hatchDefs(n, 'h')}</defs><g class="lines">${fills}${lines}</g>${texts}${over}</svg>`
}

/** a group's table as a small block of colour: its seal */
function mini(g: GroupInfo): string {
  const n = g.order, u = 96 / n
  let out = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out += `<rect x="${c * u}" y="${r * u}" width="${u + 0.3}" height="${u + 0.3}" fill="${stroke(g.table[r * n + c], n)}"/>`
  return `<svg class="seal" viewBox="-2 -2 100 100">${out}${new Pen(n).rect(0, 0, 96, 96, INK, 1.6, 2)}</svg>`
}

/** The home screen is a star chart: one cluster per order, one star per group of that order. Stars light up when found.
 *  It is laid out for the space it is given: one long zigzag when wide, several rows when not. */
function chart(puzzles: boolean, roomW: number, roomH: number): string {
  const R = 27, ORBIT = 46, CELL_W = 104, CELL_H = 150
  // the number of rows that lets the chart be drawn largest in this room
  let rows = 1, best = 0
  for (const k of [1, 2, 3, 4, 6]) {
    const cols = Math.ceil(ORDERS.length / k), scale = Math.min(roomW / (cols * CELL_W), roomH / (k * CELL_H))
    if (scale > best) { best = scale; rows = k }
  }
  const cols = Math.ceil(ORDERS.length / rows), W = cols * CELL_W, H = rows * CELL_H
  const pos = ORDERS.map((_, i) => {
    const row = Math.floor(i / cols), k = i % cols, back = row % 2 === 1 // alternate rows run right to left, so the path never crosses itself
    const x = ((back ? cols - 1 - k : k) + 0.5) * CELL_W
    return [x, (row + 0.5) * CELL_H - 8 + (k % 2 ? 1 : -1) * (rows === 1 ? 62 + 30 * Math.sin(i * 1.9 + 0.6) : 16)]
  })
  const pen = new Pen(42)
  let paths = '', nodes = ''
  for (let i = 1; i < pos.length; i++) paths += pen.line(pos[i - 1][0], pos[i - 1][1], pos[i][0], pos[i][1], SOFT, 1.1, 1.6, 1)
  let star = 0
  ORDERS.forEach((n, i) => {
    const [x, y] = pos[i], gs = groupsOfOrder(n)
    let stars = ''
    gs.forEach((g, k) => {
      const a = (k / gs.length) * 6.2832 - 1.5708 + i, sx = x + ORBIT * Math.cos(a), sy = y + ORBIT * Math.sin(a)
      stars += save.found.includes(g.id)
        ? `<circle class="star on" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="6.5" fill="${glow(star, GROUPS.length)}" style="color:${glow(star, GROUPS.length)}"><title>${g.name}</title></circle>`
        : `<circle class="star" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4.5" fill="none" stroke="${SOFT}" stroke-width="1.3" stroke-dasharray="2.5 3"/>`
      star++
    })
    const count = save.solved[`${n}:${save.difficulty}`] ?? 0
    nodes += `<g class="node" data-start="${n}" role="button" tabindex="0" aria-label="${orderOf(n)}" style="transform-origin:${x}px ${y}px">
      <circle class="halo" cx="${x}" cy="${y}" r="${ORBIT + 4}"/>
      <circle cx="${x}" cy="${y}" r="${R}" fill="${NIGHT}"/>${new Pen(n * 13).circle(x, y, R, INK, 1.8)}
      <text class="num" x="${x}" y="${y + 11}">${n}</text>
      <g class="orbit" style="transform-origin:${x}px ${y}px;animation-duration:${50 + i * 7}s;animation-direction:${i % 2 ? 'reverse' : 'normal'}">${stars}</g>
      ${puzzles && count ? `<text class="times" x="${x + R + 2}" y="${y - R + 4}">×${count}</text>` : ''}</g>`
  })
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${Math.floor(W * best)}" height="${Math.floor(H * best)}">${paths}${nodes}</svg>`
}

// ---------------------------------------------------------------------------------------- screens

function top(): string {
  const nav = (id: Tab, key: Key) => `<button data-tab="${id}" class="${!game && tab === id ? 'on' : ''}">${t(key)}</button>`
  const flag = (on: boolean) => `<b>${t(on ? 'on' : 'off')}</b>`
  const toggles = `<div class="toggles"><button data-toggle="sound">${t('sound')} ${flag(save.sound)}</button><button data-toggle="lang">${getLang() === 'en' ? '中文' : 'EN'}</button></div>`
  if (game) {
    // while a table is open the bar is just: back, what this is, and the switches. The group has no name until it is solved.
    const g = game, what = g.done ? g.done.group.name : '???', small = compact()
    const title = g.mode === 'puzzle' ? `${orderOf(g.n)} · <b class="${g.done ? 'known' : 'unknown'}">${what}</b>` : `${t('build')} · ${orderOf(g.n)}`
    // on a small screen the note is behind this button; a dot says there is something to read
    const dot = g.say.tone === 'bad' ? ' bad' : g.say.tone === 'tip' || g.done ? ' tip' : ''
    return `<header class="top"><button data-back class="back" aria-label="${t('back')}">←</button><h2>${title}</h2>
      <span class="meta">${g.mode === 'puzzle' ? t(g.difficulty) : ''}${g.hints && !small ? ` · ${t('hintsUsed')} ${g.hints}` : ''}</span>
      ${small ? `<button class="info${dot}${g.info ? ' open' : ''}" data-info aria-label="${t('info')}">i</button>`
        : `${g.code ? `<button class="code" data-copy title="${t('copyLink')}">#${g.code}</button>` : ''}${toggles}`}</header>`
  }
  return `<header class="top"><button class="word" data-tab="puzzles">symmetry</button>
    <nav>${nav('puzzles', 'puzzles')}${nav('build', 'build')}${nav('collection', 'collection')}</nav>
    ${toggles}</header>`
}

/** every group as a small seal on a wall; one of them is shown in full */
function shelf(): string {
  const shown = GROUPS.find((g) => g.id === picked && save.found.includes(g.id))
  const wall = GROUPS.map((g) => save.found.includes(g.id)
    ? `<button class="tile${g === shown ? ' on' : ''}" data-pick="${g.id}" aria-label="${g.name}">${mini(g)}</button>`
    : `<span class="tile missing" title="${orderOf(g.order)}">?</span>`).join('')
  const card = shown
    ? `<div class="entry">${mini(shown)}<div><div class="name">${shown.name}<small>${orderOf(shown.order)}</small></div><p>${esc(about(shown.id, shown.order))}</p></div></div>`
    : `<div class="entry missing"><p>${t(save.found.length ? 'pickOne' : 'collectionIntro')}</p></div>`
  return `<div class="shelf${fresh ? ' arrive' : ''}"><p class="count">${save.found.length} / ${GROUPS.length}</p><div class="wall">${wall}</div>${card}</div>`
}

function home(): string {
  if (tab === 'collection') return shelf()
  const puzzles = tab === 'puzzles', small = compact()
  const levels = DIFFICULTIES.map((d) => `<button data-level="${d}" class="${save.difficulty === d ? 'on' : ''}">${t(d)}</button>`).join('')
  // the chart gets whatever the words leave; the words are measured in lines, generously
  const w = window.innerWidth, h = window.innerHeight, pad = small ? 28 : 48
  const words = (small ? 150 : 124) + (w < 420 ? 44 : 0) + (puzzles ? (small ? 78 : 44) : 0)
  return `<div class="home${fresh ? ' arrive' : ''}"><div class="intro"><p class="lede">${t(puzzles ? 'tagline' : 'buildIntro')}</p>
    ${puzzles ? `<div class="levels">${levels}</div><p class="note">${t((save.difficulty + 'Note') as Key)}</p>` : ''}</div>
    <div class="sky">${chart(puzzles, Math.min(w, 1080) - pad, Math.max(h - words - 60, 120))}</div>
    <div class="rules"><span>1 · ${t('rule1')}</span><span>2 · ${t('rule2')}</span></div></div>`
}

function facts(g: Game): string {
  const x = g.head >= 0 ? g.head : g.sel >= 0 ? g.cells[g.sel] : -1
  if (x < 0) return ''
  const f = elementFacts(g.n, g.cells, x), list = (xs: number[]) => xs.map(L).join(' ') || t('unknown')
  const order = f.order === 1 ? `1 (${t('elIdentity')})` : f.order ?? t('unknown')
  return `<div class="facts"><h4><span class="tag" style="background:${tint(x, g.n)};border-color:${glow(x, g.n)}">${L(x)}</span>${t('element')}</h4><dl>
    <dt>${t('elOrder')}</dt><dd>${order}</dd><dt>${t('elInverse')}</dt><dd>${f.inverse === undefined ? t('unknown') : L(f.inverse)}</dd>
    <dt>${t('elCommutes')}</dt><dd>${list(f.commutesWith)}</dd><dt>${t('elConj')}</dt><dd>${list(f.conjugates)}</dd></dl></div>`
}

function reveal(g: Game, small: boolean): string {
  const d = g.done!, n = g.n
  const counts = [...orderCounts(n, g.cells)].map(([o, k]) => `${o}: ${k}`).join(' · ')
  const chain = leadingNormalSubgroups(n, g.cells)
  const steps = chain.length
    ? chain.map((s) => `${s.group?.name ?? '?'} ◁ ${d.group.name}, ${t('quotient')} ${s.quotient?.name ?? '?'}`).join('<br>')
    : t('chainNone')
  const extra = d.newSubgroups.length ? `<p><span class="new">${t('newFind')}: ${d.newSubgroups.map((s) => s.name).join(', ')}</span></p>` : ''
  // the name is written out one character at a time, once
  const name = g.fx.won ? [...d.group.name].map((ch, i) => `<i style="animation-delay:${900 + i * 110}ms">${ch}</i>`).join('') : d.group.name
  return `<div class="reveal${g.fx.won ? ' unseal' : ''}"><div class="who">${mini(d.group)}<div><div class="small">${t(g.mode === 'puzzle' ? 'itIs' : 'youMade')}</div>
    <div class="name">${name}</div>${d.isNew ? `<span class="new">${t('newFind')}</span>` : ''}</div></div>
    <p>${esc(about(d.group.id, n))}</p>
    <p class="small">${t(d.group.abelian ? 'abelian' : 'nonAbelian')} · ${t('elementsOfOrder')} ${counts}</p>
    ${n > 3 ? `${small ? '' : `<p class="small">${t('arrange')}</p>`}<p class="chain">${t('chain')}:<br>${steps}</p>${extra}` : ''}</div>`
}

/** what the game has to say right now: the result, a message, or the facts about an element */
function note(g: Game, small: boolean): string {
  // on a small screen the note covers the buttons, so it carries the one that matters
  if (g.done) return reveal(g, small) + (small ? `<div class="actions"><button data-act="next" class="main">${t(g.mode === 'puzzle' ? 'next' : 'restart')}</button></div>` : '')
  const say = g.head >= 0 && !g.say.text ? t('swapHint') : g.say.text
  const fill = g.say.tone === 'tip' && g.target >= 0 && g.cells[g.target] < 0 ? `<button class="fill" data-act="hint">${t('fillIn')}</button>` : ''
  const about = facts(g)
  if (!say && !about) return small ? `<div class="say">${t('rule1')}<br>${t('rule2')}</div>` : `<div class="say quiet">${t('pickCell')}</div>`
  return (say ? `<div class="say ${g.say.tone}">${esc(say)}${fill}</div>` : '') + about
}

function play(g: Game): string {
  const n = g.n, small = compact()
  // a small screen gets two rows of keys once one row would make them too narrow to press
  const rows = small && n + 1 > 9 ? 2 : 1, perRow = Math.ceil((n + 1) / rows)
  const keys = [...Array(n).keys()].map((v) => `<button data-put="${v}" style="background:${tint(v, n)};border-color:${stroke(v, n)};color:${glow(v, n)}">${L(v)}</button>`).join('')
  const chips = g.done ? '' : `<div class="chips" style="--per-row:${perRow}">${keys}<button class="wide" data-put="-1" aria-label="${t('erase')}">⌫</button></div>`
  const actions = g.done
    ? `<div class="actions"><button data-act="next" class="main">${t(g.mode === 'puzzle' ? 'next' : 'restart')}</button></div>`
    : `<div class="actions">
        ${g.mode === 'puzzle' ? `<button data-act="hint">${t('hint')}</button>` : ''}<button data-act="undo" ${g.history.length ? '' : 'disabled'}>${t('undo')}</button><button data-act="restart" ${g.history.length ? '' : 'disabled'}>${t('restart')}</button>
        ${g.mode === 'puzzle' ? `<button data-act="next">${t('next')}</button>` : ''}
        ${g.mode === 'build' ? `<label title="${t('autofillNote')}"><input type="checkbox" data-autofill ${save.autofill ? 'checked' : ''}>${t('autofill')}</label>` : ''}
      </div>`
  const unfold = g.fx.fresh ? ' unfold' : ''
  if (small) return `<div class="play small${unfold}" style="--key-rows:${g.done ? 0 : rows}"><div class="boardcol">${board(g)}</div>
    <div class="controls">${chips}${actions}</div>${g.info ? `<div class="sheet" data-layer>${note(g, true)}</div>` : ''}</div>`
  return `<div class="play${unfold}"><div class="boardcol">${board(g)}${chips}</div><div class="side">${note(g, false)}${actions}</div></div>`
}

function leave() {
  game = undefined; fresh = true
  history.replaceState(null, '', location.pathname + location.search)
}

/** Every change redraws the screen, so anything that should move only once is flagged, drawn, and unflagged. */
function render() {
  app.classList.toggle('playing', !!game)
  app.innerHTML = top() + (game ? play(game) : home())
  fresh = false
  if (game) game.fx = { fresh: false, put: [], hint: false, bad: false, won: false }
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
    g.head = g.head === x ? -1 : x; g.sel = -1; g.info = false
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
  const b = el.closest<HTMLElement | SVGElement>('[data-start], button, input')
  if (!b) return
  const d = b.dataset
  if (d.tab) { leave(); tab = d.tab as Tab; render() }
  else if (d.level) { save.difficulty = d.level as Difficulty; store(save); render() }
  else if (d.start) start(tab === 'build' ? 'build' : 'puzzle', +d.start)
  else if (d.put !== undefined && game) put(game.sel, +d.put)
  else if ('back' in d) { tab = game?.mode === 'build' ? 'build' : 'puzzles'; leave(); render() }
  else if ('autofill' in d) { save.autofill = (b as HTMLInputElement).checked; store(save) }
  else if (d.act === 'hint') askHint()
  else if (d.act === 'undo') undo()
  else if (d.act === 'restart') restart()
  else if (d.act === 'next' && game) start(game.mode, game.n)
  else if (d.pick) { picked = d.pick; render() }
  else if ('info' in d && game) { game.info = !game.info; render() }
  else if ('copy' in d && game?.code) void navigator.clipboard?.writeText(location.href)
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

// the chart is laid out for the window's shape
window.addEventListener('resize', () => render())
// a touch anywhere outside the unfolded note folds it away; the touch still does what it would have done
document.addEventListener('pointerdown', (ev) => {
  const el = ev.target as Element
  if (game?.info && compact() && !el.closest('.sheet, [data-info]')) { game.info = false; app.querySelector('.sheet')?.remove(); app.querySelector('.info')?.classList.remove('open') }
}, true)
// a star cluster can be opened from the keyboard too
app.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') (ev.target as Element).closest<SVGElement>('.node')?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

startSky(document.getElementById('sky') as HTMLCanvasElement)
// an address like …/#8-n-k3f9 opens that puzzle
function follow() {
  const named = parseCode(location.hash.slice(1))
  if (!named) return false
  if (game?.code !== location.hash.slice(1)) { save.difficulty = named.difficulty; open(newPuzzle(named.n, named.difficulty, named.seed)) }
  return true
}
window.addEventListener('hashchange', follow)
if (!follow()) render()
