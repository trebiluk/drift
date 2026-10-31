import assert from "node:assert/strict"
import { test } from "node:test"
import { DECK_SIZE, DECK_TILE, DECK_WRAP, GROUND_Y, LOOK, SHADOW_FLOATS, SPRITE_FLOATS, depthFog, lookOf, makeDeckTexture, packShadows, packSprites, rotateAbout, seedFor, shadowInto, wrapDeck } from "./scene.ts"
import { TIERS, tierIndex } from "./tiers.ts"
import type { Proj, Shad } from "./types.ts"

const F = 528
const W = 1366
const H = 768
const here = { yaw: 0, pitch: 0 }
const shad = (): Shad => ({ x: 0, y: 0, rx: 0, ry: 0, a: 0 })

test("every tier is a real step up from the one below it, and none of them is a step back", () => {
  const order = [...TIERS].sort((a, b) => tierIndex(b) - tierIndex(a)) // still, light, balanced, full
  assert.deepEqual(order, ["still", "light", "balanced", "full"])
  for (let i = 1; i < order.length; i++) {
    const lo = LOOK[order[i - 1]]
    const hi = LOOK[order[i]]
    assert.ok(hi.floor >= lo.floor && hi.cloud >= lo.cloud && hi.shadows >= lo.shadows, `${order[i]} must not draw less than ${order[i - 1]}`)
    assert.ok(hi.floor > lo.floor || hi.cloud > lo.cloud || hi.shadows > lo.shadows, `${order[i]} must draw something ${order[i - 1]} does not`)
  }
  // the three GL tiers differ in all three parts, so the step is easy to see
  assert.ok(lookOf("light").floor < lookOf("balanced").floor && lookOf("balanced").floor < lookOf("full").floor)
  assert.ok(lookOf("light").cloud < lookOf("balanced").cloud && lookOf("balanced").cloud < lookOf("full").cloud)
  assert.ok(lookOf("light").shadows < lookOf("balanced").shadows && lookOf("balanced").shadows < lookOf("full").shadows)
  assert.deepEqual(lookOf("still"), { floor: 0, cloud: 0, shadows: 0 })
})

test("rotateAbout turns a point the way ctx.rotate does and turns back again", () => {
  const p = { x: 0, y: 0 }
  rotateAbout(p, 11, 5, 10, 5, Math.PI / 2)
  assert.ok(Math.abs(p.x - 10) < 1e-9 && Math.abs(p.y - 6) < 1e-9)
  rotateAbout(p, p.x, p.y, 10, 5, -Math.PI / 2)
  assert.ok(Math.abs(p.x - 11) < 1e-9 && Math.abs(p.y - 5) < 1e-9)
  rotateAbout(p, 3, 4, 3, 4, 1.234)
  assert.deepEqual(p, { x: 3, y: 4 })
})

test("cloud sprites are packed far to near as given, turned by the tilt, and never past the end of the buffer", () => {
  const list: Proj[] = [
    { x: 700, y: 300, r: 40, a: 0.5, z: 900, seed: 0.25 },
    { x: 400, y: 380, r: 90, a: 1, z: 200, seed: 0.75 },
  ]
  const flat = new Float32Array(SPRITE_FLOATS * 4)
  assert.equal(packSprites(flat, list, W / 2, H / 2, 0), 2)
  assert.deepEqual([...flat.slice(0, 5)], [700, 300, 40, 0.5, 0.25])
  assert.deepEqual([...flat.slice(SPRITE_FLOATS, SPRITE_FLOATS + 5)], [400, 380, 90, 1, 0.75])
  assert.ok(flat[5] > flat[SPRITE_FLOATS + 5], "the farther cloud is the hazier one")

  const tilted = new Float32Array(SPRITE_FLOATS * 4)
  packSprites(tilted, list, W / 2, H / 2, 0.3)
  const d0 = Math.hypot(700 - W / 2, 300 - H / 2)
  const d1 = Math.hypot(tilted[0] - W / 2, tilted[1] - H / 2)
  assert.ok(Math.abs(d0 - d1) < 1e-3, "a tilt moves a cloud around the centre, not toward or away from it")
  assert.notEqual(tilted[0], flat[0])
  assert.equal(tilted[2], 40)
  assert.equal(tilted[3], 0.5)

  const small = new Float32Array(SPRITE_FLOATS)
  assert.equal(packSprites(small, list, 0, 0, 0), 1, "only what fits is written")
  assert.equal(packSprites(new Float32Array(0), list, 0, 0, 0), 0)
})

