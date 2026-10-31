import assert from "node:assert/strict"
import { test } from "node:test"
import { BRIDGE_ALPHA_MAX, BRIDGE_MAX, BRIDGE_RATE, bridgeAdd, bridgeCover, bridgeSet, bridgeStep, bridgeSwitch, createBridge } from "./bridge.ts"

const DARK = 0.2
const LIGHT = 0.857

test("a new bridge hides nothing", () => {
  const b = createBridge()
  assert.equal(b.gap, 0)
  assert.equal(bridgeCover(b, 0.5, DARK, LIGHT).alpha, 0)
})

test("the gap is the old brightness minus the new, and a missing or bad reading changes nothing", () => {
  const b = createBridge()
  bridgeSet(b, 0.525, 0.561)
  assert.ok(Math.abs(b.gap - -0.036) < 1e-9, "the new picture is 3.6 points brighter: a negative gap")
  bridgeSet(b, 0.56, 0.52)
  assert.ok(Math.abs(b.gap - 0.04) < 1e-9, "the new picture is 4 points darker: a positive gap")
  for (const [x, y] of [[null, 0.5], [0.5, null], [NaN, 0.5], [0.5, Infinity], [null, null]] as const) {
    bridgeSet(b, 0.5, 0.45)
    bridgeSet(b, x, y)
    assert.equal(b.gap, 0, `${x} / ${y} must clear the bridge`)
  }
})

test("a huge gap is cut to BRIDGE_MAX, in both directions", () => {
  const b = createBridge()
  bridgeSet(b, 0.9, 0.1)
  assert.equal(b.gap, BRIDGE_MAX)
  bridgeSet(b, 0.1, 0.9)
  assert.equal(b.gap, -BRIDGE_MAX)
})

test("the gap closes at no more than a point a second, never overshoots and never grows", () => {
  for (const start of [0.046, -0.046]) {
    const b = { gap: start }
    let last = Math.abs(b.gap)
    let t = 0
    for (let i = 0; i < 2000 && b.gap !== 0; i++) {
      bridgeStep(b, 1 / 60)
      t += 1 / 60
      assert.ok(Math.abs(b.gap) <= last + 1e-12, "never grows")
      assert.ok(Math.sign(b.gap) === 0 || Math.sign(b.gap) === Math.sign(start), "never crosses zero")
      assert.ok(last - Math.abs(b.gap) <= BRIDGE_RATE / 60 + 1e-12, "at most 1 point a second")
      last = Math.abs(b.gap)
    }
    assert.equal(b.gap, 0)
    assert.ok(Math.abs(t - Math.abs(start) / BRIDGE_RATE) < 0.05, `closes in about ${(Math.abs(start) / BRIDGE_RATE).toFixed(1)} s, took ${t.toFixed(2)}`)
  }
})

test("a long pause between frames still only moves the gap by a quarter second's worth, and a bad dt does nothing", () => {
  const b = { gap: 0.05 }
  bridgeStep(b, 30)
  assert.ok(Math.abs(b.gap - (0.05 - BRIDGE_RATE * 0.25)) < 1e-12)
  const c = { gap: 0.05 }
  for (const dt of [0, -1, NaN, Infinity]) bridgeStep(c, dt)
  assert.equal(c.gap, 0.05)
})

test("a darker new picture gets a light haze, a brighter one a dark veil, and either one lands on the old brightness", () => {
  const mean = 0.5
  const darker = { gap: 0.04 }
  const lift = bridgeCover(darker, mean, DARK, LIGHT)
  assert.equal(lift.light, true)
  assert.ok(Math.abs(mean * (1 - lift.alpha) + LIGHT * lift.alpha - (mean + 0.04)) < 1e-9)
  const brighter = { gap: -0.04 }
  const dim = bridgeCover(brighter, mean, DARK, LIGHT)
  assert.equal(dim.light, false)
  assert.ok(Math.abs(mean * (1 - dim.alpha) + DARK * dim.alpha - (mean - 0.04)) < 1e-9)
})

