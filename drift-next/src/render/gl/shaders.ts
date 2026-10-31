import { BODY_ALPHA, CLOUD_BODY, CLOUD_SHADE, SEA_FAR, SEA_HORIZON, SKY_HORIZON, SKY_TOP, type RGB } from "../palette.ts"
import { DECK_TILE, SHADOW_ALPHA, SPRITE_EXT } from "../scene.ts"

/**
 * The shaders, as text. GLSL ES 3.00 (WebGL2). Every colour is written in sRGB-coded values and blended as is, with no gamma
 * step, so a pixel here has the same brightness the 2D picture and the brightness meter measure.
 * Nothing here is copied from elsewhere: the shapes are sums of circles and plain sines, and the floor is one small seeded texture.
 */

const num = (v: number) => (Number.isInteger(v) ? `${v}.0` : v.toFixed(5))
const vec3 = (c: RGB) => `vec3(${num(c[0] / 255)}, ${num(c[1] / 255)}, ${num(c[2] / 255)})`

const COLORS = `
const vec3 SKY_TOP = ${vec3(SKY_TOP)};
const vec3 SKY_HORIZON = ${vec3(SKY_HORIZON)};
const vec3 SEA_HORIZON = ${vec3(SEA_HORIZON)};
const vec3 SEA_FAR = ${vec3(SEA_FAR)};
const vec3 BODY = ${vec3(CLOUD_BODY)};
const vec3 SHADE = ${vec3(CLOUD_SHADE)};
const float BODY_ALPHA = ${num(BODY_ALPHA)};
`

/** One big triangle that covers the screen. `vPx` is the position in CSS pixels, y down, like the 2D picture. */
export const FULL_VERT = `#version 300 es
precision highp float;
uniform vec2 uSize;
out vec2 vPx;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vPx = vec2(p.x, 1.0 - p.y) * uSize;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

/** The sea-wide tint, drawn over everything while inside a cloud. */
export const FLAT_FRAG = `#version 300 es
precision highp float;
uniform vec3 uColor;
uniform float uAlpha;
out vec4 o;
void main() {
  o = vec4(uColor, uAlpha);
}
`

/**
 * The sky and the cloud-sea floor. `floor` picks how much the floor draws (see LOOK in scene.ts): 0 flat, 1 one lookup,
 * 2 two lookups with relief, 3 five lookups with relief and a hazy horizon. `edgePx` softens the horizon line.
 *
 * The sky and the sea start as the exact same gradients the 2D picture uses, so the average brightness is the same; the
 * floor adds light and shade around that average, fading to nothing toward the horizon.
 */
export function bgFrag(floor: 0 | 1 | 2 | 3, edgePx: number): string {
  return `#version 300 es
precision highp float;
precision highp sampler2D;
#define FLOOR ${floor}
const float EDGE = ${num(edgePx)};
const float TILE = ${num(DECK_TILE)};
${COLORS}
in vec2 vPx;
out vec4 o;
uniform vec2 uSize;
uniform vec2 uC;
uniform float uF;
uniform float uHorizon;
uniform vec2 uTilt;
uniform vec3 uCam;
uniform vec2 uYaw;
uniform vec2 uPitch;
uniform sampler2D uDeck;

#if FLOOR > 0
const vec2 LIGHT = vec2(-0.018, -0.026);

