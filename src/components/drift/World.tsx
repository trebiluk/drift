import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cloudImmersion, DEFAULT_CRUISE, layerName, MAX_SPEED, MIN_SPEED, spaceFactor, stepCraft, WORLD_HOME } from "@/game/flight";
import { sampleActions } from "@/game/input";
import { runtime } from "@/game/runtime";
import {
  ATMOSPHERE_FRAG,
  ATMOSPHERE_VERT,
  CIRRUS_FRAG,
  CIRRUS_VERT,
  FARM_FRAG,
  FARM_VERT,
  PUFF_FRAG,
  PUFF_VERT,
} from "@/game/shaders";
import { createCirrusTexture, createCloudShadowTexture, createFieldTexture, createGlowTexture, createRayTexture, type ShadowBlob } from "@/game/textures";
import { useHud } from "@/store/hud";
import { Airplanes } from "./Airplanes";
import { ReefField } from "./ReefField";
import { SpaceField } from "./SpaceField";

export const SUN_DIR = new THREE.Vector3(1.15, 0.58, 0.42).normalize();
const WIND_DIR = new THREE.Vector2(0.93, 0.37).normalize();
const GROUND_Y = -1400;
const CLOUD_DECK_Y = 110;
const SUN_SHIFT = new THREE.Vector2(
  (SUN_DIR.x / SUN_DIR.y) * (CLOUD_DECK_Y - GROUND_Y),
  (SUN_DIR.z / SUN_DIR.y) * (CLOUD_DECK_Y - GROUND_Y),
);
const WRAP_SPAN = 740 * 2;

function windVelocity(out: THREE.Vector2) {
  return out.set(WIND_DIR.x * runtime.wind, WIND_DIR.y * runtime.wind);
}

const _dummy = new THREE.Object3D();
const _gliderOffset = new THREE.Vector3();
const _gliderEuler = new THREE.Euler(0, 0, 0, "YXZ");
const _gliderQuat = new THREE.Quaternion();
const GLIDER_SPAN = 1.72;
const _fwd = new THREE.Vector3();
const _clearDay = new THREE.Color(0x7eb0e4);
const _clearNight = new THREE.Color(0x0b1220);
const _fogDay = new THREE.Color(0x6ea4dc);
const _fogCloud = new THREE.Color(0xe4edf6);
const _fogNight = new THREE.Color(0x151c2c);
const _fogNightCloud = new THREE.Color(0x2a3144);
const _fogSpace = new THREE.Color(0x070b14);
const _clearMix = new THREE.Color();
const WRAP = 740;

function wrapAxis(value: number, center: number, half: number) {
  let v = value;
  const span = half * 2;
  while (v - center > half) v -= span;
  while (v - center < -half) v += span;
  return v;
}

function Atmosphere() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSun: { value: SUN_DIR.clone() },
          uSpace: { value: 0 },
          uNight: { value: 0 },
          uStars: { value: 1 },
          uDeep: { value: 0 },
          uReef: { value: 0 },
          uTime: { value: 0 },
          uGroundHaze: { value: 1 },
        },
        vertexShader: ATMOSPHERE_VERT,
        fragmentShader: ATMOSPHERE_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        fog: false,
      }),
    [],
  );

  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ camera, clock }) => {
    mesh.current?.position.copy(camera.position);
    mat.uniforms.uSpace.value = spaceFactor(camera.position.y, runtime.world);
    mat.uniforms.uNight.value = runtime.night;
    mat.uniforms.uStars.value = runtime.fx.stars ? 1 : 0;
    mat.uniforms.uDeep.value = runtime.spaceAmt;
    mat.uniforms.uReef.value = runtime.reefAmt;
    mat.uniforms.uTime.value = clock.elapsedTime;
    const ground = runtime.world === "sky" && runtime.spaceAmt < 0.45 && runtime.reefAmt < 0.45;
    mat.uniforms.uGroundHaze.value = ground ? 1 : 0;
  });

  return (
    <mesh ref={mesh} material={mat} frustumCulled={false} renderOrder={-1000}>
      <sphereGeometry args={[4200, 24, 16]} />
    </mesh>
  );
}

