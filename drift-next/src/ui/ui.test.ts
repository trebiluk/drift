import assert from "node:assert/strict"
import { test } from "node:test"
import { FIELD, approach, keyActions, levelAssist, projectInto, wrapRel, type Proj } from "./demo.ts"
import { debugLines, wantsDebug } from "./debug.ts"
import { BODY_ALPHA, CLOUD_BODY, SKY_TOP, luma } from "../render/palette.ts"

const here = { x: 0, y: 148, z: 0, yaw: 0, pitch: 0 }
const puff = (x: number, y: number, z: number, r = 60) => ({ x, y, z, r })
const out = (): Proj => ({ x: 0, y: 0, r: 0, a: 0, z: 0 })
const F = 528
const W = 1366
const H = 768

test("arrow keys and WASD steer, opposite keys cancel, nothing held is zero", () => {
  assert.deepEqual(keyActions(new Set(["ArrowLeft"])), { yaw: 1, pitch: 0 })
  assert.deepEqual(keyActions(new Set(["KeyD", "ArrowUp"])), { yaw: -1, pitch: 1 })
  assert.deepEqual(keyActions(new Set(["ArrowLeft", "ArrowRight", "KeyW", "KeyS"])), { yaw: 0, pitch: 0 })
  assert.deepEqual(keyActions(new Set()), { yaw: 0, pitch: 0 })
})

test("a cloud straight ahead lands in the middle; to the right of you lands right", () => {
  const o = out()
  assert.ok(projectInto(o, puff(0, 148, -400), here, F, W / 2, H / 2))
  assert.ok(Math.abs(o.x - W / 2) < 1 && Math.abs(o.y - H / 2) < 1)
  assert.ok(projectInto(o, puff(200, 148, -400), here, F, W / 2, H / 2))
  assert.ok(o.x > W / 2)
})

test("turning left moves the world to the right on screen", () => {
  const o = out()
  projectInto(o, puff(0, 148, -400), { ...here, yaw: 0.2 }, F, W / 2, H / 2)
  assert.ok(o.x > W / 2, "yaw + is a left turn, so a cloud ahead drifts right")
})

test("pitching up moves the horizon and the clouds down on screen", () => {
  const a = out()
  const b = out()
  projectInto(a, puff(0, 148, -400), here, F, W / 2, H / 2)
  projectInto(b, puff(0, 148, -400), { ...here, pitch: 0.2 }, F, W / 2, H / 2)
  assert.ok(b.y > a.y)
})

test("clouds behind you, or the one you are inside, are not drawn", () => {
  const o = out()
  assert.equal(projectInto(o, puff(0, 148, 400), here, F, W / 2, H / 2), false)
  assert.equal(projectInto(o, puff(0, 148, -10, 80), here, F, W / 2, H / 2), false)
})

test("flying at a cloud never floods the screen: its weight on the picture stays small the whole way in", () => {
  const o = out()
  let worst = 0
  for (const [w, h, f] of [[1366, 768, 528], [1024, 768, 528], [412, 915, 356]]) {
    for (const r of [20, 60, 120]) {
      for (let d = 2 * r + 400; d > 0; d -= 1) {
        for (const side of [0, 0.5 * r, 1.5 * r]) {
          if (!projectInto(o, puff(side, 148, -d, r), here, f, w / 2, h / 2)) continue
          const cover = Math.min(1, (Math.PI * o.r * o.r) / (w * h))
          worst = Math.max(worst, o.a * cover)
        }
      }
    }
  }
  assert.ok(worst < 0.1, `worst weight ${worst.toFixed(3)}`)
})

test("a cloud is mostly faded by the time you are about to touch it, and clearer as you back away", () => {
  const o = out()
  const r = 20
  const alphaAt = (k: number) => (projectInto(o, puff(0, 148, -k * r, r), here, F, W / 2, H / 2) ? o.a : 0)
  assert.ok(alphaAt(1.3) < 0.1, `at 1.3 radii: ${alphaAt(1.3).toFixed(3)}`)
  assert.ok(alphaAt(1.8) < 0.75, `at 1.8 radii: ${alphaAt(1.8).toFixed(3)}`)
  let last = -1
  for (let k = 1.1; k <= 3; k += 0.05) {
    const a = alphaAt(k)
    assert.ok(a >= last - 1e-9, `opacity falls as you back away at ${k.toFixed(2)} radii`)
    last = a
  }
  assert.ok(alphaAt(8) > 0.95, "a cloud at a comfortable distance is fully there")
})

