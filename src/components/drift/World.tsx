import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cloudImmersion, DEFAULT_CRUISE, layerName, MAX_SPEED, MIN_SPEED, spaceFactor, stepCraft } from "@/game/flight";
import { sampleActions } from "@/game/input";
import { runtime } from "@/game/runtime";
import {
  ATMOSPHERE_FRAG,
  ATMOSPHERE_VERT,
  PUFF_FRAG,
  PUFF_VERT,
  SEA_FRAG,
  SEA_VERT,
} from "@/game/shaders";
import { createCloudTexture, createDotTexture, createGlowTexture, createRayTexture } from "@/game/textures";
import { useHud } from "@/store/hud";
import { Airplanes } from "./Airplanes";

export const SUN_DIR = new THREE.Vector3(1.15, 0.58, 0.42).normalize();

const _dummy = new THREE.Object3D();
const _fwd = new THREE.Vector3();
const _clearDay = new THREE.Color(0x1a58b8);
const _clearNight = new THREE.Color(0x0b1220);
const _fogDay = new THREE.Color(0x8eb8e8);
const _fogCloud = new THREE.Color(0xf4f7fb);
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
        },
        vertexShader: ATMOSPHERE_VERT,
        fragmentShader: ATMOSPHERE_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
    mat.uniforms.uSpace.value = spaceFactor(camera.position.y);
    mat.uniforms.uNight.value = runtime.night;
  });

  return (
    <mesh ref={mesh} material={mat} frustumCulled={false} renderOrder={-1000}>
      <sphereGeometry args={[4200, 40, 28]} />
    </mesh>
  );
}

function Stars() {
  const points = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const count = 1800;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 3800;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: 0xf4f6ff,
        size: 3.4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        map: (() => {
          const t = new THREE.CanvasTexture(createDotTexture());
          t.needsUpdate = true;
          return t;
        })(),
      }),
    [],
  );

  useEffect(
    () => () => {
      geo.dispose();
      mat.map?.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  useFrame(({ camera }) => {
    points.current?.position.copy(camera.position);
    const space = spaceFactor(camera.position.y);
    mat.opacity = Math.max(0, space - 0.1) * 0.98 + runtime.night * 0.84 * (1 - runtime.inCloud * 0.7);
  });

  return <points ref={points} geometry={geo} material={mat} frustumCulled={false} renderOrder={-900} />;
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
    group.current.position.copy(camera.position).addScaledVector(SUN_DIR, 2800);
    const n = runtime.night;
    const s = (1 + spaceFactor(camera.position.y) * 0.35) * (1 - n * 0.38);
    group.current.scale.setScalar(s);
    mat.opacity = 0.95 - n * 0.18;
    mat.color.setRGB(1 - n * 0.22, 1 - n * 0.1, 1);
  });

  return (
    <group ref={group} renderOrder={-800}>
      <sprite material={mat} scale={[520, 520, 1]} />
      <sprite material={mat} scale={[170, 170, 1]} />
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
    camera.getWorldDirection(_fwd);
    const toward = Math.max(0, _fwd.dot(SUN_DIR));
    const vis =
      toward ** 3 *
      (0.18 + runtime.inCloud * 0.55) *
      (1 - spaceFactor(camera.position.y) * 0.7) *
      (1 - runtime.night * 0.55);
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

function CloudSea() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOffset: { value: new THREE.Vector2() },
          uSun: { value: SUN_DIR.clone() },
          uCam: { value: new THREE.Vector3() },
          uFade: { value: 1 },
          uNight: { value: 0 },
        },
        vertexShader: SEA_VERT,
        fragmentShader: SEA_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ camera, clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    (mat.uniforms.uOffset.value as THREE.Vector2).set(camera.position.x, camera.position.z);
    (mat.uniforms.uCam.value as THREE.Vector3).copy(camera.position);
    const fade = THREE.MathUtils.smoothstep(camera.position.y, 52, 108);
    mat.uniforms.uFade.value = fade * (1 - spaceFactor(camera.position.y) * 0.12);
    mat.uniforms.uNight.value = runtime.night;
    if (mesh.current) {
      mesh.current.position.x = camera.position.x;
      mesh.current.position.z = camera.position.z;
    }
  });

  return (
    <mesh
      ref={mesh}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 42, 0]}
      material={mat}
      frustumCulled={false}
      renderOrder={-20}
    >
      <planeGeometry args={[11000, 11000, 128, 128]} />
    </mesh>
  );
}

