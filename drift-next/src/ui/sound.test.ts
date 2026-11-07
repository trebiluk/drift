import assert from "node:assert/strict"
import { test } from "node:test"
import { SOUND_KEY, SOUND_TEXT, TARGET_PX, isSoundKey, labelFor, loadSound, saveSound, type SoundKey, SOUND_CSS } from "./sound.ts"

const key = (over: Partial<SoundKey>): SoundKey => ({ code: "", key: "", repeat: false, ctrl: false, meta: false, alt: false, typing: false, ...over })
const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

test("a first visit is Off: nothing saved means silent", () => {
  assert.equal(loadSound(memory()), false)
  assert.equal(loadSound(null), false)
  assert.equal(loadSound(undefined), false)
})

test("the choice survives a reload, as one word and nothing else", () => {
  const s = memory()
  saveSound(s, true)
  assert.equal(loadSound(s), true)
  saveSound(s, false)
  assert.equal(loadSound(s), false)
  assert.deepEqual([...s.m.entries()], [[SOUND_KEY, "off"]], "only the on/off word is stored: no name, no alias, no id")
})

test("a blocked or odd store never turns sound on and never throws", () => {
  const broken = { getItem: () => { throw new Error("blocked") }, setItem: () => { throw new Error("blocked") } }
  assert.equal(loadSound(broken), false)
  assert.doesNotThrow(() => saveSound(broken, true))
  const odd = memory()
  odd.setItem(SOUND_KEY, "yes")
  assert.equal(loadSound(odd), false)
})

test("M toggles, by key position on any layout; held keys, shortcuts and typing do not", () => {
  assert.equal(isSoundKey(key({ code: "KeyM", key: "m" })), true)
  assert.equal(isSoundKey(key({ code: "KeyM", key: "M" })), true)
  assert.equal(isSoundKey(key({ code: "KeyM", key: "ь" })), true, "a Russian keyboard types ь there")
  assert.equal(isSoundKey(key({ code: "KeyM", key: "m", repeat: true })), false)
  for (const mod of ["ctrl", "meta", "alt"] as const) assert.equal(isSoundKey(key({ code: "KeyM", key: "m", [mod]: true })), false)
  assert.equal(isSoundKey(key({ code: "KeyM", key: "m", typing: true })), false)
  for (const code of ["KeyP", "Escape", "ArrowLeft", "KeyA", "KeyW", "Space"]) assert.equal(isSoundKey(key({ code, key: code })), false, code)
})

test("the button says what it is in words, and is a 44 px target or bigger", () => {
  assert.equal(labelFor(false), "Sound: Off")
  assert.equal(labelFor(true), "Sound: On")
  assert.deepEqual(Object.values(SOUND_TEXT).sort(), ["Sound: Off", "Sound: On", "Tap to start sound"])
  assert.ok(TARGET_PX >= 44)
})

test("the \"Tap to start sound\" hint really hides when Sound is Off (its display rule would beat the hidden attribute)", () => {
  assert.match(SOUND_CSS, /\.ds-sound-hint\{[^}]*display:inline-flex/)
  assert.match(SOUND_CSS, /\.ds-sound-hint\[hidden\]\{display:none\}/)
})