test("a cloud fades in and out smoothly: no jump in opacity between frames at top speed", () => {
  const o = out()
  let prev = 0
  let worstStep = 0
  for (let d = 1500; d > 20; d -= 1) {
    const a = projectInto(o, puff(0, 148, -d, 60), here, F, W / 2, H / 2) ? o.a : 0
    worstStep = Math.max(worstStep, Math.abs(a - prev))
    prev = a
  }
  assert.ok(worstStep < 0.06, `one unit of travel changes opacity by ${worstStep.toFixed(3)}`)
})

test("the cloud field repeats, so the sky never runs out", () => {
  const o1 = out()
  const o2 = out()
  projectInto(o1, puff(100, 148, -400), here, F, W / 2, H / 2)
  projectInto(o2, puff(100 + FIELD, 148, -400 - FIELD), here, F, W / 2, H / 2)
  assert.ok(Math.abs(o1.x - o2.x) < 1e-6 && Math.abs(o1.y - o2.y) < 1e-6)
  assert.ok(Math.abs(wrapRel(FIELD * 3 + 5, FIELD) - 5) < 1e-6)
})

test("the nose eases back toward level, and steering input is smoothed, never a jump", () => {
  assert.ok(levelAssist(-0.3, -0.08) > 0)
  assert.ok(levelAssist(0.4, -0.08) < 0)
  assert.equal(levelAssist(-0.08, -0.08), 0)
  assert.ok(approach(0, 1, 1 / 60, 5.5) < 0.1)
  assert.equal(approach(0, 1, 10, 5.5), 1)
})

test("?debug=1 turns the readout on, nothing else does", () => {
  assert.equal(wantsDebug("?debug=1"), true)
  assert.equal(wantsDebug("?a=2&debug=1"), true)
  for (const s of ["", "?debug=0", "?debug=true", "?debug", "?xdebug=1"]) assert.equal(wantsDebug(s), false)
})

test("the readout is plain words with the version, fps, step, tier and sim state", () => {
  const info = { version: "2.0.0-h", fps: 59.6, cap: 60, stepMs: 0.42, speed: 24.04, altitude: 147.6, layer: "among-clouds", tier: "light", scale: 0.85, p95: 17.4, pinned: false, haze: 0, tint: null }
  const lines = debugLines(info)
  assert.deepEqual(lines, [
    "Drift 2.0.0-h",
    "60 fps · cap 60 · step 0.4 ms",
    "tier light · scale 0.85 · p95 17 ms",
    "speed 24.0 · altitude 148 · among-clouds",
    "haze 0% · tint -",
  ])
  const inside = debugLines({ ...info, pinned: true, p95: null, haze: 1, tint: 0.397 })
  assert.equal(inside[2], "tier light · scale 0.85 · p95 -")
  assert.equal(inside[4], "haze 100% · tint 40% · tier pinned")
  for (const l of [...lines, ...inside]) assert.ok(l.length <= 44, `short enough for a 412 px screen: ${l}`)
})

test("flying at a cloud at top speed moves the average brightness by under 5% in any second", () => {
  // Written from the palette, not from a number: the most a cloud can add is its alpha times how much lighter it is than the darkest sky.
  const contrast = BODY_ALPHA * (luma(CLOUD_BODY) - luma(SKY_TOP))
  const o = out()
  let worst = 0
  for (const [w, h, f] of [[1366, 768, 528], [1024, 768, 528], [412, 915, 356]]) {
    for (const r of [40, 80, 120]) {
      for (const side of [0, 0.5 * r, 1.5 * r]) {
        const weight: number[] = []
        for (let i = 0; i <= 14 * 60; i++) {
          const d = 700 - (64 * i) / 60
          const ok = d > 2 && projectInto(o, puff(side, 148, -d, r), here, f, w / 2, h / 2)
          weight.push(ok ? o.a * Math.min(1, (Math.PI * o.r * o.r) / (w * h)) : 0)
        }
        for (let i = 60; i < weight.length; i++) worst = Math.max(worst, Math.abs(weight[i] - weight[i - 60]) * contrast)
      }
    }
  }
  assert.ok(worst < 0.05, `worst change in one second ${(worst * 100).toFixed(1)}%`)
})
