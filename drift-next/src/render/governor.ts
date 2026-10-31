import { TIERS, TIER_TABLE, tierIndex, type Tier } from "./tiers.ts"

/**
 * Keeps the frame rate steady. Drops fast, climbs slowly, and never goes back to a tier that already failed.
 * It judges the 95th-percentile frame time, not the average: an average hides stutter, which is what a Chromebook gives.
 * `fps` in the tier table is a floor to hit. Two numbers are fed per frame: the time between drawn frames (what the student
 * sees, judged against the budget) and the time step + draw took (headroom, judged before climbing). A loop that is held to
 * 30 or 60 by design has long gaps between frames even when it is idle, so the gap alone can never say "comfortable".
 */
export const WINDOW_MS = 1500 // how much recent history counts
export const EVAL_MS = 250 // how often to judge
export const MIN_SAMPLES = 20 // fresh frames needed before any judgement
export const HITCH_MS = 250 // longer than this is a hidden tab or a stall, not a trend
export const STEADY_MS = 10_000 // comfortable this long before climbing
export const CLIMB_GAP_MS = 30_000 // and at most one climb this often
export const COMFY = 0.75 // p95 under this share of the budget counts as comfortable
export const SCALE_STEP = 0.1
const RING = 256

export type Why = "slow-scale" | "slow-tier" | "up-scale" | "up-tier" | "capped" | "lost"
export type Change = { tier: Tier; scale: number; why: Why }

export type Governor = {
  tier: Tier
  scale: number
  cap: Tier // lightest-allowed ceiling: nothing above this tier is used
  now: number
  times: Float64Array
  ms: Float32Array
  work: Float32Array
  head: number
  count: number
  scratch: Float32Array
  nextEval: number
  steadyFrom: number
  lastClimb: number
  failed: Record<Tier, boolean>
  locked: boolean // started on the still picture: there is no GL to climb back to
  losses: number
  dead: boolean
  p50: number
  p95: number
  w95: number // 95th percentile of the work time
}

const round2 = (v: number) => Math.round(v * 100) / 100

export function createGovernor(start: Tier): Governor {
  return {
    tier: start,
    scale: TIER_TABLE[start].scaleMax,
    cap: "full",
    now: 0,
    times: new Float64Array(RING),
    ms: new Float32Array(RING),
    work: new Float32Array(RING),
    head: 0,
    count: 0,
    scratch: new Float32Array(RING),
    nextEval: EVAL_MS,
    steadyFrom: 0,
    lastClimb: -Infinity,
    failed: { full: false, balanced: false, light: false, still: false },
    locked: start === "still",
    losses: 0,
    dead: false,
    p50: 0,
    p95: 0,
    w95: 0,
  }
}

function commit(g: Governor, why: Why, climb = false): Change {
  g.steadyFrom = g.now
  g.count = 0
  g.nextEval = g.now + EVAL_MS
  if (climb) g.lastClimb = g.now
  return { tier: g.tier, scale: g.scale, why }
}

function slower(g: Governor): Change | null {
  const spec = TIER_TABLE[g.tier]
  if (g.scale - SCALE_STEP >= spec.scaleMin - 1e-9) {
    g.scale = round2(Math.max(spec.scaleMin, g.scale - SCALE_STEP))
    return commit(g, "slow-scale")
  }
  const i = tierIndex(g.tier)
  if (i >= TIERS.length - 1) return null
  g.failed[g.tier] = true
  g.tier = TIERS[i + 1]
  g.scale = TIER_TABLE[g.tier].scaleMin
  return commit(g, "slow-tier")
}

function faster(g: Governor): Change | null {
  const spec = TIER_TABLE[g.tier]
  if (g.scale < spec.scaleMax - 1e-9) {
    g.scale = round2(Math.min(spec.scaleMax, g.scale + SCALE_STEP))
    return commit(g, "up-scale", true)
  }
  const up = tierIndex(g.tier) - 1
  if (up < 0 || up < tierIndex(g.cap) || g.failed[TIERS[up]]) return null
  g.tier = TIERS[up]
  g.scale = TIER_TABLE[g.tier].scaleMin
  return commit(g, "up-tier", true)
}

/**
 * Feed one frame. `frameMs` is the gap since the last drawn frame; `workMs` is what step + draw took
 * (leave it out and the gap stands in for it). Returns a change only when the tier or scale should move.
 */
export function sample(g: Governor, frameMs: number, workMs: number = frameMs): Change | null {
  g.now += frameMs
  if (g.dead) return null
  if (!(frameMs > 0) || frameMs > HITCH_MS) {
    g.steadyFrom = g.now
    return null
  }
  g.times[g.head] = g.now
  g.ms[g.head] = frameMs
  g.work[g.head] = Number.isFinite(workMs) && workMs >= 0 ? workMs : frameMs
  g.head = (g.head + 1) % RING
  if (g.count < RING) g.count++
  if (g.now < g.nextEval) return null
  g.nextEval = g.now + EVAL_MS

  let m = 0
  for (let k = 1; k <= g.count; k++) {
    const idx = (g.head - k + RING) % RING
    if (g.times[idx] < g.now - WINDOW_MS) break
    g.scratch[m++] = g.work[idx]
  }
  if (m < MIN_SAMPLES) return null
  g.scratch.subarray(0, m).sort()
  g.w95 = g.scratch[Math.ceil(m * 0.95) - 1]
  m = 0
  for (let k = 1; k <= g.count; k++) {
    const idx = (g.head - k + RING) % RING
    if (g.times[idx] < g.now - WINDOW_MS) break
    g.scratch[m++] = g.ms[idx]
  }
  const sorted = g.scratch.subarray(0, m).sort()
  g.p50 = sorted[Math.ceil(m * 0.5) - 1]
  g.p95 = sorted[Math.ceil(m * 0.95) - 1]

  const budget = TIER_TABLE[g.tier].budgetMs
  if (g.p95 > budget) return slower(g)
  if (g.w95 > budget * COMFY) {
    g.steadyFrom = g.now
    return null
  }
  if (g.locked || g.now - g.steadyFrom < STEADY_MS || g.now - g.lastClimb < CLIMB_GAP_MS) return null
  return faster(g)
}

/** Low power or reduced motion: nothing heavier than `cap` is used, and a heavier tier steps down now. */
export function setCap(g: Governor, cap: Tier): Change | null {
  g.cap = cap
  if (tierIndex(g.tier) >= tierIndex(cap)) return null
  g.tier = cap
  g.scale = TIER_TABLE[cap].scaleMin
  return commit(g, "capped")
}

/** First loss: the caller pauses and waits for a restore. A second loss gives up on WebGL for the session. */
export function contextLost(g: Governor): Change | null {
  g.losses++
  if (g.losses < 2) return null
  g.dead = true
  g.locked = true
  g.tier = "still"
  g.scale = 1
  return commit(g, "lost")
}

export function debugLine(g: Governor): string {
  const b = TIER_TABLE[g.tier].budgetMs
  return `tier ${g.tier} · scale ${g.scale.toFixed(2)} · p50 ${g.p50.toFixed(1)} ms · p95 ${g.p95.toFixed(1)} ms · budget ${b} ms`
}
