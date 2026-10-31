import assert from "node:assert/strict"
import { test } from "node:test"
import { createPacer, done, resume, setCeiling, startLoop, tick, type LoopEnv, type Pacer } from "./loop.ts"

type Run = { runs: number; dts: number[]; capAt: number[] }
/** A display that delivers a frame every `gapMs`; each frame that runs takes `work` ms. */
function display(p: Pacer, gapMs: number, secs: number, work = 2, t0 = 0): Run & { end: number } {
  const out: Run & { end: number } = { runs: 0, dts: [], capAt: [], end: t0 }
  for (let ts = t0; ts < t0 + secs * 1000; ts += gapMs) {
    p.now = ts
    const dt = tick(p, ts)
    if (dt > 0) {
      out.runs++
      out.dts.push(dt)
      done(p, work)
    }
    out.end = ts
  }
  return out
}
const rate = (r: Run, secs: number) => r.runs / secs

test("a 60 Hz display runs every frame and stays at cap 60", () => {
  const p = createPacer()
  const r = display(p, 1000 / 60, 10)
  assert.equal(p.cap, 60)
  assert.ok(rate(r, 10) > 58 && rate(r, 10) <= 60.5)
  for (const dt of r.dts) assert.ok(Math.abs(dt - 1 / 60) < 0.002)
})

test("120, 144 and 75 Hz displays are held to about 60, not 30 and not above", () => {
  for (const hz of [120, 144, 75]) {
    const p = createPacer()
    const r = display(p, 1000 / hz, 20)
    assert.equal(p.cap, 60, `${hz} Hz fell to 30`)
    assert.ok(rate(r, 20) >= 54 && rate(r, 20) <= 61, `${hz} Hz ran ${rate(r, 20).toFixed(1)} fps`)
  }
})

test("frames that run long drop the cap to 30 within a few seconds, and it stays there", () => {
  const p = createPacer()
  display(p, 40, 4)
  assert.equal(p.cap, 30)
  assert.equal(p.drops, 1)
  display(p, 40, 20, 2, p.now + 40)
  assert.equal(p.cap, 30)
})

test("a display that only delivers 30 Hz ends at 30 and does not flip-flop", () => {
  const p = createPacer()
  display(p, 1000 / 30, 200, 2)
  assert.equal(p.cap, 30)
  assert.ok(p.drops <= 2)
})

test("a stall or a hidden tab is not a trend: no drop, no jump, no catch-up burst", () => {
  const p = createPacer()
  const a = display(p, 1000 / 60, 5)
  p.now = a.end + 5000
  assert.equal(tick(p, a.end + 5000), 0, "the stalled frame does not advance the sim")
  const b = display(p, 1000 / 60, 5, 2, a.end + 5000 + 16.7)
  assert.equal(p.cap, 60)
  for (const dt of b.dts) assert.ok(dt < 0.05, `dt ${dt}`)
  assert.ok(b.runs < 5 * 60 + 2)
})

test("after resume the first frame only starts the clock", () => {
  const p = createPacer()
  const a = display(p, 1000 / 60, 2)
  resume(p)
  assert.equal(tick(p, a.end + 9000), 0)
  assert.ok(tick(p, a.end + 9000 + 17) > 0)
})

test("it climbs back to 60 once, only after 30 s and 10 s of light work", () => {
  const p = createPacer()
  const slow = display(p, 40, 3)
  assert.equal(p.cap, 30)
  const dropAt = p.changedAt
  const early = display(p, 1000 / 60, 20, 2, slow.end + 20)
  assert.equal(p.cap, 30, "not yet: under 30 s since the drop")
  display(p, 1000 / 60, 25, 2, early.end + 16.7)
  assert.equal(p.cap, 60)
  assert.ok(p.changedAt - dropAt >= 30_000)
})

test("heavy work keeps it at 30 even on a fast display", () => {
  const p = createPacer()
  const slow = display(p, 40, 3)
  display(p, 1000 / 60, 60, 20, slow.end + 20)
  assert.equal(p.cap, 30)
})

test("after the second drop it never climbs again", () => {
  const p = createPacer()
  let t = display(p, 40, 3).end
  t = display(p, 1000 / 60, 50, 2, t + 16.7).end
  assert.equal(p.cap, 60)
  t = display(p, 40, 4, 2, t + 40).end
  assert.equal(p.cap, 30)
  assert.equal(p.drops, 2)
  display(p, 1000 / 60, 200, 2, t + 16.7)
  assert.equal(p.cap, 30)
})

test("the fps and step readings follow the real rate and work time", () => {
  const p = createPacer()
  display(p, 1000 / 60, 5, 4)
  assert.ok(Math.abs(p.fps - 60) < 3, `fps ${p.fps}`)
  assert.ok(Math.abs(p.stepMs - 4) < 0.5, `step ${p.stepMs}`)
})

function fakeEnv() {
  const q: Array<(ts: number) => void> = []
  const listeners: Array<() => void> = []
  const e = {
    hiddenNow: false, cancelled: 0, clock: 0,
    raf: (cb: (ts: number) => void) => (q.push(cb), q.length),
    caf: () => { e.cancelled++; q.length = 0 },
    now: () => e.clock,
    hidden: () => e.hiddenNow,
    onVisibility: (fn: () => void) => (listeners.push(fn), () => { listeners.length = 0 }),
    pending: () => q.length,
    take: () => q.shift(),
    fire: (ts: number) => { const cb = q.shift(); cb?.(ts) },
    flip: (h: boolean) => { e.hiddenNow = h; listeners.forEach((f) => f()) },
    listeners: () => listeners.length,
  }
  return e satisfies LoopEnv & Record<string, unknown>
}

