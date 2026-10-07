// Regenerates the screenshots and GIFs in docs/media from a running copy of the app.
//
// Prerequisites (see docs/deployment.md, "Capturing the media"):
//   1. a production build of nextjs/ served on 127.0.0.1:3000   (cd nextjs && npm start)
//   2. docs/examples/dev-proxy.mjs running on 127.0.0.1:3100    (forwards /api/backend to the public deployment, GET only)
//   3. playwright-core installed somewhere:  npm i playwright-core
//      and Chrome/Chromium on the machine (CHROME=/path/to/chrome, default /usr/bin/google-chrome)
//   4. ffmpeg on PATH (GIF conversion)
//
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core/index.mjs node docs/examples/capture-media.mjs [shots|mobile|gifs|all]
//
// All data on the images comes from the live deployment at the time of capture (see media/CREDITS.md for the
// TMDB data and poster attribution).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core')

const HERE = dirname(fileURLToPath(import.meta.url))
const MEDIA = resolve(HERE, '../media')
const TMP = resolve(process.env.TMPDIR ?? '/tmp', 'gs-capture')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100'
const CHROME = process.env.CHROME ?? '/usr/bin/google-chrome'
const MODE = process.argv[2] ?? 'all'

mkdirSync(MEDIA, { recursive: true })
mkdirSync(TMP, { recursive: true })

// PNGs above 380 kB are re-encoded with a 128-colour palette (the repository keeps every image under 400 kB).
function shrink(path) {
  if (statSync(path).size <= 380 * 1024) return
  const tmp = path + '.tmp.png'
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path, '-vf', 'split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none', tmp])
  renameSync(tmp, path)
}

// Wait until the TMDB poster (lazy-loaded <img>) has actually rendered, if the page has one.
const posterLoaded = p =>
  p
    .waitForFunction(() => {
      const i = document.querySelector('img[src*="image.tmdb.org"]')
      return !i || (i.complete && i.naturalWidth > 0)
    }, null, { timeout: 15000 })
    .catch(() => {})

const sleep = ms => new Promise(r => setTimeout(r, ms))
const launch = () =>
  chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })

// A visible pointer for the GIFs (Playwright videos do not draw the cursor).
const CURSOR = `
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div')
    c.style.cssText = 'position:fixed;z-index:2147483647;width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.85);border:2px solid #7c3aed;pointer-events:none;left:-20px;top:-20px;transform:translate(-50%,-50%)'
    document.body.appendChild(c)
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
  })`

async function exploreSearchAndLoad(p, query) {
  await p.getByRole('button', { name: 'semantic', exact: true }).click()
  await p.getByPlaceholder('Search series…').fill(query)
  await p.locator('div.absolute.top-full button').first().waitFor({ timeout: 20000 })
  await p.locator('div.absolute.top-full button').first().click()
  await sleep(4500)
}