test("shadow patches are packed the same way", () => {
  const list: Shad[] = [{ x: 600, y: 500, rx: 60, ry: 20, a: 0.4 }]
  const out = new Float32Array(SHADOW_FLOATS * 2)
  assert.equal(packShadows(out, list, W / 2, H / 2, 0), 1)
  assert.deepEqual([...out.slice(0, SHADOW_FLOATS)], [600, 500, 60, 20, Math.fround(0.4)])
  packShadows(out, list, W / 2, H / 2, -0.2)
  assert.ok(Math.abs(Math.hypot(out[0] - W / 2, out[1] - H / 2) - Math.hypot(600 - W / 2, 500 - H / 2)) < 1e-3)
  assert.equal(packShadows(new Float32Array(SHADOW_FLOATS - 1), list, 0, 0, 0), 0)
})

test("each cloud keeps its own shape number, spread over 0..1", () => {
  const seen = new Set<number>()
  for (let i = 0; i < 140; i++) {
    const s = seedFor(i)
    assert.ok(s >= 0 && s < 1)
    assert.equal(seedFor(i), s)
    seen.add(Math.round(s * 1e6))
  }
  assert.equal(seen.size, 140, "no two clouds share a shape")
})

test("distance haze grows with distance and stays between 0 and 1", () => {
  let last = -1
  for (let z = 0; z <= 2000; z += 50) {
    const v = depthFog(z)
    assert.ok(v >= 0 && v <= 1)
    assert.ok(v >= last)
    last = v
  }
  assert.equal(depthFog(100), 0)
  assert.equal(depthFog(1500), 1)
})

test("a cloud's shadow lies on the floor under it: lower on the screen, never wider than the cloud's own reach", () => {
  const o = shad()
  // a cloud at the craft's own height, 400 ahead (forward is -z at yaw 0)
  assert.ok(shadowInto(o, 0, -400, 148, 60, 0.8, here.yaw, here.pitch, F, W / 2, H / 2, 2))
  assert.ok(Math.abs(o.x - W / 2) < 1e-6, "straight ahead stays straight ahead")
  assert.ok(o.y > H / 2, "the floor is below the horizon line")
  assert.ok(o.rx > 0 && o.ry > 0 && o.ry <= o.rx)
  assert.equal(o.a, 0.8)
  const right = shad()
  shadowInto(right, 200, -400, 148, 60, 0.8, 0, 0, F, W / 2, H / 2, 2)
  assert.ok(right.x > W / 2)
})

test("the Fancy shadow flattens with distance and the Normal one stays a fixed blob", () => {
  const far = shad()
  const near = shad()
  shadowInto(far, 0, -1400, 148, 60, 1, 0, 0, F, W / 2, H / 2, 2)
  shadowInto(near, 0, -160, 148, 60, 1, 0, 0, F, W / 2, H / 2, 2)
  assert.ok(far.ry / far.rx < near.ry / near.rx, "a far patch is flatter than a near one")
  const a = shad()
  const b = shad()
  shadowInto(a, 0, -1400, 148, 60, 1, 0, 0, F, W / 2, H / 2, 1)
  shadowInto(b, 0, -160, 148, 60, 1, 0, 0, F, W / 2, H / 2, 1)
  assert.ok(Math.abs(a.ry / a.rx - b.ry / b.rx) < 1e-9)
})