function Sun() {
  const group = useRef<THREE.Group>(null);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(createGlowTexture());
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
        fog: false,
      }),
    [tex],
  );

  useEffect(
    () => () => {
      tex.dispose();
      mat.dispose();
    },
    [tex, mat],
  );

  useFrame(({ camera }) => {
    if (!group.current) return;
    group.current.visible = runtime.fx.sun && runtime.reefAmt < 0.55;
    group.current.position.copy(camera.position).addScaledVector(SUN_DIR, 2800);
    const n = runtime.night;
    const s = (1 + spaceFactor(camera.position.y, runtime.world) * 0.35) * (1 - n * 0.38);
    group.current.scale.setScalar(s);
    group.current.scale.setScalar(s);
    mat.opacity = runtime.fx.sun ? 0.95 - n * 0.18 : 0;
    mat.color.setRGB(1 - n * 0.22, 1 - n * 0.1, 1);
  });

  return (
    <group ref={group} renderOrder={-800}>
      <sprite material={mat} scale={[620, 620, 1]} />
      <sprite material={mat} scale={[210, 210, 1]} />
    </group>
  );
}

function GodRays() {
  const group = useRef<THREE.Group>(null);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(createRayTexture());
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
        rotation: 0,
        fog: false,
      }),
    [tex],
  );

  useEffect(
    () => () => {
      tex.dispose();
      mat.dispose();
    },
    [tex, mat],
  );

  useFrame(({ camera }) => {
    if (!group.current) return;
    if (runtime.reefAmt > 0.4 || runtime.spaceAmt > 0.55 || !runtime.fx.sun) {
      mat.opacity = 0;
      group.current.visible = false;
      return;
    }
    group.current.visible = true;
    camera.getWorldDirection(_fwd);
    const toward = Math.max(0, _fwd.dot(SUN_DIR));
    const vis =
      toward ** 3 *
      (0.18 + runtime.inCloud * 0.55) *
      (1 - spaceFactor(camera.position.y, runtime.world) * 0.7) *
      (1 - runtime.night * 0.55) *
      (1 - runtime.reefAmt) *
      (1 - runtime.spaceAmt);
    mat.opacity = vis;
    mat.color.setRGB(1, 1 - runtime.night * 0.15, 1 - runtime.night * 0.35);
    group.current.position.copy(camera.position).addScaledVector(SUN_DIR, 240);
  });

  return (
    <group ref={group} renderOrder={8}>
      <sprite material={mat} scale={[90, 420, 1]} />
      <sprite material={mat} scale={[40, 260, 1]} position={[18, -10, 0]} />
    </group>
  );
}

const _axisX = new THREE.Vector3();
const _axisY = new THREE.Vector3();
const _axisZ = new THREE.Vector3();
const _basis = new THREE.Matrix4();

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

type Puff = {
  x: number;
  y: number;
  z: number;
  s: number;
  layer: number;
  wrap: number;
};