test("the cover is thin: at the biggest gap in ordinary play it stays well under a fifth, and it is never past the limit", () => {
  assert.ok(bridgeCover({ gap: 0.05 }, 0.5, DARK, LIGHT).alpha < 0.2)
  assert.ok(bridgeCover({ gap: -0.05 }, 0.5, DARK, LIGHT).alpha < 0.2)
  assert.ok(bridgeCover({ gap: BRIDGE_MAX }, 0.84, DARK, LIGHT).alpha <= BRIDGE_ALPHA_MAX)
  assert.equal(bridgeCover({ gap: 0.05 }, 0.86, DARK, LIGHT).alpha, 0, "no room to lighten: draw nothing, not a huge number")
  assert.equal(bridgeCover({ gap: -0.05 }, 0.21, DARK, LIGHT).alpha, 0)
  assert.equal(bridgeCover({ gap: 0.05 }, NaN, DARK, LIGHT).alpha, 0)
})

test("the picture never changes by more than a quarter point from one frame to the next while the bridge closes", () => {
  // the shown brightness is the new picture's plus the gap; with the picture held still it should fall smoothly
  const b = { gap: 0.048 }
  let shown = 0.5 + b.gap
  for (let i = 0; i < 400; i++) {
    bridgeStep(b, 1 / 30)
    const next = 0.5 + b.gap
    assert.ok(Math.abs(next - shown) <= 0.0004, `step ${i} moved ${(Math.abs(next - shown) * 100).toFixed(3)} points`)
    shown = next
  }
})

test("a second change while the first bridge is still closing starts from what the player was seeing", () => {
  const b = { gap: 0.024 } // the old picture reads 48.1% but is being shown 2.4 points lighter
  bridgeSwitch(b, 0.481, 0.515)
  assert.ok(Math.abs(b.gap - (0.481 + 0.024 - 0.515)) < 1e-9, "the shown 50.5% against the new 51.5%: a gap of -1.0 point")
  const c = { gap: 0.03 }
  bridgeSwitch(c, null, 0.5)
  assert.equal(c.gap, 0, "no reading to start from: nothing to hide")
  const d = { gap: -0.02 }
  bridgeSwitch(d, 0.5, null)
  assert.equal(d.gap, 0)
})

test("a step in the picture itself is added to the gap, keeps the shown brightness where it was, and is cut to the limit", () => {
  // the old picture read 56.1%, the new one reads 52.5%: the new one is 3.6 points darker, so the gap grows by +3.6 points
  const b = createBridge()
  bridgeAdd(b, 0.561 - 0.525)
  assert.ok(Math.abs(b.gap - 0.036) < 1e-9)
  assert.ok(Math.abs(0.525 + b.gap - 0.561) < 1e-9, "shown = new picture + gap = the old brightness")
  // it adds to a gap that is still closing from an earlier change
  const c = { gap: -0.02 }
  bridgeAdd(c, 0.036)
  assert.ok(Math.abs(c.gap - 0.016) < 1e-9)
  // two steps in a row stay within the limit, in both directions
  const d = createBridge()
  bridgeAdd(d, 0.05)
  bridgeAdd(d, 0.05)
  assert.equal(d.gap, BRIDGE_MAX)
  const e = createBridge()
  bridgeAdd(e, -0.05)
  bridgeAdd(e, -0.05)
  assert.equal(e.gap, -BRIDGE_MAX)
})

test("a bad step changes nothing, and the cover for the added gap is as thin as for any other", () => {
  const b = { gap: 0.02 }
  for (const bad of [NaN, Infinity, -Infinity]) bridgeAdd(b, bad)
  assert.equal(b.gap, 0.02)
  bridgeAdd(b, 0)
  assert.equal(b.gap, 0.02)
  const c = createBridge()
  bridgeAdd(c, 0.036)
  assert.ok(bridgeCover(c, 0.525, DARK, LIGHT).alpha < 0.2)
  assert.ok(Math.abs(0.525 * (1 - bridgeCover(c, 0.525, DARK, LIGHT).alpha) + LIGHT * bridgeCover(c, 0.525, DARK, LIGHT).alpha - 0.561) < 1e-9)
})