function CloudPuffs() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = runtime.mobile ? 120 : 180;

  const puffs = useMemo<Puff[]>(() => {
    const list: Puff[] = [];
    const yaw = runtime.craft.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    for (let i = 0; i < 16; i++) {
      list.push({
        x: fx * (50 + i * 48) + ((i % 2) * 2 - 1) * (28 + (i % 5) * 10),
        y: 108 + (i % 5) * 16,
        z: fz * (50 + i * 48) + (((i + 1) % 3) - 1) * 30,
        s: 72 + (i % 6) * 16,
      });
    }
    for (let i = list.length; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.5) * WRAP;
      const band = Math.random();
      let y: number;
      let s: number;
      if (band < 0.58) {
        y = 58 + Math.random() * 52;
        s = 78 + Math.random() * 88;
      } else if (band < 0.9) {
        y = 118 + Math.random() * 48;
        s = 48 + Math.random() * 64;
      } else {
        y = 178 + Math.random() * 36;
        s = 52 + Math.random() * 48;
      }
      list.push({
        x: Math.cos(a) * r,
        y,
        z: Math.sin(a) * r,
        s,
      });
    }
    return list;
  }, [count]);

  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(createCloudTexture());
    t.colorSpace = THREE.SRGBColorSpace;
    t.premultiplyAlpha = true;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, []);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: tex },
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

  useFrame(({ camera }) => {
    const inst = mesh.current;
    if (!inst) return;
    const cx = camera.position.x;
    const cz = camera.position.z;
    let nearest = 1;
    mat.uniforms.uSpace.value = spaceFactor(camera.position.y);
    mat.uniforms.uNight.value = runtime.night;

    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      p.x = wrapAxis(p.x, cx, WRAP);
      p.z = wrapAxis(p.z, cz, WRAP);
      const dx = p.x - cx;
      const dy = p.y - camera.position.y;
      const dz = p.z - cz;
      const d = Math.hypot(dx, dy, dz) / (p.s * 0.5);
      if (d < nearest) nearest = d;

      _dummy.position.set(p.x, p.y, p.z);
      _dummy.scale.set(p.s * 1.65, p.s, i % 2 === 0 ? 1 : 0.2);
      _dummy.rotation.set(0, 0, 0);
      _dummy.updateMatrix();
      inst.setMatrixAt(i, _dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;

    const nearCloud = THREE.MathUtils.clamp(1 - nearest, 0, 1);
    runtime.inCloud = THREE.MathUtils.clamp(
      cloudImmersion(camera.position.y) * 0.55 + nearCloud * 0.7,
      0,
      1,
    );
  });

  return <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} renderOrder={2} />;
}

function Mist() {
  const points = useRef<THREE.Points>(null);
  const count = runtime.mobile ? 180 : 280;
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 46;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(createDotTexture());
    t.needsUpdate = true;
    return t;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2.2,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: true,
        map: tex,
        alphaTest: 0.06,
      }),
    [tex],
  );

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
    [geo, mat, tex],
  );

  useFrame(({ camera }) => {
    if (!points.current) return;
    points.current.position.copy(camera.position);
    mat.opacity = runtime.inCloud * (0.28 - runtime.night * 0.1);
    mat.color.setRGB(1, 1, 1);
  });

  return <points ref={points} geometry={geo} material={mat} frustumCulled={false} renderOrder={6} />;
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
    const space = spaceFactor(camera.position.y);
    const inside = runtime.inCloud;
    const n = runtime.night;
    fog.density = THREE.MathUtils.lerp(0.00018, 0.0075, inside) * (1 - space);
    fog.color.lerpColors(_fogDay, _fogCloud, inside);
    _clearMix.copy(_fogNight).lerp(_fogNightCloud, inside);
    fog.color.lerp(_clearMix, n);
    fog.color.lerp(_fogSpace, space);
  });

  return null;
}

