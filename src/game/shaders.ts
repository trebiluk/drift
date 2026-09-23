export const ATMOSPHERE_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const ATMOSPHERE_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uSpace;
uniform float uNight;
uniform float uStars;
uniform float uDeep;
uniform float uReef;
uniform float uTime;
varying vec3 vDir;

float starHash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 sun = normalize(uSun);
  float mu = max(dot(dir, sun), 0.0);

  vec3 zenith = mix(vec3(0.025, 0.16, 0.58), vec3(0.015, 0.03, 0.09), uNight);
  vec3 horizon = mix(vec3(0.32, 0.58, 0.92), vec3(0.12, 0.16, 0.32), uNight);
  vec3 below = mix(vec3(0.18, 0.42, 0.78), vec3(0.04, 0.06, 0.12), uNight);
  vec3 sky = mix(below, horizon, smoothstep(-0.22, 0.06, h));
  sky = mix(sky, zenith, smoothstep(0.02, 0.62, h));

  float disc = pow(mu, mix(420.0, 560.0, uNight));
  float corona = pow(mu, mix(22.0, 32.0, uNight));
  float haze = pow(mu, 4.8);
  vec3 warm = vec3(1.0, 0.97, 0.88);
  vec3 cool = vec3(0.82, 0.90, 1.0);
  vec3 lamp = mix(warm, cool, uNight);
  sky += lamp * disc * mix(4.2, 2.1, uNight);
  sky += mix(vec3(1.0, 0.88, 0.58), vec3(0.55, 0.68, 1.0), uNight) * corona * mix(0.85, 0.4, uNight);
  sky += mix(vec3(1.0, 0.78, 0.48), vec3(0.25, 0.32, 0.55), uNight) * haze * mix(0.18, 0.1, uNight);

  vec3 space = vec3(0.004, 0.006, 0.018);
  float limb = pow(1.0 - abs(h), 7.2);
  space += vec3(0.22, 0.48, 1.0) * limb * 1.25;
  space += lamp * disc * 4.2;
  space += mix(vec3(1.0, 0.86, 0.55), cool, uNight) * corona * 0.62;

  vec3 col = mix(sky, space, max(uSpace, uDeep));
  float band = exp(-pow(h / 0.07, 2.0));
  col += mix(vec3(0.7, 0.88, 1.0), vec3(0.32, 0.52, 0.98), uNight) * band * (0.42 + max(uSpace, uDeep) * 0.55);

  float nA = starHash(dir * 3.6 + vec3(uTime * 0.008, 0.2, 0.1));
  float nB = starHash(dir.yzx * 5.4 + 1.7);
  float nC = starHash(dir.zxy * 2.1);
  float nD = starHash(dir * 1.15 + vec3(0.4, uTime * 0.004, 0.8));
  float neb = pow(clamp(nA * 0.42 + nB * 0.28 + nC * 0.18 + nD * 0.22, 0.0, 1.0), 1.35);
  float veins = pow(abs(nB - nC), 1.4);
  vec3 nebCol = mix(vec3(0.28, 0.05, 0.55), vec3(0.04, 0.28, 0.62), nC);
  nebCol = mix(nebCol, vec3(0.72, 0.18, 0.22), nB * 0.45);
  nebCol = mix(nebCol, vec3(0.9, 0.55, 0.25), veins * 0.35);
  col = mix(col, mix(vec3(0.008, 0.01, 0.035), nebCol, neb * 1.55), uDeep);

  float starAmt = max(uNight, max(smoothstep(0.08, 0.45, uSpace), uDeep * 0.95));
  if (uStars > 0.5 && starAmt > 0.04) {
    float cell = starHash(floor(dir * mix(170.0, 260.0, uDeep)));
    float tw = 0.55 + 0.45 * sin(uTime * (1.6 + cell * 8.0) + cell * 40.0);
    float spark = step(mix(0.992, 0.985, uDeep), cell) * pow(starHash(dir * 51.3), 5.0) * tw;
    col += vec3(0.9, 0.94, 1.0) * spark * starAmt * (0.4 + 0.6 * max(h, 0.0));
    float dust = step(0.82, starHash(dir * 90.0)) * 0.04 * uDeep;
    col += vec3(0.55, 0.62, 1.0) * dust * starAmt;
  }

  vec3 waterDown = vec3(0.01, 0.07, 0.14);
  vec3 waterUp = vec3(0.08, 0.38, 0.52);
  vec3 water = mix(waterDown, waterUp, smoothstep(-0.35, 0.72, h));
  water += vec3(0.25, 0.7, 0.62) * pow(max(h, 0.0), 2.6) * 0.55;
  float caust = pow(0.5 + 0.5 * sin(dir.x * 18.0 + uTime * 0.7) * sin(dir.z * 14.0 - uTime * 0.5), 3.0);
  water += vec3(0.2, 0.55, 0.48) * caust * max(h, 0.0) * 0.22;
  col = mix(col, water, uReef);

  gl_FragColor = vec4(col, 1.0);
}
`;

export const SEA_VERT = /* glsl */ `
uniform float uTime;
uniform vec2 uOffset;
uniform float uLod;
varying vec3 vWorld;
varying float vH;
varying vec3 vN;

