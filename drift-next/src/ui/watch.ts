/**
 * Watch (DRIFT-2-DIRECTION step 4): a hands-free glide for relaxing or studying, as in 1.12.4.
 *
 * Turned on, the glider flies itself: slow, lazy turns that drift left and right through the clouds, while the nose is
 * already held level by the sim. Steering in any way (keys, drag, the steer pad) takes over at once; a few seconds after
 * the player lets go, Watch eases back in over 3 s, so the picture never jerks. Speed still works as normal.
 *
 * A "Watch: Off / On" button at the top left (48 px, icon and words, aria-pressed). The choice is kept in this browser.
 * With reduced motion the turns are gentler. The rules are pure functions with tests; the DOM part is thin.
 */
import { PAUSE_COLORS, TARGET_PX } from "./pause.ts"

export const WATCH_KEY = "drift2-watch"
export const WATCH_TEXT = { on: "Watch: On", off: "Watch: Off" } as const

/** Seconds after the player lets go before Watch starts to ease back in, and how long the ease takes. */
export const RESUME_DELAY_S = 2.5
export const RESUME_EASE_S = 3

/** How hard Watch turns at most (steering input, -1..1). Reduced motion turns more gently. */
export const WATCH_AMP = 0.42
export const WATCH_AMP_CALM = 0.24

/** Two slow waves (38 s and 17 s): a lazy, never-repeating-looking weave with no sudden change. */
export function watchYaw(t: number, calm = false): number {
  const amp = calm ? WATCH_AMP_CALM : WATCH_AMP
  return amp * (0.62 * Math.sin((t * 2 * Math.PI) / 38) + 0.38 * Math.sin((t * 2 * Math.PI) / 17 + 1.3))
}

export type WatchState = { t: number; blend: number; hold: number }
export const createWatch = (): WatchState => ({ t: 0, blend: 1, hold: 0 })

/**
 * One step. `userSteering` is true while the player is steering by any means: Watch lets go at once. Returns the
 * steering Watch adds this step (0 while the player steers, easing back to the full weave after they let go).
 */
export function stepWatch(w: WatchState, dt: number, userSteering: boolean, calm = false): number {
  const d = Math.max(0, Math.min(dt, 0.1))
  w.t += d
  if (userSteering) {
    w.blend = 0
    w.hold = RESUME_DELAY_S
  } else if (w.hold > 0) {
    w.hold = Math.max(0, w.hold - d)
  } else {
    w.blend = Math.min(1, w.blend + d / RESUME_EASE_S)
  }
  const e = w.blend * w.blend * (3 - 2 * w.blend) // smooth ease, no kick at the start or the end
  return watchYaw(w.t, calm) * e
}

type Store = Pick<Storage, "getItem" | "setItem"> | null | undefined

export function readWatch(store: Store): boolean {
  try {
    return store?.getItem(WATCH_KEY) === "on"
  } catch {
    return false
  }
}

export function writeWatch(store: Store, on: boolean) {
  try {
    store?.setItem(WATCH_KEY, on ? "on" : "off")
  } catch {
    /* a private window: the choice lasts until the page closes */
  }
}

export const watchLabel = (on: boolean) => (on ? WATCH_TEXT.on : WATCH_TEXT.off)

const ICON = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M1.5 10s3.2-5.5 8.5-5.5S18.5 10 18.5 10s-3.2 5.5-8.5 5.5S1.5 10 1.5 10z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>'

export const WATCH_CSS = `
.ds-watch{position:fixed;top:max(12px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));z-index:20;
  display:inline-flex;align-items:center;gap:8px;min-height:${TARGET_PX}px;min-width:${TARGET_PX}px;padding:0 16px;margin:0;
  border:2px solid transparent;border-radius:12px;background:${PAUSE_COLORS.plate};color:${PAUSE_COLORS.plateInk};
  font:600 16px/1.2 system-ui,sans-serif;cursor:pointer;touch-action:manipulation;white-space:nowrap;box-sizing:border-box}
.ds-watch[aria-pressed="true"]{border-color:${PAUSE_COLORS.plateInk}}
.ds-watch:focus{outline:none}
.ds-watch:focus-visible{outline:3px solid ${PAUSE_COLORS.plateInk};outline-offset:2px;box-shadow:0 0 0 6px rgba(8,16,30,.9)}
.ds-watch[hidden]{display:none}
`

export type WatchUi = { isOn: () => boolean; unmount: () => void }

/** Mounts the Watch button. `onChange(on)` is called at mount and on every change. */
export function mountWatch(doc: Document, parent: HTMLElement, store: Store, onChange: (on: boolean) => void): WatchUi {
  const style = doc.createElement("style")
  style.textContent = WATCH_CSS
  doc.head.appendChild(style)
  const button = doc.createElement("button")
  button.type = "button"
  button.className = "ds-watch"
  parent.appendChild(button)
  let on = readWatch(store)
  const draw = () => {
    button.innerHTML = `${ICON}<span>${watchLabel(on)}</span>`
    button.setAttribute("aria-pressed", on ? "true" : "false")
    onChange(on)
  }
  const onClick = () => {
    on = !on
    writeWatch(store, on)
    draw()
  }
  button.addEventListener("click", onClick)
  draw()
  return {
    isOn: () => on,
    unmount: () => {
      button.removeEventListener("click", onClick)
      button.remove()
      style.remove()
    },
  }
}