vec3 detail(vec3 sea, vec2 q, float sd) {
  // the ray through this pixel, then where it meets the floor
  vec2 r = vec2((q.x - uC.x) / uF, (uC.y - q.y) / uF);
  float ahead = uPitch.y - r.y * uPitch.x;
  float lift = uPitch.x + r.y * uPitch.y;
  float k = uCam.y / max(-lift, 0.0004);
  vec2 w = uCam.xz + (k * ahead) * vec2(-uYaw.x, -uYaw.y) + (k * r.x) * vec2(uYaw.y, -uYaw.x);
  vec2 p = w / TILE;
  float fade = smoothstep(0.012, 0.22, sd);
#if FLOOR == 1
  float h = texture(uDeck, p * 0.5).r - 0.5;
  return sea + vec3(h * 0.34 * fade);
#elif FLOOR == 2
  vec2 pb = p * 0.5;
  vec3 a = texture(uDeck, pb).rgb;
  vec3 b = texture(uDeck, pb + LIGHT).rgb;
  float h = (a.r - 0.5) * 0.7 + (a.g - 0.5) * 0.3;
  float rel = (a.r * 0.7 + a.g * 0.3) - (b.r * 0.7 + b.g * 0.3);
  return sea + vec3((h * 0.34 + rel * 0.8) * fade);
#else
  vec2 pb = p * 0.5;
  vec3 a = texture(uDeck, pb).rgb;
  vec3 b = texture(uDeck, pb + LIGHT).rgb;
  vec3 c = texture(uDeck, p).rgb;
  vec3 d = texture(uDeck, p + LIGHT * 0.6).rgb;
  vec3 e = texture(uDeck, p * 3.0 + 0.37).rgb;
  float h = (a.r - 0.5) * 0.5 + (c.g - 0.5) * 0.3 + (e.b - 0.5) * 0.2;
  float rel = (a.r * 0.55 + c.g * 0.45) - (b.r * 0.55 + d.g * 0.45);
  return sea + vec3((h * 0.36 + rel * 0.9) * fade);
#endif
}
#endif

void main() {
  // undo the bank tilt: where is this pixel in the untilted picture?
  vec2 d = vPx - uC;
  vec2 q = vec2(uTilt.x * d.x + uTilt.y * d.y, -uTilt.y * d.x + uTilt.x * d.y) + uC;
  float below = q.y - uHorizon;
  vec3 sky = mix(SKY_TOP, SKY_HORIZON, clamp((q.y - (uHorizon - uSize.y)) / uSize.y, 0.0, 1.0));
  float sd = clamp(below / uSize.y, 0.0, 1.0);
  vec3 sea = mix(SEA_HORIZON, SEA_FAR, sd);
#if FLOOR > 0
  sea = detail(sea, q, sd);
#endif
#if FLOOR == 3
  sea = mix(sea, SKY_HORIZON, 0.45 * (1.0 - smoothstep(0.0, 0.1, sd)));
#endif
  float onFloor = smoothstep(-EDGE, EDGE, below);
  o = vec4(mix(sky, sea, onFloor), 1.0);
}
`
}

/** A cloud is one quad per cloud. Corners come from gl_VertexID, so no per-vertex buffer is needed. */
export const SPRITE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aA; // x, y, radius, alpha
layout(location = 1) in vec2 aB; // shape number, distance haze
uniform vec2 uSize;
out vec2 vLocal;
out vec3 vInfo;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  vLocal = c * ${num(SPRITE_EXT)};
  vInfo = vec3(aA.w, aB.x, aB.y);
  vec2 px = aA.xy + c * (aA.z * ${num(SPRITE_EXT)});
  gl_Position = vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
}
`

/**
 * The cloud. `cloud` 1 is a soft flat disc. 2 is three lit lobes. 3 is five lobes with a wobbly edge, a lit rim and a
 * veil of distance. The colour is always between the shade and the body colour, never brighter than the body.
 */
