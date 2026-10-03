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
uniform float uGroundHaze;
varying vec3 vDir;

float starHash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 sun = normalize(uSun);
  float mu = max(dot(dir, sun), 0.0);

  vec3 zenith = mix(vec3(0.05, 0.24, 0.72), vec3(0.015, 0.03, 0.09), uNight);
  vec3 horizon = mix(vec3(0.62, 0.78, 0.94), vec3(0.12, 0.16, 0.32), uNight);
  vec3 below = mix(vec3(0.28, 0.5, 0.82), vec3(0.04, 0.06, 0.12), uNight);
  below = mix(below, horizon, uGroundHaze);
  vec3 sky = mix(below, horizon, smoothstep(-0.22, 0.06, h));
  sky = mix(sky, zenith, smoothstep(0.02, 0.62, h));

  float disc = pow(mu, mix(900.0, 1100.0, uNight));
  float corona = pow(mu, mix(64.0, 80.0, uNight));
  float haze = pow(mu, 8.0);
  vec3 warm = vec3(1.0, 0.96, 0.86);
  vec3 cool = vec3(0.82, 0.90, 1.0);
  vec3 lamp = mix(warm, cool, uNight);
  sky += lamp * disc * mix(0.55, 0.3, uNight);
  sky += mix(vec3(1.0, 0.93, 0.75), vec3(0.55, 0.68, 1.0), uNight) * corona * mix(0.16, 0.08, uNight);
  sky += mix(vec3(1.0, 0.9, 0.72), vec3(0.25, 0.32, 0.55), uNight) * haze * mix(0.035, 0.02, uNight);
  sky = min(sky, vec3(0.97));

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

  vec3 waterDown = vec3(0.03, 0.16, 0.24);
  vec3 waterUp = vec3(0.22, 0.58, 0.66);
  vec3 water = mix(waterDown, waterUp, smoothstep(-0.35, 0.72, h));
  water += vec3(0.35, 0.78, 0.7) * pow(max(h, 0.0), 2.2) * 0.4;
  float caust = pow(0.5 + 0.5 * sin(dir.x * 18.0 + uTime * 0.7) * sin(dir.z * 14.0 - uTime * 0.5), 3.0);
  water += vec3(0.25, 0.65, 0.55) * caust * max(h, 0.0) * 0.16;
  float shaft = pow(max(0.5 + 0.5 * sin(dir.x * 5.5 + dir.z * 1.8), 0.0), 10.0);
  water += vec3(0.55, 0.9, 0.82) * shaft * max(h, 0.15) * 0.22;
  col = mix(col, water, uReef);

  gl_FragColor = vec4(col, 1.0);
}
`;

export const PUFF_VERT = /* glsl */ `
uniform vec3 uSun;
varying vec2 vLocal;
varying float vLight;
varying float vDist;
varying float vSeed;
varying vec3 vView;
varying float vScale;

