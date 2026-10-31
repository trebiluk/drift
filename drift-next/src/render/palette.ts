/**
 * The demo's colors, written down so a test can hold them to Diego's limits.
 * "Brightness" everywhere in Drift means the sRGB-coded value weighted 0.2126 / 0.7152 / 0.0722, 0 to 1.
 * The Chromium checks measure the same thing on the real picture.
 */
export type RGB = readonly [number, number, number]

export const luma = (c: RGB) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
export const css = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`

// Deep blue overhead, a little paler at the horizon, no pale band under it.
export const SKY_TOP: RGB = [36, 88, 152]
export const SKY_HORIZON: RGB = [104, 160, 210]
export const SEA_HORIZON: RGB = [92, 146, 198]
export const SEA_FAR: RGB = [56, 100, 152]

/** Off-white, never pure white: no channel passes 236 and the brightness stays under 0.86. */
export const CLOUD_BODY: RGB = [208, 220, 236]
/** The soft blue-grey underside that gives a puff its volume. */
export const CLOUD_SHADE: RGB = [100, 126, 166]
export const BODY_ALPHA = 0.9
export const SHADE_ALPHA = 0.5

/** Cool, luma-neutral: multiplying a level by this keeps the level's brightness and adds a blue-grey tint. */
export const HAZE_TINT: readonly [number, number, number] = [0.942, 1.005, 1.11]

/** The haze color for a brightness `level` (0..1). Soft and cool, never white. */
export function hazeRgb(level: number): RGB {
  const v = Math.max(0, Math.min(1, level))
  const ch = (k: number) => Math.max(0, Math.min(255, Math.round(255 * v * HAZE_TINT[k])))
  return [ch(0), ch(1), ch(2)]
}
