/**
 * Steer pad (DRIFT-S7-HUD-PLAN step 2): an option for kids who can't drag.
 *
 * Off by default. The Pause panel has a "Steer with buttons" switch (aria-pressed, the words "On"/"Off" as well as the
 * state, never colour alone). When it is on, a 4-way pad sits at the bottom left: ◀ ▲ ▼ ▶, 56 px each, icon and a
 * screen-reader name. Hold a button to steer; let go and the glider levels out as it does after a drag. Two at once
 * (up and left) steer both ways. Space or Enter on a focused button holds it too. The choice is kept in this browser
 * (localStorage, one word: "on" or "off").
 *
 * Same dark plate as Pause and Speed: never brighter than the picture. The rules are pure functions with tests.
 */
import { PAUSE_COLORS } from "./pause.ts"

export const PAD_PX = 56
export const PAD_KEY = "drift2-steerpad"
export type PadDir = "left" | "right" | "up" | "down"
export const PAD_DIRS: readonly PadDir[] = ["up", "left", "right", "down"]

/** Every word the player sees, for the translation pass (S8). */
export const STEER_TEXT = {
  option: "Steer with buttons",
  on: "On",
  off: "Off",
  pad: "Steer buttons",
  left: "Steer left",
  right: "Steer right",
  up: "Nose up",
  down: "Nose down",
}

/** Same signs as the arrow keys (demo.ts keyActions): left is +yaw, up is +pitch. Opposite buttons cancel. */
export function padAxes(held: ReadonlySet<PadDir>) {
  let yaw = 0
  let pitch = 0
  if (held.has("left")) yaw += 1
  if (held.has("right")) yaw -= 1
  if (held.has("up")) pitch += 1
  if (held.has("down")) pitch -= 1
  return { yaw, pitch }
}

type Store = Pick<Storage, "getItem" | "setItem"> | null | undefined

/** Off unless this browser saved "on". A blocked store reads as Off. */
export function readPad(store: Store): boolean {
  try {
    return store?.getItem(PAD_KEY) === "on"
  } catch {
    return false
  }
}

export function writePad(store: Store, on: boolean) {
  try {
    store?.setItem(PAD_KEY, on ? "on" : "off")
  } catch {
    /* a private window: the choice lasts until the page closes */
  }
}

/** Space and Enter hold a focused pad button; other keys (and repeats) do nothing here. */
export const holdsKey = (key: string, repeat: boolean) => !repeat && (key === " " || key === "Enter" || key === "Spacebar")

/** The switch's label: the option and its state in words. */
export const optionLabel = (on: boolean) => `${STEER_TEXT.option}: ${on ? STEER_TEXT.on : STEER_TEXT.off}`

const ARROW: Record<PadDir, string> = {
  up: '<path d="M10 4 3.5 14h13z" fill="currentColor"/>',
  down: '<path d="M10 16 3.5 6h13z" fill="currentColor"/>',
  left: '<path d="M4 10 14 3.5v13z" fill="currentColor"/>',
  right: '<path d="M16 10 6 3.5v13z" fill="currentColor"/>',
}
const ICON = (d: PadDir) => `<svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true" focusable="false">${ARROW[d]}</svg>`
const AREA: Record<PadDir, string> = { up: "1/2", left: "2/1", right: "2/3", down: "3/2" }

const CSS = `
.ds-pad{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:calc(max(16px,env(safe-area-inset-bottom)) + var(--ds-hint-h, 36px) + 12px);z-index:20;
  display:grid;grid-template-columns:repeat(3,${PAD_PX}px);grid-template-rows:repeat(3,${PAD_PX}px);gap:6px;padding:8px;border-radius:16px;
  background:${PAUSE_COLORS.plate};color:${PAUSE_COLORS.plateInk};touch-action:none;user-select:none;-webkit-user-select:none;direction:ltr}
.ds-pad[hidden]{display:none}
.ds-pad button{display:flex;align-items:center;justify-content:center;width:${PAD_PX}px;height:${PAD_PX}px;margin:0;padding:0;
  border:2px solid rgba(242,246,251,.35);border-radius:12px;background:transparent;color:inherit;cursor:pointer;touch-action:none}
.ds-pad button.held{border-color:${PAUSE_COLORS.plateInk};background:rgba(242,246,251,.16)}
.ds-pad button:focus-visible{outline:3px solid ${PAUSE_COLORS.plateInk};outline-offset:2px}
`

export type SteerPad = {
  /** The switch for the Pause panel (a `.dp-btn`). */
  option: HTMLButtonElement
  isOn: () => boolean
  /** Let go of every button (pause, hidden tab). */
  clear: () => void
  unmount: () => void
}

/** Mounts the pad (hidden unless the saved choice is on) and builds its switch. `onAxes` gets {yaw, pitch} on every change. */
export function mountSteerPad(
  doc: Document,
  host: HTMLElement,
  store: Store,
  onAxes: (a: { yaw: number; pitch: number }) => void,
  /** Called with the switch's state at mount and on every change (main.tsx updates the hint line). */
  onToggle?: (on: boolean) => void,
): SteerPad {
  const win = doc.defaultView ?? window
  const style = doc.createElement("style")
  style.textContent = CSS
  doc.head.appendChild(style)
  const pad = doc.createElement("div")
  pad.className = "ds-pad"
  pad.setAttribute("role", "group")
  pad.setAttribute("aria-label", STEER_TEXT.pad)
  const held = new Set<PadDir>()
  const btns = new Map<PadDir, HTMLButtonElement>()
  const push = () => {
    for (const [d, b] of btns) b.classList.toggle("held", held.has(d))
    onAxes(padAxes(held))
  }
  const hold = (d: PadDir, on: boolean) => {
    if (held.has(d) === on) return
    if (on) held.add(d)
    else held.delete(d)
    push()
  }
  for (const d of PAD_DIRS) {
    const b = doc.createElement("button")
    b.type = "button"
    b.innerHTML = ICON(d)
    b.setAttribute("aria-label", STEER_TEXT[d])
    b.style.gridArea = AREA[d]
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      try {
        b.setPointerCapture(e.pointerId)
      } catch {
        /* old browsers: pointerup on the button still lets go */
      }
      hold(d, true)
    })
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, () => hold(d, false))
    b.addEventListener("keydown", (e) => {
      if (!holdsKey(e.key, e.repeat)) return
      e.preventDefault()
      e.stopPropagation()
      hold(d, true)
    })
    b.addEventListener("keyup", (e) => {
      if (e.key === " " || e.key === "Enter" || e.key === "Spacebar") hold(d, false)
    })
    b.addEventListener("blur", () => hold(d, false))
    b.addEventListener("contextmenu", (e) => e.preventDefault())
    btns.set(d, b)
    pad.appendChild(b)
  }
  host.appendChild(pad)

  let on = readPad(store)
  const option = doc.createElement("button")
  option.type = "button"
  option.className = "dp-btn"
  const clear = () => {
    if (held.size === 0) return
    held.clear()
    push()
  }
  const draw = () => {
    pad.hidden = !on
    option.setAttribute("aria-pressed", String(on))
    option.innerHTML = `${ICON("up")}<span>${optionLabel(on)}</span>`
    onToggle?.(on)
  }
  option.addEventListener("click", () => {
    on = !on
    writePad(store, on)
    if (!on) clear()
    draw()
  })
  win.addEventListener("blur", clear)
  draw()
  return {
    option,
    isOn: () => on,
    clear,
    unmount: () => {
      win.removeEventListener("blur", clear)
      pad.remove()
      option.remove()
      style.remove()
    },
  }
}