void main() {
  vec3 worldPos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sx = length(instanceMatrix[0].xyz);
  float sy = length(instanceMatrix[1].xyz);
  vLocal = uv;
  vScale = sx;
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
varying float vScale;

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
  float edge = smoothstep(0.0, 0.18, 1.0 - max(abs(vLocal.x * 2.0 - 1.0), abs(vLocal.y * 2.0 - 1.0)));
  float nearFade = smoothstep(0.35, 1.0, vDist / max(vScale * 1.2, 1.0));
  float alpha = dens * fade * (1.0 - uSpace * 0.85) * edge * nearFade;
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

export const FARM_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const FARM_FRAG = /* glsl */ `
uniform sampler2D uFields;
uniform sampler2D uShadow;
uniform vec2 uCamXZ;
uniform vec2 uWind;
uniform float uTime;
uniform float uNight;
uniform vec3 uHorizon;
uniform vec2 uSunShift;
varying vec3 vWorld;

void main() {
  vec2 wxz = vWorld.xz;
  vec3 fields = texture2D(uFields, wxz / 2300.0).rgb;
  float ang = 0.52;
  float ca = cos(ang);
  float sa = sin(ang);
  vec2 rot = vec2(ca * wxz.x - sa * wxz.y, sa * wxz.x + ca * wxz.y);
  vec3 fieldsFar = texture2D(uFields, rot / 4150.0 + vec2(0.17, 0.41)).rgb;
  vec3 col = mix(fields, fieldsFar, 0.36);
  float cell = fract(sin(dot(floor(wxz / 9000.0), vec2(12.9898, 78.233))) * 43758.5453);
  col *= mix(0.93, 1.06, cell);
  col = mix(col, col * vec3(0.62, 0.72, 1.05), uNight);
  col *= mix(1.0, 0.26, uNight);

  vec2 suv = (wxz - uWind * uTime - uSunShift) / 1480.0;
  float sh = texture2D(uShadow, suv).r;
  col *= 1.0 - sh * mix(0.32, 0.04, uNight);

  vec3 toCam = cameraPosition - vWorld;
  float viewUp = toCam.y / max(length(toCam), 1.0);
  float dist = length(wxz - uCamXZ);
  float haze = smoothstep(1800.0, 6200.0, dist);
  haze = max(haze, smoothstep(0.30, 0.10, viewUp));
  col = mix(col, uHorizon, haze);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const CIRRUS_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const CIRRUS_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x);
  edge *= smoothstep(0.0, 0.22, vUv.y) * smoothstep(0.0, 0.22, 1.0 - vUv.y);
  vec3 dir = normalize(vWorld - cameraPosition);
  float ang = 1.0 - pow(abs(dir.y), 4.0);
  float a = tex.a * uOpacity * ang * edge;
  if (a < 0.015) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, a);
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
  float blot = fract(sin(dot(floor(vP * 2.6 + uSeed), vec3(12.9, 78.2, 37.7))) * 43758.5);
  col = mix(col, uB * 1.25, smoothstep(0.55, 0.82, blot) * 0.4);
  col = mix(col, uA * 0.72, smoothstep(0.2, 0.4, blot) * 0.25);
  float pole = smoothstep(0.62, 0.92, abs(normalize(vP).y));
  col = mix(col, vec3(0.9, 0.94, 0.98), pole * 0.5);
  col = mix(col, uA * 0.68, storm * 0.18);
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
  float patchN = noise(vWorld.xz * 0.035);
  vec3 sand = vec3(0.86, 0.74, 0.46);
  vec3 teal = vec3(0.05, 0.42, 0.46);
  vec3 coral = vec3(0.92, 0.36, 0.4);
  vec3 violet = vec3(0.48, 0.2, 0.56);
  vec3 albedo = mix(sand, teal, smoothstep(0.28, 0.62, vH));
  albedo = mix(albedo, vec3(0.12, 0.48, 0.3), smoothstep(0.58, 0.86, noise(vWorld.xz * 0.07)) * 0.62);
  albedo = mix(albedo, coral, smoothstep(0.62, 0.86, patchN) * 0.65);
  albedo = mix(albedo, violet, smoothstep(0.78, 0.96, noise(vWorld.xz * 0.02)));
  float rip = 0.5 + 0.5 * sin(vWorld.x * 0.42 + vWorld.z * 0.18);
  albedo = mix(albedo, sand * 1.05, rip * 0.12);
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
  if (r > 1.02) discard;
  float n = fbm(p * 2.4 + vec2(uSeed, uTime * 0.018));
  float n2 = fbm(p * 4.1 - vec2(uTime * 0.012, uSeed));
  float mask = pow(1.0 - smoothstep(0.05, 1.0, r), 1.2);
  float dens = pow(n * 0.62 + n2 * 0.38, 1.2) * mask;
  if (dens < 0.03) discard;
  vec3 col = mix(uA, uB, n2);
  col = mix(col, vec3(1.0, 0.82, 0.62), pow(n, 3.0) * 0.35);
  gl_FragColor = vec4(col * dens, dens * 0.85);
}
`;

