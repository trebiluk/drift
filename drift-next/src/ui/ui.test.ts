import assert from "node:assert/strict"
import { test } from "node:test"
import { BANK_MAX_DEG, FIELD, ROLL_FULL, approach, bankView, keyActions, levelAssist, projectInto, wrapRel, type Proj } from "./demo.ts"
import { debugLines, wantsDebug } from "./debug.ts"
import { createMeter, meanLuma, meterSize } from "./meter.ts"
import { BODY_ALPHA, CLOUD_BODY, SKY_TOP, hazeRgb, luma } from "../render/palette.ts"
import { VEIL_LEVEL } from "../sim/cloudpass.ts"
import { advance, createSimState } from "../sim/craft.ts"

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
  const info = { version: "2.0.0-i", fps: 59.6, cap: 60, stepMs: 0.42, speed: 24.04, altitude: 147.6, layer: "among-clouds", tier: "light", scale: 0.85, p95: 17.4, pinned: false, haze: 0, tint: null, bankDeg: 12.4, bankMax: 25, bright: 0.509, veil: 0 }
  const lines = debugLines(info)
  assert.deepEqual(lines, [
    "Drift 2.0.0-i",
    "60 fps · cap 60 · step 0.4 ms",
    "tier light · scale 0.85 · p95 17 ms",
    "speed 24.0 · altitude 148 · among-clouds",
    "haze 0% · tint -",
    "bank 12° of 25° · bright 51% · veil 0%",
  ])
  const inside = debugLines({ ...info, pinned: true, p95: null, haze: 1, tint: 0.397 })
  assert.equal(inside[2], "tier light · scale 0.85 · p95 -")
  assert.equal(inside[4], "haze 100% · tint 40% · tier pinned")
  // the bank is shown as an angle either way, and the guard's veil as a share
  const worst = debugLines({ ...info, bankDeg: -25, bright: 0.58, veil: 0.525 })
  assert.equal(worst[5], "bank 25° of 25° · bright 58% · veil 53%")
  for (const l of [...lines, ...inside, ...worst]) assert.ok(l.length <= 44, `short enough for a 412 px screen: ${l}`)
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

// ---- bank angle ----

const deg = (r: number) => (r * 180) / Math.PI

test("the glider never banks more than 25 degrees against the horizon, whatever the roll", () => {
  assert.equal(BANK_MAX_DEG, 25)
  let widest = 0
  for (let roll = -Math.PI; roll <= Math.PI; roll += 0.01) {
    const b = bankView(roll, false)
    widest = Math.max(widest, Math.abs(deg(b.glider - b.world)), Math.abs(deg(b.rad)))
    assert.ok(Math.abs(deg(b.world)) <= 10 + 1e-9 && Math.abs(deg(b.glider)) <= 15 + 1e-9, `each part is smaller still at roll ${roll.toFixed(2)}`)
  }
  assert.ok(widest <= 25 + 1e-9 && widest > 24.9, `reaches 25 and no more: ${widest}`)
  for (const bad of [Infinity, -Infinity, Number.NaN]) assert.deepEqual(bankView(bad, false), { world: 0, glider: 0, rad: 0 })
})

test("full steering banks the glider all the way to 25 degrees, half steering half of that, in proportion", () => {
  assert.ok(Math.abs(deg(bankView(0.4, false).rad) - 25) < 1e-9)
  assert.ok(Math.abs(deg(bankView(0.2, false).rad) - 12.5) < 1e-9)
  assert.equal(bankView(0, false).rad, 0)
  assert.ok(Math.abs(deg(bankView(ROLL_FULL, false).glider) - 15) < 1e-9, "the glider takes 60% of it")
  assert.ok(Math.abs(deg(bankView(ROLL_FULL, false).world) + 10) < 1e-9, "the horizon takes 40%, the other way round")
})

test("the sim's own roll fits the mapping: full steering for as long as you like never banks past 25", () => {
  for (const yaw of [1, -1]) {
    const s = createSimState()
    s.actions.yaw = yaw
    let top = 0
    for (let i = 0; i < 60 * 8; i++) {
      advance(s, 1 / 60)
      top = Math.max(top, Math.abs(deg(bankView(s.craft.roll, false).rad)))
    }
    assert.ok(Math.abs(s.craft.roll) <= ROLL_FULL + 1e-9, `the sim rolls to ${s.craft.roll}, the mapping expects ${ROLL_FULL}`)
    assert.ok(top <= 25 + 1e-9 && top > 24, `banked ${top.toFixed(2)} degrees at most`)
  }
})

test("steering left banks the glider left, steering right banks it right, as before", () => {
  const s = createSimState()
  s.actions.yaw = 1 // A / left
  for (let i = 0; i < 120; i++) advance(s, 1 / 60)
  const left = bankView(s.craft.roll, false)
  assert.ok(left.glider < 0 && left.world > 0, "a left bank turns the glider counter-clockwise (negative on a canvas)")
  s.actions.yaw = -1
  for (let i = 0; i < 240; i++) advance(s, 1 / 60)
  const right = bankView(s.craft.roll, false)
  assert.ok(right.glider > 0 && right.world < 0)
})

