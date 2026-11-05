import assert from "node:assert/strict"
import { test } from "node:test"
import { PAD_KEY, PAD_PX, holdsKey, optionLabel, padAxes, readPad, writePad, type PadDir } from "./steerpad.ts"
import { keyActions } from "./demo.ts"
import { TARGET_PX } from "./pause.ts"

const set = (...d: PadDir[]) => new Set<PadDir>(d)

test("the pad steers the same way as the arrow keys", () => {
  assert.deepEqual(padAxes(set("left")), keyActions(new Set(["ArrowLeft"])))
  assert.deepEqual(padAxes(set("right")), keyActions(new Set(["ArrowRight"])))
  assert.deepEqual(padAxes(set("up")), keyActions(new Set(["ArrowUp"])))
  assert.deepEqual(padAxes(set("down")), keyActions(new Set(["ArrowDown"])))
})

test("nothing held is no steering; two at once steer both ways; opposites cancel", () => {
  assert.deepEqual(padAxes(set()), { yaw: 0, pitch: 0 })
  assert.deepEqual(padAxes(set("up", "left")), { yaw: 1, pitch: 1 })
  assert.deepEqual(padAxes(set("left", "right")), { yaw: 0, pitch: 0 })
})

test("off on a first visit; the choice is remembered; a blocked store reads as off", () => {
  const mem = new Map<string, string>()
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  assert.equal(readPad(store), false)
  writePad(store, true)
  assert.equal(mem.get(PAD_KEY), "on")
  assert.equal(readPad(store), true)
  writePad(store, false)
  assert.equal(readPad(store), false)
  const blocked = { getItem: () => { throw new Error("blocked") }, setItem: () => { throw new Error("blocked") } }
  assert.equal(readPad(blocked), false)
  assert.doesNotThrow(() => writePad(blocked, true))
  assert.equal(readPad(null), false)
})

test("Space and Enter hold a pad button, held-key repeats do not stack", () => {
  assert.equal(holdsKey(" ", false), true)
  assert.equal(holdsKey("Enter", false), true)
  assert.equal(holdsKey(" ", true), false)
  assert.equal(holdsKey("ArrowLeft", false), false)
})

test("buttons are big enough and the switch says its state in words", () => {
  assert.ok(PAD_PX >= TARGET_PX && PAD_PX >= 44)
  assert.equal(optionLabel(false), "Steer with buttons: Off")
  assert.equal(optionLabel(true), "Steer with buttons: On")
})