float hash(vec2 p) {
  p = mod(p, 289.0);
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float billow(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  int oct = uLod > 1.4 ? 3 : (uLod > 0.5 ? 4 : 6);
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    float n = noise(p);
    n = 1.0 - abs(n * 2.0 - 1.0);
    v += a * n;
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

float heap(vec2 p) {
  vec2 w = p + vec2(billow(p * 1.55 + 4.1), billow(p * 1.55 + 9.7)) * 0.48;
  float h = pow(billow(w), 1.35);
  float heaps = pow(billow(w * 0.52 + 2.2), 1.85);
  float nubs = pow(billow(w * 2.15 + 6.4), 2.4);
  return (h - 0.26) * 74.0 + heaps * 42.0 + nubs * 16.0;
}

void main() {
  vec3 pos = position;
  // PlaneGeometry sits in XY. The mesh is turned -90° on X, so local Z is world up.
  // Sampling pos.xz used a zero Z and shoved the height sideways, which flattened the deck.
  vec2 wxz = vec2(pos.x, -pos.y) + uOffset;
  vec2 p = wxz * 0.0036 + vec2(uTime * 0.003, uTime * 0.0016);
  float h = heap(p);
  pos.z += h;
  float e = 5.5;
  float hx = heap(p + vec2(e * 0.0036, 0.0));
  float hz = heap(p + vec2(0.0, e * 0.0036));
  vH = clamp(h / 96.0 + 0.35, 0.0, 1.0);
  vN = normalize(vec3(h - hx, e, h - hz));
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const SEA_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uCam;
uniform float uFade;
uniform float uNight;
uniform float uLod;
varying vec3 vWorld;
varying float vH;
varying vec3 vN;

float hash(vec2 p) {
  p = mod(p, 289.0);
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 0.0) + vec2(0.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float billow(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  int oct = uLod > 1.4 ? 3 : 4;
  for (int i = 0; i < 4; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
    v += a * n;
    p *= 2.13;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vWorld.xz * 0.019;
  float cell = billow(uv);
  float nub = billow(uv * 2.6 + 13.0);
  float cauliflower = pow(cell, 1.35) * 0.68 + pow(nub, 2.4) * 0.4;

  vec3 nTex = vec3(0.0, 1.0, 0.0);
  if (uLod < 1.5) {
    float e = 1.6;
    float cx = billow(uv + vec2(e * 0.019, 0.0));
    float cz = billow(uv + vec2(0.0, e * 0.019));
    nTex = normalize(vec3((cell - cx) * 4.4, 1.0, (cell - cz) * 4.4));
  }
  vec3 n = normalize(mix(normalize(vN), nTex, 0.62));
  vec3 sun = normalize(uSun);
  float ndotl = max(dot(n, sun), 0.0);

  vec3 crease = mix(vec3(0.42, 0.58, 0.82), vec3(0.12, 0.16, 0.28), uNight);
  vec3 valley = mix(vec3(0.62, 0.74, 0.9), vec3(0.22, 0.28, 0.42), uNight);
  vec3 peak = mix(vec3(1.0, 1.0, 1.0), vec3(0.88, 0.92, 1.0), uNight);
  float ht = clamp(vH * 0.38 + cauliflower * 0.78, 0.0, 1.0);
  vec3 albedo = mix(crease, valley, smoothstep(0.12, 0.42, ht));
  albedo = mix(albedo, peak, smoothstep(0.46, 0.92, ht));

  vec3 col = albedo * mix(0.78 + 0.28 * ndotl, 0.55 + 0.42 * ndotl, uNight);
  col += mix(vec3(1.0, 0.97, 0.9), vec3(0.78, 0.86, 1.0), uNight) * pow(ndotl, 5.0) * mix(0.5, 0.28, uNight);
  col += peak * pow(cauliflower, 3.2) * 0.22;

  vec3 view = normalize(uCam - vWorld);
  float rim = pow(1.0 - max(dot(view, vec3(0.0, 1.0, 0.0)), 0.0), 2.2);
  col += mix(vec3(0.96, 0.98, 1.0), vec3(0.55, 0.68, 0.95), uNight) * rim * 0.16;
  float silver = pow(max(dot(reflect(-sun, n), view), 0.0), 4.2) * mix(0.28, 0.4, uNight);
  col += mix(vec3(1.0, 0.97, 0.9), vec3(0.82, 0.9, 1.0), uNight) * silver;

  float dist = length(uCam.xz - vWorld.xz);
  float haze = smoothstep(1400.0, 4800.0, dist);
  vec3 fogCol = mix(vec3(0.32, 0.56, 0.9), vec3(0.07, 0.11, 0.26), uNight);
  col = mix(col, fogCol, haze * 0.62);

  float alpha = uFade * (1.0 - haze * 0.22);
  float dy = uCam.y - vWorld.y;
  alpha *= smoothstep(18.0, 64.0, dy);
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export const PUFF_VERT = /* glsl */ `
uniform vec3 uSun;
uniform vec2 uCamXZ;
uniform float uWrap;
varying vec2 vLocal;
varying float vLight;
varying float vDist;
varying float vSeed;
varying vec3 vView;

float wrap1(float v, float c, float half) {
  float span = half * 2.0;
  return v - span * floor((v - c) / span + 0.5);
}

void main() {
  vec3 origin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sx = length(instanceMatrix[0].xyz);
  float sy = length(instanceMatrix[1].xyz);
  vLocal = uv;
  vSeed = fract(origin.x * 0.017 + origin.z * 0.013 + origin.y * 0.009);
  vec3 worldPos = vec3(wrap1(origin.x, uCamXZ.x, uWrap), origin.y, wrap1(origin.z, uCamXZ.y, uWrap));
  vec3 toCam = cameraPosition - worldPos;
  float topDown = abs(normalize(toCam).y);
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 up = normalize(mix(camUp, vec3(0.0, 1.0, 0.0), topDown * 0.72));
  vec3 right = normalize(cross(up, toCam));
  if (dot(right, camRight) < 0.0) right = -right;
  vec3 pos = worldPos + right * position.x * sx + up * position.y * sy;
  vDist = length(toCam);
  vView = toCam;
  float sunSide = 0.5 + 0.5 * dot(normalize(uSun.xz), normalize(right.xz + vec2(0.0001)));
  vLight = 0.9 + sunSide * 0.16 + uv.y * 0.28;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}
`;

export const PUFF_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uSpace;
uniform float uNight;
uniform float uTime;
uniform float uLod;
varying vec2 vLocal;
varying float vLight;
varying float vDist;
varying float vSeed;
varying vec3 vView;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float lobe(vec2 p, vec2 c, vec2 r) {
  vec2 q = (p - c) / r;
  return length(q);
}

float field(vec2 w, float s) {
  float d = lobe(w, vec2(0.02 * s, -0.14), vec2(0.96, 0.74));
  d = min(d, lobe(w, vec2(-0.46 - s * 0.08, 0.0), vec2(0.56, 0.5)));
  d = min(d, lobe(w, vec2(0.44 + s * 0.06, -0.04), vec2(0.58, 0.5)));
  d = min(d, lobe(w, vec2(-0.22, 0.32 + s * 0.08), vec2(0.48, 0.42)));
  d = min(d, lobe(w, vec2(0.24, 0.3), vec2(0.46, 0.4)));
  d = min(d, lobe(w, vec2(-0.02, 0.56), vec2(0.34, 0.3)));
  d = min(d, lobe(w, vec2(-0.58, -0.22), vec2(0.34, 0.3)));
  d = min(d, lobe(w, vec2(0.6, -0.2), vec2(0.32, 0.28)));
  d = min(d, lobe(w, vec2(0.08 - s * 0.1, 0.12), vec2(0.38, 0.34)));
  return d;
}

void main() {
  vec2 p = vLocal * 2.0 - 1.0;
  float ang = vSeed * 6.2832;
  float ca = cos(ang);
  float sa = sin(ang);
  p = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
  float nA = noise(p * 2.6 + vSeed * 9.0 + uTime * 0.07);
  float nB = noise(p * 6.4 + 2.7 + vSeed * 4.0 - uTime * 0.05);
  vec2 w = p + vec2(nA - 0.5, nB - 0.5) * 0.38;

  float d = field(w, vSeed);
  d += (noise(w * 8.2 + vSeed) - 0.5) * 0.2;
  if (d > 1.04) discard;

  float dens = 1.0 - smoothstep(0.36, 1.0, d);
  dens *= 0.72 + 0.28 * noise(w * 5.0 + vSeed * 3.0);
  dens = pow(dens, 0.72);
  if (dens < 0.03) discard;

  float ht = clamp(0.42 + w.y * 0.72 + nA * 0.12, 0.0, 1.0);
  vec3 under = mix(vec3(0.55, 0.7, 0.9), vec3(0.26, 0.34, 0.52), uNight);
  vec3 top = mix(vec3(1.0, 1.0, 1.0), vec3(0.88, 0.92, 1.0), uNight);
  vec3 shade = mix(under, top, ht);
  shade = mix(shade, vec3(1.0), dens * ht * 0.5);

  vec3 view = normalize(vView);
  vec3 sun = normalize(uSun);
  float backlit = pow(max(dot(view, sun), 0.0), 3.2);
  float silver = pow(max(1.0 - dens, 0.0), 1.4) * backlit;
  vec3 col = shade * mix(vLight, vLight * 0.62 + 0.2, uNight);
  col += mix(vec3(1.0, 0.97, 0.9), vec3(0.72, 0.82, 1.0), uNight) * backlit * mix(0.28, 0.16, uNight);
  col += mix(vec3(1.0, 0.98, 0.92), vec3(0.8, 0.88, 1.0), uNight) * silver * 0.55;

  float fade = smoothstep(1700.0, 90.0, vDist);
  float alpha = dens * fade * (1.0 - uSpace * 0.85);
  if (alpha < 0.04) discard;
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

export const PLANET_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
void main() {
  vN = normalMatrix * normal;
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const PLANET_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uSeed;
varying vec3 vN;
varying vec3 vP;

void main() {
  vec3 n = normalize(vN);
  float bands = 0.5 + 0.5 * sin(vP.y * 7.4 + uSeed + sin(vP.x * 3.0 + uSeed) * 0.55);
  bands += 0.12 * sin(vP.y * 18.0 + uSeed * 2.0);
  float storm = fract(sin(dot(vP, vec3(12.1, 4.2, 7.3))) * 43758.5453);
  float swirl = 0.5 + 0.5 * sin(length(vP.xz) * 9.0 - vP.y * 4.0 + uSeed);
  vec3 col = mix(uA, uB, clamp(bands, 0.0, 1.0));
  col = mix(col, uA * 0.68, storm * 0.22);
  col = mix(col, uB * 1.15, swirl * 0.12);
  float ndl = 0.16 + 0.84 * max(dot(n, normalize(vec3(0.55, 0.42, 0.32))), 0.0);
  col *= ndl;
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.4);
  vec3 atm = mix(uB, vec3(0.55, 0.75, 1.0), 0.55);
  col += atm * fres * 0.72;
  col += vec3(1.0, 0.95, 0.82) * pow(max(dot(n, normalize(vec3(0.55, 0.42, 0.32))), 0.0), 28.0) * 0.35;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const REEF_VERT = /* glsl */ `
uniform float uTime;
uniform vec2 uOffset;
varying vec3 vWorld;
varying float vH;
varying vec3 vN;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 pos = position;
  vec2 p = (pos.xz + uOffset) * 0.0062;
  float h = pow(fbm(p), 1.35);
  pos.y += (h - 0.28) * 14.0;
  float e = 2.8;
  float hx = pow(fbm(p + vec2(e * 0.0062, 0.0)), 1.35);
  float hz = pow(fbm(p + vec2(0.0, e * 0.0062)), 1.35);
  vN = normalize(vec3((h - hx) * 22.0, 1.0, (h - hz) * 22.0));
  vH = h;
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const REEF_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uCam;
uniform float uTime;
varying vec3 vWorld;
varying float vH;
varying vec3 vN;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec3 n = normalize(mix(vec3(0.0, 1.0, 0.0), vN, 0.45));
  float ndotl = max(dot(n, normalize(uSun)), 0.0);
  float patch = noise(vWorld.xz * 0.035);
  vec3 sand = vec3(0.78, 0.66, 0.42);
  vec3 teal = vec3(0.08, 0.46, 0.44);
  vec3 coral = vec3(0.92, 0.36, 0.4);
  vec3 violet = vec3(0.48, 0.2, 0.56);
  vec3 albedo = mix(sand, teal, smoothstep(0.28, 0.62, vH));
  albedo = mix(albedo, coral, smoothstep(0.62, 0.86, patch) * 0.75);
  albedo = mix(albedo, violet, smoothstep(0.78, 0.96, noise(vWorld.xz * 0.02)));
  float c1 = sin(vWorld.x * 0.14 + uTime * 0.95) * sin(vWorld.z * 0.11 - uTime * 0.62);
  float c2 = sin((vWorld.x + vWorld.z) * 0.07 - uTime * 0.38);
  float caust = pow(0.5 + 0.5 * c1, 2.2) * (0.55 + 0.45 * c2);
  vec3 col = albedo * (0.32 + 0.68 * ndotl);
  col += vec3(0.45, 0.9, 0.82) * caust * 0.42;
  col += vec3(0.15, 0.45, 0.55) * pow(max(vH, 0.0), 1.6) * 0.2;
  float dist = length(uCam.xz - vWorld.xz);
  float haze = smoothstep(220.0, 900.0, dist);
  col = mix(col, vec3(0.04, 0.18, 0.26), haze);
  float dy = uCam.y - vWorld.y;
  float alpha = 1.0 - haze * 0.35;
  alpha *= smoothstep(4.0, 14.0, dy);
  if (alpha < 0.04) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export const NEBULA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const NEBULA_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float n = fbm(p * 2.4 + vec2(uSeed, uTime * 0.018));
  float n2 = fbm(p * 4.1 - vec2(uTime * 0.012, uSeed));
  float mask = pow(1.0 - r, 1.35);
  float dens = pow(n * 0.65 + n2 * 0.35, 1.35) * mask;
  if (dens < 0.03) discard;
  vec3 col = mix(uA, uB, n2);
  col = mix(col, vec3(1.0, 0.82, 0.62), pow(n, 3.0) * 0.35);
  gl_FragColor = vec4(col * dens, dens * 0.85);
}
`;

