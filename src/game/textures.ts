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

/** Seamless farmland. Uneven strips and blocks, curved by a periodic warp,
 *  crop rows, hedges, one road and one creek. The tile edges match. */
export function createFieldTexture() {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2d context");
  const img = ctx.createImageData(size, size);
  const px = img.data;
  type Plot = { x: number; y: number; w: number; h: number; r: number; g: number; b: number; k: number; m: number };
  const greens: Array<[number, number, number]> = [
    [118, 150, 74],
    [86, 122, 58],
    [142, 170, 92],
    [70, 104, 50],
    [156, 178, 108],
  ];
  const wheats: Array<[number, number, number]> = [
    [198, 168, 88],
    [176, 146, 70],
    [214, 186, 118],
  ];
  const soils: Array<[number, number, number]> = [
    [124, 96, 62],
    [98, 76, 48],
  ];
  const plot = (x: number, y: number, w: number, h: number, c: [number, number, number], k: number, m: number): Plot => ({
    x, y, w, h, r: c[0], g: c[1], b: c[2], k, m,
  });
  const plots: Plot[] = [
    plot(0, 0, 1, 1, greens[1], 2, 0),
    plot(0.0, 0.0, 0.4, 0.34, wheats[0], 3, 1),
    plot(0.4, 0.0, 0.15, 0.56, greens[3], 0, 4),
    plot(0.55, 0.0, 0.45, 0.2, greens[4], 2, 0),
    plot(0.55, 0.2, 0.22, 0.26, soils[0], 1, 3),
    plot(0.77, 0.2, 0.23, 0.26, wheats[2], 2, 2),
    plot(0.0, 0.34, 0.24, 0.24, greens[0], 1, 3),
    plot(0.24, 0.34, 0.16, 0.24, soils[1], 4, 1),
    plot(0.55, 0.46, 0.45, 0.22, greens[2], 3, 1),
    plot(0.0, 0.58, 0.62, 0.16, wheats[1], 0, 3),
    plot(0.62, 0.68, 0.38, 0.14, greens[1], 2, 2),
    plot(0.0, 0.74, 0.34, 0.26, greens[2], 1, 0),
    plot(0.34, 0.74, 0.36, 0.26, wheats[0], 4, 1),
    plot(0.7, 0.82, 0.3, 0.18, soils[0], 0, 2),
  ];
  const hashN = (ix: number, iy: number) => {
    let h = Math.imul(ix + 13, 374761393) ^ Math.imul(iy + 29, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const wrapNoise = (u: number, v: number) => {
    const x0 = Math.floor(u);
    const y0 = Math.floor(v);
    const fx = u - x0;
    const fy = v - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hashN(x0, y0);
    const b = hashN(x0 + 1, y0);
    const c = hashN(x0, y0 + 1);
    const d = hashN(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const plotAt = (u: number, v: number) => {
    let found = plots[0];
    let edge = 1;
    for (let i = 0; i < plots.length; i++) {
      const f = plots[i];
      let du = u - f.x;
      let dv = v - f.y;
      du -= Math.floor(du);
      dv -= Math.floor(dv);
      if (du >= 0 && du < f.w && dv >= 0 && dv < f.h) {
        found = f;
        edge = Math.min(du, f.w - du, dv, f.h - dv);
      }
    }
    return { found, edge };
  };
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      let uu = u + 0.01 * Math.sin(v * Math.PI * 2 * 2);
      let vv = v + 0.008 * Math.sin(u * Math.PI * 2);
      uu -= Math.floor(uu);
      vv -= Math.floor(vv);
      const hit = plotAt(uu, vv);
      const field = hit.found;
      const edge = hit.edge;
      let r = field.r;
      let g = field.g;
      let b = field.b;
      const n = wrapNoise(u * 5, v * 5);
      const lift = (n - 0.5) * 16;
      r += lift;
      g += lift * 1.05;
      b += lift * 0.55;
      const phase = field.k * uu * 16 + field.m * vv * 16;
      if ((Math.floor(phase) & 1) === 0) {
        r += 11;
        g += 8;
        b -= 4;
      }
      if (edge < 0.012) {
        const t = 1 - edge / 0.012;
        r = r * (1 - t) + 34 * t;
        g = g * (1 - t) + 58 * t;
        b = b * (1 - t) + 32 * t;
        const cell = hashN(Math.floor(u * 90), Math.floor(v * 90));
        if (edge < 0.006 && cell > 0.72) {
          r = 22;
          g = 44;
          b = 24;
        }
      }
      const road = Math.abs(v - (0.575 + 0.008 * Math.sin(u * Math.PI * 2)));
      if (road < 0.006) {
        r = 138;
        g = 122;
        b = 98;
      } else if (road < 0.0085) {
        r = 78;
        g = 96;
        b = 58;
      }
      const creek = Math.abs(u - (0.22 + 0.012 * Math.sin(v * Math.PI * 2 * 2)));
      if (creek < 0.0055) {
        r = 64;
        g = 118;
        b = 142;
      } else if (creek < 0.008) {
        r = r * 0.45 + 48;
        g = g * 0.45 + 92;
        b = b * 0.45 + 70;
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

/** Three billowy cumulus stamps. Lit tops, cool bases, soft edge, clear of the tile rim. */
export function createPuffAtlas() {
  const w = 512;
  const h = 512;
  const rows = 3;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h * rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2d context");
  const img = ctx.createImageData(w, h * rows);
  const px = img.data;
  const shapes = [
    [
      [0.5, 0.6, 0.38, 0.22],
      [0.28, 0.56, 0.18, 0.16],
      [0.72, 0.57, 0.17, 0.15],
      [0.4, 0.44, 0.17, 0.16],
      [0.6, 0.42, 0.16, 0.15],
      [0.5, 0.34, 0.14, 0.14],
      [0.33, 0.4, 0.12, 0.12],
      [0.68, 0.46, 0.12, 0.11],
      [0.2, 0.62, 0.1, 0.09],
      [0.82, 0.6, 0.1, 0.09],
    ],
    [
      [0.46, 0.62, 0.34, 0.2],
      [0.24, 0.54, 0.16, 0.15],
      [0.66, 0.52, 0.18, 0.16],
      [0.38, 0.44, 0.15, 0.15],
      [0.54, 0.36, 0.15, 0.16],
      [0.7, 0.42, 0.11, 0.12],
      [0.3, 0.4, 0.11, 0.11],
      [0.48, 0.3, 0.1, 0.11],
    ],
    [
      [0.52, 0.58, 0.4, 0.22],
      [0.26, 0.54, 0.16, 0.15],
      [0.78, 0.56, 0.14, 0.13],
      [0.38, 0.42, 0.18, 0.16],
      [0.64, 0.4, 0.16, 0.15],
      [0.5, 0.32, 0.13, 0.13],
      [0.34, 0.34, 0.1, 0.11],
      [0.72, 0.34, 0.1, 0.1],
      [0.16, 0.6, 0.09, 0.08],
      [0.88, 0.58, 0.08, 0.08],
    ],
  ];
  const smooth = (t: number) => {
    const x = t < 0 ? 0 : t > 1 ? 1 : t;
    return x * x * (3 - 2 * x);
  };
  for (let row = 0; row < rows; row++) {
    const lobes = shapes[row];
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        let dens = 0;
        for (let i = 0; i < lobes.length; i++) {
          const lobe = lobes[i];
          const dx = (u - lobe[0]) / lobe[2];
          const dy = (v - lobe[1]) / lobe[3];
          const q = Math.sqrt(dx * dx + dy * dy);
          const fall = smooth((1 - q) / 0.32);
          if (fall > dens) dens = fall;
        }
        const rim = Math.min(u, v, 1 - u, 1 - v);
        if (rim < 0.05) dens *= rim / 0.05;
        if (dens < 0) dens = 0;
        if (dens > 1) dens = 1;
        const up = smooth(Math.max(0, Math.min(1, (0.8 - v) / 0.48)));
        const r = 118 + up * 137;
        const g = 148 + up * 107;
        const b = 184 + up * 70;
        const o = ((row * h + y) * w + x) * 4;
        px[o] = r;
        px[o + 1] = g;
        px[o + 2] = b;
        px[o + 3] = Math.round(dens * 255);
      }
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

