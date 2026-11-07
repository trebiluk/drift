import assert from "node:assert/strict"
import { test } from "node:test"
import { bandCounts, buildClouds } from "./clouds.ts"
import { BRIGHT_CAP, createGuard, createPass, proximity, stepGuard, stepPass, veilFor, type PassOpts } from "./cloudpass.ts"

// The 0.65, 0.4, 0.51, 0.06 and 0.02 below are written out on purpose, so the tests can't agree with a changed constant.
const day: PassOpts = { night: 0, calm: false, mist: "soft" }
const night: PassOpts = { night: 1, calm: false, mist: "soft" }

/** Screen brightness per frame for a target that changes with time. */
function run(target: (t: number) => number, secs: number, fps: number, o: PassOpts) {
  const s = createPass()
  const out: number[] = []
  const first = stepPass(s, 0, 0, o).screen
  out.push(first)
  for (let i = 1; i <= secs * fps; i++) out.push(stepPass(s, target(i / fps), 1 / fps, o).screen)
  return out
}
const inThenOut = (t: number) => (t < 14 ? 1 : 0)

test("white never passes Diego's caps: 65% by day, 40% at night", () => {
  for (const [o, cap] of [[day, 0.65], [night, 0.4]] as const) {
    assert.ok(Math.max(...run(() => 1, 40, 60, o)) <= cap + 1e-9)
  }
})

test("it settles to a lower grey after the tint", () => {
  const v = run(() => 1, 40, 60, day)
  assert.ok(v[v.length - 1] < Math.max(...v) - 0.1)
  // the tint is capped by the clear sky (0.51), and the grey is 77% of that
  assert.ok(Math.abs(v[v.length - 1] - 0.51 * 0.77) < 0.01, `settled at ${v[v.length - 1]}`)
})

test("going into a cloud never brightens the screen: day, night and calm, in and out", () => {
  for (const [o, sky] of [[day, 0.51], [night, 0.12], [{ ...day, calm: true }, 0.51]] as const) {
    const v = run(inThenOut, 40, 60, o)
    assert.ok(Math.abs(v[0] - sky) < 1e-9, "starts at the clear sky")
    assert.ok(Math.max(...v) <= sky + 1e-9, `highest ${Math.max(...v)} against sky ${sky}`)
    assert.ok(Math.min(...v) < sky * 0.85, "and it does dim, by at least a sixth")
  }
})

test("going in takes at least 5 s, calm at least 8 s", () => {
  const s = createPass()
  for (let i = 0; i < 59 * 5; i++) stepPass(s, 1, 1 / 60, day)
  assert.ok(s.depth < 1)
  const c = createPass()
  for (let i = 0; i < 59 * 8 - 60; i++) stepPass(c, 1, 1 / 60, { ...day, calm: true })
  assert.ok(c.depth < 1)
})

test("no frame jumps over 2%, no second over 6%, day, night, calm, 30 and 60 fps", () => {
  for (const o of [day, night, { ...day, calm: true }, { ...night, calm: true }]) {
    for (const fps of [30, 60]) {
      const v = run(inThenOut, 40, fps, o)
      for (let i = 1; i < v.length; i++) assert.ok(Math.abs(v[i] - v[i - 1]) <= 0.02)
      for (let i = fps; i < v.length; i++) assert.ok(Math.abs(v[i] - v[i - fps]) <= 0.06)
    }
  }
})

test("grazing a cloud edge cannot pump the screen", () => {
  const v = run((t) => (Math.floor(t * 8) % 2 ? 1 : 0), 10, 60, day)
  let swings = 0
  let last = v[0]
  let dir = 0
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - last
    if (Math.abs(d) >= 0.01) {
      const nd = Math.sign(d)
      if (dir && nd !== dir) swings++
      dir = nd
      last = v[i]
    }
  }
  assert.ok(swings <= 3 * 10)
  assert.ok(Math.max(...v) - Math.min(...v) < 0.03)
})

test("Off never tints, whatever the target", () => {
  const v = run(() => 1, 20, 60, { ...day, mist: "off" })
  assert.ok(v.every((x) => x === v[0]))
})

test("the same flight gives the same brightness at 30 and 60 fps", () => {
  const a = run(() => 1, 4, 30, day)
  const b = run(() => 1, 4, 60, day)
  assert.ok(Math.abs(a[a.length - 1] - b[b.length - 1]) < 1e-6)
})

test("proximity: 1 in a core, 0 far off, soft between", () => {
  const p = [{ x: 0, y: 148, z: 0, r: 50 }]
  assert.equal(proximity(0, 148, 0, p), 1)
  assert.equal(proximity(500, 148, 0, p), 0)
  const edge = proximity(50, 148, 0, p)
  assert.ok(edge > 0 && edge < 1)
})

test("proximity wraps with a repeating field: a cloud one field away counts as here", () => {
  const p = [{ x: 0, y: 148, z: 0, r: 50 }]
  assert.equal(proximity(3200, 148, -3200, p), 0, "without a wrap it is far off")
  assert.equal(proximity(3200, 148, -3200, p, 3200), 1)
  assert.equal(proximity(3200 + 500, 148, 0, p, 3200), 0)
  assert.equal(proximity(-6400, 148, 6400, p, 3200), 1)
})

