import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePullOrigin, steerFromPull } from "./pull.ts";

test("desk mouse away from the craft does not start a pull", () => {
  assert.equal(resolvePullOrigin(24, 24, 1280, 720, "mouse"), null);
});

test("desk mouse on the center craft grabs that point", () => {
  assert.deepEqual(resolvePullOrigin(640, 360, 1280, 720, "mouse"), { x: 640, y: 360 });
});

test("desk mouse near the craft still grabs", () => {
  // radius = max(100, min(1280, 720) * 0.2) = 144
  assert.deepEqual(resolvePullOrigin(640 + 140, 360, 1280, 720, "mouse"), { x: 780, y: 360 });
});

test("desk mouse just outside the craft does not grab", () => {
  assert.equal(resolvePullOrigin(640 + 170, 360, 1280, 720, "mouse"), null);
});

test("touch keeps an origin at the finger, on or off the craft", () => {
  assert.deepEqual(resolvePullOrigin(40, 500, 390, 844, "touch"), { x: 40, y: 500 });
  assert.deepEqual(resolvePullOrigin(195, 422, 390, 844, "touch"), { x: 195, y: 422 });
});

test("idle mouse position does not steer", () => {
  const idle = steerFromPull(false, 0.9, -0.8, true);
  assert.deepEqual(idle, { yaw: 0, pitch: 0 });
});

test("a held pull steers, and releasing it returns steer to zero", () => {
  const pulling = steerFromPull(true, 1, 0.4, true);
  assert.ok(pulling.yaw < -0.5, `expected a rightward yaw, got ${pulling.yaw}`);
  assert.ok(pulling.pitch > 0.2, `expected climb, got ${pulling.pitch}`);
  assert.deepEqual(steerFromPull(false, 1, 0.4, true), { yaw: 0, pitch: 0 });
});
