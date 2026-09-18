export const BASE_SPEED = 24;
export const MIN_SPEED = 8;
export const MAX_SPEED = 64;
export const YAW_RATE = 0.95;
export const PITCH_RATE = 0.72;
export const FLOOR_Y = 72;
export const CEILING_Y = 2300;
export const DEFAULT_CRUISE = 0.32;

export type Actions = {
  /** +1 = player-visible left (A / stick left / pointer left) */
  yaw: number;
  /** +1 = nose up / climb */
  pitch: number;
  /** +1 = temporary burst toward max */
  throttle: number;
  /** 0 = crawl, 1 = rush */
  cruise: number;
};

export type Craft = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
};

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function cruiseSpeed(cruise: number) {
  return MIN_SPEED + clamp(cruise, 0, 1) * (MAX_SPEED - MIN_SPEED);
}

/** yaw = 0 faces world −Z; +yaw is CCW about +Y (nose toward −X). */
export function createCraft(): Craft {
  const sunX = 1.15;
  const sunZ = 0.42;
  return {
    x: 0,
    y: 268,
    z: 0,
    yaw: Math.atan2(-sunX, -sunZ),
    pitch: -0.16,
    roll: 0,
    speed: cruiseSpeed(DEFAULT_CRUISE),
  };
}

export function stepCraft(c: Craft, a: Actions, dt: number) {
  c.yaw += a.yaw * YAW_RATE * dt;
  c.pitch += a.pitch * PITCH_RATE * dt;
  c.pitch = clamp(c.pitch, -1.18, 1.28);

  // A (+yaw) banks left: negative camera Z with YXZ order.
  const targetRoll = -a.yaw * 0.4;
  c.roll += (targetRoll - c.roll) * Math.min(1, dt * 3.2);

  const base = cruiseSpeed(a.cruise);
  const burst = a.throttle * (MAX_SPEED - base) * 0.7;
  const dive = Math.max(-c.pitch, 0) * 7 - Math.max(c.pitch, 0) * 2.2;
  const targetSpeed = clamp(base + burst + dive, MIN_SPEED, MAX_SPEED + 10);
  c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 2.4);

  const cp = Math.cos(c.pitch);
  const sp = Math.sin(c.pitch);
  const sy = Math.sin(c.yaw);
  const cy = Math.cos(c.yaw);
  const fx = -sy * cp;
  const fy = sp;
  const fz = -cy * cp;

  c.x += fx * c.speed * dt;
  c.y += fy * c.speed * dt;
  c.z += fz * c.speed * dt;

  if (c.y < FLOOR_Y) {
    c.y += (FLOOR_Y - c.y) * Math.min(1, dt * 1.4);
    if (c.pitch < 0.08) c.pitch += dt * 0.18;
  }
  if (c.y > CEILING_Y) {
    c.y += (CEILING_Y - c.y) * Math.min(1, dt * 0.35);
    if (c.pitch > 0) c.pitch -= dt * 0.1;
  }
}

export function spaceFactor(y: number) {
  return clamp((y - 780) / 900, 0, 1);
}

export function layerName(y: number) {
  if (y > 1450) return "Open space";
  if (y > 920) return "The stratosphere";
  if (y > 240) return "Above the clouds";
  if (y > 90) return "Among the clouds";
  return "Inside the clouds";
}

export function cloudImmersion(y: number) {
  const low = 1 - clamp((y - 18) / 90, 0, 1);
  const band = Math.exp(-((y - 110) * (y - 110)) / (2 * 70 * 70));
  return clamp(low * 0.85 + band * 0.35, 0, 1);
}
