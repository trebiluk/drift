import { BODY_ALPHA, CLOUD_BODY, CLOUD_SHADE, SEA_FAR, SEA_HORIZON, SHADE_ALPHA, SKY_HORIZON, SKY_TOP, css, hazeRgb } from "./palette.ts"
import type { WorldFrame } from "./types.ts"

const BODY = css(CLOUD_BODY)
const SHADE = css(CLOUD_SHADE)
const SKY_TOP_CSS = css(SKY_TOP)
const SKY_HORIZON_CSS = css(SKY_HORIZON)
const SEA_HORIZON_CSS = css(SEA_HORIZON)
const SEA_FAR_CSS = css(SEA_FAR)

/**
 * The world on a Canvas 2D context: sky, a flat sea, flat cloud discs, and the haze inside a cloud.
 * This is the `still` tier, the floor every browser can draw, and the fallback if WebGL fails.
 * The brightness meter also paints it small. It draws no veil, pull marker or glider.
 */
export function paintWorld2d(g: CanvasRenderingContext2D, v: WorldFrame) {
  const big = Math.hypot(v.w, v.h)
  g.save()
  g.translate(v.cx, v.cy)
  g.rotate(v.tilt)
  g.translate(-v.cx, -v.cy)
  const sky = g.createLinearGradient(0, v.horizon - v.h, 0, v.horizon)
  sky.addColorStop(0, SKY_TOP_CSS)
  sky.addColorStop(1, SKY_HORIZON_CSS)
  g.fillStyle = sky
  g.fillRect(-big, v.horizon - big * 2, v.w + big * 2, big * 2)
  const sea = g.createLinearGradient(0, v.horizon, 0, v.horizon + v.h)
  sea.addColorStop(0, SEA_HORIZON_CSS)
  sea.addColorStop(1, SEA_FAR_CSS)
  g.fillStyle = sea
  g.fillRect(-big, v.horizon, v.w + big * 2, big * 2)

  for (const q of v.puffs) {
    if (v.shade) {
      g.globalAlpha = q.a * SHADE_ALPHA
      g.fillStyle = SHADE
      g.beginPath()
      g.arc(q.x, q.y + q.r * 0.2, q.r, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = q.a * BODY_ALPHA
    g.fillStyle = BODY
    g.beginPath()
    g.arc(q.x, q.y, q.r * 0.92, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()

  // Inside a cloud the whole picture fades to a soft tinted haze and back. It is drawn under the glider and the pull marker.
  if (v.haze > 0.002) {
    g.globalAlpha = v.haze
    g.fillStyle = css(hazeRgb(v.hazeLevel))
    g.fillRect(0, 0, v.w, v.h)
  }
  g.globalAlpha = 1
}
