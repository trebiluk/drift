import { test } from "node:test"
import assert from "node:assert/strict"
import { mountPause, wirePause } from "./pause.ts"

// Minimal DOM-less test: just type checks and basic calls
test("pause controls wire", () => {
  const fake = { pause() {}, unpause() {}, paused: false }
  const c = wirePause(fake)
  assert.equal(typeof c.pause, "function")
  assert.equal(typeof c.unpause, "function")
  assert.equal(c.isPaused(), false)
  c.pause()
  // no throw
})

test("mountPause does not throw with fake host", () => {
  const host = { ownerDocument: { createElement: () => ({ style: {}, setAttribute(){}, addEventListener(){}, appendChild(){}, remove(){} }), addEventListener(){}, removeEventListener(){} }, appendChild(){}, remove(){} } as any
  const c = { pause(){}, unpause(){}, isPaused: () => false }
  const cleanup = mountPause(host, c)
  assert.equal(typeof cleanup, "function")
  cleanup()
})
