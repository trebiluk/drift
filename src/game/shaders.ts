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
varying vec3 vDir;

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 sun = normalize(uSun);
  float mu = max(dot(dir, sun), 0.0);

  vec3 zenith = mix(vec3(0.14, 0.44, 0.88), vec3(0.02, 0.04, 0.12), uNight);
  vec3 horizon = mix(vec3(0.92, 0.96, 1.0), vec3(0.14, 0.18, 0.34), uNight);
  vec3 below = mix(vec3(0.80, 0.90, 0.97), vec3(0.06, 0.08, 0.16), uNight);
  vec3 sky = mix(below, horizon, smoothstep(-0.22, 0.04, h));
  sky = mix(sky, zenith, smoothstep(0.04, 0.82, h));

  float disc = pow(mu, mix(320.0, 480.0, uNight));
  float corona = pow(mu, mix(16.0, 22.0, uNight));
  float haze = pow(mu, 2.4);
  vec3 warm = vec3(1.0, 0.97, 0.86);
  vec3 cool = vec3(0.82, 0.90, 1.0);
  vec3 lamp = mix(warm, cool, uNight);
  sky += lamp * disc * mix(4.0, 2.2, uNight);
  sky += mix(vec3(1.0, 0.91, 0.64), vec3(0.55, 0.68, 1.0), uNight) * corona * mix(1.2, 0.55, uNight);
  sky += mix(vec3(1.0, 0.82, 0.54), vec3(0.25, 0.32, 0.55), uNight) * haze * mix(0.38, 0.16, uNight);

  vec3 space = vec3(0.005, 0.007, 0.02);
  float limb = pow(1.0 - abs(h), 8.5);
  space += vec3(0.18, 0.42, 0.98) * limb * 1.05;
  space += lamp * disc * 3.4;
  space += mix(vec3(1.0, 0.86, 0.55), cool, uNight) * corona * 0.48;

  vec3 col = mix(sky, space, uSpace);
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p *= 2.07;
    a *= 0.52;
  }
  return v;
}

void main() {
  vec3 pos = position;
  vec2 p = (pos.xz + vec2(uOffset.x, uOffset.y)) * 0.0046;
  p += vec2(uTime * 0.0052, uTime * 0.0026);
  float h = pow(fbm(p), 1.55);
  pos.y += (h - 0.4) * 16.0;
  float e = 2.2;
  float hx = pow(fbm(p + vec2(e * 0.0046, 0.0)), 1.55);
  float hz = pow(fbm(p + vec2(0.0, e * 0.0046)), 1.55);
  vec3 n = normalize(vec3((h - hx) * 32.0, 1.0, (h - hz) * 32.0));
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
  vec3 n = normalize(vN);
  vec3 sun = normalize(uSun);
  float ndotl = max(dot(n, sun), 0.0);
  float fluff = fbm(vWorld.xz * 0.018);
  vec3 valley = mix(vec3(0.48, 0.60, 0.76), vec3(0.10, 0.14, 0.24), uNight);
  vec3 peak = mix(vec3(1.0, 0.995, 0.98), vec3(0.58, 0.64, 0.80), uNight);
  vec3 albedo = mix(valley, peak, smoothstep(0.14, 0.74, vH * 0.5 + fluff * 0.6));
  vec3 col = albedo * mix(0.42 + 0.7 * ndotl, 0.22 + 0.55 * ndotl, uNight);
  col += mix(vec3(1.0, 0.96, 0.86), vec3(0.72, 0.82, 1.0), uNight) * pow(ndotl, 7.0) * mix(0.34, 0.22, uNight);

  vec3 view = normalize(uCam - vWorld);
  float rim = pow(1.0 - max(dot(view, vec3(0.0, 1.0, 0.0)), 0.0), 2.4);
  col += mix(vec3(0.96, 0.98, 1.0), vec3(0.4, 0.5, 0.72), uNight) * rim * 0.14;
  float silver = pow(max(dot(reflect(-sun, n), view), 0.0), 4.5) * mix(0.22, 0.32, uNight);
  col += mix(vec3(1.0, 0.97, 0.9), vec3(0.78, 0.86, 1.0), uNight) * silver;

  float dist = length(uCam.xz - vWorld.xz);
  float haze = smoothstep(1300.0, 4800.0, dist);
  vec3 fogCol = mix(vec3(0.78, 0.89, 0.97), vec3(0.08, 0.11, 0.2), uNight);
  col = mix(col, fogCol, haze);

  float alpha = uFade * (1.0 - haze * 0.42);
  float dy = uCam.y - vWorld.y;
  alpha *= smoothstep(22.0, 70.0, dy);
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export const PUFF_VERT = /* glsl */ `
uniform vec3 uSun;
varying vec2 vUv;
varying float vLight;
varying float vDist;
varying vec3 vView;

void main() {
  vec3 worldPos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sx = length(instanceMatrix[0].xyz);
  float sy = length(instanceMatrix[1].xyz);
  float slot = instanceMatrix[2][2] > 0.5 ? 0.5 : 0.0;
  vUv = vec2(uv.x * 0.5 + slot, uv.y);
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 pos = worldPos + camRight * position.x * sx + camUp * position.y * sy;
  vDist = length(cameraPosition - worldPos);
  vView = cameraPosition - worldPos;
  float sunSide = 0.5 + 0.5 * dot(normalize(uSun.xz), normalize(camRight.xz + vec2(0.0001)));
  vLight = 0.64 + sunSide * 0.4 + uv.y * 0.2;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}
`;

export const PUFF_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uSun;
uniform float uSpace;
uniform float uNight;
varying vec2 vUv;
varying float vLight;
varying float vDist;
varying vec3 vView;

void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.03) discard;
  vec3 view = normalize(vView);
  vec3 sun = normalize(uSun);
  float backlit = pow(max(dot(view, sun), 0.0), 3.5);
  vec3 col = t.rgb * mix(vLight, vLight * 0.55 + 0.12, uNight);
  col += mix(vec3(1.0, 0.96, 0.88), vec3(0.7, 0.82, 1.0), uNight) * backlit * mix(0.42, 0.28, uNight);
  col += vec3(1.0, 0.98, 0.94) * pow(t.a, 2.0) * mix(0.08, 0.04, uNight);
  float fade = smoothstep(1100.0, 340.0, vDist);
  float spaceFade = 1.0 - uSpace * 0.78;
  float alpha = t.a * fade * spaceFade;
  gl_FragColor = vec4(col * alpha, alpha);
}
`;