function buildPuffs(_count: number, mobile: boolean, narrow: boolean): { puffs: Puff[]; shadows: ShadowBlob[] } {
  const list: Puff[] = [];
  const shadows: ShadowBlob[] = [];
  const yaw = runtime.craft.yaw;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = -fz;
  const rz = fx;
  const rng = mulberry32(19);
  const scale = narrow ? 0.86 : 1;
  const layers = mobile
    ? [
        { n: 7, layer: 0, radius: 300, wrap: 740, y: 98, s: 112 * scale },
        { n: 9, layer: 1, radius: 900, wrap: 1680, y: 220, s: 66 * scale },
        { n: 10, layer: 2, radius: 1980, wrap: 3400, y: 540, s: 40 * scale },
      ]
    : [
        { n: 9, layer: 0, radius: 340, wrap: 820, y: 104, s: 132 * scale },
        { n: 12, layer: 1, radius: 1020, wrap: 1860, y: 236, s: 74 * scale },
        { n: 14, layer: 2, radius: 2200, wrap: 3700, y: 580, s: 46 * scale },
      ];
  for (const layer of layers) {
    for (let i = 0; i < layer.n; i++) {
      const ang = (i / layer.n) * Math.PI * 2 + 0.4;
      const along = layer.radius * (0.9 + rng() * 0.22);
      const side = Math.sin(ang) * layer.radius * 0.72 + (rng() - 0.5) * 40;
      const fwd = Math.cos(ang) * along;
      const x = fx * fwd + rx * side;
      const z = fz * fwd + rz * side;
      const y = layer.y + (rng() - 0.5) * (layer.layer === 0 ? 26 : 48);
      const s = layer.s * (0.86 + rng() * 0.28);
      list.push({ x, y, z, s, layer: layer.layer, wrap: layer.wrap });
      if (layer.layer < 2) {
        shadows.push({ x, z, rx: s * 0.52, rz: s * 0.36, rot: rng() * Math.PI });
      }
    }
  }
  return { puffs: list, shadows };
}

function CloudPuffs({ puffs }: { puffs: Puff[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = puffs.length;
  const wind = useMemo(() => new THREE.Vector2(), []);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSun: { value: SUN_DIR.clone() },
          uSpace: { value: 0 },
          uNight: { value: 0 },
        },
        vertexShader: PUFF_VERT,
        fragmentShader: PUFF_FRAG,
        transparent: true,
        depthWrite: false,
        premultipliedAlpha: true,
        side: THREE.DoubleSide,
        toneMapped: false,
        fog: false,
      }),
    [],
  );

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    const layers = new Float32Array(puffs.length);
    for (let i = 0; i < puffs.length; i++) layers[i] = puffs[i].layer;
    g.setAttribute("aLayer", new THREE.InstancedBufferAttribute(layers, 1));
    return g;
  }, [puffs]);

  useEffect(
    () => () => {
      mat.dispose();
      geo.dispose();
    },
    [mat, geo],
  );

  useFrame(({ camera, clock }) => {
    const inst = mesh.current;
    if (!inst) return;
    inst.visible = runtime.world === "sky" && camera.position.y < 820;
    if (!inst.visible) {
      runtime.inCloud = runtime.world === "sky" ? cloudImmersion(camera.position.y) : 0;
      return;
    }
    const lod = runtime.lod;
    let limit = count;
    if (lod > 1) {
      limit = 0;
      while (limit < count && puffs[limit].layer < 2) limit++;
    }
    inst.count = limit;
    windVelocity(wind);
    const ox = wind.x * clock.elapsedTime;
    const oz = wind.y * clock.elapsedTime;
    const cx = camera.position.x;
    const cz = camera.position.z;
    mat.uniforms.uSpace.value = spaceFactor(camera.position.y, runtime.world);
    mat.uniforms.uNight.value = runtime.night;

    let nearest = 4;
    for (let i = 0; i < limit; i++) {
      const puff = puffs[i];
      const drift = puff.layer === 0 ? 1 : puff.layer === 1 ? 0.62 : 0.28;
      const x = wrapAxis(puff.x + ox * drift, cx, puff.wrap);
      const z = wrapAxis(puff.z + oz * drift, cz, puff.wrap);
      const dx = x - cx;
      const dy = puff.y - camera.position.y;
      const dz = z - cz;
      if (puff.layer === 0) {
        const d = Math.hypot(dx, dy, dz) / (puff.s * 0.55);
        if (d < nearest) nearest = d;
      }
      const grow = puff.layer === 0 ? 1.62 : puff.layer === 1 ? 1.28 : 1.02;
      const tall = puff.layer === 0 ? 1.12 : puff.layer === 1 ? 0.92 : 0.72;
      _dummy.position.set(x, puff.y, z);
      _dummy.scale.set(puff.s * grow, puff.s * tall, 1);
      _dummy.rotation.set(0, 0, 0);
      _dummy.updateMatrix();
      inst.setMatrixAt(i, _dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;

    const nearCloud = THREE.MathUtils.clamp(1 - nearest, 0, 1);
    const punch = nearCloud > 0.7 ? (nearCloud - 0.7) / 0.3 : 0;
    runtime.inCloud = THREE.MathUtils.clamp(cloudImmersion(camera.position.y) * 0.12 + punch, 0, 1);
  });

  return <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} renderOrder={2} />;
}

