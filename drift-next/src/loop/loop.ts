/**
 * The frame loop. The pacer decides which animation frames run; startLoop wires it to requestAnimationFrame.
 * Cap 60. If frames run long it drops to 30 and tells nobody to panic; it climbs back at most twice.
 * It never advances time across a hidden tab or a stall, so the craft cannot jump.
 * Timing uses the timestamps requestAnimationFrame hands in, so tests can feed it any display.
 */
export const HITCH_MS = 250 // longer than this is a hidden tab or a stall, not a trend
export const LONG_FACTOR = 1.75 // an interval this many frame-times long counts as a long frame
export const WINDOW = 60 // intervals judged together, about one second at 60
export const DROP_LONG = 15 // this many long frames in a window drops the cap to 30
export const RISE_AFTER_MS = 10_000 // light work for this long before going back to 60
export const RISE_GAP_MS = 30_000 // and at most one change of cap this often
export const WORK_OK_MS = 8 // step + draw under this leaves room for 60
export const MAX_DROPS = 2 // after the second drop it stays at 30 for the session

export type Pacer = {
  cap: 60 | 30
  ceiling: 60 | 30 // the fastest cap allowed: a light tier sets 30 and the loop never climbs past it
  now: number
  last: number // timestamp of the last frame that ran; NaN until the clock starts
  due: number // earliest time the next frame may run
  ring: Float32Array
  n: number
  head: number
  drops: number
  changedAt: number
  okSince: number
  stepMs: number // smoothed time spent in step + draw
  fps: number
  runs: number
  winStart: number
}

export function createPacer(ceiling: 60 | 30 = 60): Pacer {
  return {
    cap: ceiling, ceiling, now: 0, last: NaN, due: 0, ring: new Float32Array(WINDOW), n: 0, head: 0,
    drops: 0, changedAt: 0, okSince: 0, stepMs: 0, fps: 0, runs: 0, winStart: 0,
  }
}

const frameMs = (p: Pacer) => 1000 / p.cap

function clearWindow(p: Pacer) {
  p.n = 0
  p.head = 0
}

/** Call once per animation frame. Returns seconds to advance the sim, or 0 to skip this frame. */
export function tick(p: Pacer, ts: number): number {
  p.now = ts
  if (Number.isNaN(p.last)) {
    p.last = ts
    p.due = ts
    p.winStart = ts
    p.runs = 0
    return 0
  }
  if (ts < p.due - 1) return 0
  const elapsed = ts - p.last
  p.last = ts
  const interval = frameMs(p)
  if (elapsed > HITCH_MS) {
    p.due = ts + interval
    clearWindow(p)
    p.okSince = ts
    return 0
  }
  p.due += interval
  if (ts - p.due > interval) p.due = ts + interval

  p.ring[p.head] = elapsed
  p.head = (p.head + 1) % WINDOW
  if (p.n < WINDOW) p.n++
  if (p.cap === 60 && p.n === WINDOW) {
    let long = 0
    const limit = interval * LONG_FACTOR
    for (let i = 0; i < WINDOW; i++) if (p.ring[i] > limit) long++
    if (long >= DROP_LONG) {
      p.cap = 30
      p.drops++
      p.changedAt = ts
      p.okSince = ts
      p.due = ts + frameMs(p)
      clearWindow(p)
    }
  }

  p.runs++
  if (ts - p.winStart >= 500) {
    p.fps = (p.runs * 1000) / (ts - p.winStart)
    p.runs = 0
    p.winStart = ts
  }
  return elapsed / 1000
}

/** Call after a frame ran, with how long step + draw took. May lift the cap back to 60. */
export function done(p: Pacer, workMs: number) {
  p.stepMs += (workMs - p.stepMs) * 0.1
  if (p.stepMs > WORK_OK_MS) p.okSince = p.now
  if (
    p.cap === 30 &&
    p.ceiling === 60 &&
    p.drops < MAX_DROPS &&
    p.now - p.okSince >= RISE_AFTER_MS &&
    p.now - p.changedAt >= RISE_GAP_MS
  ) {
    p.cap = 60
    p.changedAt = p.now
    p.due = p.now + frameMs(p)
    clearWindow(p)
  }
}

/** A quality tier asked for a new top speed. Takes effect now, and the drop counter starts fresh. */
export function setCeiling(p: Pacer, ceiling: 60 | 30) {
  if (p.ceiling === ceiling) return
  p.ceiling = ceiling
  p.cap = ceiling
  p.drops = 0
  p.changedAt = p.now
  p.okSince = p.now
  p.due = p.now + frameMs(p)
  clearWindow(p)
}

/** The tab came back: forget the clock so the gap is never counted. */
export function resume(p: Pacer) {
  p.last = NaN
  clearWindow(p)
}

export type LoopEnv = {
  raf: (cb: (ts: number) => void) => number
  caf: (id: number) => void
  now: () => number
  hidden: () => boolean
  onVisibility: (fn: () => void) => () => void
}

export type LoopHooks = {
  step: (dtSeconds: number) => void
  draw: () => void
  /** After each frame that ran: ms since the last drawn frame, and ms spent in step + draw. */
  onFrame?: (elapsedMs: number, workMs: number) => void
  onError?: (e: unknown) => void
}

export function startLoop(env: LoopEnv, hooks: LoopHooks, pacer: Pacer = createPacer()) {
  let id = 0
  let running = true
  let paused = false
  const frame = (ts: number) => {
    id = 0
    if (!running || env.hidden() || paused) return
    id = env.raf(frame)
    const dt = tick(pacer, ts)
    if (dt <= 0) return
    const t0 = env.now()
    try {
      hooks.step(dt)
      hooks.draw()
      const work = env.now() - t0
      done(pacer, work)
      hooks.onFrame?.(dt * 1000, work)
    } catch (e) {
      stop()
      hooks.onError?.(e)
    }
  }
  const cancel = () => {
    if (id) env.caf(id)
    id = 0
  }
  const off = env.onVisibility(() => {
    if (!running) return
    if (env.hidden()) {
      cancel()
      // auto-pause on hide: set paused so panel can show
      paused = true
      if (typeof (window as any).__pauseShow === "function") (window as any).__pauseShow(true)
    } else {
      resume(pacer)
      if (!paused && !id) id = env.raf(frame)
    }
  })
  function stop() {
    running = false
    cancel()
    off()
  }
  function pause() {
    if (paused) return
    paused = true
    cancel()
  }
  function unpause() {
    if (!paused) return
    paused = false
    resume(pacer)
    if (!env.hidden() && !id) id = env.raf(frame)
  }
  if (!env.hidden()) id = env.raf(frame)
  return { stop, pause, unpause, pacer, get paused() { return paused } }
}

export function browserLoopEnv(): LoopEnv {
  return {
    raf: (cb) => requestAnimationFrame(cb),
    caf: (id) => cancelAnimationFrame(id),
    now: () => performance.now(),
    hidden: () => document.hidden,
    onVisibility: (fn) => {
      document.addEventListener("visibilitychange", fn)
      return () => document.removeEventListener("visibilitychange", fn)
    },
  }
}
