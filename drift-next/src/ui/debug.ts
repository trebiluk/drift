export type DebugInfo = {
  version: string
  fps: number
  cap: number
  stepMs: number
  speed: number
  altitude: number
  layer: string
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
    `speed ${i.speed.toFixed(1)} · altitude ${Math.round(i.altitude)} · ${i.layer}`,
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
    const text = debugLines(read()).join("\n")
    if (text !== last) {
      last = text
      box.textContent = text
    }
  }
  paint()
  const timer = setInterval(paint, everyMs)
  return () => {
    clearInterval(timer)
    box.remove()
  }
}
