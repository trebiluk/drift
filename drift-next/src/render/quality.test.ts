import assert from "node:assert/strict"
import { test } from "node:test"
import { CLOUD_BODY, CLOUD_SHADE, HAZE_TINT, SEA_FAR, SEA_HORIZON, SKY_HORIZON, SKY_TOP, BODY_ALPHA, hazeRgb, luma } from "./palette.ts"
import type { ProbeEnv } from "./probe.ts"
import { MAX_PUFFS, capFromSearch, drawPlan, frameDone, planOf, puffLimitFromSearch, startQuality, tierFromSearch } from "./quality.ts"
import { TIERS, TIER_TABLE } from "./tiers.ts"

const good: ProbeEnv = { context: () => ({}), renderer: () => "ANGLE (Intel, Mesa Intel UHD)", cores: 8, memoryGb: 8, userAgent: "Mozilla/5.0 (X11; Linux x86_64)", media: () => false }
const cros: ProbeEnv = { ...good, userAgent: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)" }

test("?q= pins a tier for testing, and only a real tier name counts", () => {
  for (const t of TIERS) assert.equal(tierFromSearch(`?debug=1&q=${t}`), t)
  for (const s of ["", "?q=", "?q=max", "?q=LIGHT", "?quality=light"]) assert.equal(tierFromSearch(s), null)
})

test("a pinned tier skips the probe, starts there, and the governor never moves it", () => {
  let probed = 0
  const counting: ProbeEnv = { context: () => (probed++, null), renderer: () => (probed++, ""), cores: 2 }
  const q = startQuality(counting, "?q=light")
  assert.equal(probed, 0, "the probe was never asked")
  assert.equal(q.pinned, true)
  assert.equal(q.gov.tier, "light")
  // 45 ms frames with 40 ms of work are far over light's 38 ms budget and fill the judging window, so an unpinned governor would drop
  for (let i = 0; i < 2000; i++) assert.equal(frameDone(q, 45, 40), null)
  assert.equal(q.gov.tier, "light")
  assert.equal(q.gov.scale, TIER_TABLE.light.scaleMax)
  const free = startQuality(good, "")
  const free2 = startQuality({ ...good, cores: 2 }, "")
  assert.equal(free.pinned || free2.pinned, false)
  let moved = null
  for (let i = 0; i < 2000 && !moved; i++) moved = frameDone(free2, 45, 40)
  assert.ok(moved, "the same frames do move a governor that is not pinned")
})

test("no choice made: the probe picks, and the governor judges frames", () => {
  assert.equal(startQuality(good, "").gov.tier, "balanced")
  assert.equal(startQuality(cros, "").gov.tier, "light")
  assert.equal(startQuality({ ...good, renderer: () => "Google SwiftShader" }, "").gov.tier, "still")
  assert.equal(startQuality({ context: () => null }, "").gov.tier, "still")
  const q = startQuality(good, "")
  assert.equal(q.pinned, false)
  let change = null
  for (let i = 0; i < 400 && !change; i++) change = frameDone(q, 45, 5)
  assert.ok(change && change.why === "slow-scale")
})

test("reduced motion or Low power can never climb above light", () => {
  for (const [env, low] of [[{ ...good, media: (s: string) => s.includes("reduced-motion") }, false], [good, true]] as const) {
    const q = startQuality(env, "", low)
    assert.equal(q.gov.tier, "light")
    let climbs = 0
    for (let i = 0; q.gov.now < 300_000; i++) {
      const c = frameDone(q, 33.4, 3)
      if (c && c.why === "up-tier") climbs++
    }
    assert.equal(climbs, 0)
    assert.equal(q.gov.tier, "light")
  }
})

test("each tier does less than the one above: clouds, shading, speed", () => {
  const plans = TIERS.map((t) => drawPlan(t, TIER_TABLE[t].scaleMax))
  assert.deepEqual(plans.map((p) => p.fps), [60, 60, 30, 30])
  assert.deepEqual(plans.map((p) => p.shade), [true, true, false, false])
  for (let i = 1; i < plans.length; i++) assert.ok(plans[i].puffs < plans[i - 1].puffs)
  assert.equal(plans[2].puffs, 48)
  assert.equal(MAX_PUFFS, 140)
  assert.equal(planOf(startQuality(cros, "")).fps, 30)
})

test("?puffs=N is a tester's limit, in range or ignored", () => {
  assert.equal(puffLimitFromSearch("?debug=1&puffs=0"), 0)
  assert.equal(puffLimitFromSearch("?puffs=24"), 24)
  assert.equal(puffLimitFromSearch("?puffs=9999"), MAX_PUFFS)
  for (const s of ["", "?puffs=", "?puffs=-1", "?puffs=1.5", "?puffs=x"]) assert.equal(puffLimitFromSearch(s), null)
})

// ---- palette: Diego's light limits, written as plain numbers

test("cloud bodies are off-white, never pure white", () => {
  assert.ok(Math.max(...CLOUD_BODY) <= 236)
  assert.ok(luma(CLOUD_BODY) <= 0.86)
  assert.ok(luma(CLOUD_BODY) > luma(CLOUD_SHADE), "the underside is darker than the top")
  const brightestOnScreen = BODY_ALPHA * luma(CLOUD_BODY) + (1 - BODY_ALPHA) * luma(SKY_HORIZON)
  assert.ok(brightestOnScreen < 0.85, `brightest cloud pixel over the palest sky ${brightestOnScreen.toFixed(3)}`)
})

test("the sky and sea stay mid-blue: nothing is pale, and the top is darker than the horizon", () => {
  for (const c of [SKY_TOP, SKY_HORIZON, SEA_HORIZON, SEA_FAR]) {
    assert.ok(luma(c) <= 0.62, `a sky color is ${luma(c).toFixed(2)} bright`)
    assert.ok(c[2] > c[0] && c[2] > c[1], "blue leads")
  }
  assert.ok(luma(SKY_TOP) < luma(SKY_HORIZON))
  assert.ok(luma(SEA_FAR) < luma(SEA_HORIZON))
  assert.ok(Math.abs(luma(SKY_HORIZON) - luma(SEA_HORIZON)) < 0.08, "no bright band at the horizon")
})

test("the haze keeps the brightness it is asked for, is tinted blue-grey, and is never white", () => {
  assert.ok(Math.abs(luma([HAZE_TINT[0] * 255, HAZE_TINT[1] * 255, HAZE_TINT[2] * 255]) - 1) < 0.01, "tint does not change brightness")
  for (const level of [0.1, 0.2, 0.31, 0.4, 0.51, 0.65]) {
    const c = hazeRgb(level)
    assert.ok(Math.abs(luma(c) - level) < 0.01, `level ${level} came out ${luma(c).toFixed(3)}`)
    assert.ok(c[2] > c[0], "cool tint")
    assert.ok(Math.max(...c) < 200, "nowhere near white")
  }
  assert.deepEqual(hazeRgb(2), hazeRgb(1))
  assert.deepEqual(hazeRgb(-1), [0, 0, 0])
})

test("?cap= can only lower the brightness cap, to 40-58 percent; anything else is ignored", () => {
  assert.equal(capFromSearch("?debug=1&cap=45"), 0.45)
  assert.equal(capFromSearch("?cap=58"), 0.58)
  assert.equal(capFromSearch("?cap=40"), 0.4)
  for (const s of ["", "?cap=", "?cap=39", "?cap=59", "?cap=60", "?cap=99", "?cap=100", "?cap=4", "?cap=4.5", "?cap=-45", "?cap=x"]) assert.equal(capFromSearch(s), null, s)
})
