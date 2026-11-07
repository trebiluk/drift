/**
 * Pause and Home: a calm way to stop mid-flight.
 *
 * A Pause button (icon + text, 48 px tall) is always on screen while flying; P and Esc do the same. Pausing freezes the sim and
 * the frame loop (the caller does that in `onPause`) and shows a small panel with Resume (focused first) and Home (the hub, same
 * origin). Hiding the tab pauses too, quietly, so the panel is already there when the player comes back.
 *
 * Light: the panel is a blue-grey card at about the picture's own brightness (53 to 57%, never white), so opening it does not
 * jump the screen, and it fades in over 200 ms (no fade under reduced motion). Text on it is near-black, 5.1:1 or better.
 *
 * The rules (which key does what, where Tab goes) are pure functions with tests; the DOM part is thin.
 */

/** The hub: same origin, the root of apps.kulibert.net. Drift lives at /drift/. */
export const HUB_HREF = "/"
export const TARGET_PX = 48 // every control is at least this tall (44 px is the floor)
export const FADE_MS = 200

export const PAUSE_COLORS = {
  panel: "#788ba0", // 53.5% on the picture's brightness scale
  primary: "#8195ab", // 57.4%: Resume is a touch lighter so it reads as the first choice
  ink: "#0d1726", // text, icons, borders and the focus ring on the panel
  plate: "rgba(8, 16, 30, 0.82)", // the Pause button: the same dark plate as the hint line
  plateInk: "#f2f6fb",
} as const

/** Every word the player sees, in one place for the translation pass (S8). */
/** Every word the player sees. English here; S8 (i18n/lang.ts) swaps in the player's language before the HUD is built. */
export const PAUSE_TEXT = { pause: "Pause", paused: "Paused", resume: "Resume", home: "Home", classic: "Classic Drift: space and reef" }

export type KeyInput = {
  code: string
  key: string
  repeat: boolean
  ctrl: boolean
  meta: boolean
  alt: boolean
  /** The key went to a text field: never steal it. */
  typing: boolean
}

export type Action = "pause" | "resume" | null

/** P pauses and resumes. Esc pauses while flying and closes the panel (resumes) while paused. Held keys and shortcuts do nothing. */
export function keyAction(paused: boolean, k: KeyInput): Action {
  if (k.repeat || k.ctrl || k.meta || k.alt || k.typing) return null
  const isP = k.code === "KeyP" || k.key === "p" || k.key === "P"
  const isEsc = k.key === "Escape" || k.code === "Escape"
  if (!isP && !isEsc) return null
  return paused ? "resume" : "pause"
}

/** The tab was hidden while flying: pause (quietly, the player is not looking). Showing it again never resumes by itself. */
export function visibilityAction(paused: boolean, hidden: boolean): Action {
  return hidden && !paused ? "pause" : null
}

/** Tab inside the panel goes round its controls and never leaves it. Returns the index to focus. */
export function nextFocus(current: number, count: number, back: boolean): number {
  if (count <= 0) return -1
  if (current < 0 || current >= count) return back ? count - 1 : 0
  return (current + (back ? count - 1 : 1)) % count
}

/** sRGB-coded brightness on Drift's 0 to 1 scale (render/palette.ts uses the same weights). */
export function brightnessOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export type PauseOpts = {
  onPause: () => void
  onResume: () => void
  /** Where Home goes. Defaults to the hub. */
  homeHref?: string
  /** More buttons for the panel, shown between Resume and Home (the steer pad switch). */
  extra?: HTMLElement[]
  /** A short line at the foot of the panel (S8: "these words are machine drafts"). Not shown when empty. */
  note?: string
}

export type PauseUi = {
  pause: (quiet?: boolean) => void
  resume: () => void
  isPaused: () => boolean
  unmount: () => void
}

