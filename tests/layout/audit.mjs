// Walks the game through its states at many window sizes and reports every place where content does not fit.
//
//   npm run build && CHROME=/path/to/chrome npm run audit:layout
//
// "Does not fit" is measured, not prevented: an element whose content is larger than its box (whether that
// shows as a scrollbar or as clipping), an element that reaches outside the window, a page that scrolls,
// or a control with something else lying on top of it.
// A scrollbar is a symptom; this finds the symptom wherever it is, in whatever state.
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const SIZES = [[320, 568], [360, 640], [391, 687], [390, 844], [430, 932], [740, 360], [768, 1024], [1024, 768], [1280, 640], [1366, 768], [1440, 900], [1920, 1080]]
const LANGS = ['en', 'zh']
const only = (name, all) => (process.env[name] ? all.filter((x) => process.env[name].split(',').includes(String(Array.isArray(x) ? x[0] : x))) : all)

/** runs in the page */
function probe() {
  const vw = window.innerWidth, vh = window.innerHeight, found = []
  const name = (el) => {
    const part = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '')
    return el.parentElement && el.parentElement.id !== 'app' && el.parentElement !== document.body ? part(el.parentElement) + ' > ' + part(el) : part(el)
  }
  const page = document.documentElement
  if (page.scrollHeight > vh + 1 || page.scrollWidth > vw + 1) found.push({ what: 'the page scrolls', where: 'html', by: `${page.scrollWidth - vw}x${page.scrollHeight - vh}` })
  for (const el of document.querySelectorAll('#app, #app *')) {
    if (el.ownerSVGElement) continue // the inside of a drawing does not scroll; the drawing itself is checked
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.display === 'inline') continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    const dx = el.scrollWidth - el.clientWidth, dy = el.scrollHeight - el.clientHeight
    if ((dy > 1 && cs.overflowY !== 'visible') || (dx > 1 && cs.overflowX !== 'visible')) found.push({ what: cs.overflowY === 'hidden' || cs.overflowX === 'hidden' ? 'content is cut off' : 'content scrolls inside', where: name(el), by: `${Math.max(dx, 0)}x${Math.max(dy, 0)}` })
    if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) found.push({ what: 'reaches outside the window', where: name(el), by: `${Math.round(Math.max(r.right - vw, -r.left, 0))}x${Math.round(Math.max(r.bottom - vh, -r.top, 0))}` })
  }
  // a drawing must hold everything in it: a star cluster's halo covers its orbit, and must lie inside the chart
  for (const svg of document.querySelectorAll('#app svg.chart')) {
    const box = svg.getBoundingClientRect()
    for (const halo of svg.querySelectorAll('.halo')) {
      const r = halo.getBoundingClientRect()
      if (r.left < box.left - 1 || r.top < box.top - 1 || r.right > box.right + 1 || r.bottom > box.bottom + 1) { found.push({ what: 'cut off by the edge of its own drawing', where: 'svg.chart .node', by: '' }); break }
    }
  }
  // every control must be reachable: whatever is on top at its centre has to be the control itself
  for (const el of document.querySelectorAll('#app button, #app input, #app .node')) {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1 || getComputedStyle(el).visibility === 'hidden') continue
    const x = r.left + r.width / 2, y = r.top + r.height / 2
    if (x < 0 || y < 0 || x > vw || y > vh) continue // already reported as outside the window
    const top = document.elementFromPoint(x, y)
    if (top && top !== el && !el.contains(top) && !top.contains(el) && !top.closest('[data-layer]')) found.push({ what: 'a control is covered', where: `${name(el)} under ${name(top)}`, by: '' })
  }
  return found
}

// SIZE=391,1366 and LANG_=en narrow the walk; several can run side by side on different PORTs
const PORT = +(process.env.PORT ?? 4399)
const server = await preview({ preview: { port: PORT, host: '127.0.0.1', strictPort: true }, logLevel: 'silent' })
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox', '--no-proxy-server'] })
const tally = new Map() // "what | where" -> { count, sizes:Set, states:Set, worst }
let checks = 0

