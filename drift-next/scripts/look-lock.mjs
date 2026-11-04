#!/usr/bin/env node
/**
 * Drift look lock, stage S0b (docs/crew/DRIFT-LOOK-LOCK-REFS.md §4, DRIFT-2-DESIGN.md §13).
 *
 * Photographs any Drift build the same way every time and turns the clouds into numbers:
 *   coverage (share of the frame that is cloud), distinct blobs (separate clouds, so "merged banks" show),
 *   shadow contrast (cloud tops vs undersides), and mean brightness (the light-sensitive cap).
 * It also times 10 s of real frames (with the CPU slowed, the Chromebook-floor stand-in) and writes a CSV.
 *
 * Works on any URL: a local drift-next build, the live /drift/ (1.x), or the Sep 18 reference build (3e48cfe).
 * Pictures never go in this repo (commit 1b6b5b7). Write them outside it, for example into
 * shared/drift/visual-eval/ in apps-kulibert.
 *
 *   node scripts/look-lock.mjs --url http://localhost:5173/ --out /tmp/look --label next
 *   node scripts/look-lock.mjs --url https://apps.kulibert.net/drift/ --out /tmp/look --label live --start "button[aria-label=Start]"
 *   node scripts/look-lock.mjs --compare /tmp/look/next.json --refs /path/to/refs   (refs: refs.json + the kept images)
 *
 * Needs only Playwright (installed globally is fine). No npm packages, no network except the URL you give it.
 */
import { createRequire } from "node:module"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, basename } from "node:path"

const require = createRequire(import.meta.url)
function loadPlaywright() {
  const tries = ["playwright", (process.env.NODE_PATH || "").split(":").filter(Boolean).map((p) => join(p, "playwright")), `${process.env.HOME}/.npm-global/lib/node_modules/playwright`].flat()
  for (const t of tries) { try { return require(t) } catch {} }
  throw new Error("Playwright not found. Install it, or set NODE_PATH to the folder that has it.")
}

// ---------- arguments ----------
const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d }
const has = (k) => args.includes("--" + k)

/** Viewports from the design: 3 required, phone landscape added (S7 onward). */
export const VIEWPORTS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "412x915", width: 412, height: 915 },
  { name: "915x412", width: 915, height: 412 },
]
/** Poses: seconds of flight after start, with no input. Same clock, same seed, same picture. */
export const POSES = [{ name: "t3", ms: 3000 }, { name: "t8", ms: 8000 }]
/** A fixed stand-in for Math.random so builds that place clouds with it (3e48cfe) repeat. */
const SEED_SCRIPT = `(() => { let a = 0x9e3779b9; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })()`

// ---------- the measures (run inside a page, on an image) ----------
/** Returns { coverage, blobs, shadow, bright } for an image, all 0..1 except blobs (a count). Same weights as render/palette.ts. */
const MEASURE_IN_PAGE = async (dataUrl) => {
  const img = new Image(); img.src = dataUrl; await img.decode()
  const W = 240, H = Math.max(1, Math.round((img.height / img.width) * W)) // small is enough, and fast
  const c = document.createElement("canvas"); c.width = W; c.height = H
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H)
  const d = g.getImageData(0, 0, W, H).data
  const n = W * H; const mask = new Uint8Array(n); const lumas = []; let sum = 0, cloud = 0
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2]
    const y = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255 // sRGB-coded brightness, as Drift's guard measures it
    sum += y
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0
    // cloud: light and low in colour (sky is a saturated blue, fields are coloured or dark)
    if (y > 0.42 && sat < 0.22) { mask[i] = 1; cloud++; lumas.push(y) }
  }
  // distinct blobs: 4-connected parts of the cloud mask bigger than 0.05% of the frame
  const seen = new Uint8Array(n); const minArea = Math.max(3, Math.round(n * 0.0005)); let blobs = 0
  const stack = []
  for (let i = 0; i < n; i++) {
    if (!mask[i] || seen[i]) continue
    let area = 0; stack.push(i); seen[i] = 1
    while (stack.length) {
      const p = stack.pop(); area++; const x = p % W, yy = (p / W) | 0
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, yy > 0 ? p - W : -1, yy < H - 1 ? p + W : -1]) if (q >= 0 && mask[q] && !seen[q]) { seen[q] = 1; stack.push(q) }
    }
    if (area >= minArea) blobs++
  }
  lumas.sort((a, b) => a - b)
  const pct = (p) => (lumas.length ? lumas[Math.min(lumas.length - 1, Math.floor(p * lumas.length))] : 0)
  return { coverage: cloud / n, blobs, shadow: pct(0.9) - pct(0.1), bright: sum / n }
}

