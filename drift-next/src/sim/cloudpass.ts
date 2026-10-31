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

// The brightness guard. The cloud pass above keeps the tint under the clear sky, but nothing there looks at the picture
// that actually reaches the screen. The guard does: it is told the measured mean brightness of the picture and, if that is
// over the cap, lays a dark veil over it until the picture is exactly at the cap. It is the last word for light-sensitive
// players, whatever the sky, the clouds or the haze do. In normal play the picture is under the cap and the veil stays 0.
export const BRIGHT_CAP = 0.58 // the picture's mean brightness is never allowed above this (Diego's limit is 60%)
export const BRIGHT_FLOOR = 0.4 // a test may lower the cap, never below this
export const VEIL_LEVEL = 0.2 // brightness of the veil color: a dark blue-grey, never black
export const VEIL_MAX = 0.75 // the most the veil can cover, so a bad reading can never black the screen out
export const VEIL_RELEASE_S = 0.04 // the veil lifts no faster than this per second; it drops on at once (it only ever dims)

export type Guard = { veil: number }
export type GuardOut = { veil: number; out: number }

export const createGuard = (): Guard => ({ veil: 0 })

/** The veil that brings a picture of brightness `base` down to `cap`: 0 when it is already under. */
export function veilFor(base: number, cap = BRIGHT_CAP): number {
  if (!(base > cap)) return 0
  return clamp((base - cap) / (base - VEIL_LEVEL), 0, VEIL_MAX)
}

/**
 * One frame of the guard. `base` is the picture's measured mean brightness before the veil, `cap` can only be lowered.
 * Dimming is immediate, so the picture never goes over the cap; lifting is slow, so the veil cannot make the screen pump.
 * `out` is the brightness after the veil. A reading that is not a number changes nothing.
 */
export function stepGuard(g: Guard, base: number, dt: number, cap = BRIGHT_CAP): GuardOut {
  const c = clamp(Number.isFinite(cap) ? cap : BRIGHT_CAP, BRIGHT_FLOOR, BRIGHT_CAP)
  if (!Number.isFinite(base)) return { veil: g.veil, out: NaN }
  const want = veilFor(base, c)
  g.veil = Math.max(want, g.veil - clamp(dt, 0, MAX_DT) * VEIL_RELEASE_S)
  return { veil: g.veil, out: base * (1 - g.veil) + VEIL_LEVEL * g.veil }
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
