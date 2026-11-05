import assert from "node:assert/strict"
import { test } from "node:test"
import { HUD, HUD_LANGS, MACHINE_DRAFT, RTL_LANGS, fill, hudFor, type HudWords } from "./hud.ts"
import { PAUSE_TEXT } from "../ui/pause.ts"
import { SOUND_TEXT } from "../ui/sound.ts"
import { SPEED_TEXT, speedLabel } from "../ui/throttle.ts"
import { STEER_TEXT } from "../ui/steerpad.ts"
import { WATCH_TEXT } from "../ui/watch.ts"
import { TRACK_TEXT } from "../audio/tracks.ts"

const keys = Object.keys(HUD.en) as (keyof HudWords)[]
const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",")

test("9 tables: English and Simple, 7 home languages; Arabic and Dari read right to left", () => {
  assert.deepEqual([...HUD_LANGS], ["en", "simple", "es", "uk", "ru", "ar", "fa-AF", "rw", "ti"])
  assert.deepEqual([...RTL_LANGS].sort(), ["ar", "fa-AF"])
  for (const l of HUD_LANGS) if (l !== "en") assert.ok(MACHINE_DRAFT.has(l), `${l} is marked as a machine draft`)
  assert.equal(MACHINE_DRAFT.has("en"), false)
})

test("every language has every word, nothing empty, 5 speed names, the same placeholders as English", () => {
  for (const l of HUD_LANGS) {
    const t = HUD[l]
    assert.deepEqual(Object.keys(t).sort(), [...keys].sort(), l)
    for (const k of keys) {
      const v = t[k]
      if (Array.isArray(v)) {
        assert.equal(v.length, 5, `${l}.${k}`)
        for (const s of v) assert.ok(s.trim().length > 0, `${l}.${k}`)
      } else {
        assert.ok((v as string).trim().length > 0, `${l}.${k}`)
        assert.equal(holes(v as string), holes(HUD.en[k] as string), `${l}.${k} placeholders`)
      }
    }
  }
})

test("no home-language table is left in English", () => {
  for (const l of HUD_LANGS) {
    if (l === "en" || l === "simple") continue
    const same = keys.filter((k) => typeof HUD[l][k] === "string" && HUD[l][k] === HUD.en[k])
    assert.deepEqual(same, [], `${l} still has English for ${same.join(", ")}`)
  }
})

test("Simple is never longer than English (it is meant to be easier)", () => {
  for (const k of keys) {
    const s = HUD.simple[k]
    const e = HUD.en[k]
    if (typeof s === "string") assert.ok(s.length <= (e as string).length, `simple.${k}`)
  }
})

test("Western digits only, so numbers read the same everywhere until Diego decides", () => {
  for (const l of HUD_LANGS) for (const k of keys) assert.doesNotMatch(String(HUD[l][k]), /[٠-٩۰-۹]/, `${l}.${k}`)
})

test("the English table matches the words the HUD shows today, word for word", () => {
  const en = HUD.en
  assert.equal(en.pause, PAUSE_TEXT.pause)
  assert.equal(en.paused, PAUSE_TEXT.paused)
  assert.equal(en.resume, PAUSE_TEXT.resume)
  assert.equal(en.home, PAUSE_TEXT.home)
  assert.equal(en.soundOn, SOUND_TEXT.on)
  assert.equal(en.soundOff, SOUND_TEXT.off)
  assert.equal(en.speed, SPEED_TEXT.speed)
  assert.equal(en.faster, SPEED_TEXT.faster)
  assert.equal(en.slower, SPEED_TEXT.slower)
  assert.deepEqual([...en.speedNames], [...SPEED_TEXT.names])
  assert.equal(fill(en.speedOf, { n: 2, total: 5, name: en.speedNames[1] }), speedLabel(1))
  for (const k of ["on", "off", "left", "right", "up", "down"] as const) assert.equal(en[k], STEER_TEXT[k])
  assert.equal(en.steerOption, STEER_TEXT.option)
  assert.equal(en.steerPad, STEER_TEXT.pad)
  assert.equal(en.watchOn, WATCH_TEXT.on)
  assert.equal(en.watchOff, WATCH_TEXT.off)
  assert.deepEqual([en.trackLabel, en.trackCalm, en.trackRain, en.trackOcean, en.trackBowls], [TRACK_TEXT.label, TRACK_TEXT.calm, TRACK_TEXT.rain, TRACK_TEXT.ocean, TRACK_TEXT.bowls])
})

test("language tags fall back sensibly", () => {
  assert.equal(hudFor("es-MX"), HUD.es)
  assert.equal(hudFor("fa"), HUD["fa-AF"])
  assert.equal(hudFor("prs"), HUD["fa-AF"])
  assert.equal(hudFor("ar"), HUD.ar)
  assert.equal(hudFor("de"), HUD.en)
  assert.equal(hudFor(null), HUD.en)
})

test("fill leaves an unfilled placeholder visible", () => {
  assert.equal(fill("Speed {n} of {total}", { n: 3 }), "Speed 3 of {total}")
})
