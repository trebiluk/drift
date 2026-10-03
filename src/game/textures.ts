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

/** Combed high cirrus. One canvas, drawn once. Soft ribbons, no stitched gaps. */
export function createCirrusTexture() {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  ctx.clearRect(0, 0, w, h);
  const rng = mulberry32(7);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const paint = (blur: string, alphaMul: number) => {
    ctx.filter = blur;
    for (let i = 0; i < 5; i++) {
      const y = 36 + (i + rng() * 0.6) * ((h - 72) / 5);
      const amp = 8 + rng() * 16;
      const phase = rng() * Math.PI * 2;
      const width = 28 + rng() * 26;
      const alpha = (0.07 + rng() * 0.08) * alphaMul;
      ctx.beginPath();
      for (let x = -20; x <= w + 20; x += 12) {
        const yy = y + Math.sin(x * 0.008 + phase) * amp + Math.sin(x * 0.021 + phase * 1.7) * amp * 0.35;
        if (x === -20) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.lineWidth = width;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.stroke();
    }
    ctx.filter = "none";
  };
  paint("blur(16px)", 1);
  paint("blur(8px)", 0.55);

  ctx.globalCompositeOperation = "destination-in";
  const fadeX = ctx.createLinearGradient(0, 0, w, 0);
  fadeX.addColorStop(0, "rgba(0,0,0,0)");
  fadeX.addColorStop(0.14, "rgba(0,0,0,1)");
  fadeX.addColorStop(0.86, "rgba(0,0,0,1)");
  fadeX.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fadeX;
  ctx.fillRect(0, 0, w, h);
  const fadeY = ctx.createLinearGradient(0, 0, 0, h);
  fadeY.addColorStop(0, "rgba(0,0,0,0)");
  fadeY.addColorStop(0.22, "rgba(0,0,0,1)");
  fadeY.addColorStop(0.78, "rgba(0,0,0,1)");
  fadeY.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fadeY;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
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

/** One repeating tile of irregular fields, short hedges, and a few tulip rows. */
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
  const jx: number[][] = [];
  const jy: number[][] = [];
  for (let j = 0; j < rows; j++) {
    jx[j] = [];
    jy[j] = [];
    for (let i = 0; i < cols; i++) {
      jx[j][i] = (rng() - 0.5) * 0.55;
      jy[j][i] = (rng() - 0.5) * 0.55;
    }
  }
  const vx = (i: number, j: number) => {
    const ii = ((i % cols) + cols) % cols;
    const jj = ((j % rows) + rows) % rows;
    return ((i + 0.5 + jx[jj][ii]) / cols) * size;
  };
  const vy = (i: number, j: number) => {
    const ii = ((i % cols) + cols) % cols;
    const jj = ((j % rows) + rows) % rows;
    return ((j + 0.5 + jy[jj][ii]) / rows) * size;
  };
  const mix = (a: [number, number], b: [number, number], t: number): [number, number] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  type Pt = [number, number];

  ctx.fillStyle = "#7ea872";
  ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(48, 78, 46, 0.4)";

  const paint = (pts: Pt[], edges: Array<[Pt, Pt]>, tulip: boolean, wheat: boolean) => {
    const palette = wheat ? FIELD_WHEAT : FIELD_GREENS;
    const base = palette[Math.floor(rng() * palette.length)];
    const minX = Math.min(...pts.map((p) => p[0]));
    const maxX = Math.max(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1]));
    const maxY = Math.max(...pts.map((p) => p[1]));
    const oxs = [0];
    const oys = [0];
    if (minX < 1) oxs.push(size);
    if (maxX > size - 1) oxs.push(-size);
    if (minY < 1) oys.push(size);
    if (maxY > size - 1) oys.push(-size);
    const color = TULIPS[Math.floor(rng() * TULIPS.length)];
    const horizontal = rng() < 0.5;
    const step = 4 + Math.floor(rng() * 3);
    const marks = edges.map(([a, b]) => {
      const tree = rng() < 0.22;
      const along = 0.3 + rng() * 0.4;
      const rad = 1.6 + rng() * 1.8;
      return { a, b, tree, along, rad };
    });
    for (const ox of oxs) {
      for (const oy of oys) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0] + ox, pts[k][1] + oy);
        ctx.closePath();
        ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
        ctx.fill();
        if (tulip) {
          ctx.save();
          ctx.clip();
          ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.55)`;
          if (horizontal) {
            for (let y = minY + 2; y < maxY - 1; y += step) ctx.fillRect(minX + ox, y + oy, maxX - minX, 1);
          } else {
            for (let x = minX + 2; x < maxX - 1; x += step) ctx.fillRect(x + ox, minY + oy, 1, maxY - minY);
          }
          ctx.restore();
        }
        for (const mark of marks) {
          const p0 = mix(mark.a, mark.b, 0.16);
          const p1 = mix(mark.a, mark.b, 0.72);
          ctx.beginPath();
          ctx.moveTo(p0[0] + ox, p0[1] + oy);
          ctx.lineTo(p1[0] + ox, p1[1] + oy);
          ctx.stroke();
          if (mark.tree) {
            const dot = mix(mark.a, mark.b, mark.along);
            ctx.fillStyle = "rgba(42, 68, 40, 0.45)";
            ctx.beginPath();
            ctx.arc(dot[0] + ox, dot[1] + oy, mark.rad, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  };

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p00: Pt = [vx(i, j), vy(i, j)];
      const p10: Pt = [vx(i + 1, j), vy(i + 1, j)];
      const p11: Pt = [vx(i + 1, j + 1), vy(i + 1, j + 1)];
      const p01: Pt = [vx(i, j + 1), vy(i, j + 1)];
      const wide = Math.hypot(p10[0] - p00[0], p10[1] - p00[1]) >= Math.hypot(p01[0] - p00[0], p01[1] - p00[1]);
      if (rng() < 0.25) {
        const t = 0.38 + rng() * 0.24;
        if (wide) {
          const a = mix(p00, p10, t);
          const b = mix(p01, p11, t);
          const tulipA = rng() < 0.11;
          const wheatA = !tulipA && rng() < 0.34;
          paint([p00, a, b, p01], [[p00, a], [a, b]], tulipA, wheatA);
          const tulipB = rng() < 0.11;
          const wheatB = !tulipB && rng() < 0.34;
          paint([a, p10, p11, b], [[a, p10], [p10, p11]], tulipB, wheatB);
        } else {
          const a = mix(p00, p01, t);
          const b = mix(p10, p11, t);
          const tulipA = rng() < 0.11;
          const wheatA = !tulipA && rng() < 0.34;
          paint([p00, p10, b, a], [[p00, p10], [a, b]], tulipA, wheatA);
          const tulipB = rng() < 0.11;
          const wheatB = !tulipB && rng() < 0.34;
          paint([a, b, p11, p01], [[b, p11], [p11, p01]], tulipB, wheatB);
        }
      } else {
        const tulip = rng() < 0.11;
        const wheat = !tulip && rng() < 0.34;
        paint([p00, p10, p11, p01], [[p10, p11], [p11, p01]], tulip, wheat);
      }
    }
  }
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
        g.addColorStop(0, "rgba(255,255,255,0.55)");
        g.addColorStop(0.55, "rgba(255,255,255,0.25)");
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

