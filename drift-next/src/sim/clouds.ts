import type { Puff } from "./cloudpass.ts"

export const HOME_Y = 148 // sky home height, same as WORLD_HOME.sky.y
export const EYE_BAND = 40 // "at eye level" = within this far of home height

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Seeded, so a look-lock frame repeats. Below 25%, eye level 45%, above 30%. */
export function buildClouds(seed = 19, n = 60): Puff[] {
  const rng = mulberry32(seed)
  const out: Puff[] = []
  for (let i = 0; i < n; i++) {
    const k = i % 20
    const band = k < 5 ? 0 : k < 14 ? 1 : 2
    const y = band === 0 ? 60 + rng() * 48 : band === 1 ? HOME_Y - EYE_BAND + rng() * 2 * EYE_BAND : 188 + rng() * 112
    const ang = rng() * Math.PI * 2
    const dist = 150 + Math.sqrt(rng()) * 1450
    out.push({ x: Math.cos(ang) * dist, y, z: Math.sin(ang) * dist, r: 18 + Math.pow(rng(), 1.6) * 102 })
  }
  return out
}

export function bandCounts(puffs: readonly Puff[], homeY = HOME_Y) {
  let below = 0
  let eye = 0
  let above = 0
  for (const p of puffs) {
    if (p.y < homeY - EYE_BAND) below++
    else if (p.y > homeY + EYE_BAND) above++
    else eye++
  }
  return { below, eye, above }
}
