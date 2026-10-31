/**
 * Cloud fly-through: how the screen tints while the craft is in a cloud.
 * Pure, slow, and capped on purpose (Diego is light-sensitive). See docs/crew/DRIFT-LOOK-LOCK-REFS.md 0.1.
 * Beats: a pale tint thickens, settles to a vague grey, then clears. Never a flash.
 * The tint is capped at Diego's 65% and is never brighter than the clear sky, so going into a cloud dims the screen
 * and tints it; it does not brighten it. Brightness here is the sRGB-coded value (see render/palette.ts).
 * SKY_DAY is measured on the demo's real picture at level flight (S5); night is still an estimate.
 */
export type Puff = { x: number; y: number; z: number; r: number }
export type CloudPass = { depth: number; settle: number }
export type PassOpts = { night: number; calm: boolean; mist: "soft" | "off" }
export type PassOut = { coverage: number; level: number; screen: number; inside: boolean }

export const CLOUD_PEAK = 0.65 // brightest the tint may be, share of full white (Diego's pick)
export const CLOUD_PEAK_NIGHT = 0.4
export const GREY_SHARE = 0.77 // the grey settles to this share of the peak
export const SKY_DAY = 0.51 // average screen brightness under clear sky, measured on the demo at level flight
export const SKY_NIGHT = 0.12
export const RAMP_S = 5 // seconds to go in, and again to come out
export const RAMP_CALM_S = 8 // reduced motion or Calm
export const MAX_STEP_FRAME = 0.02 // largest brightness change in one frame
export const MAX_RATE_S = 0.06 // largest brightness change in one second
export const MAX_DT = 0.1

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
function smooth(a: number, b: number, v: number) {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export const createPass = (): CloudPass => ({ depth: 0, settle: 0 })

const wrapBy = (v: number, span: number) => (span > 0 ? v - Math.round(v / span) * span : v)

/**
 * 0 clear of every cloud, 1 in a cloud core. Soft edge from 0.55 to 1.25 radii.
 * `wrap` is the span a repeating cloud field comes round again (0 for a field that does not repeat).
 */
export function proximity(x: number, y: number, z: number, puffs: readonly Puff[], wrap = 0) {
  let best = 0
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i]
    const dx = wrapBy(x - p.x, wrap)
    const dy = y - p.y
    const dz = wrapBy(z - p.z, wrap)
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / p.r
    const v = 1 - smooth(0.55, 1.25, d)
    if (v > best) best = v
  }
  return best
}

/** Moves the pass toward `target` (0..1) no faster than one ramp. Night is the eased 0..1 value. */
export function stepPass(s: CloudPass, target: number, dt: number, o: PassOpts): PassOut {
  const rate = clamp(dt, 0, MAX_DT) / (o.calm ? RAMP_CALM_S : RAMP_S)
  const t = o.mist === "off" ? 0 : clamp(target, 0, 1)
  s.depth += clamp(t - s.depth, -rate, rate)
  const inside = s.depth > 0.98
  s.settle = clamp(s.settle + (inside ? rate : -rate), 0, s.depth)
  const n = clamp(o.night, 0, 1)
  const sky = lerp(SKY_DAY, SKY_NIGHT, n)
  const peak = Math.min(lerp(CLOUD_PEAK, CLOUD_PEAK_NIGHT, n), sky)
  const c = s.depth
  const level = c > 1e-4 ? peak - (peak - peak * GREY_SHARE) * (s.settle / c) : peak
  return { coverage: c, level, screen: (1 - c) * sky + c * level, inside }
}
