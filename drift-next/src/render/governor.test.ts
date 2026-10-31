import assert from "node:assert/strict"
import { test } from "node:test"
import { contextLost, createGovernor, debugLine, sample, setCap, type Change, type Governor } from "./governor.ts"
import type { Tier } from "./tiers.ts"

type At = Change & { t: number }
/** Run `secs` of frames; `ms` may vary by frame number. Returns every change with its time in seconds. */
function feed(g: Governor, ms: number | ((i: number) => number), secs: number): At[] {
  const out: At[] = []
  const end = g.now + secs * 1000
  for (let i = 0; g.now < end; i++) {
    const c = sample(g, typeof ms === "function" ? ms(i) : ms)
    if (c) out.push({ ...c, t: g.now / 1000 })
  }
  return out
}
const order: Tier[] = ["full", "balanced", "light", "still"]

test("a steady screen waits 10 s, then climbs one step at a time, 30 s apart", () => {
  const g = createGovernor("light")
  const ch = feed(g, 16, 130)
  assert.ok(ch[0].t >= 10 && ch[0].t < 12, `first climb at ${ch[0].t}`)
  for (let i = 1; i < ch.length; i++) assert.ok(ch[i].t - ch[i - 1].t >= 29.9)
  for (const c of ch) assert.ok(c.why === "up-scale" || c.why === "up-tier")
  assert.ok(ch.some((c) => c.why === "up-tier"))
})

test("tiers only move one step at a time", () => {
  const g = createGovernor("balanced")
  let last = g.tier
  for (const c of [...feed(g, 45, 30), ...feed(g, 10, 200)]) {
    assert.ok(Math.abs(order.indexOf(c.tier) - order.indexOf(last)) <= 1)
    last = c.tier
  }
})

test("a struggling screen sheds scale first, then tiers, and gets to still fast", () => {
  const g = createGovernor("balanced")
  const ch = feed(g, 45, 30)
  assert.deepEqual(ch.map((c) => c.why), ["slow-scale", "slow-scale", "slow-tier", "slow-tier"])
  assert.equal(g.tier, "still")
  assert.ok(ch[ch.length - 1].t < 10, `took ${ch[ch.length - 1].t} s`)
  for (let i = 1; i < ch.length; i++) assert.ok(ch[i].t - ch[i - 1].t >= 0.8, "needs fresh frames after each change")
  assert.equal(feed(g, 45, 60).length, 0, "nothing lighter than still")
})

test("a tier that failed is never tried again this session", () => {
  const g = createGovernor("balanced")
  feed(g, 28, 20)
  assert.equal(g.tier, "light")
  const up = feed(g, 12, 400)
  assert.ok(up.every((c) => c.tier === "light"))
  assert.equal(g.scale, 1)
})

test("the 95th percentile catches stutter an average hides", () => {
  const g = createGovernor("balanced")
  const ms = (i: number) => (i % 10 === 0 ? 60 : 16) // average about 20 ms, under the 24 ms budget
  assert.ok(feed(g, ms, 10).some((c) => c.why === "slow-scale"))
})

test("a few spikes, one stall or a hidden tab do not cause a drop", () => {
  const g = createGovernor("balanced")
  assert.equal(feed(g, (i) => (i % 40 === 0 ? 60 : 16), 20).filter((c) => c.why.startsWith("slow")).length, 0)
  assert.equal(sample(g, 300), null)
  assert.equal(sample(g, 5000), null)
  assert.equal(feed(g, 16, 5).filter((c) => c.why.startsWith("slow")).length, 0)
})

test("a hitch restarts the 10 s steady clock", () => {
  const g = createGovernor("light")
  feed(g, 16, 8)
  sample(g, 400)
  assert.equal(feed(g, 16, 8).length, 0)
  assert.ok(feed(g, 16, 6).length > 0)
})

test("starting on still, it stays still: there is no WebGL to climb back to", () => {
  const g = createGovernor("still")
  assert.equal(feed(g, 8, 300).length, 0)
  assert.equal(g.tier, "still")
})

test("a cap (low power, reduced motion) steps down now and is never exceeded", () => {
  const g = createGovernor("balanced")
  const c = setCap(g, "light")
  assert.equal(c?.why, "capped")
  assert.equal(g.tier, "light")
  assert.ok(feed(g, 8, 400).every((x) => x.tier === "light"))
  assert.equal(setCap(createGovernor("still"), "light"), null)
})

test("one lost context pauses, a second gives up on WebGL for good", () => {
  const g = createGovernor("balanced")
  assert.equal(contextLost(g), null)
  assert.equal(g.tier, "balanced")
  const c = contextLost(g)
  assert.deepEqual([c?.tier, c?.why], ["still", "lost"])
  assert.equal(feed(g, 8, 300).length, 0)
  assert.equal(g.tier, "still")
})

test("the debug line is plain words", () => {
  const g = createGovernor("light")
  feed(g, 16, 3)
  assert.match(debugLine(g), /^tier light · scale 1\.00 · p50 16\.0 ms · p95 16\.0 ms · budget 38 ms$/)
})

test("a loop held to 30 can still prove it keeps up: a long gap with little work is comfortable", () => {
  const g = createGovernor("light")
  let up: Change | null = null
  for (let i = 0; g.now < 60_000 && !up; i++) up = sample(g, 33.4, 4)
  assert.ok(up?.why === "up-scale" || up?.why === "up-tier", "climbs when the work is light")
  assert.ok(g.now >= 10_000, "after the steady wait")
  const h = createGovernor("light")
  const none: At[] = feed(h, 33.4, 120) // no work time given: the gap stands in for it, and a 33 ms gap is not comfortable at 38 ms
  assert.equal(none.length, 0)
})

test("a screen that arrives late is too slow however little work the code did", () => {
  const g = createGovernor("balanced")
  let first: Change | null = null
  for (let i = 0; i < 400 && !first; i++) first = sample(g, 40, 2)
  assert.ok(first && first.why === "slow-scale", "40 ms gaps are over the 24 ms budget")
})

test("heavy work with on-time gaps is not comfortable, so it never climbs", () => {
  const g = createGovernor("light")
  let moved = 0
  for (let i = 0; g.now < 120_000; i++) if (sample(g, 33.4, 30)) moved++
  assert.equal(moved, 0)
})
