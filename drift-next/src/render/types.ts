import type { Tier } from "./tiers.ts"

/** A cloud, projected onto the screen. `z` is how far ahead it is, `seed` (0..1) gives each cloud its own shape. */
export type Proj = { x: number; y: number; r: number; a: number; z: number; seed: number }

/** The patch of shade a cloud throws on the cloud-sea floor, already on the screen. */
export type Shad = { x: number; y: number; rx: number; ry: number; a: number }

/** Everything a world renderer needs to draw one picture. Sizes are in CSS pixels. */
export type WorldFrame = {
  w: number
  h: number
  f: number // focal length
  cx: number
  cy: number
  horizon: number // screen y of the horizon before the bank tilt
  tilt: number // the bank turn given to the horizon, as ctx.rotate takes it
  tier: Tier
  shade: boolean // the 2D drawer shades cloud undersides only on the heavier tiers
  puffs: readonly Proj[] // far to near, only the ones in view
  shadows: readonly Shad[] // one per cloud in `puffs`, same order; empty when the tier draws none
  haze: number // 0 clear .. 1 inside a cloud
  hazeLevel: number // brightness of the haze, 0..1
  pose: { x: number; y: number; z: number; yaw: number; pitch: number }
}

/** What the picture is drawn with, so the readout and the tests can say which path is live. */
export type DrawPath = "gl" | "canvas2d"