async function measureFile(page, file) {
  const url = "data:image/png;base64," + readFileSync(file).toString("base64")
  return page.evaluate(MEASURE_IN_PAGE, url)
}

// ---------- shoot a build ----------
async function shoot() {
  const url = arg("url"); const out = arg("out"); const label = arg("label", "build")
  if (!url || !out) { console.error("Need --url and --out"); process.exit(2) }
  const start = arg("start", "") // optional selector to press first (1.x has a Start button)
  const throttle = Number(arg("throttle", "4"))
  const gpu = arg("gpu", "swiftshader") // swiftshader | none | default
  mkdirSync(out, { recursive: true })
  const { chromium } = loadPlaywright()
  const launchArgs = gpu === "none" ? ["--disable-gpu", "--disable-webgl", "--disable-webgl2"] : gpu === "swiftshader" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : []
  const browser = await chromium.launch({ args: launchArgs })
  const report = { label, url, when: new Date().toISOString().slice(0, 10), gpu, throttle, clock: "fake", shots: [], timing: [], errors: [], outside: [] }
  const host = new URL(url).hostname
  try {
    let clockMode = arg("clock", "fake"); let vpRetry = false
    for (let vi = 0; vi < VIEWPORTS.length; vi++) {
      const vp = VIEWPORTS[vi]
      // 1. pictures
      vpRetry = false
      for (const pose of POSES) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "no-preference" })
        await ctx.addInitScript(SEED_SCRIPT)
        const page = await ctx.newPage()
        page.on("pageerror", (e) => report.errors.push(`${vp.name}: ${e.message.slice(0, 160)}`))
        page.on("request", (q) => { const h = new URL(q.url()).hostname; if (h !== host && !q.url().startsWith("data:")) report.outside.push(h) })
        // Fake clock: the same frame every run. Some builds (1.x three/r3f) stall on it, so fall back to real time and say so.
        const fake = clockMode === "fake"
        if (fake) await page.clock.install({ time: new Date("2026-09-18T12:00:00Z") })
        await page.goto(url, { waitUntil: "load" })
        const wait = (ms) => (fake ? page.clock.runFor(ms) : page.waitForTimeout(ms))
        await wait(1500)
        if (start) { await page.locator(start).first().click({ timeout: 5000 }).catch(() => report.errors.push(`${vp.name}: start control not found`)) }
        await wait(pose.ms)
        const file = join(out, `${label}-${vp.name}-${pose.name}.png`)
        try { await page.screenshot({ path: file, timeout: 15000 }) } catch (e) {
          await ctx.close()
          if (fake && clockMode === "fake") { clockMode = "real"; report.clock = "real (fake clock stalled this build)"; console.warn("Fake clock stalled the page; switching to real time (pictures repeat less exactly)."); vpRetry = true; break }
          throw e
        }
        report.shots.push({ viewport: vp.name, pose: pose.name, file: basename(file), clock: clockMode })
        await ctx.close()
      }
      if (vpRetry) { report.shots = report.shots.filter((x) => x.viewport !== vp.name); vi--; continue }
      // 2. real frame times, CPU slowed: the Chromebook-floor stand-in
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      await ctx.addInitScript(SEED_SCRIPT)
      const page = await ctx.newPage()
      const cdp = await ctx.newCDPSession(page); if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle })
      await page.goto(url, { waitUntil: "load" }); await page.waitForTimeout(1500)
      if (start) await page.locator(start).first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(1500)
      const frames = await page.evaluate(() => new Promise((done) => { const t = []; let last = performance.now(); const end = last + 10000
        const f = (now) => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else done(t) }; requestAnimationFrame(f) }))
      writeFileSync(join(out, `${label}-${vp.name}-frames.csv`), "frame,ms\n" + frames.map((m, i) => `${i},${m.toFixed(2)}`).join("\n") + "\n")
      const s = frames.slice(1).sort((a, b) => a - b); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
      report.timing.push({ viewport: vp.name, frames: s.length, fps: Math.round(s.length / 10), p50ms: +q(0.5).toFixed(1), p95ms: +q(0.95).toFixed(1) })
      await ctx.close()
    }
    // 3. the numbers for every picture
    const mctx = await browser.newContext(); const mpage = await mctx.newPage()
    for (const s of report.shots) Object.assign(s, await measureFile(mpage, join(out, s.file)))
    await mctx.close()
  } finally { await browser.close() }
  report.outside = [...new Set(report.outside)]
  writeFileSync(join(out, `${label}.json`), JSON.stringify(report, null, 2) + "\n")
  console.log(table(report))
}