type Streak = { x: number; y: number; z: number; w: number; d: number; yaw: number; tilt: number };

function Cirrus() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { gl } = useThree();
  const wind = useMemo(() => new THREE.Vector2(), []);
  const streaks = useMemo<Streak[]>(() => {
    const yaw0 = runtime.craft.yaw;
    const fx = -Math.sin(yaw0);
    const fz = -Math.cos(yaw0);
    const rx = -fz;
    const rz = fx;
    const rng = mulberry32(11);
    const open = 0.24;
    // Two sit in the opening view at different heights. The other six ring the sky.
    const slots = [
      { az: 0.1, r: 1320, y: 630, w: 1900, d: 540 },
      { az: -0.14, r: 1760, y: 490, w: 2000, d: 620 },
      { az: 1.25, r: 1540, y: 580, w: 1860, d: 560 },
      { az: 2.3, r: 1680, y: 640, w: 2100, d: 600 },
      { az: 3.25, r: 1420, y: 520, w: 1940, d: 580 },
      { az: 4.2, r: 1840, y: 650, w: 1880, d: 530 },
      { az: 5.05, r: 1280, y: 560, w: 2060, d: 640 },
      { az: -1.35, r: 1600, y: 610, w: 1920, d: 570 },
    ];
    const list: Streak[] = [];
    for (const slot of slots) {
      const jit = (rng() - 0.5) * ((24 * Math.PI) / 180);
      const az = Math.abs(slot.az) < 0.4 ? slot.az + jit * 0.2 : slot.az + jit;
      const ca = Math.cos(az);
      const sa = Math.sin(az);
      const x = (fx * ca + rx * sa) * slot.r;
      const z = (fz * ca + rz * sa) * slot.r;
      const elev = Math.atan2(slot.y - 190, slot.r);
      list.push({
        x,
        z,
        y: slot.y,
        w: slot.w,
        d: slot.d,
        yaw: Math.atan2(z, x) + Math.PI / 2,
        tilt: elev - open,
      });
    }
    return list;
  }, []);
  const tex = useMemo(() => {
    const map = new THREE.CanvasTexture(createCirrusTexture());
    map.colorSpace = THREE.NoColorSpace;
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    map.premultiplyAlpha = true;
    map.needsUpdate = true;
    return map;
  }, [gl]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: tex },
          uOpacity: { value: 0.22 },
          uNight: { value: 0 },
        },
        vertexShader: CIRRUS_VERT,
        fragmentShader: CIRRUS_FRAG,
        transparent: true,
        depthWrite: false,
        premultipliedAlpha: true,
        side: THREE.DoubleSide,
        toneMapped: false,
        fog: false,
      }),
    [tex],
  );
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useEffect(
    () => () => {
      tex.dispose();
      mat.dispose();
      geo.dispose();
    },
    [tex, mat, geo],
  );

  useFrame(({ camera, clock }) => {
    const inst = mesh.current;
    if (!inst) return;
    const sky = runtime.world === "sky" && runtime.spaceAmt < 0.4 && camera.position.y < 980;
    inst.visible = sky;
    if (!sky) return;
    mat.uniforms.uOpacity.value = 0.22 * (1 - runtime.night * 0.94);
    mat.uniforms.uNight.value = runtime.night;
    windVelocity(wind);
    const ox = wind.x * clock.elapsedTime;
    const oz = wind.y * clock.elapsedTime;
    const half = 3400;
    for (let i = 0; i < streaks.length; i++) {
      const s = streaks[i];
      const ct = Math.cos(s.tilt);
      const st = Math.sin(s.tilt);
      const ax = Math.cos(s.yaw);
      const az = Math.sin(s.yaw);
      const dx = az;
      const dz = -ax;
      _axisX.set(ax, 0, az);
      _axisY.set(dx * ct, st, dz * ct);
      _axisZ.set(-dx * st, ct, -dz * st);
      _basis.makeBasis(_axisX, _axisY, _axisZ);
      _dummy.quaternion.setFromRotationMatrix(_basis);
      const x = wrapAxis(s.x + ox, camera.position.x, half);
      const z = wrapAxis(s.z + oz, camera.position.z, half);
      _dummy.position.set(x, s.y, z);
      _dummy.scale.set(s.w, s.d, 1);
      _dummy.updateMatrix();
      inst.setMatrixAt(i, _dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, streaks.length]} frustumCulled={false} renderOrder={1} />;
}

function Farmland({ shadows }: { shadows: ShadowBlob[] }) {
  const mesh = useRef<THREE.Mesh>(null);
  const wind = useMemo(() => new THREE.Vector2(), []);
  const { gl } = useThree();
  const fieldTex = useMemo(() => {
    const map = new THREE.CanvasTexture(createFieldTexture());
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    map.needsUpdate = true;
    return map;
  }, [gl]);
  const shadowTex = useMemo(() => {
    const map = new THREE.CanvasTexture(createCloudShadowTexture(shadows, WRAP_SPAN));
    map.colorSpace = THREE.NoColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.flipY = false;
    map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    map.needsUpdate = true;
    return map;
  }, [gl, shadows]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uFields: { value: fieldTex },
          uShadow: { value: shadowTex },
          uCamXZ: { value: new THREE.Vector2() },
          uWind: { value: new THREE.Vector2() },
          uTime: { value: 0 },
          uNight: { value: 0 },
          uHorizon: { value: new THREE.Color(0.62, 0.78, 0.94) },
          uSunShift: { value: SUN_SHIFT.clone() },
        },
        vertexShader: FARM_VERT,
        fragmentShader: FARM_FRAG,
        toneMapped: false,
        fog: false,
      }),
    [fieldTex, shadowTex],
  );

  useEffect(
    () => () => {
      fieldTex.dispose();
      shadowTex.dispose();
      mat.dispose();
    },
    [fieldTex, shadowTex, mat],
  );

  useFrame(({ camera, clock }) => {
    if (!mesh.current) return;
    const sky = runtime.world === "sky" && runtime.spaceAmt < 0.45 && runtime.reefAmt < 0.45;
    mesh.current.visible = sky;
    if (!sky) return;
    mesh.current.position.x = camera.position.x;
    mesh.current.position.z = camera.position.z;
    windVelocity(wind);
    (mat.uniforms.uWind.value as THREE.Vector2).copy(wind);
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uNight.value = runtime.night;
    (mat.uniforms.uCamXZ.value as THREE.Vector2).set(camera.position.x, camera.position.z);
    const n = runtime.night;
    (mat.uniforms.uHorizon.value as THREE.Color).setRGB(
      0.62 + (0.12 - 0.62) * n,
      0.78 + (0.16 - 0.78) * n,
      0.94 + (0.32 - 0.94) * n,
    );
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]} material={mat} frustumCulled={false}>
      <planeGeometry args={[15200, 15200, 1, 1]} />
    </mesh>
  );
}

