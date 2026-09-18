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

  vec3 zenith = mix(vec3(0.05, 0.28, 0.78), vec3(0.02, 0.04, 0.12), uNight);
  vec3 horizon = mix(vec3(0.22, 0.50, 0.86), vec3(0.10, 0.14, 0.28), uNight);
  vec3 below = mix(vec3(0.16, 0.40, 0.78), vec3(0.05, 0.07, 0.14), uNight);
  vec3 sky = mix(below, horizon, smoothstep(-0.22, 0.04, h));
  sky = mix(sky, zenith, smoothstep(0.0, 0.55, h));

  float disc = pow(mu, mix(380.0, 520.0, uNight));
  float corona = pow(mu, mix(28.0, 36.0, uNight));
  float haze = pow(mu, 6.0);
  vec3 warm = vec3(1.0, 0.97, 0.86);
  vec3 cool = vec3(0.82, 0.90, 1.0);
  vec3 lamp = mix(warm, cool, uNight);
  sky += lamp * disc * mix(3.2, 1.8, uNight);
  sky += mix(vec3(1.0, 0.91, 0.64), vec3(0.55, 0.68, 1.0), uNight) * corona * mix(0.55, 0.32, uNight);
  sky += mix(vec3(1.0, 0.82, 0.54), vec3(0.25, 0.32, 0.55), uNight) * haze * mix(0.12, 0.08, uNight);

  vec3 space = vec3(0.005, 0.007, 0.02);
  float limb = pow(1.0 - abs(h), 8.5);
  space += vec3(0.18, 0.42, 0.98) * limb * 1.05;
  space += lamp * disc * 3.4;
  space += mix(vec3(1.0, 0.86, 0.55), cool, uNight) * corona * 0.48;

  vec3 col = mix(sky, space, max(uSpace, uDeep));
  float band = exp(-pow(h / 0.07, 2.0));
  col += mix(vec3(0.7, 0.88, 1.0), vec3(0.32, 0.52, 0.98), uNight) * band * (0.42 + max(uSpace, uDeep) * 0.55);

  float nA = starHash(dir * 3.6 + vec3(uTime * 0.01, 0.2, 0.1));
  float nB = starHash(dir.yzx * 5.4 + 1.7);
  float nC = starHash(dir.zxy * 2.1);
  float neb = pow(nA * 0.65 + nB * 0.35, 1.6);
  vec3 nebCol = mix(vec3(0.22, 0.06, 0.48), vec3(0.04, 0.2, 0.52), nC);
  nebCol = mix(nebCol, vec3(0.55, 0.16, 0.12), nB * 0.55);
  col = mix(col, mix(vec3(0.01, 0.012, 0.04), nebCol, neb * 1.35), uDeep);

  float starAmt = max(uNight, max(smoothstep(0.08, 0.45, uSpace), uDeep * 0.95));
  if (uStars > 0.5 && starAmt > 0.04) {
    float cell = starHash(floor(dir * mix(160.0, 220.0, uDeep)));
    float spark = step(mix(0.993, 0.988, uDeep), cell) * pow(starHash(dir * 51.3), 5.0);
    col += vec3(0.88, 0.92, 1.0) * spark * starAmt * (0.35 + 0.65 * max(h, 0.0));
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
  for (int i = 0; i < 6; i++) {
    float n = noise(p);
    n = 1.0 - abs(n * 2.0 - 1.0);
    v += a * n;
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 pos = position;
  vec2 p = (pos.xz + vec2(uOffset.x, uOffset.y)) * 0.0038;
  p += vec2(uTime * 0.004, uTime * 0.002);
  float h = pow(billow(p), 1.25);
  pos.y += (h - 0.42) * 28.0;
  float e = 3.4;
  float hx = pow(billow(p + vec2(e * 0.0038, 0.0)), 1.25);
  float hz = pow(billow(p + vec2(0.0, e * 0.0038)), 1.25);
  vec3 n = normalize(vec3((h - hx) * 18.0, 1.0, (h - hz) * 18.0));
  vH = h;
  vN = n;
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.11;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 n = normalize(mix(vec3(0.0, 1.0, 0.0), vN, 0.22));
  vec3 sun = normalize(uSun);
  float ndotl = max(dot(n, sun), 0.0);
  float fluff = fbm(vWorld.xz * 0.012);
  vec3 valley = mix(vec3(0.72, 0.82, 0.94), vec3(0.16, 0.20, 0.34), uNight);
  vec3 peak = mix(vec3(1.0, 1.0, 1.0), vec3(0.82, 0.88, 0.98), uNight);
  vec3 albedo = mix(valley, peak, smoothstep(0.22, 0.78, vH * 0.45 + fluff * 0.55));
  vec3 col = albedo * mix(0.9 + 0.12 * ndotl, 0.62 + 0.4 * ndotl, uNight);
  col += mix(vec3(1.0, 0.96, 0.86), vec3(0.78, 0.86, 1.0), uNight) * pow(ndotl, 7.0) * mix(0.34, 0.28, uNight);

  vec3 view = normalize(uCam - vWorld);
  float rim = pow(1.0 - max(dot(view, vec3(0.0, 1.0, 0.0)), 0.0), 2.4);
  col += mix(vec3(0.96, 0.98, 1.0), vec3(0.55, 0.68, 0.95), uNight) * rim * 0.22;
  float silver = pow(max(dot(reflect(-sun, n), view), 0.0), 4.5) * mix(0.22, 0.4, uNight);
  col += mix(vec3(1.0, 0.97, 0.9), vec3(0.82, 0.9, 1.0), uNight) * silver;

  float dist = length(uCam.xz - vWorld.xz);
  float haze = smoothstep(1600.0, 5200.0, dist);
  vec3 fogCol = mix(vec3(0.38, 0.62, 0.92), vec3(0.07, 0.11, 0.26), uNight);
  col = mix(col, fogCol, haze * 0.7);
  col += mix(vec3(0.75, 0.88, 1.0), vec3(0.28, 0.42, 0.78), uNight) * haze * 0.18;

  float alpha = uFade * (1.0 - haze * 0.28);
  float dy = uCam.y - vWorld.y;
  alpha *= smoothstep(22.0, 70.0, dy);
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export const PUFF_VERT = /* glsl */ `
uniform vec3 uSun;
varying vec2 vLocal;
varying float vLight;
varying float vDist;
varying float vSeed;
varying vec3 vView;

void main() {
  vec3 worldPos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sx = length(instanceMatrix[0].xyz);
  float sy = length(instanceMatrix[1].xyz);
  vLocal = uv;
  vSeed = fract(worldPos.x * 0.017 + worldPos.z * 0.013 + worldPos.y * 0.009);
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 pos = worldPos + camRight * position.x * sx + camUp * position.y * sy;
  vDist = length(cameraPosition - worldPos);
  vView = cameraPosition - worldPos;
  float sunSide = 0.5 + 0.5 * dot(normalize(uSun.xz), normalize(camRight.xz + vec2(0.0001)));
  vLight = 0.82 + sunSide * 0.2 + uv.y * 0.22;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}
`;

export const PUFF_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uSpace;
uniform float uNight;
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

void main() {
  vec2 p = vLocal * 2.0 - 1.0;
  float nA = noise(p * 2.8 + vSeed * 9.0);
  float nB = noise(p * 6.2 + 2.7 + vSeed * 4.0);
  vec2 w = p + vec2(nA - 0.5, nB - 0.5) * 0.28;

  float d = lobe(w, vec2(0.0, -0.12), vec2(0.98, 0.78));
  d = min(d, lobe(w, vec2(-0.42, 0.02), vec2(0.58, 0.5)));
  d = min(d, lobe(w, vec2(0.4, -0.02), vec2(0.6, 0.52)));
  d = min(d, lobe(w, vec2(-0.18, 0.34), vec2(0.46, 0.4)));
  d = min(d, lobe(w, vec2(0.2, 0.3), vec2(0.44, 0.38)));
  d = min(d, lobe(w, vec2(0.02, 0.54), vec2(0.32, 0.28)));
  d += (noise(w * 7.5 + vSeed) - 0.5) * 0.16;
  if (d > 1.02) discard;

  float dens = 1.0 - smoothstep(0.48, 1.0, d);
  dens *= 0.72 + 0.28 * noise(w * 4.4 + vSeed * 3.0);
  if (dens < 0.05) discard;

  float ht = clamp(0.42 + w.y * 0.62 + nA * 0.08, 0.0, 1.0);
  vec3 shade = mix(vec3(0.55, 0.68, 0.86), vec3(1.0, 1.0, 1.0), ht);
  shade = mix(shade, vec3(1.0), dens * ht * 0.35);
  vec3 view = normalize(vView);
  vec3 sun = normalize(uSun);
  float backlit = pow(max(dot(view, sun), 0.0), 3.8);
  vec3 col = shade * mix(vLight, vLight * 0.6 + 0.22, uNight);
  col += mix(vec3(1.0, 0.97, 0.9), vec3(0.72, 0.82, 1.0), uNight) * backlit * mix(0.22, 0.14, uNight);

  float fade = smoothstep(1100.0, 90.0, vDist);
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
  float bands = 0.5 + 0.5 * sin(vP.y * 7.4 + uSeed + sin(vP.x * 3.0 + uSeed) * 0.55);
  float storm = fract(sin(dot(vP, vec3(12.1, 4.2, 7.3))) * 43758.5453);
  vec3 col = mix(uA, uB, bands);
  col = mix(col, uA * 0.72, storm * 0.2);
  float ndl = 0.2 + 0.8 * max(dot(normalize(vN), normalize(vec3(0.55, 0.42, 0.32))), 0.0);
  gl_FragColor = vec4(col * ndl, 1.0);
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
  vec3 sand = vec3(0.72, 0.62, 0.42);
  vec3 teal = vec3(0.12, 0.42, 0.4);
  vec3 coral = vec3(0.86, 0.38, 0.42);
  vec3 violet = vec3(0.42, 0.22, 0.48);
  vec3 albedo = mix(sand, teal, smoothstep(0.28, 0.62, vH));
  albedo = mix(albedo, coral, smoothstep(0.62, 0.86, patch) * 0.7);
  albedo = mix(albedo, violet, smoothstep(0.78, 0.96, noise(vWorld.xz * 0.02)));
  float caust = pow(0.5 + 0.5 * sin(vWorld.x * 0.12 + uTime * 0.8) * sin(vWorld.z * 0.1 - uTime * 0.55), 2.4);
  vec3 col = albedo * (0.35 + 0.65 * ndotl);
  col += vec3(0.35, 0.75, 0.7) * caust * 0.28;
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

