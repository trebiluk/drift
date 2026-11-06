import assert from "node:assert/strict"
import { test } from "node:test"
import { CLASSIC_HREF, FADE_MS, HUB_HREF, classicLink, PAUSE_COLORS, PAUSE_TEXT, TARGET_PX, brightnessOf, contrast, keyAction, nextFocus, visibilityAction, type KeyInput } from "./pause.ts"

const key = (over: Partial<KeyInput>): KeyInput => ({ code: "", key: "", repeat: false, ctrl: false, meta: false, alt: false, typing: false, ...over })

test("P and Esc pause while flying", () => {
  assert.equal(keyAction(false, key({ code: "KeyP", key: "p" })), "pause")
  assert.equal(keyAction(false, key({ code: "KeyP", key: "P" })), "pause")
  assert.equal(keyAction(false, key({ code: "Escape", key: "Escape" })), "pause")
})

test("P and Esc resume from the panel", () => {
  assert.equal(keyAction(true, key({ code: "KeyP", key: "p" })), "resume")
  assert.equal(keyAction(true, key({ code: "Escape", key: "Escape" })), "resume")
})

test("P works by its place on the keyboard, whatever the layout (a Russian keyboard types з there)", () => {
  assert.equal(keyAction(false, key({ code: "KeyP", key: "з" })), "pause")
})

test("a held key, a shortcut or typing in a field never pauses; steering keys never pause", () => {
  assert.equal(keyAction(false, key({ code: "KeyP", key: "p", repeat: true })), null, "a held P does not flicker the panel")
  for (const mod of ["ctrl", "meta", "alt"] as const) assert.equal(keyAction(false, key({ code: "KeyP", key: "p", [mod]: true })), null, `${mod}+P is the browser's`)
  assert.equal(keyAction(false, key({ code: "KeyP", key: "p", typing: true })), null)
  for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS", "Space", "Enter"]) {
    assert.equal(keyAction(false, key({ code, key: code })), null, code)
  }
})

test("hiding the tab pauses while flying; it never resumes by itself and never pauses twice", () => {
  assert.equal(visibilityAction(false, true), "pause")
  assert.equal(visibilityAction(true, true), null)
  assert.equal(visibilityAction(true, false), null, "coming back leaves the panel up")
  assert.equal(visibilityAction(false, false), null)
})

test("Tab goes round the panel's two controls and never leaves it", () => {
  assert.equal(nextFocus(0, 2, false), 1)
  assert.equal(nextFocus(1, 2, false), 0)
  assert.equal(nextFocus(0, 2, true), 1)
  assert.equal(nextFocus(1, 2, true), 0)
  assert.equal(nextFocus(-1, 2, false), 0, "focus outside the panel comes back to Resume")
  assert.equal(nextFocus(-1, 2, true), 1)
  assert.equal(nextFocus(0, 0, false), -1)
})

test("the panel text meets AA contrast on every surface it sits on", () => {
  for (const surface of [PAUSE_COLORS.panel, PAUSE_COLORS.primary]) {
    const c = contrast(PAUSE_COLORS.ink, surface)
    assert.ok(c >= 4.5, `${PAUSE_COLORS.ink} on ${surface} is ${c.toFixed(2)}:1`)
  }
  // the Pause button: light text on the dark plate, worst case over the brightest sky (plate composited at 82%)
  assert.ok(contrast(PAUSE_COLORS.plateInk, "#1d2a3b") >= 7)
})

test("the panel sits at the picture's own brightness: never white, never a dark hole", () => {
  for (const surface of [PAUSE_COLORS.panel, PAUSE_COLORS.primary]) {
    const b = brightnessOf(surface)
    assert.ok(b >= 0.45 && b <= 0.6, `${surface} is ${(b * 100).toFixed(1)}%`)
  }
  assert.ok(brightnessOf("#ffffff") > 0.99 && brightnessOf("#000000") === 0, "the measure itself")
})

test("controls are at least 44 px, the fade is short, Home goes to the hub on the same origin", () => {
  assert.ok(TARGET_PX >= 44)
  assert.ok(FADE_MS > 0 && FADE_MS <= 300)
  assert.equal(HUB_HREF, "/")
  assert.ok(!/^https?:/.test(HUB_HREF), "same origin: no other host")
})

test("every word on the button and panel is in one table, ready for translation", () => {
  assert.deepEqual(Object.keys(PAUSE_TEXT).sort(), ["classic", "home", "pause", "paused", "resume"])
  // Button words stay short; the Classic link is a full-width panel row that wraps, so it gets more room.
  for (const [k, v] of Object.entries(PAUSE_TEXT)) assert.ok(v.length > 0 && v.length <= (k === "classic" ? 40 : 12), k)
})

test("the Classic Drift link opens ./classic/ with the panel's look and its words", () => {
  type El = { tag: string; className: string; href: string; textContent: string; kids: El[]; appendChild: (c: El) => void }
  const make = (tag: string): El => {
    const e: El = { tag, className: "", href: "", textContent: "", kids: [], appendChild: (c) => { e.kids.push(c); e.textContent += c.textContent } }
    return e
  }
  const a = classicLink({ createElement: make } as unknown as Document) as unknown as El
  assert.equal(CLASSIC_HREF, "./classic/")
  assert.equal(a.tag, "a")
  assert.equal(a.href, CLASSIC_HREF)
  assert.ok(a.className.includes("dp-btn"))
  assert.equal(a.textContent, PAUSE_TEXT.classic)
})