export function spriteFrag(cloud: 1 | 2 | 3): string {
  const lobes = cloud === 3 ? 5 : 3
  return `#version 300 es
precision highp float;
#define CLOUD ${cloud}
#define LOBES ${lobes}
${COLORS}
in vec2 vLocal;
in vec3 vInfo;
out vec4 o;
uniform float uFog;

#if CLOUD > 1
const float SC = 1.3;

// lobe i of a cloud: centre x, centre y, radius, in units of the cloud's radius (y is down)
vec3 lobeOf(int i, float seed) {
  float fi = float(i);
  if (i == 0) {
    return vec3(0.04 * sin(seed * 29.0), -0.04, ${cloud === 3 ? "0.46" : "0.50"});
  }
  float t = (fi - 1.0) / ${num(lobes - 2)};
  float th = mix(3.14159, 0.0, t);
  float x = cos(th) * 0.46 + 0.07 * sin(seed * 17.0 + fi * 1.9);
  float y = 0.08 - sin(th) * ${cloud === 3 ? "0.22" : "0.0"} + 0.06 * sin(seed * 11.0 + fi * 3.1);
  float r = ${cloud === 3 ? "0.34" : "0.40"} + 0.05 * sin(seed * 13.0 + fi * 2.7);
  return vec3(x, y, r);
}
#endif

void main() {
  float a = vInfo.x;
  float seed = vInfo.y;
  vec2 p = vLocal;
#if CLOUD == 1
  float cover = 1.0 - smoothstep(0.74, 1.02, length(p));
  o = vec4(BODY, a * BODY_ALPHA * cover);
#else
  // the cloud's edge is its nearest lobe; its surface tilt blends the lobes, so no hard seams show where they meet
  float best = 1.0e9;
  vec2 bsum = vec2(0.0);
  float wsum = 0.0;
  for (int i = 0; i < LOBES; i++) {
    vec3 l = lobeOf(i, seed);
    vec2 dq = p - l.xy * SC;
    float rr = l.z * SC;
    float sdist = length(dq) - rr;
    best = min(best, sdist);
    float wgt = exp(-7.0 * sdist);
    bsum += (dq / rr) * wgt;
    wsum += wgt;
  }
  vec2 bq = bsum / wsum;
  bq /= max(1.0, length(bq));
#if CLOUD == 3
  best += 0.035 * sin(5.0 * p.x + seed * 23.0) * sin(4.0 * p.y + seed * 31.0) + 0.018 * sin(11.0 * p.x - seed * 7.0) * sin(9.0 * p.y + seed * 5.0);
#endif
  float cover = 1.0 - smoothstep(-0.04, 0.07, best);
  vec3 n = vec3(bq, sqrt(max(0.0, 1.0 - dot(bq, bq))));
  float lit = clamp(dot(n, normalize(vec3(-0.35, -0.65, 0.68))) * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(SHADE, BODY, 0.32 + 0.68 * lit);
  col = mix(col, SHADE, 0.3 * smoothstep(0.05, 0.75, p.y));
#if CLOUD == 3
  float rim = (1.0 - n.z) * max(dot(normalize(bq + vec2(1.0e-4)), vec2(-0.5, -0.85)), 0.0);
  col += (BODY - col) * (rim * 0.7);
  col = mix(col, SKY_HORIZON, vInfo.z * uFog * 0.45);
#endif
  col = min(col, BODY);
  o = vec4(col, a * BODY_ALPHA * cover);
#endif
}
`
}

/** A cloud's shadow on the floor: a soft ellipse, kept below the horizon. */
export const SHADOW_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aA; // x, y, rx, ry
layout(location = 1) in float aS; // alpha
uniform vec2 uSize;
out vec2 vLocal;
out vec2 vPx;
out float vA;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  vLocal = c;
  vA = aS;
  vec2 px = aA.xy + c * aA.zw;
  vPx = px;
  gl_Position = vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
}
`

export const SHADOW_FRAG = `#version 300 es
precision highp float;
${COLORS}
in vec2 vLocal;
in vec2 vPx;
in float vA;
out vec4 o;
uniform vec2 uC;
uniform float uHorizon;
uniform vec2 uTilt;
void main() {
  float k = 1.0 - smoothstep(0.15, 1.0, length(vLocal));
  vec2 d = vPx - uC;
  float qy = -uTilt.y * d.x + uTilt.x * d.y + uC.y;
  float onFloor = smoothstep(uHorizon, uHorizon + 4.0, qy);
  o = vec4(SEA_FAR * 0.55, vA * ${num(SHADOW_ALPHA)} * k * k * onFloor);
}
`
