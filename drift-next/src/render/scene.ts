import type { Tier } from "./tiers.ts"
import type { Proj, Shad } from "./types.ts"

/**
 * What each quality tier draws, as plain numbers, so a test can hold the tiers to "each one is a real step up".
 * The picture's overall brightness is the same on every tier (the palette sets it); a tier adds detail, not light.
 */
export type Look = {
  floor: 0 | 1 | 2 | 3 // the cloud-sea below: 0 flat gradient, 1 one soft lookup, 2 two scales + relief, 3 three scales + relief
  cloud: 0 | 1 | 2 | 3 // 0 flat disc, 1 soft flat disc, 2 lit three-lobe, 3 lit five-lobe with a wobbly rim and distance haze
  shadows: 0 | 1 | 2 // 0 none, 1 soft round blobs, 2 blobs that squash with distance
}

export const LOOK: Record<Tier, Look> = {
  still: { floor: 0, cloud: 0, shadows: 0 },
  light: { floor: 1, cloud: 1, shadows: 0 },
  balanced: { floor: 2, cloud: 2, shadows: 1 },
  full: { floor: 3, cloud: 3, shadows: 2 },
}

export const lookOf = (t: Tier): Look => LOOK[t]

/** The cloud-sea floor sits at this height. The craft never goes below FLOOR_Y (72) in sim/craft.ts, and the lowest clouds sit at 60. */
export const GROUND_Y = 0
/** How dark a cloud's shadow is at its darkest, as the share of the floor it covers. */
export const SHADOW_ALPHA = 0.2
/** A shadow reaches a little past the cloud that throws it. */
export const SHADOW_SPREAD = 1.15
/** A cloud-sprite quad reaches this many radii from its centre, so the lobes of a bumpy cloud fit inside it. */
export const SPRITE_EXT = 1.45

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** A point rotated about (cx, cy) by `angle`, the way ctx.rotate turns the picture. Writes into `out`. */
export function rotateAbout(out: { x: number; y: number }, x: number, y: number, cx: number, cy: number, angle: number) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const dx = x - cx
  const dy = y - cy
  out.x = cx + c * dx - s * dy
  out.y = cy + s * dx + c * dy
}

/** Each cloud gets its own number between 0 and 1 from its place in the seeded list, so its shape never changes between frames. */
export const seedFor = (i: number) => (i * 0.6180339887498949 + 0.137) % 1

/** How much a cloud this far ahead is veiled by distance, 0 (near) to 1 (far). Only the Fancy tier uses it. */
export const depthFog = (z: number) => smooth(250, 1100, z)

export const SPRITE_FLOATS = 6 // x, y, r, alpha, seed, fog

/**
 * Packs the visible clouds for the GPU, already turned by the bank tilt. Returns how many were written.
 * `out` is reused every frame, so nothing is allocated in the loop.
 */
export function packSprites(out: Float32Array, list: readonly Proj[], cx: number, cy: number, tilt: number): number {
  const n = Math.min(list.length, Math.floor(out.length / SPRITE_FLOATS))
  const c = Math.cos(tilt)
  const s = Math.sin(tilt)
  for (let i = 0; i < n; i++) {
    const q = list[i]
    const dx = q.x - cx
    const dy = q.y - cy
    const o = i * SPRITE_FLOATS
    out[o] = cx + c * dx - s * dy
    out[o + 1] = cy + s * dx + c * dy
    out[o + 2] = q.r
    out[o + 3] = q.a
    out[o + 4] = q.seed
    out[o + 5] = depthFog(q.z)
  }
  return n
}

export const SHADOW_FLOATS = 5 // x, y, rx, ry, alpha

export function packShadows(out: Float32Array, list: readonly Shad[], cx: number, cy: number, tilt: number): number {
  const n = Math.min(list.length, Math.floor(out.length / SHADOW_FLOATS))
  const c = Math.cos(tilt)
  const s = Math.sin(tilt)
  for (let i = 0; i < n; i++) {
    const q = list[i]
    const dx = q.x - cx
    const dy = q.y - cy
    const o = i * SHADOW_FLOATS
    out[o] = cx + c * dx - s * dy
    out[o + 1] = cy + s * dx + c * dy
    out[o + 2] = q.rx
    out[o + 3] = q.ry
    out[o + 4] = q.a
  }
  return n
}

