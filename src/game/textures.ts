function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPuff(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: [number, number, number],
  alpha: number,
) {
  const g = ctx.createRadialGradient(x, y - r * 0.2, r * 0.03, x, y, r);
  g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`);
  g.addColorStop(0.36, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * 0.58})`);
  g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function paintCloud(ctx: CanvasRenderingContext2D, size: number, ox: number, seed: number) {
  const rand = mulberry32(seed);
  const cx = ox + size * 0.5;
  const cy = size * 0.55;

  for (let i = 0; i < 62; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = Math.pow(rand(), 0.6) * size * 0.32;
    const x = cx + Math.cos(ang) * rad * 1.38;
    const y = cy + Math.sin(ang) * rad * 0.66;
    const r = size * (0.07 + rand() * 0.18);
    const height = (cy - y) / size;
    const warmth = Math.max(0, 0.4 + height * 1.2 + rand() * 0.12);
    const cr = Math.round(148 + warmth * 107);
    const cg = Math.round(156 + warmth * 96);
    const cb = Math.round(170 + warmth * 80);
    drawPuff(ctx, x, y, r, [cr, cg, cb], 0.26 + rand() * 0.3);
  }

  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  const mask = ctx.createRadialGradient(cx, cy - size * 0.05, size * 0.05, cx, cy, size * 0.48);
  mask.addColorStop(0, "rgba(255,255,255,1)");
  mask.addColorStop(0.52, "rgba(255,255,255,0.94)");
  mask.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = mask;
  ctx.fillRect(ox, 0, size, size);
  ctx.restore();
}

export function createCloudTexture(seed = 21) {
  return createCloudAtlas(seed);
}

export function createCloudAtlas(seed = 21) {
  const size = 640;
  const canvas = document.createElement("canvas");
  canvas.width = size * 2;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paintCloud(ctx, size, 0, seed);
  paintCloud(ctx, size, size, seed + 17);
  return canvas;
}

export function createGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,251,240,1)");
  g.addColorStop(0.08, "rgba(255,238,186,0.96)");
  g.addColorStop(0.26, "rgba(255,210,120,0.42)");
  g.addColorStop(0.52, "rgba(180,210,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createRayTexture() {
  const w = 64;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  const g = ctx.createLinearGradient(w / 2, 0, w / 2, h);
  g.addColorStop(0, "rgba(255,244,210,0.6)");
  g.addColorStop(0.35, "rgba(255,230,170,0.14)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "destination-in";
  const fade = ctx.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.5, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}
