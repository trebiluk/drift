import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_NOTCH, NOTCHES, SPEED_TEXT, clampNotch, notchOf, speedKey, speedLabel } from "./throttle.ts"
import type { KeyInput } from "./pause.ts"

const key = (over: Partial<KeyInput>): KeyInput => ({ code: "", key: "", repeat: false, ctrl: false, meta: false, alt: false, typing: false, ...over })

test("5 notches from slow to fast, the default matches the old 0.32 cruise", () => {
  assert.equal(NOTCHES.length, 5)
  for (let i = 1; i < NOTCHES.length; i++) assert.ok(NOTCHES[i] > NOTCHES[i - 1])
  assert.equal(NOTCHES[0] >= 0 && NOTCHES[NOTCHES.length - 1] <= 1, true)
  assert.equal(NOTCHES[DEFAULT_NOTCH], 0.32)
  assert.equal(SPEED_TEXT.names.length, NOTCHES.length)
})

test("notches never go past the ends", () => {
  assert.equal(clampNotch(-3), 0)
  assert.equal(clampNotch(9), NOTCHES.length - 1)
  assert.equal(clampNotch(2.4), 2)
})

test("the nearest notch to a cruise value", () => {
  assert.equal(notchOf(0.32), 1)
  assert.equal(notchOf(0), 0)
  assert.equal(notchOf(0.9), 4)
})

test("E and + go faster, Q and − slower, by key position too (other keyboard layouts)", () => {
  assert.equal(speedKey(key({ code: "KeyE", key: "e" })), 1)
  assert.equal(speedKey(key({ code: "KeyE", key: "у" })), 1, "a Russian keyboard types у there")
  assert.equal(speedKey(key({ code: "Equal", key: "=" })), 1)
  assert.equal(speedKey(key({ code: "NumpadAdd", key: "+" })), 1)
  assert.equal(speedKey(key({ code: "KeyQ", key: "q" })), -1)
  assert.equal(speedKey(key({ code: "Minus", key: "-" })), -1)
})

test("steering keys, shortcuts and typing never change speed", () => {
  for (const code of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "KeyP", "Escape", "Space"]) assert.equal(speedKey(key({ code, key: code })), 0, code)
  for (const mod of ["ctrl", "meta", "alt"] as const) assert.equal(speedKey(key({ code: "KeyE", key: "e", [mod]: true })), 0, mod)
  assert.equal(speedKey(key({ code: "KeyE", key: "e", typing: true })), 0)
})

test("the label says the notch in words and numbers, never colour alone", () => {
  assert.equal(speedLabel(1), "Speed 2 of 5, Slow")
  assert.equal(speedLabel(4), "Speed 5 of 5, Fastest")
})