function FogRig() {
  const { scene } = useThree();
  const fog = useMemo(() => new THREE.FogExp2(0xc5dff0, 0.0004), []);

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame(({ camera }) => {
    const space = Math.max(spaceFactor(camera.position.y, runtime.world), runtime.spaceAmt);
    const inside = runtime.world === "sky" ? runtime.inCloud : 0;
    const n = runtime.night;
    if (runtime.reefAmt > 0.4) {
      fog.density = THREE.MathUtils.lerp(0.0012, 0.0024, runtime.reefAmt);
      fog.color.setRGB(0.08, 0.32, 0.4);
    } else {
      fog.density = THREE.MathUtils.lerp(0.00003, 0.0009, inside) * (1 - space);
      fog.color.lerpColors(_fogDay, _fogCloud, inside);
      _clearMix.copy(_fogNight).lerp(_fogNightCloud, inside);
      fog.color.lerp(_clearMix, n);
      fog.color.lerp(_fogSpace, space);
    }
  });

  return null;
}

function FlightLoop() {
  const { camera } = useThree();
  const hudAcc = useRef(0);
  const smooth = useRef({ yaw: 0, pitch: 0 });
  const reduced = useHud((s) => s.reducedMotion);

  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    runtime.time += dt;
    const craft = runtime.craft;
    const actions = sampleActions();

    if (!runtime.frozen && runtime.playing) {
      if (!runtime.injectedKeys) {
        const keys = runtime.keys;
        let d = 0;
        if (keys.has("Equal") || keys.has("NumpadAdd") || keys.has("KeyE")) d += 1;
        if (keys.has("Minus") || keys.has("NumpadSubtract") || keys.has("KeyQ")) d -= 1;
        if (d) runtime.cruise = THREE.MathUtils.clamp(runtime.cruise + d * dt * 0.55, 0, 1);
      }
      if (runtime.injectedKeys) {
        stepCraft(craft, actions, dt, runtime.world);
        smooth.current.yaw = actions.yaw;
        smooth.current.pitch = actions.pitch;
      } else {
        const k = Math.min(1, dt * 5.5);
        smooth.current.yaw += (actions.yaw - smooth.current.yaw) * k;
        smooth.current.pitch += (actions.pitch - smooth.current.pitch) * k;
        stepCraft(
          craft,
          {
            yaw: smooth.current.yaw,
            pitch: smooth.current.pitch,
            throttle: actions.throttle,
            cruise: runtime.cruise,
          },
          dt,
          runtime.world,
        );
      }
      if (runtime.easy && !runtime.stick.active) {
        const keys = runtime.keys;
        const hands =
          keys.has("KeyA") ||
          keys.has("KeyD") ||
          keys.has("ArrowLeft") ||
          keys.has("ArrowRight") ||
          keys.has("KeyW") ||
          keys.has("KeyS") ||
          keys.has("ArrowUp") ||
          keys.has("ArrowDown");
        if (!hands) {
          const home = WORLD_HOME[runtime.world];
          craft.pitch += (home.pitch - craft.pitch) * Math.min(1, dt * 0.85);
          craft.roll += -craft.roll * Math.min(1, dt * 1.4);
          craft.yaw += dt * 0.07;
          const lo = home.y - 36;
          const hi = home.y + 70;
          if (craft.y < lo) craft.y += (lo - craft.y) * Math.min(1, dt * 0.4);
          else if (craft.y > hi) craft.y += (hi - craft.y) * Math.min(1, dt * 0.22);
        }
      }
    } else if (!runtime.frozen) {
      const home = WORLD_HOME[runtime.world];
      const sunX = 1.15;
      const sunZ = 0.42;
      const face = Math.atan2(-sunX, -sunZ) + 0.72;
      craft.yaw = face + Math.sin(runtime.time * 0.1) * 0.14;
      craft.pitch = home.pitch + Math.sin(runtime.time * 0.16) * 0.04;
      craft.roll *= 0.9;
      stepCraft(craft, { yaw: 0, pitch: 0, throttle: 0, cruise: DEFAULT_CRUISE * 0.7 }, dt, runtime.world);
    }

    const bob = runtime.frozen || reduced || !runtime.playing ? 0 : Math.sin(runtime.time * 0.7) * 0.16;
    camera.position.set(craft.x, craft.y + bob, craft.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = craft.yaw;
    // Three.js YXZ: +rotation.x looks up. +craft.pitch is climb (fy>0), so match signs —
    // nose down (negative pitch) looks down and dives.
    camera.rotation.x = craft.pitch;
    camera.rotation.z = craft.roll;

    const rush = THREE.MathUtils.clamp((craft.speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED), 0, 1);
    const warp = runtime.world === "space" ? runtime.boostAmt : 0;
    const fov = reduced ? 72 : 68 + rush * (runtime.fx.streaks ? 16 : 7) + warp * (runtime.fx.streaks ? 10 : 4);
    const persp = camera as THREE.PerspectiveCamera;
    if (Math.abs(persp.fov - fov) > 0.08) {
      persp.fov = fov;
      persp.updateProjectionMatrix();
    }

    const nk = reduced ? 1 : Math.min(1, dt * 1.7);
    runtime.night += (runtime.nightTarget - runtime.night) * nk;
    const tSpace = runtime.world === "space" ? 1 : 0;
    const tReef = runtime.world === "reef" ? 1 : 0;
    const wk = Math.min(1, dt * 2.2);
    runtime.spaceAmt += (tSpace - runtime.spaceAmt) * wk;
    runtime.reefAmt += (tReef - runtime.reefAmt) * wk;

    hudAcc.current += dt;
    if (hudAcc.current > 0.12) {
      hudAcc.current = 0;
      useHud.getState().patch({
        altitude: craft.y,
        speed: craft.speed,
        cruise: runtime.cruise,
        layer: layerName(craft.y, runtime.world),
        inCloud: runtime.inCloud,
        space: Math.max(spaceFactor(craft.y, runtime.world), runtime.spaceAmt),
        night: runtime.night,
      });
    }
  });

  return null;
}

