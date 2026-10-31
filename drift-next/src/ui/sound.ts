/**
 * The Sound button: "Sound: Off" / "Sound: On", with a speaker icon, top right, 48 px tall. M does the same.
 *
 * Off on a first visit, so a classroom stays quiet. The choice is kept in this browser (localStorage, one word: "on" or "off";
 * nothing about the player). Browsers only let sound start after a click, a tap or a key, so if the saved choice is On the
 * button says so and the pad starts at the player's first click, tap or key press.
 * Hiding the tab fades the sound out; showing it fades back in (if it is on).
 */
import type { Ambient } from "../audio/ambient.ts"

export const SOUND_KEY = "drift.sound"
export const SOUND_TEXT = { off: "Sound: Off", on: "Sound: On" } as const
export const TARGET_PX = 48

export type SoundKey = { code: string; key: string; repeat: boolean; ctrl: boolean; meta: boolean; alt: boolean; typing: boolean }

/** M turns sound on or off. Held keys, shortcuts and typing in a field do nothing. Works by key position on any layout. */
export function isSoundKey(k: SoundKey): boolean {
  if (k.repeat || k.ctrl || k.meta || k.alt || k.typing) return false
  return k.code === "KeyM" || k.key === "m" || k.key === "M"
}

type Store = Pick<Storage, "getItem" | "setItem"> | null | undefined

/** The saved choice. Anything other than "on" (nothing saved, an old value, storage blocked) means Off. */
export function loadSound(store: Store): boolean {
  try {
    return store?.getItem(SOUND_KEY) === "on"
  } catch {
    return false
  }
}

export function saveSound(store: Store, on: boolean): void {
  try {
    store?.setItem(SOUND_KEY, on ? "on" : "off")
  } catch {
    /* private mode or storage blocked: the choice lasts until reload */
  }
}

export const labelFor = (on: boolean) => (on ? SOUND_TEXT.on : SOUND_TEXT.off)

const ICON_ON = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 7.5h3L10.5 4v12L6 12.5H3z" fill="currentColor"/><path d="M13 7a4 4 0 0 1 0 6M15.2 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
const ICON_OFF = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 7.5h3L10.5 4v12L6 12.5H3z" fill="currentColor"/><path d="M13 7.5l5 5M18 7.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'

const CSS = `
.ds-sound{position:fixed;top:max(12px,env(safe-area-inset-top));right:calc(8px + env(safe-area-inset-right, 0px));z-index:20;
  display:inline-flex;align-items:center;gap:8px;min-height:${TARGET_PX}px;min-width:${TARGET_PX}px;padding:0 16px;margin:0;
  border:0;border-radius:12px;background:rgba(8,16,30,.82);color:#f2f6fb;font:600 16px/1.2 system-ui,sans-serif;
  cursor:pointer;touch-action:manipulation;white-space:nowrap;box-sizing:border-box}
.ds-sound:focus{outline:none}
.ds-sound:focus-visible{outline:3px solid #f2f6fb;outline-offset:2px;box-shadow:0 0 0 6px rgba(8,16,30,.9)}
.ds-sound-hint{position:fixed;top:max(68px,calc(12px + env(safe-area-inset-top) + 56px));right:calc(8px + env(safe-area-inset-right, 0px));z-index:19;
  display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;margin:0;
  border-radius:10px;background:rgba(8,16,30,.82);color:#f2f6fb;font:500 14px/1.2 system-ui,sans-serif;
  pointer-events:none;white-space:nowrap;box-sizing:border-box}
`

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.closest("input, textarea, select") !== null)

export type SoundUi = { toggle: () => void; isOn: () => boolean; unmount: () => void }

export function mountSound(doc: Document, parent: HTMLElement, ambient: Ambient, store: Store): SoundUi {
  const win = doc.defaultView ?? window
  const style = doc.createElement("style")
  style.textContent = CSS
  doc.head.appendChild(style)
  const button = doc.createElement("button")
  button.type = "button"
  button.className = "ds-sound"
  button.setAttribute("aria-keyshortcuts", "M")
  parent.appendChild(button)

  let on = loadSound(store)
  const hint = doc.createElement("div")
  hint.className = "ds-sound-hint"
  hint.setAttribute("role", "status")
  hint.innerHTML = `${ICON_ON}<span>Tap to start sound</span>`
  hint.hidden = true
  parent.appendChild(hint)

  const show = () => {
    button.innerHTML = `${on ? ICON_ON : ICON_OFF}<span>${labelFor(on)}</span>`
    button.setAttribute("aria-pressed", on ? "true" : "false")
    button.setAttribute("aria-label", labelFor(on))
    hint.hidden = !waiting
  }
  let waiting = on
  show()

  // Saved as On: wait for the first click, tap or key anywhere, which is when a browser lets sound start.
  const onFirstGesture = () => {
    if (!waiting) return
    waiting = false
    removeGesture()
    if (on) ambient.setOn(true)
    show()
  }
  const removeGesture = () => {
    win.removeEventListener("pointerdown", onFirstGesture, true)
    win.removeEventListener("keydown", onFirstGesture, true)
  }
  if (waiting) {
    win.addEventListener("pointerdown", onFirstGesture, true)
    win.addEventListener("keydown", onFirstGesture, true)
  }

  const toggle = () => {
    on = !on
    waiting = false
    removeGesture()
    saveSound(store, on)
    ambient.setOn(on) // a click, tap or M press: a user gesture, so sound may start
    show()
  }
  const onClick = () => toggle()
  const onKey = (e: KeyboardEvent) => {
    if (!isSoundKey({ code: e.code, key: e.key, repeat: e.repeat, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, typing: isTyping(e.target) })) return
    e.preventDefault()
    toggle()
  }
  const onVisibility = () => ambient.setHidden(doc.hidden)

  button.addEventListener("click", onClick)
  win.addEventListener("keydown", onKey)
  doc.addEventListener("visibilitychange", onVisibility)
  ambient.setHidden(doc.hidden)

  return {
    toggle,
    isOn: () => on,
    unmount: () => {
      removeGesture()
      button.removeEventListener("click", onClick)
      win.removeEventListener("keydown", onKey)
      doc.removeEventListener("visibilitychange", onVisibility)
      ambient.dispose()
      button.remove()
      hint.remove()
      style.remove()
    },
  }
}