// ---------- compare a build with the kept references ----------
/** Thresholds from 3–4 references: the range across them, never a median (LOOK-LOCK-REFS §4). */
export function thresholds(refs) {
  const v = (k) => refs.map((r) => r[k])
  const [cmin, cmax] = [Math.min(...v("coverage")), Math.max(...v("coverage"))]
  return { blobsMin: Math.min(...v("blobs")), coverageMin: Math.max(0, cmin - 0.1), coverageMax: Math.min(1, cmax + 0.1), shadowMin: Math.min(...v("shadow")), brightMax: Math.max(...v("bright")) }
}
export function verdict(shot, th) {
  const fails = []
  if (shot.blobs < th.blobsMin) fails.push(`blobs ${shot.blobs} < ${th.blobsMin}`)
  if (shot.coverage < th.coverageMin || shot.coverage > th.coverageMax) fails.push(`coverage ${pc(shot.coverage)} outside ${pc(th.coverageMin)}–${pc(th.coverageMax)}`)
  if (shot.shadow < th.shadowMin) fails.push(`shadow ${pc(shot.shadow)} < ${pc(th.shadowMin)}`)
  if (shot.bright > th.brightMax) fails.push(`brightness ${pc(shot.bright)} > ${pc(th.brightMax)}`)
  return fails
}
async function compare() {
  const build = JSON.parse(readFileSync(arg("compare"), "utf8")); const refsDir = arg("refs")
  const picks = JSON.parse(readFileSync(join(refsDir, "refs.json"), "utf8")).filter((p) => p.decision === "keep")
  if (picks.length < 3 || picks.length > 4) console.warn(`refs.json has ${picks.length} Keep images; the look lock wants 3 or 4.`)
  const extra = (arg("ref-frames", "") || "").split(",").filter(Boolean) // e.g. the 3e48cfe frames
  const { chromium } = loadPlaywright(); const b = await chromium.launch(); const page = await (await b.newContext()).newPage()
  const refs = []
  for (const p of picks) refs.push({ file: p.file, ...(await measureFile(page, join(refsDir, p.file))) })
  for (const f of extra) refs.push({ file: basename(f), ...(await measureFile(page, f)) })
  await b.close()
  const th = thresholds(refs); let bad = 0
  console.log("References:\n" + refs.map((r) => `  ${r.file}: ${line(r)}`).join("\n"))
  console.log("Thresholds:", JSON.stringify(th))
  for (const s of build.shots) { const f = verdict(s, th); if (f.length) bad++; console.log(`${f.length ? "FAIL" : "pass"}  ${s.viewport} ${s.pose}  ${line(s)}${f.length ? "  ← " + f.join("; ") : ""}`) }
  console.log(bad ? `\n${bad} of ${build.shots.length} pictures fail. Diego's eye has the last word.` : `\nAll ${build.shots.length} pictures pass the numbers. Diego's eye has the last word.`)
  process.exitCode = bad ? 1 : 0
}

const pc = (x) => (x * 100).toFixed(1) + "%"
const line = (s) => `coverage ${pc(s.coverage)} · blobs ${s.blobs} · shadow ${pc(s.shadow)} · bright ${pc(s.bright)}`
function table(r) {
  const rows = r.shots.map((s) => `${s.viewport.padEnd(9)} ${s.pose.padEnd(3)}  ${line(s)}`)
  const t = r.timing.map((x) => `${x.viewport.padEnd(9)} ${x.fps} fps · p50 ${x.p50ms} ms · p95 ${x.p95ms} ms (CPU ${r.throttle}× slower)`)
  return [`Look lock: ${r.label} (${r.url}) · clock ${r.clock}`, ...rows, ...t, `errors: ${r.errors.length}  outside requests: ${r.outside.join(", ") || "none"}`].join("\n")
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (has("compare")) await compare()
  else await shoot()
}