function QualityRig() {
  const { gl } = useThree();
  const ema = useRef(60);
  const cool = useRef(0);

  useFrame((_, dt) => {
    const fps = 1 / Math.max(dt, 1 / 240);
    ema.current += (fps - ema.current) * Math.min(1, dt * 2.4);
    cool.current += dt;
    if (cool.current < 1.25) return;
    cool.current = 0;
    let lod = runtime.lod;
    if (ema.current < 38 && lod < 2) lod += 1;
    else if (ema.current < 48 && lod < 1) lod += 1;
    else if (ema.current > 56 && lod > 0) lod -= 1;
    if (lod === runtime.lod) return;
    runtime.lod = lod;
    const cap = runtime.mobile
      ? lod > 0
        ? 1
        : 1.15
      : lod > 1
        ? 1
        : lod > 0
          ? 1.15
          : 1.5;
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  });

  return null;
}

function Glider() {
  const root = useRef<THREE.Group>(null);
  const body = useMemo(() => new THREE.MeshLambertMaterial({ color: "#f4f7fb", fog: false }), []);
  const wing = useMemo(() => new THREE.MeshLambertMaterial({ color: "#c5d4e4", fog: false }), []);
  const tip = useMemo(() => new THREE.MeshLambertMaterial({ color: "#2c6eae", fog: false }), []);
  const nose = useMemo(() => new THREE.MeshLambertMaterial({ color: "#f3e2b8", fog: false }), []);
  useEffect(
    () => () => {
      body.dispose();
      wing.dispose();
      tip.dispose();
      nose.dispose();
    },
    [body, wing, tip, nose],
  );

  useFrame(({ camera, size }) => {
    const g = root.current;
    if (!g) return;
    g.visible = runtime.playing;
    if (!runtime.playing) return;
    const persp = camera as THREE.PerspectiveCamera;
    const dist = 4.8;
    const vFov = THREE.MathUtils.degToRad(persp.fov || 68);
    const visH = 2 * Math.tan(vFov / 2) * dist;
    const visW = visH * (size.width / Math.max(1, size.height));
    const sc = visW / 6 / GLIDER_SPAN;
    _gliderOffset.set(0, -visH * 0.22, -dist);
    _gliderOffset.applyQuaternion(camera.quaternion);
    g.position.copy(camera.position).add(_gliderOffset);
    _gliderEuler.set(-runtime.craft.pitch * 0.75, 0, runtime.craft.roll * 1.25, "YXZ");
    _gliderQuat.setFromEuler(_gliderEuler);
    g.quaternion.copy(camera.quaternion).multiply(_gliderQuat);
    g.scale.setScalar(sc);
  });

  return (
    <group ref={root} frustumCulled={false}>
      <mesh material={body} position={[0, 0, 0.02]}>
        <boxGeometry args={[0.16, 0.1, 0.78]} />
      </mesh>
      <mesh material={nose} position={[0, 0.01, -0.46]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.07, 0.26, 6]} />
      </mesh>
      <mesh material={wing} position={[-0.46, 0.02, 0.04]} rotation={[0, 0.08, 0]}>
        <boxGeometry args={[0.78, 0.025, 0.28]} />
      </mesh>
      <mesh material={wing} position={[0.46, 0.02, 0.04]} rotation={[0, -0.08, 0]}>
        <boxGeometry args={[0.78, 0.025, 0.28]} />
      </mesh>
      <mesh material={tip} position={[-0.86, 0.02, 0.02]}>
        <boxGeometry args={[0.08, 0.03, 0.16]} />
      </mesh>
      <mesh material={tip} position={[0.86, 0.02, 0.02]}>
        <boxGeometry args={[0.08, 0.03, 0.16]} />
      </mesh>
      <mesh material={body} position={[0, 0.02, 0.46]}>
        <boxGeometry args={[0.42, 0.02, 0.14]} />
      </mesh>
      <mesh material={wing} position={[0, 0.12, 0.46]}>
        <boxGeometry args={[0.02, 0.2, 0.16]} />
      </mesh>
    </group>
  );
}