const ICON_PAUSE = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><rect x="3" y="2" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="11" y="2" width="4" height="14" rx="1.2" fill="currentColor"/></svg>'
const ICON_PLAY = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M4 2.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 4 2.5z" fill="currentColor"/></svg>'
const ICON_HOME = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M9 2 1.5 8.5h2.2V16h4V11.5h2.6V16h4V8.5h2.2z" fill="currentColor"/></svg>'

const CSS = `
.dp-pause{position:fixed;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));z-index:20;
  display:inline-flex;align-items:center;gap:8px;min-height:${TARGET_PX}px;min-width:${TARGET_PX}px;padding:0 16px;margin:0;
  border:0;border-radius:12px;background:${PAUSE_COLORS.plate};color:${PAUSE_COLORS.plateInk};font:600 16px/1.2 system-ui,sans-serif;
  cursor:pointer;touch-action:manipulation;box-sizing:border-box;max-width:calc(50vw - 20px)}
.dp-pause:focus-visible{outline:3px solid ${PAUSE_COLORS.plateInk};outline-offset:2px;box-shadow:0 0 0 6px rgba(8,16,30,.9)}
.dp-pause[hidden]{display:none}
.dp-pause svg,.ds-watch svg,.ds-sound svg,.ds-speed svg,.dp-btn svg{flex:none}
.dp-back{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:16px;
  background:transparent;opacity:0;transition:opacity ${FADE_MS}ms ease}
.dp-back[hidden]{display:none}
.dp-back.dp-quiet{transition:none}
.dp-panel{box-sizing:border-box;width:min(340px,100%);padding:20px;border-radius:16px;background:${PAUSE_COLORS.panel};
  color:${PAUSE_COLORS.ink};border:1px solid rgba(13,23,38,.45);display:flex;flex-direction:column;gap:12px;font-family:system-ui,sans-serif}
.dp-title{margin:0 0 4px;font:700 22px/1.2 system-ui,sans-serif}
.dp-btn{display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;width:100%;min-height:${TARGET_PX + 4}px;
  margin:0;padding:0 16px;border:2px solid ${PAUSE_COLORS.ink};border-radius:12px;background:${PAUSE_COLORS.panel};
  color:${PAUSE_COLORS.ink};font:700 18px/1.2 system-ui,sans-serif;text-decoration:none;cursor:pointer;touch-action:manipulation}
.dp-btn.dp-primary{background:${PAUSE_COLORS.primary}}
.dp-note{margin:4px 0 0;font:500 14px/1.35 system-ui,sans-serif;color:${PAUSE_COLORS.ink}}
.dp-btn:focus-visible{outline:3px solid ${PAUSE_COLORS.ink};outline-offset:3px}
@media (prefers-reduced-motion: reduce){.dp-back{transition:none}}
`

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.closest("input, textarea, select") !== null)

/** Builds the Pause button and the panel inside `parent`. Call `unmount` to take everything away again. */
/** Where Drift 1.12.5 lives on the Hub once Drift 2 is the door (`/drift/classic/`). */
export const CLASSIC_HREF = "./classic/"

/** The Pause-panel link to classic Drift (space, reef, study timer), which Drift 2 doesn't have yet. Same look as Home. */
export function classicLink(doc: Document = document, href = CLASSIC_HREF): HTMLAnchorElement {
  const a = doc.createElement("a")
  a.className = "dp-btn dp-classic"
  a.href = href
  const span = doc.createElement("span")
  span.textContent = PAUSE_TEXT.classic
  a.appendChild(span)
  return a
}

