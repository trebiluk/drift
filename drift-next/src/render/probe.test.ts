import assert from "node:assert/strict"
import { test } from "node:test"
import { detectCaps, startTier, type ProbeEnv } from "./probe.ts"
import { TIERS, TIER_TABLE, tierIndex } from "./tiers.ts"

const good: ProbeEnv = { context: () => ({}), renderer: () => "ANGLE (Intel, Mesa Intel UHD)", cores: 8, memoryGb: 8, userAgent: "Mozilla/5.0 (X11; Linux x86_64)", media: () => false }
const tier = (e: ProbeEnv, lowPower = false) => startTier(detectCaps(e), lowPower)

test("no WebGL at all starts on the still picture", () => {
  assert.equal(tier({ ...good, context: () => null }), "still")
  assert.equal(tier({}), "still")
})

test("a context call that throws is the same as no WebGL", () => {
  assert.equal(tier({ ...good, context: () => { throw new Error("blocked") } }), "still")
})

test("a software renderer starts still, because it would crawl", () => {
  for (const name of ["Google SwiftShader", "llvmpipe (LLVM 15)", "Microsoft Basic Render Driver"]) {
    assert.equal(tier({ ...good, renderer: () => name }), "still")
  }
  assert.equal(tier({ ...good, renderer: () => { throw new Error("no ext") } }), "balanced")
})

test("WebGL1 only starts light", () => {
  assert.equal(tier({ ...good, context: (k) => (k === "webgl" ? {} : null) }), "light")
})

test("Chromebook, 4 cores, 4 GB, reduced motion and low power all start light", () => {
  assert.equal(tier({ ...good, userAgent: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)" }), "light")
  assert.equal(tier({ ...good, cores: 4 }), "light")
  assert.equal(tier({ ...good, memoryGb: 4 }), "light")
  assert.equal(tier({ ...good, media: (q) => q.includes("reduced-motion") }), "light")
  assert.equal(tier(good, true), "light")
})

test("a capable desktop starts balanced, and unknown specs do not count against it", () => {
  assert.equal(tier(good), "balanced")
  assert.equal(tier({ context: () => ({}), renderer: () => "NVIDIA" }), "balanced")
})

test("the probe never starts on full, whatever the machine says", () => {
  for (const gl of [null, {}]) for (const cores of [undefined, 2, 16]) for (const memoryGb of [undefined, 2, 32]) {
    for (const reduced of [false, true]) for (const lowPower of [false, true]) {
      const t = tier({ ...good, context: () => gl, cores, memoryGb, media: () => reduced }, lowPower)
      assert.notEqual(t, "full")
    }
  }
})

test("a media query that throws is treated as off", () => {
  assert.equal(tier({ ...good, media: () => { throw new Error("x") } }), "balanced")
})

test("touch is read from touch points or a coarse pointer", () => {
  assert.equal(detectCaps({ ...good, touchPoints: 5 }).touch, true)
  assert.equal(detectCaps({ ...good, media: (q) => q.includes("coarse") }).touch, true)
  assert.equal(detectCaps(good).touch, false)
})

test("the tier table gets cheaper as you go down, and only still skips WebGL", () => {
  for (let i = 1; i < TIERS.length; i++) {
    assert.ok(TIER_TABLE[TIERS[i]].puffs <= TIER_TABLE[TIERS[i - 1]].puffs)
    assert.ok(TIER_TABLE[TIERS[i]].scaleMax <= TIER_TABLE[TIERS[i - 1]].scaleMax)
  }
  assert.equal(TIERS.filter((t) => TIER_TABLE[t].renderer === "canvas2d").join(), "still")
  for (const t of TIERS) assert.ok(TIER_TABLE[t].scaleMin <= TIER_TABLE[t].scaleMax && TIER_TABLE[t].scaleMax <= 1.5)
  assert.equal(tierIndex("still"), 3)
})