test("hiding the tab stops asking for frames, showing it starts again without a jump", () => {
  const env = fakeEnv()
  const seen: number[] = []
  startLoop(env, { step: (dt) => seen.push(dt), draw: () => {} })
  let ts = 0
  for (let i = 0; i < 5; i++) env.fire((ts += 16.7))
  assert.ok(seen.length >= 3)
  env.flip(true)
  assert.equal(env.pending(), 0, "no frame requested while hidden")
  env.flip(false)
  assert.equal(env.pending(), 1)
  const before = seen.length
  env.fire((ts += 8000))
  assert.equal(seen.length, before, "first frame after the tab returns does not step")
  env.fire((ts += 16.7))
  assert.ok(seen.length > before)
  assert.ok(Math.max(...seen) < 0.05)
})

test("a short trip to another tab does not count as flying time", () => {
  const env = fakeEnv()
  const seen: number[] = []
  startLoop(env, { step: (dt) => seen.push(dt), draw: () => {} })
  let ts = 0
  for (let i = 0; i < 5; i++) env.fire((ts += 16.7))
  env.flip(true)
  env.flip(false)
  const before = seen.length
  env.fire((ts += 200)) // under the stall limit, so only the clock reset keeps this from being 0.2 s of flight
  assert.equal(seen.length, before, "the first frame back only restarts the clock")
  env.fire((ts += 16.7))
  assert.ok(seen.length > before)
  assert.ok(Math.max(...seen) < 0.05, `largest step ${Math.max(...seen)}`)
})

test("a frame that was already queued when the tab hid does nothing and asks for no more", () => {
  const env = fakeEnv()
  const seen: number[] = []
  startLoop(env, { step: (dt) => seen.push(dt), draw: () => {} })
  const queued = env.take()
  env.flip(true)
  env.hiddenNow = true
  queued?.(1000)
  assert.equal(env.pending(), 0, "no new frame requested")
  assert.equal(seen.length, 0, "no step ran")
})

test("an error in step stops the loop once and reports it, instead of repeating every frame", () => {
  const env = fakeEnv()
  const errors: unknown[] = []
  const loop = startLoop(env, { step: () => { throw new Error("boom") }, draw: () => {}, onError: (e) => errors.push(e) })
  let ts = 0
  for (let i = 0; i < 10; i++) env.fire((ts += 16.7))
  assert.equal(errors.length, 1)
  assert.equal(env.pending(), 0)
  assert.equal(env.listeners(), 0)
  loop.stop()
})

test("stop() cancels the pending frame and removes the visibility listener", () => {
  const env = fakeEnv()
  const loop = startLoop(env, { step: () => {}, draw: () => {} })
  loop.stop()
  assert.equal(env.pending(), 0)
  assert.equal(env.listeners(), 0)
})

test("a tab that starts hidden asks for no frames until it is shown", () => {
  const env = fakeEnv()
  env.hiddenNow = true
  startLoop(env, { step: () => {}, draw: () => {} })
  assert.equal(env.pending(), 0)
  env.flip(false)
  assert.equal(env.pending(), 1)
})

test("a light tier holds the loop at 30 and it never climbs back, however easy the work", () => {
  const p = createPacer(30)
  assert.equal(p.cap, 30)
  const r = display(p, 1000 / 60, 60, 1)
  assert.equal(p.cap, 30)
  assert.ok(rate(r, 60) >= 28 && rate(r, 60) <= 31, `${rate(r, 60).toFixed(1)} fps`)
})

test("a tier change moves the ceiling at once: up lets 60 run, down holds 30", () => {
  const p = createPacer(30)
  display(p, 1000 / 60, 3, 1)
  setCeiling(p, 60)
  assert.equal(p.cap, 60)
  const up = display(p, 1000 / 60, 10, 1, p.now + 16)
  assert.ok(rate(up, 10) >= 57, `${rate(up, 10).toFixed(1)} fps after going up`)
  setCeiling(p, 30)
  assert.equal(p.cap, 30)
  const down = display(p, 1000 / 60, 10, 1, p.now + 16)
  assert.ok(rate(down, 10) <= 31, `${rate(down, 10).toFixed(1)} fps after going down`)
  setCeiling(p, 30)
  assert.equal(p.cap, 30, "asking for the same ceiling changes nothing")
})

test("after the ceiling goes up, the pacer may still drop to 30 on its own if frames run long", () => {
  const p = createPacer(30)
  setCeiling(p, 60)
  display(p, 40, 4)
  assert.equal(p.cap, 30)
  assert.equal(p.ceiling, 60)
})

test("each frame that runs reports the gap and the work to the hook, in milliseconds", () => {
  const env = fakeEnv()
  const seen: Array<[number, number]> = []
  startLoop(env, { step: () => { env.clock += 3 }, draw: () => {}, onFrame: (gap, work) => seen.push([gap, work]) })
  let ts = 0
  for (let i = 0; i < 6; i++) env.fire((ts += 16.7))
  assert.ok(seen.length >= 4)
  for (const [gap, work] of seen) {
    assert.ok(Math.abs(gap - 16.7) < 0.5, `gap ${gap}`)
    assert.equal(work, 3)
  }
})

test("an error thrown by the frame hook stops the loop once, like any other error", () => {
  const env = fakeEnv()
  const errors: unknown[] = []
  startLoop(env, { step: () => {}, draw: () => {}, onFrame: () => { throw new Error("hook") }, onError: (e) => errors.push(e) })
  let ts = 0
  for (let i = 0; i < 8; i++) env.fire((ts += 16.7))
  assert.equal(errors.length, 1)
  assert.equal(env.pending(), 0)
})
