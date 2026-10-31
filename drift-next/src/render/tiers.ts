/** The four quality tiers. Numbers are starting values; S20 tunes them on the real class Chromebook. */
export type Tier = "full" | "balanced" | "light" | "still"
export const TIERS: readonly Tier[] = ["full", "balanced", "light", "still"]

export type TierSpec = {
  renderer: "gl" | "canvas2d"
  scaleMin: number // lowest render scale the governor may use
  scaleMax: number
  aa: boolean
  puffs: number
  fps: number // target
  budgetMs: number // p95 frame time that counts as "keeping up"
}

export const TIER_TABLE: Record<Tier, TierSpec> = {
  full: { renderer: "gl", scaleMin: 1, scaleMax: 1.5, aa: true, puffs: 140, fps: 60, budgetMs: 20 },
  balanced: { renderer: "gl", scaleMin: 0.8, scaleMax: 1, aa: false, puffs: 90, fps: 60, budgetMs: 24 },
  light: { renderer: "gl", scaleMin: 0.75, scaleMax: 1, aa: false, puffs: 48, fps: 30, budgetMs: 38 },
  still: { renderer: "canvas2d", scaleMin: 1, scaleMax: 1, aa: false, puffs: 0, fps: 30, budgetMs: 38 },
}

export const tierIndex = (t: Tier) => TIERS.indexOf(t)