test("clouds repeat, and 40% or more sit at eye level", () => {
  assert.deepEqual(buildClouds(19), buildClouds(19))
  const c = bandCounts(buildClouds(19))
  assert.ok(c.eye / 60 >= 0.4 && c.below > 0 && c.above > 0)
  const r = buildClouds(19).map((p) => p.r)
  assert.ok(Math.max(...r) / Math.min(...r) >= 5)
})

// ---- the brightness guard. 0.58, 0.4, 0.2, 0.75 and 0.04 are written out on purpose, like the numbers above. ----

test("the guard's cap is under Diego's 60% and over the clear sky, so normal play never touches it", () => {
  assert.equal(BRIGHT_CAP, 0.58)
  assert.ok(BRIGHT_CAP <= 0.6 && BRIGHT_CAP > 0.51 + 0.05, "room above the measured sky and the 56.4% worst approach")
  // the cloud pass in a full trip in and out, day and night: its model number never reaches the cap, so the veil stays off
  for (const o of [day, night, { ...day, calm: true }]) {
    const g = createGuard()
    for (const base of run(inThenOut, 40, 60, o)) assert.equal(stepGuard(g, base, 1 / 60).veil, 0)
  }
})

test("the guard leaves a picture at or under the cap exactly as it is", () => {
  for (const base of [0, 0.12, 0.3, 0.51, 0.564, 0.58]) {
    const g = createGuard()
    for (let i = 0; i < 120; i++) {
      const r = stepGuard(g, base, 1 / 60)
      assert.equal(r.veil, 0)
      assert.equal(r.out, base)
    }
  }
})

test("over the cap the picture comes out at the cap: not above, and not needlessly below", () => {
  for (const cap of [0.58, 0.5, 0.4]) {
    for (let base = cap + 0.005; base <= 1.0001; base += 0.005) {
      const r = stepGuard(createGuard(), base, 1 / 60, cap)
      assert.ok(r.out <= cap + 1e-9, `base ${base.toFixed(3)} cap ${cap}: out ${r.out}`)
      assert.ok(r.out >= cap - 1e-9, `veil only as much as needed: base ${base.toFixed(3)} cap ${cap}: out ${r.out}`)
    }
  }
  // a white screen at the default cap: veil (1 - 0.58) / (1 - 0.2)
  assert.ok(Math.abs(veilFor(1) - 0.525) < 1e-9)
})

test("a test can lower the cap but never raise it, and never below 40%", () => {
  assert.ok(stepGuard(createGuard(), 0.9, 1 / 60, 0.9).out <= 0.58 + 1e-9, "asking for 90% still gets 58%")
  assert.ok(Math.abs(stepGuard(createGuard(), 0.9, 1 / 60, 0.1).out - 0.4) < 1e-9, "asking for 10% gets 40%")
  assert.ok(stepGuard(createGuard(), 0.9, 1 / 60, Number.NaN).out <= 0.58 + 1e-9)
})

test("the veil never covers more than 75%, whatever the reading", () => {
  for (const base of [0.6, 0.9, 1, 3, 100]) assert.ok(stepGuard(createGuard(), base, 1 / 60, 0.4).veil <= 0.75)
  assert.equal(stepGuard(createGuard(), 100, 1 / 60, 0.4).veil, 0.75)
})

test("a reading that is not a number changes nothing", () => {
  const g = createGuard()
  stepGuard(g, 0.9, 1 / 60)
  const v = g.veil
  assert.ok(v > 0.3)
  for (const bad of [Number.NaN, Infinity, -Infinity]) assert.equal(stepGuard(g, bad, 1, 0.58).veil, v)
})

test("the veil drops on at once but lifts at no more than 4% of cover per second", () => {
  const g = createGuard()
  const on = stepGuard(g, 0.9, 1 / 60).veil
  assert.ok(on > 0.4, "one frame of an over-bright picture is enough")
  let last = on
  for (let i = 1; i <= 60 * 14; i++) {
    const v = stepGuard(g, 0.4, 1 / 60).veil
    assert.ok(last - v <= 0.04 / 60 + 1e-9, "no frame lifts more than a 60th of 4%")
    if (i === 60) assert.ok(on - v <= 0.04 + 1e-9, `after 1 s: ${on} to ${v}`)
    last = v
  }
  assert.equal(last, 0, "and it does lift in the end")
  // a long hitch cannot lift it in one go
  const h = createGuard()
  stepGuard(h, 0.9, 1 / 60)
  assert.ok(h.veil - stepGuard(h, 0.4, 30).veil <= 0.1 * 0.04 + 1e-9)
})

test("with the guard on, no frame moves the picture 2% and no second 6%, while the sky swings as fast as it ever can", () => {
  for (const fps of [30, 60]) {
    const g = createGuard()
    const out: number[] = []
    // the brightest the cloud pass lets the sky change: 3.5% a second, up past the cap and back down
    for (let i = 0; i <= 24 * fps; i++) {
      const t = i / fps
      const base = t < 12 ? 0.5 + 0.035 * t : 0.92 - 0.035 * (t - 12)
      out.push(stepGuard(g, base, 1 / fps).out)
    }
    assert.ok(Math.max(...out) <= 0.58 + 1e-9, `highest ${Math.max(...out)}`)
    for (let i = 1; i < out.length; i++) assert.ok(Math.abs(out[i] - out[i - 1]) <= 0.02, `frame ${i}`)
    for (let i = fps; i < out.length; i++) assert.ok(Math.abs(out[i] - out[i - fps]) <= 0.06, `second at ${i}: ${Math.abs(out[i] - out[i - fps])}`)
  }
})