function LightRig() {
  const amb = useRef<THREE.AmbientLight>(null);
  const dir = useRef<THREE.DirectionalLight>(null);
  const { gl } = useThree();

  useFrame(() => {
    const n = runtime.night;
    const reef = runtime.reefAmt;
    const deep = runtime.spaceAmt;
    if (amb.current) {
      amb.current.intensity = THREE.MathUtils.lerp(1.02, 0.34, n) * (1 - deep * 0.25) * (1 + reef * 0.15);
      amb.current.color.setRGB(
        THREE.MathUtils.lerp(0.86, 0.38, n) * (1 - reef * 0.45),
        THREE.MathUtils.lerp(0.91, 0.46, n) * (1 + reef * 0.12),
        THREE.MathUtils.lerp(0.96, 0.62, n) * (1 + reef * 0.2),
      );
    }
    if (dir.current) {
      dir.current.intensity = THREE.MathUtils.lerp(0.55, 0.22, n) * (1 - reef * 0.25);
      dir.current.color.setRGB(
        THREE.MathUtils.lerp(1, 0.72, n),
        THREE.MathUtils.lerp(0.96, 0.82, n),
        THREE.MathUtils.lerp(0.84, 1, n),
      );
    }
    if (reef > 0.5) _clearMix.setRGB(0.02, 0.12, 0.18);
    else _clearMix.lerpColors(_clearDay, _clearNight, Math.max(n, deep));
    gl.setClearColor(_clearMix, 1);
    gl.toneMappingExposure = 1;
  });

  return (
    <>
      <ambientLight ref={amb} intensity={1.02} color="#dceaf6" />
      <directionalLight ref={dir} position={[SUN_DIR.x, SUN_DIR.y, SUN_DIR.z]} intensity={0.55} color="#fff4d6" />
    </>
  );
}

function SkyClouds() {
  const mobile = runtime.mobile;
  const count = mobile ? 96 : 140;
  const narrow = useMemo(
    () => (typeof window !== "undefined" ? window.innerWidth / window.innerHeight < 1 || window.innerWidth < 600 : false),
    [],
  );
  const built = useMemo(() => buildPuffs(count, mobile, narrow), [count, mobile, narrow]);
  return (
    <>
      <Farmland shadows={built.shadows} />
      <Cirrus />
      <CloudPuffs puffs={built.puffs} />
    </>
  );
}

export function World() {
  return (
    <>
      <Atmosphere />
      <Sun />
      <SkyClouds />
      <Airplanes />
      <SpaceField />
      <ReefField />
      <GodRays />
      <Glider />
      <FogRig />
      <FlightLoop />
      <QualityRig />
      <LightRig />
    </>
  );
}
