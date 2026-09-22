import { clamp, type Actions } from "./flight";
import { radialDeadzone, resolvePullOrigin, steerFromPull } from "./pull";
import { runtime } from "./runtime";

const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
  "Equal",
  "Minus",
  "NumpadAdd",
  "NumpadSubtract",
  "KeyQ",
  "KeyE",
]);

function inTouchChrome(e: PointerEvent) {
  if (!runtime.mobile) return false;
  const w = window.innerWidth;
  if (runtime.fx.throttle && e.clientX > w - 92) return true;
  if (e.clientY < 88 && e.clientX > w - 88) return true;
  return false;
}

function setStickFromEvent(e: PointerEvent) {
  const span = Math.max(56, Math.min(window.innerWidth, window.innerHeight) * 0.2);
  const dx = (e.clientX - runtime.stick.originX) / span;
  const dy = (runtime.stick.originY - e.clientY) / span;
  runtime.stick.x = clamp(dx, -1, 1);
  runtime.stick.y = clamp(dy, -1, 1);
  runtime.pointer.nx = runtime.stick.x;
  runtime.pointer.ny = runtime.stick.y;
  runtime.pointer.ready = true;
  runtime.pointer.active = true;
}

function releasePull(pointerId: number) {
  if (runtime.stick.pointerId !== pointerId) return;
  runtime.stick.active = false;
  runtime.stick.pointerId = null;
  runtime.stick.x = 0;
  runtime.stick.y = 0;
  runtime.pointer.active = false;
  runtime.pointer.ready = false;
  runtime.pointer.nx = 0;
  runtime.pointer.ny = 0;
}

function onKeyDown(e: KeyboardEvent) {
  if (runtime.uiCapture) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    return;
  }
  runtime.keys.add(e.code);
  if (GAME_KEYS.has(e.code)) e.preventDefault();
}

function onKeyUp(e: KeyboardEvent) {
  runtime.keys.delete(e.code);
}

function onBlur() {
  runtime.keys.clear();
  runtime.pointer.active = false;
  runtime.pointer.ready = false;
  runtime.pointer.nx = 0;
  runtime.pointer.ny = 0;
  runtime.uiCapture = false;
  runtime.uiPointers.clear();
  runtime.stick.active = false;
  runtime.stick.pointerId = null;
  runtime.stick.x = 0;
  runtime.stick.y = 0;
}

function onPointerMove(e: PointerEvent) {
  if (runtime.uiPointers.has(e.pointerId)) return;
  if (e.pointerType === "mouse" && runtime.uiCapture) return;
  if (e.pointerType === "mouse" && runtime.stick.pointerId === e.pointerId && e.buttons === 0) {
    releasePull(e.pointerId);
    return;
  }
  if (runtime.stick.pointerId === e.pointerId && runtime.stick.active) {
    setStickFromEvent(e);
  }
}

function onPointerDown(e: PointerEvent) {
  if (runtime.uiPointers.has(e.pointerId) || runtime.uiCapture) return;
  if (!runtime.playing) return;
  if (e.pointerType !== "mouse" && inTouchChrome(e)) return;
  if (runtime.stick.pointerId != null) return;
  const origin = resolvePullOrigin(
    e.clientX,
    e.clientY,
    window.innerWidth,
    window.innerHeight,
    e.pointerType,
  );
  if (!origin) return;
  runtime.stick.pointerId = e.pointerId;
  runtime.stick.originX = origin.x;
  runtime.stick.originY = origin.y;
  runtime.stick.active = true;
  runtime.stick.x = 0;
  runtime.stick.y = 0;
  runtime.pointer.isMouse = e.pointerType === "mouse";
  setStickFromEvent(e);
  const target = e.target;
  if (target instanceof Element) {
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* the canvas may already own the pointer */
    }
  }
}

function onPointerUp(e: PointerEvent) {
  runtime.uiPointers.delete(e.pointerId);
  if (runtime.uiPointers.size === 0) runtime.uiCapture = false;
  releasePull(e.pointerId);
}

function onWheel(e: WheelEvent) {
  if (!runtime.playing || runtime.uiCapture || runtime.mobile) return;
  e.preventDefault();
  const step = clamp(e.deltaY * 0.0012, -0.08, 0.08);
  runtime.cruise = clamp(runtime.cruise - step, 0, 1);
}

export function captureUiPointer(id: number) {
  runtime.uiPointers.add(id);
  runtime.uiCapture = true;
}

export function releaseUiPointer(id: number) {
  runtime.uiPointers.delete(id);
  if (runtime.uiPointers.size === 0) runtime.uiCapture = false;
}

export function attachInput() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onBlur);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("wheel", onWheel, { passive: false });
}

export function detachInput() {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", onBlur);
  document.removeEventListener("visibilitychange", onBlur);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
  window.removeEventListener("wheel", onWheel);
}

export function sampleActions(): Actions {
  const keys = runtime.injectedKeys ? new Set(runtime.injectedKeys) : runtime.keys;

  let yaw = 0;
  let pitch = 0;
  let throttle = 0;

  if (keys.has("KeyA") || keys.has("ArrowLeft")) yaw += 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) yaw -= 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) pitch += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) pitch -= 1;
  if (keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("Space")) throttle += 1;

  // Steer only while a pull is held. Idle mouse position never contributes.
  if (runtime.playing) {
    const pulled = steerFromPull(
      runtime.stick.active,
      runtime.stick.x,
      runtime.stick.y,
      runtime.pointer.isMouse,
    );
    yaw += pulled.yaw;
    pitch += pulled.pitch;
  }

  if (typeof navigator !== "undefined" && navigator.getGamepads) {
    const pads = navigator.getGamepads();
    for (const gp of pads) {
      if (!gp) continue;
      const lx = gp.axes[0] ?? 0;
      const ly = gp.axes[1] ?? 0;
      const stick = radialDeadzone(lx, ly);
      yaw += -stick.x;
      pitch += -stick.y;
      const triggers = (gp.buttons[7]?.value ?? 0) - (gp.buttons[6]?.value ?? 0);
      throttle += triggers;
    }
  }

  if (runtime.steerOverride != null) yaw = runtime.steerOverride;

  return {
    yaw: clamp(yaw, -1, 1),
    pitch: clamp(pitch, -1, 1),
    throttle: clamp(throttle, -1, 1),
    cruise: runtime.cruise,
  };
}
