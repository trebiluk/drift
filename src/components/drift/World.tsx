import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cloudImmersion, DEFAULT_CRUISE, layerName, MAX_SPEED, MIN_SPEED, spaceFactor, stepCraft, WORLD_HOME } from "@/game/flight";
import { sampleActions } from "@/game/input";
import { runtime } from "@/game/runtime";
import {
  ATMOSPHERE_FRAG,
  ATMOSPHERE_VERT,
  FARM_FRAG,
  FARM_VERT,
  PUFF_FRAG,
  PUFF_VERT,
} from "@/game/shaders";
import { createCirrusTexture, createCloudShadowTexture, createFieldTexture, createGlowTexture, createRayTexture } from "@/game/textures";
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

type Puff = {
  x: number;
  y: number;
  z: number;
  s: number;
};

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

function buildPuffs(count: number): Puff[] {
  const list: Puff[] = [];
  const yaw = runtime.craft.yaw;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  for (let i = 0; i < 10; i++) {
    list.push({
      x: fx * (40 + i * 42) + ((i % 2) * 2 - 1) * (18 + (i % 4) * 14),
      y: 88 + (i % 5) * 14,
      z: fz * (40 + i * 42) + (((i + 1) % 3) - 1) * 22,
      s: 70 + (i % 5) * 18,
    });
  }
  for (let c = 0; c < 18; c++) {
    const a = Math.random() * Math.PI * 2;
    const r = 70 + Math.pow(Math.random(), 0.4) * WRAP;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const cy = 70 + Math.random() * 70;
    const n = 3 + (c % 4);
    for (let j = 0; j < n && list.length < count; j++) {
      list.push({
        x: cx + (Math.random() - 0.5) * 78,
        y: cy + (Math.random() - 0.5) * 36,
        z: cz + (Math.random() - 0.5) * 78,
        s: 52 + Math.random() * 88,
      });
    }
  }
  while (list.length < count) {
    const a = Math.random() * Math.PI * 2;
    const r = 50 + Math.random() * WRAP;
    list.push({
      x: Math.cos(a) * r,
      y: 64 + Math.random() * 90,
      z: Math.sin(a) * r,
      s: 48 + Math.random() * 70,
    });
  }
  return list;
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

  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

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
    inst.count = lod > 1 ? Math.floor(count * 0.78) : count;
    windVelocity(wind);
    const ox = wind.x * clock.elapsedTime;
    const oz = wind.y * clock.elapsedTime;
    const cx = camera.position.x;
    const cz = camera.position.z;
    mat.uniforms.uSpace.value = spaceFactor(camera.position.y, runtime.world);
    mat.uniforms.uNight.value = runtime.night;

    let nearest = 4;
    const drawn = inst.count;
    for (let i = 0; i < drawn; i++) {
      const puff = puffs[i];
      const x = wrapAxis(puff.x + ox, cx, WRAP);
      const z = wrapAxis(puff.z + oz, cz, WRAP);
      const dx = x - cx;
      const dy = puff.y - camera.position.y;
      const dz = z - cz;
      const d = Math.hypot(dx, dy, dz) / (puff.s * 0.55);
      if (d < nearest) nearest = d;
      _dummy.position.set(x, puff.y, z);
      _dummy.scale.set(puff.s * 1.55, puff.s * 1.12, 1);
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

type Streak = { x: number; y: number; z: number; w: number; d: number; yaw: number };

function Cirrus() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const wind = useMemo(() => new THREE.Vector2(), []);
  const streaks = useMemo<Streak[]>(() => {
    const list: Streak[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const r = 980 + (i % 3) * 420;
      list.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        y: 540 + (i % 4) * 42,
        w: 820 + (i % 3) * 240,
        d: 150 + (i % 2) * 80,
        yaw: a + 0.7,
      });
    }
    return list;
  }, []);
  const tex = useMemo(() => {
    const map = new THREE.CanvasTexture(createCirrusTexture());
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.needsUpdate = true;
    return map;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 0.46,
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
    mat.opacity = 0.46 * (1 - runtime.night * 0.7);
    windVelocity(wind);
    const ox = wind.x * clock.elapsedTime;
    const oz = wind.y * clock.elapsedTime;
    const half = 2200;
    for (let i = 0; i < streaks.length; i++) {
      const s = streaks[i];
      _dummy.position.set(wrapAxis(s.x + ox, camera.position.x, half), s.y, wrapAxis(s.z + oz, camera.position.z, half));
      _dummy.rotation.set(-Math.PI / 2, 0, s.yaw);
      _dummy.scale.set(s.w, s.d, 1);
      _dummy.updateMatrix();
      inst.setMatrixAt(i, _dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, streaks.length]} frustumCulled={false} renderOrder={1} />;
}

function Farmland({ puffs }: { puffs: Puff[] }) {
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
    map.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
    map.needsUpdate = true;
    return map;
  }, [gl]);
  const shadowTex = useMemo(() => {
    const map = new THREE.CanvasTexture(createCloudShadowTexture(puffs, WRAP_SPAN));
    map.colorSpace = THREE.NoColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.flipY = false;
    map.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
    map.needsUpdate = true;
    return map;
  }, [gl, puffs]);
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
    const fov = reduced ? 72 : 68 + rush * (runtime.fx.streaks ? 16 : 7);
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
  const count = runtime.mobile ? 96 : 140;
  const puffs = useMemo(() => buildPuffs(count), [count]);
  return (
    <>
      <Farmland puffs={puffs} />
      <Cirrus />
      <CloudPuffs puffs={puffs} />
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
      <FogRig />
      <FlightLoop />
      <QualityRig />
      <LightRig />
    </>
  );
}