function Streaks() {
  const points = useRef<THREE.Points>(null);
  const count = 90;
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = -8 - Math.random() * 42;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.28,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    [],
  );

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  useFrame(({ camera }, dt) => {
    if (!points.current) return;
    const rush = THREE.MathUtils.clamp((runtime.craft.speed - 34) / 30, 0, 1);
    mat.opacity = rush * 0.55 * (1 - runtime.inCloud * 0.5);
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const flow = runtime.craft.speed * dt * 1.8;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 2] += flow;
      if (arr[i * 3 + 2] > 4) {
        arr[i * 3] = (Math.random() - 0.5) * 18;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
        arr[i * 3 + 2] = -10 - Math.random() * 40;
      }
    }
    attr.needsUpdate = true;
    points.current.position.copy(camera.position);
    points.current.quaternion.copy(camera.quaternion);
  });

  return <points ref={points} geometry={geo} material={mat} frustumCulled={false} renderOrder={7} />;
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

    if (runtime.playing) {
      if (!runtime.injectedKeys) {
        const keys = runtime.keys;
        let d = 0;
        if (keys.has("Equal") || keys.has("NumpadAdd") || keys.has("KeyE")) d += 1;
        if (keys.has("Minus") || keys.has("NumpadSubtract") || keys.has("KeyQ")) d -= 1;
        if (d) runtime.cruise = THREE.MathUtils.clamp(runtime.cruise + d * dt * 0.55, 0, 1);
      }
      if (runtime.injectedKeys) {
        stepCraft(craft, actions, dt);
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
        );
      }
    } else {
      const sunX = 1.15;
      const sunZ = 0.42;
      const home = Math.atan2(-sunX, -sunZ);
      craft.yaw = home + Math.sin(runtime.time * 0.1) * 0.14;
      craft.pitch = -0.22 + Math.sin(runtime.time * 0.16) * 0.045;
      craft.roll *= 0.9;
      stepCraft(craft, { yaw: 0, pitch: 0, throttle: 0, cruise: DEFAULT_CRUISE * 0.7 }, dt);
    }

    const bob = reduced || !runtime.playing ? 0 : Math.sin(runtime.time * 0.7) * 0.16;
    camera.position.set(craft.x, craft.y + bob, craft.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = craft.yaw;
    camera.rotation.x = -craft.pitch;
    camera.rotation.z = craft.roll;

    const rush = THREE.MathUtils.clamp((craft.speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED), 0, 1);
    const fov = reduced ? 72 : 68 + rush * 16;
    const persp = camera as THREE.PerspectiveCamera;
    if (Math.abs(persp.fov - fov) > 0.08) {
      persp.fov = fov;
      persp.updateProjectionMatrix();
    }

    const nk = reduced ? 1 : Math.min(1, dt * 1.7);
    runtime.night += (runtime.nightTarget - runtime.night) * nk;

    hudAcc.current += dt;
    if (hudAcc.current > 0.12) {
      hudAcc.current = 0;
      useHud.getState().patch({
        altitude: craft.y,
        speed: craft.speed,
        cruise: runtime.cruise,
        layer: layerName(craft.y),
        inCloud: runtime.inCloud,
        space: spaceFactor(craft.y),
        night: runtime.night,
      });
    }
  });

  return null;
}

function LightRig() {
  const amb = useRef<THREE.AmbientLight>(null);
  const dir = useRef<THREE.DirectionalLight>(null);
  const { gl } = useThree();

  useFrame(() => {
    const n = runtime.night;
    if (amb.current) {
      amb.current.intensity = THREE.MathUtils.lerp(1.02, 0.34, n);
      amb.current.color.setRGB(
        THREE.MathUtils.lerp(0.86, 0.38, n),
        THREE.MathUtils.lerp(0.91, 0.46, n),
        THREE.MathUtils.lerp(0.96, 0.62, n),
      );
    }
    if (dir.current) {
      dir.current.intensity = THREE.MathUtils.lerp(0.55, 0.22, n);
      dir.current.color.setRGB(
        THREE.MathUtils.lerp(1, 0.72, n),
        THREE.MathUtils.lerp(0.96, 0.82, n),
        THREE.MathUtils.lerp(0.84, 1, n),
      );
    }
    _clearMix.lerpColors(_clearDay, _clearNight, n);
    gl.setClearColor(_clearMix, 1);
            gl.toneMappingExposure = THREE.MathUtils.lerp(1.06, 0.84, n);
  });

  return (
    <>
      <ambientLight ref={amb} intensity={1.02} color="#dceaf6" />
      <directionalLight ref={dir} position={[SUN_DIR.x, SUN_DIR.y, SUN_DIR.z]} intensity={0.55} color="#fff4d6" />
    </>
  );
}

export function World() {
  return (
    <>
      <Atmosphere />
      <Stars />
      <Sun />
      <CloudSea />
      <CloudPuffs />
      <Airplanes />
      <Mist />
      <Streaks />
      <GodRays />
      <FogRig />
      <FlightLoop />
      <LightRig />
    </>
  );
}
