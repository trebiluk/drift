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

/** Combed high cirrus. One soft band per tile, slow lengthwise variation, no gaps. */
export function createCirrusTexture() {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2d context");
  const img = ctx.createImageData(w, h);
  const px = img.data;
  const fade = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  };
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const band = Math.exp(-(((v - 0.5) / 0.4) ** 2));
    const fadeV = fade(v / 0.22) * fade((1 - v) / 0.22);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const fadeU = fade(u / 0.18) * fade((1 - u) / 0.18);
      const fiber = 0.9 + 0.1 * Math.sin(u * Math.PI * 2 * 0.85 + 0.4);
      let a = band * fadeU * fadeV * fiber;
      if (a < 0) a = 0;
      if (a > 1) a = 1;
      const i = (y * w + x) * 4;
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
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

/** One seamless tile of fields. Edges match so the repeat has no seam.
 *  Hedge lines and darker field borders are part of the tile. */
export function createFieldTexture() {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2d context");
  const img = ctx.createImageData(size, size);
  const px = img.data;
  const cols = 8;
  const rows = 8;
  const rng = mulberry32(19);
  const cells: Array<{ r: number; g: number; b: number; kind: number; stripe: number }> = [];
  for (let n = 0; n < cols * rows; n++) {
    const wheat = rng() < 0.3;
    const tulip = !wheat && rng() < 0.14;
    const pal = wheat ? FIELD_WHEAT : FIELD_GREENS;
    const base = pal[Math.floor(rng() * pal.length)];
    const tint = tulip ? TULIPS[Math.floor(rng() * TULIPS.length)] : base;
    cells.push({
      r: tulip ? Math.round(base[0] * 0.55 + tint[0] * 0.45) : base[0],
      g: tulip ? Math.round(base[1] * 0.55 + tint[1] * 0.45) : base[1],
      b: tulip ? Math.round(base[2] * 0.55 + tint[2] * 0.45) : base[2],
      kind: tulip ? 2 : wheat ? 1 : 0,
      stripe: 5 + Math.floor(rng() * 4),
    });
  }
  const hashN = (ix: number, iy: number, periodX: number, periodY: number) => {
    const a = ((ix % periodX) + periodX) % periodX;
    const b = ((iy % periodY) + periodY) % periodY;
    let h = Math.imul(a + 1, 374761393) ^ Math.imul(b + 1, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const wrapNoise = (u: number, v: number, periodX: number, periodY: number) => {
    const x0 = Math.floor(u);
    const y0 = Math.floor(v);
    const fx = u - x0;
    const fy = v - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hashN(x0, y0, periodX, periodY);
    const b = hashN(x0 + 1, y0, periodX, periodY);
    const c = hashN(x0, y0 + 1, periodX, periodY);
    const d = hashN(x0 + 1, y0 + 1, periodX, periodY);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n1 = wrapNoise(u * 2, v * 2, 2, 2);
      const n2 = wrapNoise(u * 2 + 5.2, v * 2 + 1.7, 2, 2);
      const wu = u * cols + (n1 - 0.5) * 0.55;
      const wv = v * rows + (n2 - 0.5) * 0.55;
      let i = Math.floor(wu);
      let j = Math.floor(wv);
      const fu = wu - i;
      const fv = wv - j;
      i = ((i % cols) + cols) % cols;
      j = ((j % rows) + rows) % rows;
      const cell = cells[j * cols + i];
      const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
      let r = cell.r;
      let g = cell.g;
      let b = cell.b;
      const grain = wrapNoise(u * 24, v * 24, 24, 24);
      const lift = (grain - 0.5) * 16;
      r += lift;
      g += lift * 1.04;
      b += lift * 0.65;
      if (cell.kind === 1 && Math.floor(x / cell.stripe) % 2 === 0) {
        r += 12;
        g += 8;
        b -= 6;
      } else if (cell.kind === 2 && Math.floor((x + y * 0.35) / (cell.stripe + 2)) % 2 === 0) {
        r = r * 0.62 + 78;
        g = g * 0.62 + 46;
        b = b * 0.7 + 58;
      }
      if (edge < 0.09) {
        const t = 1 - edge / 0.09;
        const k = 1 - t * 0.34;
        r *= k;
        g *= k;
        b *= k;
      }
      if (edge < 0.016) {
        r = 36;
        g = 58;
        b = 34;
      }
      const o = (y * size + x) * 4;
      px[o] = clampByte(r);
      px[o + 1] = clampByte(g);
      px[o + 2] = clampByte(b);
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export type ShadowBlob = { x: number; z: number; rx: number; rz: number; rot: number };

function blurWrapMask(ctx: CanvasRenderingContext2D, size: number, radius: number) {
  const img = ctx.getImageData(0, 0, size, size);
  const src = new Float32Array(size * size);
  const data = img.data;
  for (let i = 0; i < src.length; i++) src[i] = data[i * 4] / 255;
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  const n = radius * 2 + 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = (x + k + size) % size;
        sum += src[y * size + xx];
      }
      tmp[y * size + x] = sum / n;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = (y + k + size) % size;
        sum += tmp[yy * size + x];
      }
      dst[y * size + x] = sum / n;
    }
  }
  for (let i = 0; i < dst.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(dst[i] * 255)));
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** One wrap tile of soft cloud-shaped shadows. Repeats with the puff wrap. */
export function createCloudShadowTexture(blobs: ShadowBlob[], span: number) {
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
  for (const blob of blobs) {
    const px = tile(blob.x);
    const py = tile(blob.z);
    const rxp = Math.max(8, (blob.rx / span) * size);
    const rzp = Math.max(8, (blob.rz / span) * size);
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const x = px + ox;
        const y = py + oy;
        if (x < -rxp || y < -rzp || x > size + rxp || y > size + rzp) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(blob.rot);
        ctx.scale(rxp, rzp);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, "rgba(255,255,255,0.85)");
        g.addColorStop(0.6, "rgba(255,255,255,0.45)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
  blurWrapMask(ctx, size, 6);
  return canvas;
}