test("reduced motion draws no tilt at all, however hard you steer", () => {
  for (const roll of [-0.4, -0.1, 0.1, 0.4, 2]) assert.deepEqual(bankView(roll, true), { world: 0, glider: 0, rad: 0 })
})

// ---- the brightness meter ----

test("meanLuma uses the same weights as the palette, ignores alpha, and reads an empty image as 0", () => {
  const px = (r: number, g: number, b: number, a = 255) => [r, g, b, a]
  assert.equal(meanLuma([]), 0)
  assert.ok(Math.abs(meanLuma(Uint8ClampedArray.from(px(255, 255, 255))) - 1) < 1e-12, "white reads as 1")
  assert.equal(meanLuma(Uint8ClampedArray.from(px(0, 0, 0))), 0)
  for (const c of [[255, 0, 0], [0, 255, 0], [0, 0, 255], [36, 88, 152], [208, 220, 236]] as const) {
    assert.ok(Math.abs(meanLuma(Uint8ClampedArray.from(px(...c, 40))) - luma(c)) < 1e-12, `same as the palette for ${c}`)
  }
  assert.ok(Math.abs(meanLuma(Uint8ClampedArray.from([...px(255, 255, 255), ...px(0, 0, 0)])) - 0.5) < 1e-12, "the mean of white and black")
  assert.ok(Math.abs(meanLuma(Uint8ClampedArray.from([...px(255, 255, 255), ...px(0, 0, 0), ...px(0, 0, 0), ...px(0, 0, 0)])) - 0.25) < 1e-12)
})

test("the meter's small canvas keeps the screen's shape and stays small", () => {
  for (const [w, h] of [[1366, 768], [412, 915], [1024, 768], [800, 800], [0, 0]] as const) {
    const { mw, mh } = meterSize(w, h)
    assert.ok(mw * mh >= 600 && mw * mh <= 1000, `${w}x${h} -> ${mw}x${mh}`)
    if (w > 0) assert.ok(Math.abs(mw / mh - w / h) / (w / h) < 0.15, `shape kept for ${w}x${h}: ${mw}x${mh}`)
  }
})

function fakeCanvasDoc(read: (w: number, h: number) => Uint8ClampedArray, opts: { noContext?: boolean; throwOnRead?: boolean } = {}) {
  const calls: string[] = []
  const g = {
    setTransform: (...a: number[]) => void calls.push("transform " + a.map((v) => +v.toFixed(4)).join(" ")),
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      calls.push(`read ${w}x${h}`)
      if (opts.throwOnRead) throw new Error("no readback")
      return { data: read(w, h) }
    },
  }
  const canvas = { width: 0, height: 0, getContext: () => (opts.noContext ? null : g) }
  return { doc: { createElement: () => canvas } as unknown as Document, calls }
}
const grey = (v: number) => (w: number, h: number) => new Uint8ClampedArray(w * h * 4).map((_, i) => (i % 4 === 3 ? 255 : v))

test("the meter paints the picture small, scaled to fit, and reads its mean brightness back", () => {
  const { doc, calls } = fakeCanvasDoc(grey(128))
  const meter = createMeter(doc)
  assert.ok(meter)
  let painted = 0
  const m = meter.measure(() => void painted++, 1366, 768)
  assert.equal(painted, 1)
  assert.ok(m !== null && Math.abs(m - 128 / 255) < 1e-9)
  const { mw, mh } = meterSize(1366, 768)
  assert.equal(calls[0], `transform ${+(mw / 1366).toFixed(4)} 0 0 ${+(mh / 768).toFixed(4)} 0 0`)
  assert.ok(calls.includes(`read ${mw}x${mh}`))
})

test("a browser that cannot read a canvas back gives no meter, or stops trying after one failure", () => {
  assert.equal(createMeter(fakeCanvasDoc(grey(0), { noContext: true }).doc), null)
  const { doc, calls } = fakeCanvasDoc(grey(0), { throwOnRead: true })
  const meter = createMeter(doc)
  assert.ok(meter)
  assert.equal(meter.measure(() => {}, 800, 600), null)
  const reads = calls.filter((c) => c.startsWith("read")).length
  assert.equal(meter.measure(() => {}, 800, 600), null)
  assert.equal(calls.filter((c) => c.startsWith("read")).length, reads, "no second try")
})

test("the veil is drawn in the color the guard assumes: a dark, cool grey at 20% brightness", () => {
  assert.equal(VEIL_LEVEL, 0.2)
  assert.ok(Math.abs(luma(hazeRgb(VEIL_LEVEL)) - 0.2) < 0.005)
})