export function mountPause(doc: Document, parent: HTMLElement, opts: PauseOpts): PauseUi {
  const win = doc.defaultView ?? window
  const style = doc.createElement("style")
  style.textContent = CSS
  doc.head.appendChild(style)

  const button = doc.createElement("button")
  button.type = "button"
  button.className = "dp-pause"
  button.setAttribute("aria-keyshortcuts", "P Escape")
  button.setAttribute("aria-haspopup", "dialog")
  button.innerHTML = `${ICON_PAUSE}<span>${PAUSE_TEXT.pause}</span>`

  const back = doc.createElement("div")
  back.className = "dp-back"
  back.hidden = true
  const panel = doc.createElement("div")
  panel.className = "dp-panel"
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-modal", "true")
  panel.setAttribute("aria-labelledby", "dp-title")
  const title = doc.createElement("h2")
  title.id = "dp-title"
  title.className = "dp-title"
  title.textContent = PAUSE_TEXT.paused
  const resumeBtn = doc.createElement("button")
  resumeBtn.type = "button"
  resumeBtn.className = "dp-btn dp-primary"
  resumeBtn.innerHTML = `${ICON_PLAY}<span>${PAUSE_TEXT.resume}</span>`
  const home = doc.createElement("a")
  home.className = "dp-btn"
  home.href = opts.homeHref ?? HUB_HREF
  home.innerHTML = `${ICON_HOME}<span>${PAUSE_TEXT.home}</span>`
  panel.append(title, resumeBtn, ...(opts.extra ?? []), home)
  if (opts.note) {
    const note = doc.createElement("p")
    note.className = "dp-note"
    note.textContent = opts.note
    panel.appendChild(note)
  }
  back.appendChild(panel)
  parent.append(button, back)

  const focusables: HTMLElement[] = [resumeBtn, ...(opts.extra ?? []), home]
  let paused = false
  let hideTimer = 0

  const pause = (quiet = false) => {
    if (paused) return
    paused = true
    opts.onPause()
    win.clearTimeout(hideTimer)
    button.hidden = true
    button.setAttribute("aria-expanded", "true")
    back.classList.toggle("dp-quiet", quiet)
    back.hidden = false
    void back.offsetWidth // start the fade from 0
    back.style.opacity = "1"
    resumeBtn.focus({ preventScroll: true })
  }

  const resume = () => {
    if (!paused) return
    paused = false
    back.style.opacity = "0"
    back.style.pointerEvents = "none"
    const reduced = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    const finish = () => {
      back.hidden = true
      back.style.pointerEvents = ""
    }
    if (reduced || back.classList.contains("dp-quiet")) finish()
    else hideTimer = win.setTimeout(finish, FADE_MS)
    button.hidden = false
    button.setAttribute("aria-expanded", "false")
    // Focus leaves the panel so the arrow keys steer again (the game ignores keys that land on a button).
    const active = doc.activeElement
    if (active instanceof HTMLElement && (panel.contains(active) || active === button)) active.blur()
    opts.onResume()
  }

  const onKey = (e: KeyboardEvent) => {
    if (paused && e.key === "Tab") {
      e.preventDefault()
      const i = nextFocus(focusables.indexOf(doc.activeElement as HTMLButtonElement), focusables.length, e.shiftKey)
      focusables[i]?.focus()
      return
    }
    if (paused && e.key === " " && doc.activeElement === home) {
      e.preventDefault()
      home.click()
      return
    }
    const act = keyAction(paused, {
      code: e.code,
      key: e.key,
      repeat: e.repeat,
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      alt: e.altKey,
      typing: isTyping(e.target),
    })
    if (!act) return
    e.preventDefault()
    if (act === "pause") pause()
    else resume()
  }
  const onVisibility = () => {
    if (visibilityAction(paused, doc.hidden) === "pause") pause(true)
  }
  const onButton = () => pause()
  const onResumeBtn = () => resume()

  button.addEventListener("click", onButton)
  resumeBtn.addEventListener("click", onResumeBtn)
  win.addEventListener("keydown", onKey)
  doc.addEventListener("visibilitychange", onVisibility)

  return {
    pause,
    resume,
    isPaused: () => paused,
    unmount: () => {
      win.clearTimeout(hideTimer)
      button.removeEventListener("click", onButton)
      resumeBtn.removeEventListener("click", onResumeBtn)
      win.removeEventListener("keydown", onKey)
      doc.removeEventListener("visibilitychange", onVisibility)
      button.remove()
      back.remove()
      style.remove()
    },
  }
}
