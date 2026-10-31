import type { DrawPath } from "../render/types.ts"

/** The names a person sees for the tiers. The ids (full, balanced, light, still) stay in the code and in `data-tier`. */
export const TIER_NAMES: Record<string, string> = { full: "Fancy", balanced: "Normal", light: "Lite", still: "Still" }

export type DebugInfo = {
  version: string
  fps: number
  cap: number
  stepMs: number
  speed: number
  altitude: number
  layer: string
  tier: string
  scale: number
  p95: number | null // frame time the governor judges; null when the tier is pinned and nothing is judged
  pinned: boolean
  haze: number // 0 clear .. 1 inside a cloud
  tint: number | null // brightness level of the haze, 0..1; null while there is none
  bankDeg: number // how far the glider is banked against the horizon, degrees, always 0 or more
  bankMax: number // the most it can ever bank, degrees
  bright: number // mean brightness of the picture after the guard, 0..1
  veil: number // how much of the guard's dark veil is on, 0..1 (0 in normal play)
  draw: DrawPath // gl: WebGL draws the world; canvas2d: Canvas 2D does (Still, or GL missing or lost)
  clouds: number // how many clouds are on the screen this frame
  lost: number // how many times the browser has taken the GL context away
}

/** ?debug=1 turns the readout on. */
export function wantsDebug(search: string): boolean {
  try {
    return new URLSearchParams(search).get("debug") === "1"
  } catch {
    return false
  }
}

export function debugLines(i: DebugInfo): string[] {
  return [
    `Drift ${i.version}`,
    `${Math.round(i.fps)} fps · cap ${i.cap} · step ${i.stepMs.toFixed(1)} ms`,
    `tier ${TIER_NAMES[i.tier] ?? i.tier} (${i.tier}) · p95 ${i.p95 === null ? "-" : i.p95.toFixed(0) + " ms"}`,
    `speed ${i.speed.toFixed(1)} · altitude ${Math.round(i.altitude)} · ${i.layer}`,
    `haze ${Math.round(i.haze * 100)}% · tint ${i.tint === null ? "-" : Math.round(i.tint * 100) + "%"}${i.pinned ? " · tier pinned" : ""}`,
    `bank ${Math.round(Math.abs(i.bankDeg))}° of ${Math.round(i.bankMax)}° · bright ${Math.round(i.bright * 100)}% · veil ${Math.round(i.veil * 100)}%`,
    `draw ${i.draw === "gl" ? "gl" : "2d"} · scale ${i.scale.toFixed(2)} · ${i.clouds} clouds · lost ${i.lost}`,
  ]
}

/** A small dark box in the top left corner. Plain words, no color coding, never catches a tap. */
export function mountDebug(host: HTMLElement, read: () => DebugInfo, everyMs = 250): () => void {
  const box = host.ownerDocument.createElement("div")
  box.setAttribute("role", "status")
  box.setAttribute("aria-live", "off")
  box.setAttribute("aria-label", "Debug readout")
  box.dataset.debug = "1"
  Object.assign(box.style, {
    position: "fixed",
    top: "max(8px, env(safe-area-inset-top))",
    left: "max(8px, env(safe-area-inset-left))",
    zIndex: "10",
    maxWidth: "calc(100vw - 16px)",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #3a4a63",
    background: "rgba(8, 16, 30, 0.9)",
    color: "#e8eef7",
    font: "13px/1.45 ui-monospace, Menlo, Consolas, monospace",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    pointerEvents: "none",
  })
  host.appendChild(box)
  let last = ""
  const paint = () => {
    const info = read()
    const text = debugLines(info).join("\n")
    if (text !== last) {
      last = text
      box.textContent = text
      box.dataset.tier = info.tier
    }
  }
  paint()
  const timer = setInterval(paint, everyMs)
  return () => {
    clearInterval(timer)
    box.remove()
  }
}
