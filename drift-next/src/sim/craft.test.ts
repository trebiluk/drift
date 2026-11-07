import assert from "node:assert/strict"
import { test } from "node:test"
import { advance, createSimState, layerId, MAX_DT, STEP_DT, type Actions, type SimState } from "./craft.ts"

const steering: Actions = { yaw: 0.6, pitch: -0.25, throttle: 0.4, cruise: 0.32 }

function fresh(): SimState {
  return createSimState(steering)
}

test("advance is deterministic", () => {
  const a = fresh()
  const b = fresh()
  advance(a, 1 / 30)
  advance(b, STEP_DT)
  advance(b, STEP_DT)
  assert.deepEqual(a.craft, b.craft)
  assert.equal(a.accumulator, b.accumulator)

  const again = fresh()
  advance(again, 1 / 30)
  assert.deepEqual(again, a)
})

test("dt clamp works", () => {
  const hitch = fresh()
  const capped = fresh()
  advance(hitch, 5)
  advance(capped, MAX_DT)
  assert.deepEqual(hitch, capped)
  assert.ok(hitch.craft.z !== fresh().craft.z)
})

test("layerId is set", () => {
  assert.equal(layerId(100), "among-clouds")
  assert.equal(layerId(50), "inside-clouds")
  assert.equal(layerId(300), "above-clouds")
  assert.equal(layerId(1000), "stratosphere")
  assert.equal(layerId(1600), "open-space")
  assert.equal(layerId(2000, "space"), "among-worlds")
  assert.equal(layerId(2400, "space"), "deep-space")
  assert.equal(layerId(1000, "space"), "outer-dark")
  assert.equal(layerId(60, "reef"), "near-surface")
  assert.equal(layerId(30, "reef"), "above-reef")
  assert.equal(layerId(10, "reef"), "shallows")
})
