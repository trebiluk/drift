/**
 * S8: the flight screen in the player's language (DRIFT-2-DIRECTION step 7).
 *
 * The language comes from the Hub's own setting, so a kid picks it once for every app: `kulibert-prefs-v1` in this
 * browser (the Hub and Drift share apps.kulibert.net), or `?lang=` in the link (for teachers and tests). Anything else
 * is English. `lang` and `dir` go on <html>, so Arabic and Dari read right to left; the steer pad and the speed bars stay
 * left to right, so ◀ is always on the left.
 *
 * Every table but English is a machine draft; the Pause panel says so in the player's language.
 */
import { HUD, HUD_LANGS, MACHINE_DRAFT, RTL_LANGS, type HudLang, type HudWords } from "./hud.ts"
import { PAUSE_TEXT } from "../ui/pause.ts"
import { SOUND_TEXT } from "../ui/sound.ts"
import { SPEED_TEXT } from "../ui/throttle.ts"
import { STEER_TEXT } from "../ui/steerpad.ts"
import { WATCH_TEXT } from "../ui/watch.ts"
import { TRACK_TEXT } from "../audio/tracks.ts"
import { DEMO_TEXT } from "../ui/demo.ts"

/** The Hub's settings key (shared/kulibert-prefs.js). Drift only reads it. */
export const PREFS_KEY = "kulibert-prefs-v1"

type Store = Pick<Storage, "getItem"> | null | undefined

/** A language tag as the Hub writes it, or a looser one ("es-MX", "fa", "prs", "AR"), to one of the 9 tables. */
export function langOf(v: unknown): HudLang | null {
  if (typeof v !== "string" || !v.trim()) return null
  const t = v.trim()
  if ((HUD_LANGS as readonly string[]).includes(t)) return t as HudLang
  const base = t.toLowerCase().split(/[-_]/)[0]
  if (base === "fa" || base === "prs") return "fa-AF"
  if (base === "simple") return "simple"
  return (HUD_LANGS as readonly string[]).includes(base) ? (base as HudLang) : null
}

/** `?lang=` first, then the Hub's setting, then English. Never throws (blocked storage, bad JSON). */
export function pickLang(search: string, store: Store): HudLang {
  try {
    const q = langOf(new URLSearchParams(search).get("lang"))
    if (q) return q
  } catch {
    /* no URLSearchParams: fall through */
  }
  try {
    const raw = store?.getItem(PREFS_KEY)
    const p = raw ? (JSON.parse(raw) as { lang?: unknown }) : null
    const l = langOf(p?.lang)
    if (l) return l
  } catch {
    /* blocked storage or a broken value */
  }
  return "en"
}

export const dirOf = (l: HudLang) => (RTL_LANGS.has(l) ? "rtl" : "ltr")
/** <html lang>: Simple is English. */
export const htmlLang = (l: HudLang) => (l === "simple" ? "en" : l)

/** The words now in use (English until `useLang`). */
let current: HudWords = HUD.en
let currentLang: HudLang = "en"
export const words = () => current
export const lang = () => currentLang

/**
 * Puts language `l` into every HUD part's words. Call it **before** the HUD is built (main.tsx does, at load);
 * the parts read their words as they draw. Returns the draft line for the Pause panel ("" in English).
 */
export function useLang(l: HudLang): string {
  const w = HUD[l]
  current = w
  currentLang = l
  Object.assign(PAUSE_TEXT, { pause: w.pause, paused: w.paused, resume: w.resume, home: w.home, classic: w.classic })
  Object.assign(SOUND_TEXT, { on: w.soundOn, off: w.soundOff, tap: w.tapSound })
  Object.assign(SPEED_TEXT, { speed: w.speed, faster: w.faster, slower: w.slower, names: [...w.speedNames], of: w.speedOf })
  Object.assign(STEER_TEXT, { option: w.steerOption, on: w.on, off: w.off, pad: w.steerPad, left: w.left, right: w.right, up: w.up, down: w.down })
  Object.assign(WATCH_TEXT, { on: w.watchOn, off: w.watchOff })
  Object.assign(TRACK_TEXT, { label: w.trackLabel, calm: w.trackCalm, rain: w.trackRain, ocean: w.trackOcean, bowls: w.trackBowls })
  Object.assign(DEMO_TEXT, { glider: w.glider })
  return MACHINE_DRAFT.has(l) ? w.drafts : ""
}

/** Sets `lang` and `dir` on the page. */
export function markPage(doc: Document, l: HudLang) {
  doc.documentElement.lang = htmlLang(l)
  doc.documentElement.dir = dirOf(l)
  doc.documentElement.dataset.draft = MACHINE_DRAFT.has(l) ? "machine" : "no"
}
