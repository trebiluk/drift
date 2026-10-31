/**
 * The brightness meter. It paints the same picture the player sees onto a tiny hidden canvas and reads back its mean
 * brightness, so the guard (sim/cloudpass.ts) can act on what really reaches the screen instead of on a model of it.
 * Painting small keeps it cheap: a few hundred pixels to read back, not a whole screen.
 * Brightness is the same measure as everywhere else in Drift (render/palette.ts): sRGB-coded, weighted 0.2126 / 0.7152 / 0.0722.
 */

/** About this many pixels, in the screen's shape. */
const METER_PIXELS = 768
/** How often the picture is measured. The sim cannot move the picture's brightness by half a percent in this time. */
export const METER_EVERY_MS = 100

/** Mean brightness, 0..1, of RGBA pixel data. An empty image reads 0. */
export function meanLuma(data: ArrayLike<number>): number {
  const n = Math.floor(data.length / 4)
  if (n === 0) return 0
  let sum = 0
  for (let i = 0; i < n * 4; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  return sum / (255 * n)
}

/** The size of the small canvas for a screen of `w` by `h`: the same shape, about METER_PIXELS pixels. */
export function meterSize(w: number, h: number): { mw: number; mh: number } {
  const aspect = w > 0 && h > 0 ? w / h : 16 / 9
  const mw = Math.max(8, Math.round(Math.sqrt(METER_PIXELS * aspect)))
  const mh = Math.max(8, Math.round(METER_PIXELS / mw))
  return { mw, mh }
}

export type Meter = {
  /** Paints with `paint` onto the small canvas (in the screen's own coordinates) and returns its mean brightness, or null if it cannot be read. */
  measure: (paint: (g: CanvasRenderingContext2D) => void, w: number, h: number) => number | null
}

/** null when this browser cannot read a canvas back; the caller then falls back to the model of the picture. */
export function createMeter(doc: Document): Meter | null {
  let g: CanvasRenderingContext2D | null = null
  let canvas: HTMLCanvasElement | null = null
  try {
    canvas = doc.createElement("canvas")
    g = canvas.getContext("2d", { willReadFrequently: true })
  } catch {
    return null
  }
  if (!g || !canvas) return null
  const small = canvas
  const ctx = g
  let broken = false
  return {
    measure(paint, w, h) {
      if (broken) return null
      try {
        const { mw, mh } = meterSize(w, h)
        if (small.width !== mw || small.height !== mh) {
          small.width = mw
          small.height = mh
        }
        ctx.setTransform(mw / w, 0, 0, mh / h, 0, 0)
        paint(ctx)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        return meanLuma(ctx.getImageData(0, 0, mw, mh).data)
      } catch {
        broken = true
        return null
      }
    },
  }
}