for (const [w, h] of only('SIZE', SIZES)) for (const lang of only('LANG_', LANGS)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', hasTouch: w < 800 })
  await ctx.addInitScript((lang) => { if (!sessionStorage.getItem('audit')) { sessionStorage.setItem('audit', '1'); localStorage.setItem('symmetry.v2', JSON.stringify({ lang, sound: false })) } }, lang)
  const page = await ctx.newPage()
  const crashes = []
  page.on('pageerror', (e) => crashes.push(e.message))
  const check = async (state) => {
    checks++
    for (const f of await page.evaluate(probe)) {
      const key = `${f.what} | ${f.where}`
      const t = tally.get(key) ?? { count: 0, sizes: new Set(), states: new Set(), worst: f.by }
      t.count++; t.sizes.add(`${w}x${h}`); t.states.add(`${state} [${lang}]`)
      tally.set(key, t)
    }
  }
  const open = async (hash) => {
    await page.goto(`http://127.0.0.1:${PORT}/${hash}`); await page.waitForSelector('#app > *'); await page.evaluate(() => document.fonts.ready)
    // a puzzle is made on another thread: look at the waiting screen, then wait for this puzzle's own board
    if (hash) { await check('a puzzle is being made'); await page.waitForFunction((code) => !document.querySelector('.brewing') && document.querySelector('#board') && document.querySelector('.code, .info') && location.hash === code, hash, { timeout: 120000 }) }
  }
  // controls are pressed by event, not by pointer, so that a layout that is wrong cannot stop the walk
  const press = (selector) => page.dispatchEvent(selector, 'click')
  const cell = async (n, r, c) => {
    const box = await page.locator('#board').boundingBox(), u = 640 / (n + 1)
    await page.mouse.click(box.x + box.width * (6 + u * (c + 1.5)) / 652, box.y + box.height * (6 + u * (r + 1.5)) / 652)
  }

  // the three home screens, each difficulty's note, a collection entry
  await open('')
  await check('home')
  for (const d of ['normal', 'expert', 'easy']) { await press(`[data-level="${d}"]`); await check(`home, ${d}`) }
  await press('[data-tab="build"]'); await check('home, build')
  await press('[data-help]'); await check('home, build, the explanation open'); await press('[data-help]')
  await press('[data-tab="puzzles"]'); await press('[data-help]'); await check('home, the explanation open'); await press('[data-help]')

  // puzzles: every state on the way from fresh to solved
  for (const [n, d, seed] of [[2, 'e', 1], [3, 'e', 1], [4, 'n', 3], [8, 'e', 5], [8, 'x', 2], [12, 'x', 9], [16, 'n', 4], [20, 'e', 1], [20, 'x', 2]]) {
    await open(`#${n}-${d}-${seed}`)
    const tag = `order ${n} ${d}`
    await check(`${tag}: fresh`)
    await cell(n, 0, 0); await check(`${tag}: a cell selected`)
    await cell(n, -1, 0); await check(`${tag}: a header selected`)
    if (await page.$('[data-help]')) { await press('[data-help]'); await check(`${tag}: the explanation open`); await press('[data-help]') }
    else { await cell(n, -1, 0); await press('[data-info]'); await check(`${tag}: the note open with nothing to say`); await press('[data-info]'); await cell(n, -1, 0) }
    await cell(n, -1, 0)
    // a wrong move: repeat a value in its own row
    for (let i = 0; i < n * n + 5; i++) {
      if (await page.$('.reveal')) break
      await press('[data-act="hint"]'); await check(`${tag}: a hint`)
      await press('[data-act="hint"]'); await check(`${tag}: a cell filled`)
    }
    if (!(await page.$('.reveal'))) tally.set(`the puzzle was not finished | ${tag}`, { count: 1, sizes: new Set([`${w}x${h}`]), states: new Set([lang]), worst: '' })
    await check(`${tag}: solved`)
    if (await page.$('.sheet')) { await page.mouse.click(4, h - 4); await check(`${tag}: solved, note folded away`) }
    if (n > 3) { await cell(n, -1, 0); await cell(n, -1, 1); await check(`${tag}: solved, two elements swapped`) }
  }
  // the collection once something is in it
  await open(''); await press('[data-tab="collection"]'); await check('collection')
  for (const tile of await page.$$('[data-pick]')) { await tile.dispatchEvent('click'); await check('collection, a seal picked') }

  // building: a repeated value, and a broken associativity
  await open(''); await press('[data-tab="build"]'); await press('[data-start="3"]')
  await check('build: empty')
  await cell(3, 0, 0); await page.keyboard.press('1'); await cell(3, 0, 1); await page.keyboard.press('1'); await check('build: a value twice in a row')
  await page.keyboard.press('0'); await cell(3, 1, 0); await page.keyboard.press('2'); await check('build: associativity broken')

  if (crashes.length) tally.set(`the page threw | ${crashes[0]}`, { count: crashes.length, sizes: new Set([`${w}x${h}`]), states: new Set(['-']), worst: '' })
  await ctx.close()
}
await browser.close()
await new Promise((done) => server.httpServer.close(done))

const rows = [...tally].sort((a, b) => b[1].count - a[1].count)
console.log(`${checks} states checked, ${rows.length} kinds of misfit\n`)
for (const [key, t] of rows) {
  const [what, where] = key.split(' | ')
  console.log(`${String(t.count).padStart(5)}x  ${what}: ${where}   (worst ${t.worst}px)`)
  console.log(`        sizes: ${[...t.sizes].join(' ')}`)
  console.log(`        e.g.:  ${[...t.states].slice(0, 3).join(' · ')}`)
}
process.exit(rows.length ? 1 : 0)
