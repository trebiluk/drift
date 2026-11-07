/**
 * The brightness bridge. When the picture changes how it is drawn (WebGL gives way to Canvas 2D after a lost context, or the
 * other way round), the two pictures are never exactly as bright: the lit floor and clouds of WebGL and the flat 2D version
 * differ by a few points either way, depending on where the craft is. Left alone that is a one-frame jump.
 *
 * So the new picture is matched to the old one at the moment of the change, and the difference then closes slowly, at no
 * more than BRIDGE_RATE a second. The match is a thin flat cover over the picture: a dark veil when the new picture is
 * brighter, a soft off-white haze (never white) when it is darker. Pure numbers; the demo does the painting.
 */

export const BRIDGE_RATE = 0.01 // the gap closes by at most 1 point of brightness per second
export const BRIDGE_MAX = 0.08 // the biggest gap it will hide; anything past that is not a sensible reading
export const BRIDGE_ALPHA_MAX = 0.3 // the cover is never thicker than this

export type Bridge = {
  /** How much brighter the old picture was than the new one (0 to 1 scale). Positive: the new picture is darker. */
  gap: number
}

export type Cover = {
  /** Draw a dark veil (the new picture is brighter) or a light haze (it is darker). */
  light: boolean
  alpha: number
}

export const createBridge = (): Bridge => ({ gap: 0 })

const finite = (v: number | null): v is number => v !== null && Number.isFinite(v)

/** Called when the picture changes: the old picture's brightness and the new one's. A missing or bad reading changes nothing. */
export function bridgeSet(b: Bridge, before: number | null, after: number | null): void {
  if (!finite(before) || !finite(after)) {
    b.gap = 0
    return
  }
  const g = before - after
  b.gap = g > BRIDGE_MAX ? BRIDGE_MAX : g < -BRIDGE_MAX ? -BRIDGE_MAX : g
}

/**
 * The picture is changing while an earlier bridge is still closing. What the player was seeing is the old picture's brightness
 * plus whatever gap was still being hidden, so the new bridge starts from that, not from the bare reading.
 */
export function bridgeSwitch(b: Bridge, meanBefore: number | null, after: number | null): void {
  bridgeSet(b, finite(meanBefore) ? meanBefore + b.gap : null, after)
}

/**
 * The picture itself changed in one step while the same drawer kept drawing it (a tier step added or removed clouds). `delta` is
 * the old picture's brightness minus the new one's, measured both ways on the same frame, so the shown brightness stays put.
 * It adds to a gap that is still closing, and is cut to BRIDGE_MAX like any other.
 */
export function bridgeAdd(b: Bridge, delta: number): void {
  if (!Number.isFinite(delta)) return
  const g = b.gap + delta
  b.gap = g > BRIDGE_MAX ? BRIDGE_MAX : g < -BRIDGE_MAX ? -BRIDGE_MAX : g
}

/** Lets the gap close. Never overshoots, never moves away from zero, and a bad `dt` does nothing. */
export function bridgeStep(b: Bridge, dt: number): void {
  if (!(dt > 0) || !Number.isFinite(dt) || b.gap === 0) return
  const move = BRIDGE_RATE * Math.min(dt, 0.25)
  b.gap = b.gap > 0 ? Math.max(0, b.gap - move) : Math.min(0, b.gap + move)
}

/**
 * The cover that makes a picture with mean brightness `mean` read `gap` brighter than it really is.
 * `dark` and `lightLevel` are the brightness of the veil colour and of the haze colour.
 */
export function bridgeCover(b: Bridge, mean: number, dark: number, lightLevel: number): Cover {
  if (Math.abs(b.gap) < 0.0005 || !Number.isFinite(mean)) return { light: false, alpha: 0 }
  if (b.gap > 0) {
    const room = lightLevel - mean
    return { light: true, alpha: room > 0.05 ? Math.min(BRIDGE_ALPHA_MAX, b.gap / room) : 0 }
  }
  const room = mean - dark
  return { light: false, alpha: room > 0.05 ? Math.min(BRIDGE_ALPHA_MAX, -b.gap / room) : 0 }
}
