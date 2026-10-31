import { buildClouds } from "../sim/clouds.ts"
import { createPass, proximity, stepPass, SKY_DAY, type PassOpts, type PassOut, type Puff } from "../sim/cloudpass.ts"
import { advance, clamp, createSimState, layerId, WORLD_HOME, type SimState } from "../sim/craft.ts"
import { steerFromPull } from "../input/pull.ts"
import { browserLoopEnv, createPacer, setCeiling, startLoop } from "../loop/loop.ts"
import { BODY_ALPHA, CLOUD_BODY, CLOUD_SHADE, SEA_FAR, SEA_HORIZON, SHADE_ALPHA, SKY_HORIZON, SKY_TOP, css, hazeRgb } from "../render/palette.ts"
import { browserEnv } from "../render/probe.ts"
import { MAX_PUFFS, frameDone, planOf, puffLimitFromSearch, startQuality } from "../render/quality.ts"
import { mountDebug } from "./debug.ts"

/** The seeded cloud field repeats this often, so the sky never runs out as you fly. */
export const FIELD = 3200
export const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"])

export function keyActions(keys: ReadonlySet<string>) {
  let yaw = 0
  let pitch = 0
  if (keys.has("ArrowLeft") || keys.has("KeyA")) yaw += 1
  if (keys.has("ArrowRight") || keys.has("KeyD")) yaw -= 1
  if (keys.has("ArrowUp") || keys.has("KeyW")) pitch += 1
  if (keys.has("ArrowDown") || keys.has("KeyS")) pitch -= 1
  return { yaw, pitch }
}

export const wrapRel = (v: number, span: number) => v - Math.round(v / span) * span
export const approach = (cur: number, target: number, dt: number, rate: number) => cur + (target - cur) * Math.min(1, dt * rate)
/** With no pitch input the nose eases back toward level, so the demo does not dive into the floor. */
export const levelAssist = (pitch: number, home: number) => clamp((home - pitch) * 2, -1, 1)

