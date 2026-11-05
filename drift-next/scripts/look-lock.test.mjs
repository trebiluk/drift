import test from "node:test"
import assert from "node:assert/strict"
import { thresholds, verdict, VIEWPORTS, POSES } from "./look-lock.mjs"

const refs = [
  { coverage: 0.30, blobs: 18, shadow: 0.22, bright: 0.60 },
  { coverage: 0.40, blobs: 24, shadow: 0.30, bright: 0.64 },
  { coverage: 0.25, blobs: 15, shadow: 0.26, bright: 0.58 },
]

test("thresholds use the range across the references, never a median", () => {
  const th = thresholds(refs)
  assert.equal(th.blobsMin, 15)
  assert.ok(Math.abs(th.coverageMin - 0.15) < 1e-9 && Math.abs(th.coverageMax - 0.5) < 1e-9)
  assert.equal(th.shadowMin, 0.22)
  assert.equal(th.brightMax, 0.64)
})

test("a picture inside every range passes, and each miss is named", () => {
  const th = thresholds(refs)
  assert.deepEqual(verdict({ coverage: 0.3, blobs: 20, shadow: 0.25, bright: 0.6 }, th), [])
  const f = verdict({ coverage: 0.03, blobs: 4, shadow: 0.02, bright: 0.7 }, th)
  assert.equal(f.length, 4)
  assert.match(f.join(" "), /blobs 4 < 15/)
  assert.match(f.join(" "), /brightness/)
})

test("the design's viewports and two repeatable poses are all covered", () => {
  assert.deepEqual(VIEWPORTS.map((v) => v.name), ["1366x768", "1024x768", "412x915", "915x412"])
  assert.ok(POSES.length >= 2 && POSES.every((p) => p.ms > 0))
})
