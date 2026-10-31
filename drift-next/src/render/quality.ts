import { BRIGHT_CAP, BRIGHT_FLOOR } from "../sim/cloudpass.ts"
import { createGovernor, sample, setCap, type Change, type Governor } from "./governor.ts"
import { detectCaps, startTier, type Caps, type ProbeEnv } from "./probe.ts"
import { TIERS, TIER_TABLE, type Tier } from "./tiers.ts"

/** The demo draws with Canvas 2D at every tier, so a tier changes how much it draws, not which drawer it uses. */
export type DrawPlan = {
  puffs: number // how many clouds of the seeded field are used
  shade: boolean // draw the soft underside of each cloud
  fps: 60 | 30 // the most frames per second the loop may run
  scale: number // render scale: fewer pixels to fill when the screen is struggling
}

// `still` has no GL puffs in the tier table; here it draws a few flat discs so the game is still a game.
const STILL_PUFFS = 24

export function drawPlan(tier: Tier, scale: number): DrawPlan {
  const spec = TIER_TABLE[tier]
  return {
    puffs: tier === "still" ? STILL_PUFFS : spec.puffs,
    shade: tier === "full" || tier === "balanced",
    fps: spec.fps === 60 ? 60 : 30,
    scale,
  }
}

/** The largest number of clouds any tier asks for. */
export const MAX_PUFFS = Math.max(...TIERS.map((t) => drawPlan(t, 1).puffs))

/** `?q=full|balanced|light|still` pins a tier for testing. Anything else is ignored. */
export function tierFromSearch(search: string): Tier | null {
  try {
    const q = new URLSearchParams(search).get("q")
    return TIERS.find((t) => t === q) ?? null
  } catch {
    return null
  }
}

export type Quality = { gov: Governor; caps: Caps | null; pinned: boolean }

/**
 * Pick the starting tier and make the governor. A pinned tier skips the probe and never moves.
 * Reduced motion or Low power cannot climb above `light`.
 */
export function startQuality(env: ProbeEnv, search: string, lowPower = false): Quality {
  const forced = tierFromSearch(search)
  if (forced) return { gov: createGovernor(forced), caps: null, pinned: true }
  const caps = detectCaps(env)
  const gov = createGovernor(startTier(caps, lowPower))
  if (caps.reducedMotion || lowPower) setCap(gov, "light")
  return { gov, caps, pinned: false }
}

/** One finished frame. `elapsedMs` is the time since the last drawn frame, `workMs` what step + draw took. */
export function frameDone(q: Quality, elapsedMs: number, workMs: number): Change | null {
  return q.pinned ? null : sample(q.gov, elapsedMs, workMs)
}

export function planOf(q: Quality): DrawPlan {
  return drawPlan(q.gov.tier, q.gov.scale)
}

/**
 * `?debug=1&cap=NN` lowers the brightness cap to NN percent (40 to 58) so a tester can watch the guard work.
 * It can only lower the cap; anything else is ignored. Only read when debug is on.
 */
export function capFromSearch(search: string): number | null {
  try {
    const v = new URLSearchParams(search).get("cap")
    if (v === null || !/^\d{2}$/.test(v)) return null
    const n = Number(v) / 100
    return n >= BRIGHT_FLOOR - 1e-9 && n <= BRIGHT_CAP + 1e-9 ? n : null
  } catch {
    return null
  }
}

/** `?debug=1&puffs=N` limits the clouds, so a tester can look at clear sky (`puffs=0`). Only read when debug is on. */
export function puffLimitFromSearch(search: string): number | null {
  try {
    const v = new URLSearchParams(search).get("puffs")
    if (v === null || !/^\d{1,4}$/.test(v)) return null
    return Math.min(Number(v), MAX_PUFFS)
  } catch {
    return null
  }
}