test("a shadow behind you, or right under you, is not drawn, and a huge one is held to a fraction of the screen", () => {
  const o = shad()
  assert.equal(shadowInto(o, 0, 400, 148, 60, 1, 0, 0, F, W / 2, H / 2, 2), false)
  assert.equal(shadowInto(o, 0, 0, 148, 60, 1, 0, 0, F, W / 2, H / 2, 2), false)
  if (shadowInto(o, 0, -40, 90, 400, 1, 0, 0, F, W / 2, H / 2, 1)) assert.ok(o.rx <= 0.35 * F + 1e-9)
  assert.equal(GROUND_Y, 0)
})

test("the floor texture is the same everywhere, centred on grey, with the same spread in every band", () => {
  const t = makeDeckTexture()
  assert.equal(t.length, DECK_SIZE * DECK_SIZE * 4)
  const again = makeDeckTexture()
  assert.deepEqual(t, again)
  assert.notDeepEqual(t, makeDeckTexture(DECK_SIZE, 8))
  const n = DECK_SIZE * DECK_SIZE
  const sds: number[] = []
  for (let ch = 0; ch < 3; ch++) {
    let sum = 0
    for (let i = 0; i < n; i++) sum += t[i * 4 + ch]
    const mean = sum / n
    assert.ok(Math.abs(mean - 128) < 1.5, `band ${ch} averages ${mean.toFixed(2)}, not grey`)
    let sq = 0
    for (let i = 0; i < n; i++) sq += (t[i * 4 + ch] - mean) ** 2
    sds.push(Math.sqrt(sq / n))
  }
  for (const sd of sds) assert.ok(sd > 35 && sd < 55, `spread ${sd.toFixed(1)} should be about a fifth of full range`)
  for (let i = 0; i < n; i++) assert.equal(t[i * 4 + 3], 255)
})

test("the floor texture repeats without a seam, and finer bands are lumpier than broad ones", () => {
  const t = makeDeckTexture()
  const S = DECK_SIZE
  const grad = (ch: number) => {
    let across = 0
    let inside = 0
    for (let j = 0; j < S; j++) {
      across += Math.abs(t[(j * S + (S - 1)) * 4 + ch] - t[j * S * 4 + ch]) // the wrap from the last column to the first
      for (let i = 0; i < S - 1; i++) inside += Math.abs(t[(j * S + i + 1) * 4 + ch] - t[(j * S + i) * 4 + ch])
    }
    return { across: across / S, inside: inside / (S * (S - 1)) }
  }
  const g = [grad(0), grad(1), grad(2)]
  for (const x of g) assert.ok(x.across < x.inside * 2.5, `the seam (${x.across.toFixed(2)}) should be no rougher than the rest (${x.inside.toFixed(2)})`)
  assert.ok(g[0].inside < g[1].inside && g[1].inside < g[2].inside, "broad billows are the smoothest, fine grain the roughest")
  // the same wrap, top to bottom
  let down = 0
  for (let i = 0; i < S; i++) down += Math.abs(t[((S - 1) * S + i) * 4] - t[i * 4])
  assert.ok(down / S < g[0].inside * 2.5)
})

test("the craft's position is reduced by an exact multiple of the floor pattern, so nothing jumps when it wraps", () => {
  for (const k of [0.5, 1, 3]) assert.equal(Number.isInteger((DECK_WRAP * k) / DECK_TILE), true, `scale ${k} must fit a whole number of times`)
  for (const v of [-50000.5, -1, 0, 1, 2047.9, 2048, 5000, 123456.789]) {
    const w = wrapDeck(v)
    assert.ok(w >= 0 && w < DECK_WRAP)
    assert.ok(Math.abs(wrapDeck(v + DECK_WRAP * 3) - w) < 1e-6)
  }
})
