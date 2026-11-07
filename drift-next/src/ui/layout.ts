/**
 * Where the glider sits (DRIFT-2-DIRECTION step 6, S7 step 3). The glider is drawn low in the middle of the screen, at 78% of
 * the height. On an upright phone the steer pad and the Speed dock fill the bottom of the screen and reach across the
 * middle, so the glider ended up under the pad. Now the page tells the picture where its bottom docks are, and the glider
 * sits just above whichever of them reach over the middle column: never under a button, never above the horizon line.
 */

export type Rect = { left: number; top: number; right: number; bottom: number }

/** Where the glider sits when nothing is in the way: low in the middle, as before. */
export const GLIDER_AT = 0.78
/** Space kept between the glider's tail and the top of a dock (CSS px). */
export const GLIDER_GAP = 12
/** Half the glider's width, as a share of its size `s` (the wings reach 1.4 s; the white edge adds a little). */
export const GLIDER_HALF = 1.5
/** The glider's tail sits 0.6 s below its centre, its nose 1.2 s above. */
const TAIL = 0.6
/** The highest the glider goes: its centre stays this many `s` below the horizon line, so it never flies over it. */
const FLOOR = 1.3

/**
 * The top of the highest dock that reaches over the column `cx ± half`, or `Infinity` if none does. Docks with no size
 * (hidden ones) are skipped.
 */
export function dockTop(rects: readonly Rect[], cx: number, half: number): number {
  let top = Infinity
  for (const r of rects) {
    if (!(r.right > r.left && r.bottom > r.top)) continue
    if (r.right <= cx - half || r.left >= cx + half) continue
    top = Math.min(top, r.top)
  }
  return top
}

/**
 * The glider's centre on screen (y, CSS px), for a view `h` high whose horizon line is at `cy`, a glider of size `s`, and
 * the docks in `rects` (screen boxes of the steer pad, Speed, the hint line and so on).
 */
export function gliderY(h: number, cy: number, s: number, cx: number, rects: readonly Rect[]): number {
  const want = h * GLIDER_AT
  const top = dockTop(rects, cx, s * GLIDER_HALF + GLIDER_GAP)
  const room = top - s * TAIL - GLIDER_GAP
  return Math.max(cy + s * FLOOR, Math.min(want, room))
}

/** The screen box of an element, or null when it is hidden or has no size. */
export function rectOf(el: Element | null | undefined): Rect | null {
  if (!el || (el as HTMLElement).hidden) return null
  const b = el.getBoundingClientRect()
  if (!(b.width > 0 && b.height > 0)) return null
  return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }
}
