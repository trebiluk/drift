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
  const g = ctx.createRadialGradient(x, y - r * 0.18, r * 0.02, x, y, r);
  g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`);
  g.addColorStop(0.42, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * 0.5})`);
  g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function circleMask(ctx: CanvasRenderingContext2D, ox: number, size: number) {
  const img = ctx.getImageData(ox, 0, size, size);
  const data = img.data;
  const cx = size * 0.5;
  const cy = size * 0.52;
  const rx = size * 0.46;
  const ry = size * 0.4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      let m = 1;
      if (d > 1) m = 0;
      else if (d > 0.55) m = 1 - (d - 0.55) / 0.45;
      m = m * m * (3 - 2 * m);
      data[i + 3] = Math.round(data[i + 3] * m);
      if (data[i + 3] > 0) {
        data[i] = Math.min(255, data[i] + 28);
        data[i + 1] = Math.min(255, data[i + 1] + 26);
        data[i + 2] = Math.min(255, data[i + 2] + 22);
      }
    }
  }
  ctx.putImageData(img, ox, 0);
}

function paintCloud(ctx: CanvasRenderingContext2D, size: number, ox: number, seed: number) {
  const rand = mulberry32(seed);
  const cx = ox + size * 0.5;
  const cy = size * 0.52;

  for (let i = 0; i < 38; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = Math.pow(rand(), 0.55) * size * 0.28;
    const x = cx + Math.cos(ang) * rad * 1.35;
    const y = cy + Math.sin(ang) * rad * 0.62;
    const r = size * (0.08 + rand() * 0.16);
    drawPuff(ctx, x, y, r, [255, 252, 248], 0.42 + rand() * 0.38);
  }
  circleMask(ctx, ox, size);
}

export function createCloudTexture(seed = 21) {
  return createCloudAtlas(seed);
}

export function createCloudAtlas(seed = 21) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size * 2;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

export function createDotTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Thin horizontal streaks for high cirrus. Drawn once. */
export function createCirrusTexture() {
  const w = 512;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  ctx.clearRect(0, 0, w, h);
  const strokes = [
    { y: 28, a: 0.55, width: 7, bow: 10 },
    { y: 46, a: 0.32, width: 4, bow: -6 },
    { y: 62, a: 0.48, width: 5, bow: 8 },
    { y: 84, a: 0.28, width: 9, bow: -4 },
    { y: 102, a: 0.4, width: 3, bow: 6 },
  ];
  for (const s of strokes) {
    const g = ctx.createLinearGradient(0, s.y, w, s.y);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.18, `rgba(255,255,255,${s.a})`);
    g.addColorStop(0.72, `rgba(255,255,255,${s.a * 0.85})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(8, s.y);
    ctx.bezierCurveTo(w * 0.3, s.y + s.bow, w * 0.62, s.y - s.bow, w - 8, s.y + s.bow * 0.3);
    ctx.stroke();
  }
  return canvas;
}

const FIELD_GREENS: Array<[number, number, number]> = [
  [168, 196, 138],
  [120, 168, 112],
  [186, 204, 150],
  [98, 148, 104],
  [154, 176, 132],
];
const FIELD_WHEAT: Array<[number, number, number]> = [
  [214, 196, 132],
  [196, 170, 98],
  [226, 210, 160],
  [176, 154, 96],
];
const TULIPS: Array<[number, number, number]> = [
  [242, 168, 192],
  [214, 96, 112],
  [242, 220, 138],
  [206, 176, 226],
  [246, 244, 242],
];

/** One repeating tile of patchwork fields and a few tulip rows. */
export function createFieldTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  const rng = mulberry32(19);
  const cols = 8;
  const rows = 8;
  const edges = (n: number) => {
    const raw = [0];
    for (let i = 0; i < n; i++) raw.push(raw[i] + 0.72 + rng() * 0.56);
    const last = raw[raw.length - 1];
    return raw.map((v) => (v / last) * size);
  };
  const xs = edges(cols);
  const ys = edges(rows);
  ctx.fillStyle = "#6e9a68";
  ctx.fillRect(0, 0, size, size);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = xs[i];
      const y0 = ys[j];
      const x1 = xs[i + 1];
      const y1 = ys[j + 1];
      const tulip = rng() < 0.2;
      const wheat = !tulip && rng() < 0.34;
      const base = (wheat ? FIELD_WHEAT : FIELD_GREENS)[Math.floor(rng() * (wheat ? FIELD_WHEAT.length : FIELD_GREENS.length))];
      ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (tulip) {
        const horizontal = rng() < 0.5;
        const stripe = 5 + Math.floor(rng() * 3);
        const color = TULIPS[Math.floor(rng() * TULIPS.length)];
        ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
        if (horizontal) {
          for (let y = y0 + 3; y < y1 - 2; y += stripe) ctx.fillRect(x0 + 2, y, x1 - x0 - 4, 2);
        } else {
          for (let x = x0 + 3; x < x1 - 2; x += stripe) ctx.fillRect(x, y0 + 2, 2, y1 - y0 - 4);
        }
      }
    }
  }
  ctx.strokeStyle = "rgba(48, 78, 46, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= cols; i++) {
    ctx.moveTo(xs[i], 0);
    ctx.lineTo(xs[i], size);
  }
  for (let j = 0; j <= rows; j++) {
    ctx.moveTo(0, ys[j]);
    ctx.lineTo(size, ys[j]);
  }
  ctx.stroke();
  return canvas;
}

type ShadowPuff = { x: number; z: number; s: number };

/** One wrap tile of soft cloud shadows. Repeats with the puff wrap. */
export function createCloudShadowTexture(puffs: ShadowPuff[], span: number) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";
  const tile = (v: number) => {
    let x = v % span;
    if (x < 0) x += span;
    return (x / span) * size;
  };
  for (const p of puffs) {
    const px = tile(p.x);
    const py = tile(p.z);
    const r = Math.max(6, ((p.s * 0.72) / span) * size);
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const x = px + ox;
        const y = py + oy;
        if (x < -r || y < -r || x > size + r || y > size + r) continue;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.45, "rgba(255,255,255,0.45)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return canvas;
}

