import assert from "node:assert/strict"
import { test } from "node:test"
import { HUD, HUD_LANGS } from "./hud.ts"
import { PREFS_KEY, dirOf, htmlLang, langOf, pickLang, useLang, words } from "./lang.ts"
import { PAUSE_TEXT } from "../ui/pause.ts"
import { SOUND_TEXT } from "../ui/sound.ts"
import { SPEED_TEXT, speedLabel } from "../ui/throttle.ts"
import { STEER_TEXT, optionLabel } from "../ui/steerpad.ts"
import { WATCH_TEXT, watchLabel } from "../ui/watch.ts"
import { TRACK_TEXT, trackName } from "../audio/tracks.ts"
import { DEMO_TEXT } from "../ui/demo.ts"
import { trackOptionLabel } from "../ui/soundtrack.ts"

const hub = (lang: unknown) => ({ getItem: (k: string) => (k === PREFS_KEY ? JSON.stringify({ v: 1, size: "M", lang }) : null) })

test("the Hub's language setting decides; ?lang= beats it; anything else is English", () => {
  assert.equal(pickLang("", hub("uk")), "uk")
  assert.equal(pickLang("", hub("fa-AF")), "fa-AF")
  assert.equal(pickLang("?lang=ar", hub("uk")), "ar", "a teacher's link wins")
  assert.equal(pickLang("?lang=klingon", hub("es")), "es", "an unknown ?lang= is ignored")
  assert.equal(pickLang("", hub("de")), "en")
  assert.equal(pickLang("", null), "en")
  assert.equal(pickLang("", { getItem: () => "{not json" }), "en")
  assert.equal(pickLang("", { getItem: () => { throw new Error("blocked") } }), "en")
})

test("loose tags land on a table: es-MX, fa, prs, AR, simple", () => {
  assert.equal(langOf("es-MX"), "es")
  assert.equal(langOf("fa"), "fa-AF")
  assert.equal(langOf("prs"), "fa-AF")
  assert.equal(langOf("AR"), "ar")
  assert.equal(langOf("simple"), "simple")
  assert.equal(langOf(""), null)
  assert.equal(langOf(7), null)
})

test("Arabic and Dari read right to left; Simple is English to the browser", () => {
  for (const l of HUD_LANGS) assert.equal(dirOf(l), l === "ar" || l === "fa-AF" ? "rtl" : "ltr", l)
  assert.equal(htmlLang("simple"), "en")
  assert.equal(htmlLang("fa-AF"), "fa-AF")
})

test("every HUD part takes the language's words, and English comes back exactly", () => {
  for (const l of HUD_LANGS) {
    const note = useLang(l)
    const w = HUD[l]
    assert.equal(words(), w)
    assert.equal(PAUSE_TEXT.resume, w.resume, l)
    assert.equal(SOUND_TEXT.tap, w.tapSound, l)
    assert.equal(watchLabel(true), w.watchOn, l)
    assert.equal(optionLabel(false), `${w.steerOption}: ${w.off}`, l)
    assert.equal(STEER_TEXT.left, w.left, l)
    assert.equal(speedLabel(1), w.speedOf.replace("{n}", "2").replace("{total}", "5").replace("{name}", w.speedNames[1]), l)
    assert.doesNotMatch(speedLabel(4), /\{\w+\}/, `${l}: no placeholder left`)
    assert.equal(trackName("rain"), w.trackRain, l)
    assert.equal(trackOptionLabel("bowls"), `${w.trackLabel}: ${w.trackBowls}`, l)
    assert.equal(DEMO_TEXT.glider, w.glider, l)
    assert.equal(note, l === "en" ? "" : w.drafts, `${l}: the Pause panel says the words are drafts (never in English)`)
  }
  useLang("en")
  assert.deepEqual([PAUSE_TEXT.pause, SOUND_TEXT.off, WATCH_TEXT.off, TRACK_TEXT.calm, SPEED_TEXT.names[2]], ["Pause", "Sound: Off", "Watch: Off", "Calm", "Medium"])
})