// ───────────────────────── desktop screenshots ─────────────────────────
async function shots() {
  const b = await launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const shot = async (name, settle) => {
    await sleep(settle)
    await p.screenshot({ path: join(MEDIA, name) })
    shrink(join(MEDIA, name))
    console.log('shot', name)
  }

  await p.goto(BASE + '/')
  await shot('home.png', 1500)

  await p.goto(BASE + '/search?q=slow-burn%20psychological%20thriller')
  await shot('search-semantic.png', 9000)

  await p.getByRole('button', { name: 'hybrid', exact: true }).click()   // same query, hybrid mode (can take several seconds)
  await p.locator('text=hybrid').first().waitFor()
  await p.waitForFunction(() => document.body.innerText.includes('searching…') === false, null, { timeout: 60000 })
  await shot('search-hybrid.png', 9000)

  for (const [mode, q, file] of [['structural', 'breaking', 'search-structural.png'], ['person', 'cranston', 'search-person.png']]) {
    await p.goto(`${BASE}/search?q=${q}`)
    await sleep(2500)
    await p.getByRole('button', { name: mode, exact: true }).click()
    await p.waitForFunction(() => !document.body.innerText.includes('searching…'), null, { timeout: 60000 })
    await shot(file, 7000)
  }

  await p.goto(BASE + '/search?q=slow-burn%20psychological%20thriller')
  await p.locator('text=Safe').first().waitFor({ timeout: 60000 })
  await sleep(5000)
  await p.getByLabel('Fullscreen').click()
  await shot('graph-fullscreen.png', 4000)
  await p.keyboard.press('Escape')

  await p.goto(BASE + '/series/1396?depth=2')
  await posterLoaded(p)
  await shot('series-depth2.png', 12000)

  await p.goto(BASE + '/series/1396')
  await posterLoaded(p)
  await shot('series-breaking-bad.png', 8000)

  await p.goto(BASE + '/person/17419')
  await shot('person-bryan-cranston.png', 9000)

  await p.goto(BASE + '/similar/1396')
  await p.locator('text=#1').first().waitFor({ timeout: 60000 })   // hybrid similarity can take several seconds
  await shot('similar-breaking-bad.png', 8000)

  await p.goto(BASE + '/methodology')
  await shot('methodology.png', 1500)

  await p.goto(BASE + '/explore')
  await shot('explore-empty.png', 2000)

  // Build a graph from one series, show the layouts, then expand a person node with Enter in the navigator.
  await exploreSearchAndLoad(p, 'Breaking Bad')
  await p.getByText('GRAPH NODES').first().click()
  await shot('explore-graph.png', 800)

  const fit = async () => { await p.getByTitle('Fit to view').click() }
  await p.getByRole('button', { name: 'hierarchy', exact: true }).first().click()   // layout: hierarchy (dagre)
  await sleep(3000); await fit()
  await shot('explore-layout-hierarchy.png', 1200)
  await p.getByRole('button', { name: 'concentric', exact: true }).click()
  await sleep(2500); await fit()
  await shot('explore-layout-concentric.png', 1200)
  await p.getByRole('button', { name: 'circle', exact: true }).click()
  await sleep(2500); await fit()
  await shot('explore-layout-circle.png', 1200)
  await p.getByRole('button', { name: 'force', exact: true }).click()
  await sleep(2500)

  await p.getByPlaceholder('Filter…').fill('Cranston')
  await p.locator('[data-gnid]').first().click()
  await sleep(1200)
  await p.keyboard.press('Enter')
  await sleep(7000)
  await p.getByPlaceholder('Filter…').fill('')
  await fit()
  await sleep(2500)   // let the physics layout finish, then fit once more
  await fit()
  await shot('explore-expanded-node-panel.png', 1500)

  await p.getByRole('button', { name: '3D', exact: true }).click()
  await shot('explore-3d.png', 6000)
  await b.close()
}

// ───────────────────────── mobile screenshots ─────────────────────────
async function mobile() {
  const b = await launch()
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const p = await ctx.newPage()
  const shot = async (name, settle) => {
    await sleep(settle)
    await p.screenshot({ path: join(MEDIA, name) })
    shrink(join(MEDIA, name))
    console.log('shot', name)
  }
  await p.goto(BASE + '/search?q=slow-burn%20psychological%20thriller')
  await shot('mobile-search-list.png', 9000)
  await p.locator('button', { hasText: /^Safe/ }).first().tap().catch(() => {})
  await shot('mobile-search-detail.png', 6000)
  await p.goto(BASE + '/series/1396')
  await posterLoaded(p)
  await shot('mobile-series.png', 8000)
  await p.goto(BASE + '/explore')
  await shot('mobile-explore-empty.png', 2000)
  await p.getByRole('button', { name: /controls/i }).tap()
  await p.getByRole('button', { name: 'semantic', exact: true }).tap()
  await p.getByPlaceholder('Search series…').fill('Breaking Bad')
  await p.locator('div.absolute.top-full button').first().waitFor({ timeout: 30000 })
  await p.locator('div.absolute.top-full button').first().tap()
  await sleep(4000)
  await p.getByTitle('Close panel').tap()
  await shot('mobile-explore-graph.png', 4000)
  await b.close()
}

