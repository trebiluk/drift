/**
 * Speed (DRIFT-S7-HUD-PLAN step 1): an on-screen control with 5 notches, Slow to Fast.
 *
 * Before this, speed could only be changed through a test hook. Now: a small dock at the bottom right with ▲ Faster and
 * ▼ Slower buttons (48 px, icon + text) and the notch as words and a number ("Speed 2 of 5"); keys Q / E and − / + do the
 * same. It is a `role="slider"` with `aria-valuetext`, so a screen reader hears "Speed 2 of 5, slow". The sim already eases
 * speed (craft.ts), so a change never jumps the picture.
 *
 * Same dark plate as the Pause button: never brighter than the picture. Nothing is shown by colour alone: the notch is a
 * number, a word and filled bars.
 *
 * The rules are pure functions with tests; the DOM part is thin.
 */
import { PAUSE_COLORS, TARGET_PX, type KeyInput } from "./pause.ts"

/** Cruise values (0 = crawl, 1 = rush) for the 5 notches. Notch 2 (index 1) is the 2.0.0-n default, 0.32. */
export const NOTCHES = [0.08, 0.32, 0.55, 0.78, 1] as const
export const DEFAULT_NOTCH = 1

/** Every word the player sees, for the translation pass (S8). */
export const SPEED_TEXT = {
  speed: "Speed",
  faster: "Faster",
  slower: "Slower",
  names: ["Slowest", "Slow", "Medium", "Fast", "Fastest"] as readonly string[],
  /** What a screen reader says: "Speed 2 of 5, Slow". */
  of: "Speed {n} of {total}, {name}",
}

export const clampNotch = (n: number) => Math.max(0, Math.min(NOTCHES.length - 1, Math.round(n)))

/** The nearest notch to a cruise value (used once, to start from whatever the sim was given). */
export function notchOf(cruise: number): number {
  let best = 0
  for (let i = 1; i < NOTCHES.length; i++) if (Math.abs(NOTCHES[i] - cruise) < Math.abs(NOTCHES[best] - cruise)) best = i
  return best
}

/** E, + and = go faster; Q and − go slower. By key position (code) first, so other keyboard layouts still work. */
export function speedKey(k: KeyInput): 1 | -1 | 0 {
  if (k.ctrl || k.meta || k.alt || k.typing) return 0
  if (k.code === "KeyE" || k.code === "Equal" || k.code === "NumpadAdd" || k.key === "+") return 1
  if (k.code === "KeyQ" || k.code === "Minus" || k.code === "NumpadSubtract" || k.key === "-") return -1
  return 0
}

/** What a screen reader and the dock both say: "Speed 2 of 5, Slow". */
export const speedLabel = (notch: number) =>
  SPEED_TEXT.of.replace("{n}", String(notch + 1)).replace("{total}", String(NOTCHES.length)).replace("{name}", SPEED_TEXT.names[notch])

const CSS = `
.ds-speed{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:calc(max(12px,env(safe-area-inset-bottom)) + 52px);z-index:20;
  display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:8px;border-radius:14px;background:${PAUSE_COLORS.plate};color:${PAUSE_COLORS.plateInk};
  font:600 15px/1.2 system-ui,sans-serif;touch-action:manipulation;user-select:none;box-sizing:border-box;width:136px}
.ds-speed button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:${TARGET_PX}px;min-width:${TARGET_PX}px;margin:0;padding:4px 8px;text-align:center;
  border:2px solid rgba(242,246,251,.35);border-radius:10px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.ds-speed button:disabled{opacity:.4;cursor:default}
.ds-speed button:focus-visible,.ds-speed [role=slider]:focus-visible{outline:3px solid ${PAUSE_COLORS.plateInk};outline-offset:2px}
.ds-speed [role=slider]{display:flex;flex-direction:column;align-items:center;gap:4px;padding:4px 2px;border-radius:8px}
.ds-speed .ds-bars{display:flex;gap:3px;align-items:flex-end;height:18px;direction:ltr}
.ds-speed .ds-bars i{display:block;width:8px;border-radius:2px;border:1.5px solid ${PAUSE_COLORS.plateInk}}
.ds-speed .ds-bars i.on{background:${PAUSE_COLORS.plateInk}}
.ds-speed .ds-word{font-size:14px;text-align:center}
`

export type SpeedDock = { unmount: () => void; notch: () => number; set: (n: number) => void }

/** Mounts the dock. `onChange(cruise)` is called with the new cruise value; the caller hands it to the sim. */
export function mountSpeed(doc: Document, host: HTMLElement, start: number, onChange: (cruise: number) => void): SpeedDock {
  const style = doc.createElement("style")
  style.textContent = CSS
  doc.head.appendChild(style)
  const box = doc.createElement("div")
  box.className = "ds-speed"
  const up = doc.createElement("button")
  up.type = "button"
  up.innerHTML = '<span aria-hidden="true">▲</span><span></span>'
  const slider = doc.createElement("div")
  slider.setAttribute("role", "slider")
  slider.tabIndex = 0
  slider.setAttribute("aria-valuemin", "1")
  slider.setAttribute("aria-valuemax", String(NOTCHES.length))
  slider.innerHTML = '<span class="ds-bars" aria-hidden="true"></span><span class="ds-word"></span>'
  const down = doc.createElement("button")
  down.type = "button"
  down.innerHTML = '<span aria-hidden="true">▼</span><span></span>'
  box.append(up, slider, down)
  host.appendChild(box)
  ;(up.lastElementChild as HTMLElement).textContent = SPEED_TEXT.faster
  ;(down.lastElementChild as HTMLElement).textContent = SPEED_TEXT.slower
  const bars = slider.querySelector(".ds-bars") as HTMLElement
  bars.innerHTML = NOTCHES.map((_, i) => `<i style="height:${6 + i * 3}px"></i>`).join("")
  let notch = clampNotch(start)

  const draw = () => {
    slider.setAttribute("aria-valuenow", String(notch + 1))
    slider.setAttribute("aria-valuetext", speedLabel(notch))
    slider.setAttribute("aria-label", SPEED_TEXT.speed)
    ;(slider.querySelector(".ds-word") as HTMLElement).textContent = `${notch + 1}/${NOTCHES.length} ${SPEED_TEXT.names[notch]}`
    bars.querySelectorAll("i").forEach((b, i) => b.classList.toggle("on", i <= notch))
    up.disabled = notch >= NOTCHES.length - 1
    down.disabled = notch <= 0
  }
  const set = (n: number) => {
    const next = clampNotch(n)
    if (next === notch) return
    notch = next
    draw()
    onChange(NOTCHES[notch])
  }
  up.addEventListener("click", () => set(notch + 1))
  down.addEventListener("click", () => set(notch - 1))
  slider.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "PageUp" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "PageDown" ? -1 : 0
    if (e.key === "Home") { e.preventDefault(); set(0); return }
    if (e.key === "End") { e.preventDefault(); set(NOTCHES.length - 1); return }
    if (d) { e.preventDefault(); e.stopPropagation(); set(notch + d) }
  })
  const onKey = (e: KeyboardEvent) => {
    const t = e.target
    const typing = t instanceof HTMLElement && !!t.closest("input, textarea, select, [contenteditable='true']")
    const d = speedKey({ code: e.code, key: e.key, repeat: e.repeat, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, typing })
    if (d) { e.preventDefault(); set(notch + d) }
  }
  doc.addEventListener("keydown", onKey)
  draw()
  onChange(NOTCHES[notch])
  return {
    unmount: () => { doc.removeEventListener("keydown", onKey); box.remove(); style.remove() },
    notch: () => notch,
    set,
  }
}