function smooth(a: number, b: number, v: number) {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export type Proj = { x: number; y: number; r: number; a: number; z: number }
type Pose = { x: number; y: number; z: number; yaw: number; pitch: number }

/**
 * Where a cloud lands on screen, written into `out`. Returns false when it is behind you or too close.
 * Clouds fade out as you reach them, and big close ones fade much sooner (from about a fifth of the view), so flying at a
 * cloud at top speed never changes the average brightness by more than a few percent in a second.
 */
export function projectInto(out: Proj, p: Puff, c: Pose, f: number, cx: number, cy: number): boolean {
  const dx = wrapRel(p.x - c.x, FIELD)
  const dy = p.y - c.y
  const dz = wrapRel(p.z - c.z, FIELD)
  const sy = Math.sin(c.yaw)
  const cyw = Math.cos(c.yaw)
  const xc = dx * cyw - dz * sy
  const fh = -dx * sy - dz * cyw
  const zc = fh * Math.cos(c.pitch) + dy * Math.sin(c.pitch)
  const yc = -fh * Math.sin(c.pitch) + dy * Math.cos(c.pitch)
  if (zc < 2) return false
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const near = smooth(1, 2.4, dist / p.r)
  const far = 1 - smooth(900, 1500, dist)
  const r = (f * p.r) / Math.max(zc, dist * 0.7)
  const big = 1 - smooth(0.22 * f, 0.5 * f, r)
  const a = near * far * big
  if (a < 0.01) return false
  out.x = cx + (f * xc) / zc
  out.y = cy - (f * yc) / zc
  out.r = r
  out.a = a
  out.z = zc
  return true
}

type Stick = { active: boolean; id: number; ox: number; oy: number; x: number; y: number; mouse: boolean }

export type DemoOpts = { version: string; debug: boolean; search?: string; lowPower?: boolean }

const BODY = css(CLOUD_BODY)
const SHADE = css(CLOUD_SHADE)
const SKY_TOP_CSS = css(SKY_TOP)
const SKY_HORIZON_CSS = css(SKY_HORIZON)
const SEA_HORIZON_CSS = css(SEA_HORIZON)
const SEA_FAR_CSS = css(SEA_FAR)

export function mountDemo(host: HTMLElement, opts: DemoOpts): () => void {
  const doc = host.ownerDocument
  const canvas = doc.createElement("canvas")
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", display: "block" })
  canvas.setAttribute("role", "img")
  canvas.setAttribute("aria-label", "A glider flying among clouds. Drag, or use the arrow keys, to steer.")
  host.appendChild(canvas)
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    canvas.remove()
    const note = doc.createElement("p")
    note.textContent = "This device cannot draw the picture."
    host.appendChild(note)
    return () => note.remove()
  }

  const state: SimState = createSimState({ yaw: 0, pitch: 0, throttle: 0, cruise: 0.32 })
  const quality = startQuality(browserEnv(), opts.search ?? window.location.search, opts.lowPower ?? false)
  let plan = planOf(quality)
  const puffs = buildClouds(19, MAX_PUFFS)
  const testLimit = opts.debug ? puffLimitFromSearch(opts.search ?? window.location.search) : null
  const pickPuffs = () => puffs.slice(0, Math.min(plan.puffs, testLimit ?? MAX_PUFFS))
  let active: Puff[] = pickPuffs()
  const pool: Proj[] = puffs.map(() => ({ x: 0, y: 0, r: 0, a: 0, z: 0 }))
  const order: Proj[] = []
  const pass = createPass()
  let haze: PassOut = { coverage: 0, level: SKY_DAY, screen: SKY_DAY, inside: false }
  const keys = new Set<string>()
  const stick: Stick = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0, mouse: true }
  const steer = { yaw: 0, pitch: 0 }
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
  // Reduced motion keeps the fade but slows it to the calm ramp, and drops the roll tilt below.
  const passOpts: PassOpts = { night: 0, calm: reduced, mist: "soft" }
  let w = 0
  let h = 0
  let dpr = 1
  let drawRoll = 0 // the tilt actually drawn: always 0 under reduced motion

  const release = () => {
    stick.active = false
    stick.id = -1
    stick.x = 0
    stick.y = 0
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const t = e.target
    if (t instanceof HTMLElement && t.closest("button, a, input, textarea, select, [role='slider']")) return
    if (e.ctrlKey || e.metaKey || e.altKey || !GAME_KEYS.has(e.code)) return
    keys.add(e.code)
    e.preventDefault()
  }
  const onKeyUp = (e: KeyboardEvent) => void keys.delete(e.code)
  const clearInput = () => {
    keys.clear()
    release()
  }
  const setStick = (e: PointerEvent) => {
    const span = Math.max(56, Math.min(window.innerWidth, window.innerHeight) * 0.2)
    stick.x = clamp((e.clientX - stick.ox) / span, -1, 1)
    stick.y = clamp((stick.oy - e.clientY) / span, -1, 1)
  }
  const onDown = (e: PointerEvent) => {
    if (stick.active) return
    stick.active = true
    stick.id = e.pointerId
    stick.ox = e.clientX
    stick.oy = e.clientY
    stick.mouse = e.pointerType === "mouse"
    setStick(e)
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* the pointer may already be gone */
    }
  }
  const onMove = (e: PointerEvent) => {
    if (!stick.active || e.pointerId !== stick.id) return
    if (e.pointerType === "mouse" && e.buttons === 0) return release()
    setStick(e)
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerId === stick.id) release()
  }
  const onHide = () => {
    if (doc.hidden) clearInput()
  }
  const noMenu = (e: Event) => e.preventDefault()
  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("keyup", onKeyUp)
  window.addEventListener("blur", clearInput)
  doc.addEventListener("visibilitychange", onHide)
  canvas.addEventListener("pointerdown", onDown)
  canvas.addEventListener("pointermove", onMove)
  canvas.addEventListener("pointerup", onUp)
  canvas.addEventListener("pointercancel", onUp)
  canvas.addEventListener("lostpointercapture", onUp)
  canvas.addEventListener("contextmenu", noMenu)

  const step = (dt: number) => {
    const k = keyActions(keys)
    const pull = steerFromPull(stick.active, stick.x, stick.y, stick.mouse)
    const yawIn = clamp(k.yaw + pull.yaw, -1, 1)
    const pitchIn = clamp(k.pitch + pull.pitch, -1, 1)
    const pitchWant = pitchIn !== 0 ? pitchIn : levelAssist(state.craft.pitch, WORLD_HOME.sky.pitch)
    steer.yaw = approach(steer.yaw, yawIn, dt, 5.5)
    steer.pitch = approach(steer.pitch, pitchWant, dt, 5.5)
    state.actions.yaw = steer.yaw
    state.actions.pitch = steer.pitch
    advance(state, dt)
    const c = state.craft
    haze = stepPass(pass, proximity(c.x, c.y, c.z, active, FIELD), dt, passOpts)
  }

  const fit = () => {
    const nw = host.clientWidth || window.innerWidth
    const nh = host.clientHeight || window.innerHeight
    const nd = Math.min(window.devicePixelRatio || 1, plan.scale)
    if (nw === w && nh === h && nd === dpr) return
    w = nw
    h = nh
    dpr = nd
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }

  const draw = () => {
    fit()
    const c = state.craft
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const f = Math.min(h / 2 / Math.tan((36 * Math.PI) / 180), w / 2 / Math.tan((30 * Math.PI) / 180))
    const cx = w / 2
    const cy = h * 0.46
    const horizon = cy + f * Math.tan(c.pitch)
    const big = Math.hypot(w, h)

    ctx.save()
    drawRoll = reduced ? 0 : c.roll
    ctx.translate(cx, cy)
    ctx.rotate(-drawRoll)
    ctx.translate(-cx, -cy)
    const sky = ctx.createLinearGradient(0, horizon - h, 0, horizon)
    sky.addColorStop(0, SKY_TOP_CSS)
    sky.addColorStop(1, SKY_HORIZON_CSS)
    ctx.fillStyle = sky
    ctx.fillRect(-big, horizon - big * 2, w + big * 2, big * 2)
    const sea = ctx.createLinearGradient(0, horizon, 0, horizon + h)
    sea.addColorStop(0, SEA_HORIZON_CSS)
    sea.addColorStop(1, SEA_FAR_CSS)
    ctx.fillStyle = sea
    ctx.fillRect(-big, horizon, w + big * 2, big * 2)

    order.length = 0
    for (let i = 0; i < active.length; i++) if (projectInto(pool[i], active[i], c, f, cx, cy)) order.push(pool[i])
    order.sort((a, b) => b.z - a.z)
    for (const q of order) {
      if (plan.shade) {
        ctx.globalAlpha = q.a * SHADE_ALPHA
        ctx.fillStyle = SHADE
        ctx.beginPath()
        ctx.arc(q.x, q.y + q.r * 0.2, q.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = q.a * BODY_ALPHA
      ctx.fillStyle = BODY
      ctx.beginPath()
      ctx.arc(q.x, q.y, q.r * 0.92, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Inside a cloud the whole picture fades to a soft tinted haze and back. It is drawn under the glider and the pull marker.
    if (haze.coverage > 0.002) {
      ctx.globalAlpha = haze.coverage
      ctx.fillStyle = css(hazeRgb(haze.level))
      ctx.fillRect(0, 0, w, h)
    }
    ctx.globalAlpha = 1

    if (stick.active) {
      ctx.lineWidth = 3
      ctx.strokeStyle = "rgba(10, 20, 40, 0.75)"
      ctx.beginPath()
      ctx.arc(stick.ox, stick.oy, 22, 0, Math.PI * 2)
      ctx.moveTo(stick.ox, stick.oy)
      ctx.lineTo(stick.ox + stick.x * Math.max(56, Math.min(w, h) * 0.2), stick.oy - stick.y * Math.max(56, Math.min(w, h) * 0.2))
      ctx.stroke()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = "rgba(245, 249, 253, 0.95)"
      ctx.stroke()
    }

    const s = Math.max(24, Math.min(w, h) * 0.06)
    ctx.save()
    ctx.translate(cx, h * 0.78)
    ctx.rotate(drawRoll * 1.5)
    ctx.beginPath()
    ctx.moveTo(0, -s * 1.2)
    ctx.lineTo(-s * 1.4, s * 0.6)
    ctx.lineTo(0, s * 0.2)
    ctx.lineTo(s * 1.4, s * 0.6)
    ctx.closePath()
    ctx.fillStyle = "#17243a"
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = "#f4f8fc"
    ctx.stroke()
    ctx.restore()
  }

  let failed = false
  const pacer = createPacer(plan.fps)
  const hooks = {
    step,
    draw,
    onFrame: (elapsedMs: number, workMs: number) => {
      if (!frameDone(quality, elapsedMs, workMs)) return
      plan = planOf(quality)
      active = pickPuffs()
      setCeiling(pacer, plan.fps)
    },
    onError: (e: unknown) => {
      failed = true
      console.error("Drift stopped:", e)
    },
  }
  const loop = startLoop(browserLoopEnv(), hooks, pacer)
  const stopDebug = opts.debug
    ? mountDebug(host, () => ({
        version: opts.version,
        fps: loop.pacer.fps,
        cap: loop.pacer.cap,
        stepMs: loop.pacer.stepMs,
        speed: state.craft.speed,
        altitude: state.craft.y,
        layer: failed ? "stopped" : layerId(state.craft.y),
        tier: quality.gov.tier,
        scale: quality.gov.scale,
        p95: quality.pinned ? null : quality.gov.p95,
        pinned: quality.pinned,
        haze: haze.coverage,
        tint: haze.coverage > 0.002 ? haze.level : null,
      }))
    : () => {}
  const hookWindow = window as unknown as { __controlsTest?: unknown }
  if (opts.debug) {
    hookWindow.__controlsTest = {
      getYaw: () => state.craft.yaw,
      getPitch: () => state.craft.pitch,
      getSpeed: () => state.craft.speed,
      getAltitude: () => state.craft.y,
      getPos: () => ({ x: state.craft.x, y: state.craft.y, z: state.craft.z }),
      /** For testers: put the craft somewhere, level, facing `yaw`. */
      place: (x: number, y: number, z: number, yaw: number) => {
        Object.assign(state.craft, { x, y, z, yaw, pitch: 0, roll: 0 })
      },
      setCruise: (v: number) => {
        state.actions.cruise = clamp(v, 0, 1)
      },
      getTier: () => ({ tier: quality.gov.tier, scale: quality.gov.scale, pinned: quality.pinned, puffs: plan.puffs, fps: plan.fps }),
      getHaze: () => ({ coverage: haze.coverage, level: haze.level, inside: haze.inside }),
      getVisible: () => order.length,
      getDrawRoll: () => drawRoll,
      getRoll: () => state.craft.roll,
    }
  }

  return () => {
    loop.stop()
    stopDebug()
    window.removeEventListener("keydown", onKeyDown)
    window.removeEventListener("keyup", onKeyUp)
    window.removeEventListener("blur", clearInput)
    doc.removeEventListener("visibilitychange", onHide)
    canvas.remove()
    if (opts.debug) delete hookWindow.__controlsTest
  }
}
