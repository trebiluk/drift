import assert from "node:assert/strict"
import { test } from "node:test"
import { RESUME_DELAY_S, RESUME_EASE_S, WATCH_AMP, WATCH_AMP_CALM, WATCH_CSS, WATCH_KEY, createWatch, readWatch, stepWatch, watchLabel, watchYaw, writeWatch } from "./watch.ts"

test("the weave stays gentle: never past its amplitude, and it changes slowly", () => {
  let worst = 0
  let biggest = 0
  for (let t = 0; t < 600; t += 1 / 60) {
    const a = watchYaw(t)
    const b = watchYaw(t + 1 / 60)
    biggest = Math.max(biggest, Math.abs(a))
    worst = Math.max(worst, Math.abs(b - a) * 60)
  }
  assert.ok(biggest <= WATCH_AMP + 1e-9)
  assert.ok(worst < 0.2, `steering changes by at most ${worst.toFixed(3)} per second`)
})

test("it turns both ways and doesn't circle off to one side", () => {
  let sum = 0
  let left = 0
  let right = 0
  const n = 60 * 60 * 10
  for (let i = 0; i < n; i++) {
    const y = watchYaw(i / 60)
    sum += y
    if (y > 0.05) left++
    if (y < -0.05) right++
  }
  assert.ok(Math.abs(sum / n) < 0.02, "the average turn over 10 minutes is near zero")
  assert.ok(left > n * 0.2 && right > n * 0.2, "real turns both ways")
})

test("reduced motion turns more gently", () => {
  for (let t = 0; t < 120; t += 0.5) assert.ok(Math.abs(watchYaw(t, true)) <= WATCH_AMP_CALM + 1e-9)
})

test("steering takes over at once, and Watch eases back in after the player lets go", () => {
  const w = createWatch()
  for (let i = 0; i < 120; i++) stepWatch(w, 1 / 60, false)
  assert.equal(w.blend, 1)
  for (let i = 0; i < 30; i++) assert.equal(stepWatch(w, 1 / 60, true), 0, "nothing from Watch while the player steers")
  // just after letting go: still nothing, until the delay is over
  let t = 0
  while (t < RESUME_DELAY_S - 0.1) {
    assert.equal(Math.abs(stepWatch(w, 1 / 60, false)), 0)
    t += 1 / 60
  }
  // then a smooth ease back to the full weave
  let last = w.blend
  for (let i = 0; i < 60 * (RESUME_EASE_S + 1); i++) {
    stepWatch(w, 1 / 60, false)
    assert.ok(w.blend >= last)
    last = w.blend
  }
  assert.equal(w.blend, 1)
})

test("off on a first visit; the choice is remembered; a blocked store reads as off", () => {
  const mem = new Map<string, string>()
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  assert.equal(readWatch(store), false)
  writeWatch(store, true)
  assert.equal(mem.get(WATCH_KEY), "on")
  assert.equal(readWatch(store), true)
  const blocked = { getItem: () => { throw new Error("x") }, setItem: () => { throw new Error("x") } }
  assert.equal(readWatch(blocked), false)
  assert.doesNotThrow(() => writeWatch(blocked, true))
})

test("the button says its state in words and really hides when hidden", () => {
  assert.equal(watchLabel(false), "Watch: Off")
  assert.equal(watchLabel(true), "Watch: On")
  assert.match(WATCH_CSS, /\.ds-watch\[hidden\]\{display:none\}/)
  assert.match(WATCH_CSS, /aria-pressed="true"\]\{border-color/, "On also shows a border, not only different words")
})