/**
 * Where the shadow of a cloud falls on the cloud-sea floor, on the screen. The sun is straight overhead, so the shadow lies
 * right under the cloud. `dx` and `dz` are the cloud's offset from the craft (already wrapped), `r` its radius, `a` how
 * visible the cloud is (a shadow is never stronger than its cloud). Returns false when the patch is behind you.
 * `mode` 1 is a round blob, `mode` 2 is flattened by how low the floor is seen, so far ones lie flat and near ones are round.
 */
export function shadowInto(out: Shad, dx: number, dz: number, camY: number, r: number, a: number, yaw: number, pitch: number, f: number, cx: number, cy: number, mode: 1 | 2): boolean {
  const dy = GROUND_Y - camY
  const sy = Math.sin(yaw)
  const cyw = Math.cos(yaw)
  const xc = dx * cyw - dz * sy
  const fh = -dx * sy - dz * cyw
  const zc = fh * Math.cos(pitch) + dy * Math.sin(pitch)
  const yc = -fh * Math.sin(pitch) + dy * Math.cos(pitch)
  if (zc < 8) return false
  const rx = Math.min((f * r * SHADOW_SPREAD) / zc, 0.35 * f)
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const squash = mode === 2 ? clamp(Math.abs(dy) / Math.max(dist, 1e-6), 0.1, 1) : 0.5
  out.x = cx + (f * xc) / zc
  out.y = cy - (f * yc) / zc
  out.rx = rx
  out.ry = rx * squash
  out.a = a
  return true
}

/** The floor texture covers this many world units each way and repeats. Its coarsest use stretches it to twice that. */
export const DECK_TILE = 1024
/** The floor pattern repeats exactly every DECK_WRAP, so the craft's position is reduced by it before it reaches the GPU. */
export const DECK_WRAP = DECK_TILE * 2
export const wrapDeck = (v: number) => v - Math.floor(v / DECK_WRAP) * DECK_WRAP

export const DECK_SIZE = 128

/** A small seeded random stream, so the same floor is drawn on every machine. */
function stream(seed: number) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth value noise on a `cells` by `cells` lattice that repeats in both directions. */
function lattice(cells: number, rnd: () => number) {
  const v = new Float32Array(cells * cells)
  for (let i = 0; i < v.length; i++) v[i] = rnd()
  const at = (i: number, j: number) => v[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)]
  return (u: number, w: number) => {
    const x = u * cells
    const y = w * cells
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx
    const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx
    return top + (bot - top) * sy
  }
}

/**
 * The one texture the cloud-sea floor is built from: soft billows that repeat in both directions.
 * Red is the broad billows (4 across), green the middle size (8), blue the fine grain (16). Each channel is centred on grey
 * (128) with the same spread, a fifth of full range, so the shader can add or take away a little light and the average stays put.
 */
export function makeDeckTexture(size = DECK_SIZE, seed = 7): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  const rnd = stream(seed)
  const base = [4, 8, 16]
  for (let ch = 0; ch < 3; ch++) {
    const coarse = lattice(base[ch], rnd)
    const fine = lattice(base[ch] * 2, rnd)
    const raw = new Float32Array(size * size)
    let sum = 0
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const v = coarse(i / size, j / size) * 0.68 + fine(i / size, j / size) * 0.32
        raw[j * size + i] = v
        sum += v
      }
    }
    const mean = sum / raw.length
    let spread = 0
    for (let i = 0; i < raw.length; i++) spread += (raw[i] - mean) * (raw[i] - mean)
    const sd = Math.sqrt(spread / raw.length) || 1
    for (let i = 0; i < raw.length; i++) out[i * 4 + ch] = clamp(Math.round(128 + ((raw[i] - mean) / sd) * 0.2 * 255), 0, 255)
  }
  for (let i = 0; i < size * size; i++) out[i * 4 + 3] = 255
  return out
}