// ───────────────────────── GIFs ─────────────────────────
// Playwright's own video recorder needs a separate ffmpeg download, so frames are grabbed with screenshots in
// a loop and stitched with the system ffmpeg, using the real capture timestamps as frame durations.
async function recorded(name, script) {
  const dir = join(TMP, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const b = await launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(CURSOR)
  const p = await ctx.newPage()

  const frames = []
  let recording = false
  const loop = (async () => {
    while (!recording) await sleep(20)
    while (recording) {
      const t = Date.now()
      const file = join(dir, `f${String(frames.length).padStart(4, '0')}.jpg`)
      await p.screenshot({ path: file, type: 'jpeg', quality: 80 })
      frames.push({ file, t })
    }
  })()

  await script(p, () => { recording = true })   // each script calls start() when the page is ready to be filmed
  recording = false
  await loop
  await ctx.close()
  await b.close()

  // concat list with per-frame durations; cap the clip at 15 s
  const lines = []
  const t0 = frames[0].t
  let total = 0
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.t ?? f.t + 100
    const d = Math.max(0.04, (next - f.t) / 1000)
    if (total >= 15) return
    total += d
    lines.push(`file '${f.file}'`, `duration ${d.toFixed(3)}`)
  })
  lines.push(`file '${frames[Math.min(frames.length, lines.length / 2) - 1].file}'`)
  const list = join(dir, 'frames.txt')
  writeFileSync(list, lines.join('\n'))
  const vf = 'fps=10,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4'
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, join(MEDIA, `${name}.gif`)])
  console.log('gif', name, `${frames.length} frames over ${((Date.now() - t0) / 1000).toFixed(1)} s, clip ${total.toFixed(1)} s`)
}

async function gifs() {
  // 1) search -> add two results to the explore list -> open the list menu -> go to explore
  await recorded('search-to-explore', async (p, start) => {
    await p.goto(BASE + '/search?q=slow-burn%20psychological%20thriller')
    await p.locator('text=Safe').first().waitFor({ timeout: 30000 })
    await sleep(2500)
    start()
    await sleep(600)
    await p.getByRole('button', { name: '+ explore' }).nth(1).click()
    await sleep(900)
    await p.getByRole('button', { name: '+ explore' }).nth(2).click()
    await sleep(900)
    await p.getByRole('button', { name: 'Explore list' }).click()
    await sleep(1500)
    await p.getByText('open explore').click()
    await sleep(2500)
  })

  // 2) explore: start from a series, expand a person node, switch layouts
  await recorded('explore-workflow', async (p, start) => {
    await p.goto(BASE + '/explore')
    await sleep(800)
    start()
    await p.getByRole('button', { name: 'semantic', exact: true }).click()
    await p.getByPlaceholder('Search series…').pressSequentially('Breaking Bad', { delay: 60 })
    await p.locator('div.absolute.top-full button').first().waitFor({ timeout: 20000 })
    await sleep(500)
    await p.locator('div.absolute.top-full button').first().click()
    await sleep(2800)
    await p.getByText('GRAPH NODES').first().click()
    await p.getByPlaceholder('Filter…').fill('Cranston')
    await p.locator('[data-gnid]').first().click()
    await sleep(900)
    await p.keyboard.press('Enter')
    await sleep(2800)
    await p.getByTitle('Fit to view').click()
    await sleep(700)
    await p.getByRole('button', { name: 'concentric', exact: true }).click()
    await sleep(2200)
  })

  // 3) node navigator with the keyboard: Up/Down walk the list, Enter goes into children, Esc to the parent, T = tree
  await recorded('navigator-keys', async (p, start) => {
    await p.goto(BASE + '/explore')
    await sleep(800)
    await exploreSearchAndLoad(p, 'Breaking Bad')
    await p.getByText('GRAPH NODES').first().click()
    await p.getByRole('button', { name: 'hierarchy', exact: true }).nth(1).click()
    await sleep(800)
    start()
    for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown']) {
      await p.keyboard.press(k)
      await sleep(750)
    }
    await p.keyboard.press('t')
    await sleep(1500)
  })
}

// ───────────────────────── error state (simulated) ─────────────────────────
// Needs a second proxy:  SIMULATE_500=/api/backend/api/search/persons PORT=3101 node dev-proxy.mjs
async function errors() {
  const b = await launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  await p.goto((process.env.BASE_ERR ?? 'http://127.0.0.1:3101') + '/search?q=cranston')
  await p.getByRole('button', { name: 'person', exact: true }).click()
  await p.locator('[role=alert]').first().waitFor({ timeout: 30000 })
  await sleep(1000)
  await p.screenshot({ path: join(MEDIA, 'search-error-simulated.png') })
  console.log('shot search-error-simulated.png')
  await b.close()
}

if (MODE === 'errors') await errors()
if (MODE === 'shots' || MODE === 'all') await shots()
if (MODE === 'mobile' || MODE === 'all') await mobile()
if (MODE === 'gifs' || MODE === 'all') await gifs()
