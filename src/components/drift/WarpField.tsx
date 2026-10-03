import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { runtime } from "@/game/runtime";
import { useHud } from "@/store/hud";

const CAP = 1400;

const VERT = /* glsl */ `
attribute vec4 aColor;
varying vec4 vColor;
void main() {
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uBoost;
varying vec4 vColor;
void main() {
  if (vColor.a < 0.015) discard;
  gl_FragColor = vec4(vColor.rgb * (1.0 + uBoost * 0.4), vColor.a);
}
`;

function seedStar(i: number, pos: Float32Array, rgb: Float32Array, anywhere: boolean) {
  const z = anywhere ? -8 - Math.random() * 860 : -640 - Math.random() * 240;
  const spread = Math.abs(z) * 0.86;
  const ang = Math.random() * Math.PI * 2;
  const rad = Math.sqrt(Math.random()) * spread;
  pos[i * 3] = Math.cos(ang) * rad;
  pos[i * 3 + 1] = Math.sin(ang) * rad;
  pos[i * 3 + 2] = z;
  const pick = (i * 17 + Math.floor(Math.random() * 5)) % 20;
  if (pick === 0) {
    rgb[i * 3] = 1;
    rgb[i * 3 + 1] = 0.84;
    rgb[i * 3 + 2] = 0.58;
  } else if (pick < 5) {
    rgb[i * 3] = 0.68;
    rgb[i * 3 + 1] = 0.82;
    rgb[i * 3 + 2] = 1;
  } else {
    rgb[i * 3] = 0.92;
    rgb[i * 3 + 1] = 0.95;
    rgb[i * 3 + 2] = 1;
  }
}

function writeColor(colors: Float32Array, i: number, r: number, g: number, b: number) {
  const alphas = [0.95, 0.95, 0, 0.95, 0, 0];
  const o = i * 24;
  for (let v = 0; v < 6; v++) {
    const k = o + v * 4;
    colors[k] = r;
    colors[k + 1] = g;
    colors[k + 2] = b;
    colors[k + 3] = alphas[v];
  }
}

function writeQuad(
  positions: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  streak: number,
  width: number,
) {
  let nx = 1;
  let ny = 0;
  const len = Math.hypot(x, y);
  if (len > 0.0001) {
    nx = -y / len;
    ny = x / len;
  }
  const px = nx * width;
  const py = ny * width;
  const tx = px * 0.22;
  const ty = py * 0.22;
  const tz = z - streak;
  const o = i * 18;
  positions[o] = x + px;
  positions[o + 1] = y + py;
  positions[o + 2] = z;
  positions[o + 3] = x - px;
  positions[o + 4] = y - py;
  positions[o + 5] = z;
  positions[o + 6] = x + tx;
  positions[o + 7] = y + ty;
  positions[o + 8] = tz;
  positions[o + 9] = x - px;
  positions[o + 10] = y - py;
  positions[o + 11] = z;
  positions[o + 12] = x - tx;
  positions[o + 13] = y - ty;
  positions[o + 14] = tz;
  positions[o + 15] = x + tx;
  positions[o + 16] = y + ty;
  positions[o + 17] = tz;
}

export function WarpField() {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const built = useMemo(() => {
    const pos = new Float32Array(CAP * 3);
    const rgb = new Float32Array(CAP * 3);
    const positions = new Float32Array(CAP * 18);
    const colors = new Float32Array(CAP * 24);
    for (let i = 0; i < CAP; i++) {
      seedStar(i, pos, rgb, true);
      writeColor(colors, i, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
      writeQuad(positions, i, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], 0.6, 0.08);
    }
    const geo = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    const colorAttr = new THREE.BufferAttribute(colors, 4);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", positionAttr);
    geo.setAttribute("aColor", colorAttr);
    geo.setDrawRange(0, CAP * 6);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uBoost: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    return { pos, rgb, positions, colors, geo, mat, positionAttr, colorAttr };
  }, []);

  useEffect(
    () => () => {
      built.geo.dispose();
      built.mat.dispose();
    },
    [built],
  );

  useFrame(({ camera }, raw) => {
    const root = group.current;
    const sheet = mesh.current;
    if (!root || !sheet) return;
    const dt = Math.min(raw, 0.05);
    root.position.copy(camera.position);
    root.quaternion.copy(camera.quaternion);

    const show = runtime.spaceAmt > 0.05 && runtime.fx.stars;
    sheet.visible = show;
    if (!show) {
      if (runtime.world !== "space") runtime.boostHold = false;
      runtime.boostAmt += (0 - runtime.boostAmt) * Math.min(1, dt * 4);
      return;
    }

    const injected = runtime.injectedKeys;
    let want = runtime.boostHold ? 1 : 0;
    if (!want) {
      if (injected) {
        for (let i = 0; i < injected.length; i++) {
          const code = injected[i];
          if (code === "ShiftLeft" || code === "ShiftRight" || code === "Space") want = 1;
        }
      } else if (
        runtime.keys.has("ShiftLeft") ||
        runtime.keys.has("ShiftRight") ||
        runtime.keys.has("Space")
      ) {
        want = 1;
      }
    }
    runtime.boostAmt += (want - runtime.boostAmt) * Math.min(1, dt * 5.5);
    built.mat.uniforms.uBoost.value = runtime.boostAmt;

    const reduced = useHud.getState().reducedMotion;
    const lodScale = runtime.lod >= 2 ? 0.42 : runtime.lod >= 1 ? 0.7 : 1;
    let active = Math.round(CAP * runtime.starDensity * lodScale);
    if (active < 72) active = 72;
    if (active > CAP) active = CAP;
    built.geo.setDrawRange(0, active * 6);

    const speed01 = Math.min(1, Math.max(0, runtime.cruise));
    const visual = (90 + speed01 * 260) * (1 + runtime.boostAmt * 4.8) * (reduced ? 0.35 : 1);
    const stretch =
      reduced || !runtime.fx.streaks ? 0.01 : 0.055 + speed01 * 0.04 + runtime.boostAmt * 0.42;

    let recolored = false;
    const { pos, rgb, positions, colors } = built;
    for (let i = 0; i < active; i++) {
      const jitter = 0.48 + ((i * 37) % 100) / 140;
      let z = pos[i * 3 + 2] + visual * jitter * dt;
      if (z > -2.2) {
        seedStar(i, pos, rgb, false);
        writeColor(colors, i, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
        recolored = true;
        z = pos[i * 3 + 2];
      } else {
        pos[i * 3 + 2] = z;
      }
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const width = Math.abs(z) * (0.00135 + runtime.boostAmt * 0.0008) * (1 + (i % 17 === 0 ? 0.8 : 0));
      const streak = Math.min(Math.abs(z) - 1.8, Math.abs(z) * stretch * (0.55 + jitter));
      writeQuad(positions, i, x, y, z, streak, width);
    }
    built.positionAttr.needsUpdate = true;
    if (recolored) built.colorAttr.needsUpdate = true;
  }, -1);

  return (
    <group ref={group}>
      <mesh ref={mesh} geometry={built.geo} material={built.mat} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
