export function radialDeadzone(x: number, y: number, dz = 0.16) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

/**
 * Where a pull starts.
 * Mouse, trackpad, finger, and pen all steer from the press point.
 * Idle motion never starts a pull. The caller skips the speed control and buttons.
 */
export function resolvePullOrigin(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  _pointerType: string,
): { x: number; y: number } | null {
  if (width < 1 || height < 1) return null;
  return { x: clientX, y: clientY };
}

/** Pointer steer while a pull is held. Idle position contributes nothing. */
export function steerFromPull(active: boolean, x: number, y: number, mouse: boolean) {
  if (!active) return { yaw: 0, pitch: 0 };
  const pulled = radialDeadzone(x, y, mouse ? 0.12 : 0.08);
  return { yaw: -pulled.x, pitch: pulled.y };
}
