export function radialDeadzone(x: number, y: number, dz = 0.16) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

/**
 * Where a pull starts.
 * Mouse only grabs on or near the center craft — idle motion elsewhere is ignored.
 * Touch keeps an origin-relative stick at the finger. A touch on the craft uses
 * that same point, so it feels like pulling the craft.
 */
export function resolvePullOrigin(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  pointerType: string,
): { x: number; y: number } | null {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const radius = Math.max(100, Math.min(w, h) * 0.2);
  const nearCraft = Math.hypot(clientX - cx, clientY - cy) <= radius;
  if (pointerType === "mouse" && !nearCraft) return null;
  return { x: clientX, y: clientY };
}

/** Pointer steer while a pull is held. Idle position contributes nothing. */
export function steerFromPull(active: boolean, x: number, y: number, mouse: boolean) {
  if (!active) return { yaw: 0, pitch: 0 };
  const pulled = radialDeadzone(x, y, mouse ? 0.12 : 0.08);
  return { yaw: -pulled.x, pitch: pulled.y };
}
