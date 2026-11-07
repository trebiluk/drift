import assert from "node:assert/strict"
import { test } from "node:test"
import { GLIDER_AT, GLIDER_GAP, GLIDER_HALF, dockTop, gliderY, type Rect } from "./layout.ts"

const box = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom })
// Measured from 2.0.0-v with the steer pad on (Chromium): pad, Speed, hint line, version chip.
const PHONE_412: Rect[] = [box(12, 638, 208, 834), box(285, 680, 400, 851), box(12, 847, 256, 899), box(313, 866, 396, 899)]
const PHONE_360: Rect[] = [box(12, 345, 208, 541), box(233, 405, 348, 576), box(12, 553, 204, 624), box(261, 591, 344, 624)]
const WIDE_1366: Rect[] = [box(12, 509, 208, 705), box(1239, 533, 1354, 704), box(12, 718, 388, 752), box(1267, 719, 1350, 752)]

const size = (w: number, h: number) => Math.max(24, Math.min(w, h) * 0.06)
const hits = (y: number, s: number, cx: number, rects: Rect[]) =>
  rects.some((r) => r.left < cx + s * GLIDER_HALF && r.right > cx - s * GLIDER_HALF && r.top < y + s * 0.6 && r.bottom > y - s * 1.2)

test("with nothing in the way the glider stays where it always was: low in the middle", () => {
  assert.equal(gliderY(768, 768 * 0.46, size(1366, 768), 683, []), 768 * GLIDER_AT)
  assert.equal(gliderY(768, 768 * 0.46, size(1366, 768), 683, WIDE_1366), 768 * GLIDER_AT, "on a laptop the docks are at the edges")
})

test("upright phone: the steer pad reaches over the middle, so the glider sits just above it, never under it", () => {
  for (const [w, h, rects] of [[412, 915, PHONE_412], [360, 640, PHONE_360]] as const) {
    const s = size(w, h)
    const y = gliderY(h, h * 0.46, s, w / 2, rects)
    assert.ok(y < h * GLIDER_AT, `${w}: moved up`)
    assert.equal(hits(y, s, w / 2, [...rects]), false, `${w}: clear of every dock`)
    assert.ok(y - s * 1.2 > h * 0.46 - s, `${w}: still below the horizon line`)
  }
  const s = size(412, 915)
  assert.equal(gliderY(915, 915 * 0.46, s, 206, PHONE_412), 638 - s * 0.6 - GLIDER_GAP, "the tail sits a gap above the pad")
})

test("only docks that reach over the glider's column count; hidden ones (no size) never do", () => {
  assert.equal(dockTop([box(0, 500, 100, 600)], 300, 40), Infinity)
  assert.equal(dockTop([box(0, 500, 270, 600)], 300, 40), 500)
  assert.equal(dockTop([box(0, 0, 0, 0), box(250, 700, 350, 760)], 300, 40), 700)
  assert.equal(dockTop([box(250, 700, 350, 760), box(200, 640, 320, 700)], 300, 40), 640, "the highest one wins")
})

test("never above the horizon line, even if a dock reached halfway up the screen", () => {
  const s = 30
  assert.equal(gliderY(800, 368, s, 200, [box(0, 300, 400, 800)]), 368 + s * 1.3)
})
