/** Pause UI for Drift: always-visible Pause button, calm panel on pause.
 * Keyboard: P and Esc pause. Panel: Resume (focused first), Home.
 * Auto-pause on tab hidden (visibilitychange) and window blur / focus loss.
 * No flash, respects reduced motion (no fade if prefers-reduced-motion).
 * Targets 44px+, icon+text, contrast AA, visible focus.
 */

export type PauseControls = {
  pause: () => void
  unpause: () => void
  isPaused: () => boolean
}

export function mountPause(host: HTMLElement, controls: PauseControls): () => void {
  const doc = host.ownerDocument
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches

  // Always-visible Pause button — forced 44x44+ hit target
  const btn = doc.createElement("button")
  btn.type = "button"
  btn.setAttribute("aria-label", "Pause")
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style="flex-shrink:0"><rect x="4" y="3" width="4" height="14"/><rect x="12" y="3" width="4" height="14"/></svg><span>Pause</span>`
  Object.assign(btn.style, {
    position: "fixed",
    top: "max(12px, env(safe-area-inset-top))",
    left: "max(12px, env(safe-area-inset-left))",
    zIndex: "20",
    height: "44px",
    minHeight: "44px",
    minWidth: "44px",
    padding: "0 16px",
    boxSizing: "border-box",
    border: "none",
    borderRadius: "10px",
    background: "rgba(8, 16, 30, 0.88)",
    color: "#f2f6fb",
    fontSize: "16px",
    fontFamily: "system-ui, sans-serif",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    lineHeight: "1",
  })
  // Explicit first-tap handler that always opens the panel
  btn.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!controls.isPaused()) {
      controls.pause()
    }
  })
  host.appendChild(btn)

  // Calm panel (hidden by default)
  const panel = doc.createElement("div")
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-modal", "true")
  panel.setAttribute("aria-label", "Paused")
  panel.hidden = true
  Object.assign(panel.style, {
    position: "fixed",
    inset: "0",
    zIndex: "30",
    background: "rgba(8, 16, 30, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: reduced ? "1" : "0",
    transition: reduced ? "none" : "opacity 0.2s ease",
    pointerEvents: "none",
  })
  const box = doc.createElement("div")
  Object.assign(box.style, {
    background: "#f2f6fb",
    color: "#102033",
    padding: "24px",
    borderRadius: "16px",
    textAlign: "center",
    minWidth: "240px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
  })
  const title = doc.createElement("h2")
  title.textContent = "Paused"
  title.style.margin = "0 0 16px"
  title.style.fontSize = "20px"
  box.appendChild(title)

  const resume = doc.createElement("button")
  resume.type = "button"
  resume.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style="flex-shrink:0"><polygon points="5,3 17,10 5,17"/></svg><span>Resume</span>`
  Object.assign(resume.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    height: "44px",
    minHeight: "44px",
    marginBottom: "12px",
    padding: "0 16px",
    boxSizing: "border-box",
    border: "none",
    borderRadius: "10px",
    background: "#2563EB",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer",
  })
  resume.addEventListener("click", () => controls.unpause())
  box.appendChild(resume)

  const home = doc.createElement("button")
  home.type = "button"
  home.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style="flex-shrink:0"><path d="M10 2 L18 8 V18 H12 V12 H8 V18 H2 V8 Z"/></svg><span>Home</span>`
  Object.assign(home.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    height: "44px",
    minHeight: "44px",
    padding: "0 16px",
    boxSizing: "border-box",
    border: "1px solid #102033",
    borderRadius: "10px",
    background: "transparent",
    color: "#102033",
    fontSize: "16px",
    cursor: "pointer",
  })
  home.addEventListener("click", () => {
    window.location.href = "https://apps.kulibert.net"
  })
  box.appendChild(home)

  panel.appendChild(box)
  host.appendChild(panel)

  const showPanel = (show: boolean) => {
    if (show) {
      panel.hidden = false
      panel.style.pointerEvents = "auto"
      if (!reduced) requestAnimationFrame(() => { panel.style.opacity = "1" })
      else panel.style.opacity = "1"
      setTimeout(() => resume.focus(), 0)
    } else {
      if (!reduced) {
        panel.style.opacity = "0"
        setTimeout(() => { panel.hidden = true; panel.style.pointerEvents = "none" }, 200)
      } else {
        panel.hidden = true
        panel.style.pointerEvents = "none"
      }
      btn.focus()
    }
  }

  // Keyboard: P and Esc pause (when not in input)
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest("button, input, textarea, select")) return
    if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      e.preventDefault()
      if (!controls.isPaused()) controls.pause()
    }
  }
  doc.addEventListener("keydown", onKey)

  // Auto-pause on window blur / focus loss (in addition to visibilitychange in loop)
  const onBlur = () => {
    if (!controls.isPaused()) controls.pause()
  }
  window.addEventListener("blur", onBlur)

  const cleanup = () => {
    btn.remove()
    panel.remove()
    doc.removeEventListener("keydown", onKey)
    window.removeEventListener("blur", onBlur)
  }

  ;(window as any).__pauseShow = showPanel

  return cleanup
}

/** Helper to wire into loop if needed. */
export function wirePause(loop: { pause: () => void; unpause: () => void; paused: boolean }) {
  return {
    pause: () => { loop.pause(); (window as any).__pauseShow?.(true) },
    unpause: () => { loop.unpause(); (window as any).__pauseShow?.(false) },
    isPaused: () => loop.paused,
  }
}
