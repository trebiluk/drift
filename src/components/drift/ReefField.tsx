import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { runtime } from "@/game/runtime";
import { REEF_FRAG, REEF_VERT } from "@/game/shaders";

const SUN = new THREE.Vector3(1.15, 0.58, 0.42).normalize();

type Coral = { x: number; z: number; h: number; s: number; hue: number };
type Fish = { x: number; y: number; z: number; yaw: number; speed: number; s: number; hue: number };
type Bubble = { x: number; y: number; z: number; s: number; v: number };

const WRAP = 420;
const _dummy = new THREE.Object3D();
const FISH_COLORS = [0xf2c14e, 0x4ecdc4, 0xff6b6b, 0xffe66d, 0x7bdff2, 0xf7a072];
const CORAL_COLORS = [0xe07a5f, 0xf2cc8f, 0x81b29a, 0xc77dff, 0xffb4a2, 0x83c5be];

function wrap(v: number, c: number, h: number) {
  const span = h * 2;
  while (v - c > h) v -= span;
  while (v - c < -h) v += span;
  return v;
}

function makeFishGeo() {
  const body = new THREE.SphereGeometry(0.42, 12, 8);
  body.scale(0.7, 0.46, 1.35);
  const tail = new THREE.SphereGeometry(0.32, 8, 6);
  tail.scale(0.1, 0.9, 0.48);
  tail.translate(0, 0.02, 1.2);
  const fin = new THREE.SphereGeometry(0.2, 6, 5);
  fin.scale(0.08, 0.55, 0.32);
  fin.translate(0, 0.34, -0.1);
  const geo = mergeGeometries([body, tail, fin]);
  body.dispose();
  tail.dispose();
  fin.dispose();
  if (!geo) throw new Error("fish");
  return geo;
}

function makeCoralGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.ConeGeometry(0.36, 1.15, 7);
  trunk.translate(0, 0.58, 0);
  parts.push(trunk);
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.ConeGeometry(0.15, 0.7, 6);
    const a = (i / 5) * Math.PI * 2;
    arm.translate(0, 0.35, 0);
    arm.rotateZ(0.62);
    arm.rotateY(a);
    arm.translate(Math.cos(a) * 0.1, 0.78, Math.sin(a) * 0.1);
    parts.push(arm);
  }
  const geo = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!geo) throw new Error("coral");
  return geo;
}

export function ReefField() {
  const group = useRef<THREE.Group>(null);
  const floor = useRef<THREE.Mesh>(null);
  const coralMesh = useRef<THREE.InstancedMesh>(null);
  const fishMesh = useRef<THREE.InstancedMesh>(null);
  const bubbleMesh = useRef<THREE.InstancedMesh>(null);
  const count = runtime.mobile ? 28 : 48;
  const fishCount = runtime.mobile ? 14 : 26;
  const bubbleCount = runtime.mobile ? 10 : 18;

  const corals = useMemo<Coral[]>(() => {
    const list: Coral[] = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * WRAP;
      list.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        h: 2.2 + Math.random() * 6.5,
        s: 0.8 + Math.random() * 1.6,
        hue: Math.floor(Math.random() * CORAL_COLORS.length),
      });
    }
    return list;
  }, [count]);

  const school = useMemo<Fish[]>(() => {
    const list: Fish[] = [];
    for (let i = 0; i < fishCount; i++) {
      list.push({
        x: (Math.random() - 0.5) * 180,
        y: 10 + Math.random() * 22,
        z: (Math.random() - 0.5) * 180,
        yaw: Math.random() * Math.PI * 2,
        speed: 4 + Math.random() * 6,
        s: 0.7 + Math.random() * 1.1,
        hue: Math.floor(Math.random() * FISH_COLORS.length),
      });
    }
    return list;
  }, [fishCount]);

  const bubbles = useMemo<Bubble[]>(() => {
    const list: Bubble[] = [];
    for (let i = 0; i < bubbleCount; i++) {
      list.push({
        x: (Math.random() - 0.5) * 160,
        y: 2 + Math.random() * 28,
        z: (Math.random() - 0.5) * 160,
        s: 0.12 + Math.random() * 0.28,
        v: 1.4 + Math.random() * 2.2,
      });
    }
    return list;
  }, [bubbleCount]);

  const floorMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOffset: { value: new THREE.Vector2() },
          uSun: { value: SUN.clone() },
          uCam: { value: new THREE.Vector3() },
        },
        vertexShader: REEF_VERT,
        fragmentShader: REEF_FRAG,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    [],
  );

  const coralGeo = useMemo(() => makeCoralGeo(), []);
  const coralMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.08, fog: true }),
    [],
  );
  const fishGeo = useMemo(() => makeFishGeo(), []);
  const fishMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.18, fog: true }),
    [],
  );
  const bubbleGeo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const bubbleMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xc8fff6,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        fog: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      floorMat.dispose();
      coralGeo.dispose();
      coralMat.dispose();
      fishGeo.dispose();
      fishMat.dispose();
      bubbleGeo.dispose();
      bubbleMat.dispose();
    },
    [floorMat, coralGeo, coralMat, fishGeo, fishMat, bubbleGeo, bubbleMat],
  );

  const coralPainted = useRef(false);
  const fishPainted = useRef(false);
  const tick = useRef(0);

  useFrame(({ camera, clock }, dt) => {
    const root = group.current;
    if (!root) return;
    root.visible = runtime.reefAmt > 0.04;
    if (!root.visible) return;

    floorMat.uniforms.uTime.value = clock.elapsedTime;
    (floorMat.uniforms.uOffset.value as THREE.Vector2).set(camera.position.x, camera.position.z);
    (floorMat.uniforms.uCam.value as THREE.Vector3).copy(camera.position);
    if (floor.current) {
      floor.current.position.x = camera.position.x;
      floor.current.position.z = camera.position.z;
    }

    const cx = camera.position.x;
    const cz = camera.position.z;
    tick.current += 1;
    const skipSoft = runtime.lod > 0 && (tick.current & 1) === 1;
    if (coralMesh.current) {
      for (let i = 0; i < corals.length; i++) {
        const c = corals[i];
        c.x = wrap(c.x, cx, WRAP);
        c.z = wrap(c.z, cz, WRAP);
        _dummy.position.set(c.x, c.h * 0.5, c.z);
        _dummy.scale.set(c.s, c.h, c.s);
        _dummy.rotation.set(0, i * 0.7, 0);
        _dummy.updateMatrix();
        coralMesh.current.setMatrixAt(i, _dummy.matrix);
        if (!coralPainted.current) coralMesh.current.setColorAt(i, _col.setHex(CORAL_COLORS[c.hue]));
      }
      coralMesh.current.instanceMatrix.needsUpdate = true;
      if (!coralPainted.current && coralMesh.current.instanceColor) {
        coralMesh.current.instanceColor.needsUpdate = true;
        coralPainted.current = true;
      }
    }

    if (fishMesh.current && !skipSoft) {
      for (let i = 0; i < school.length; i++) {
        const f = school[i];
        f.yaw += Math.sin(clock.elapsedTime * 0.35 + i * 0.7) * dt * 0.22;
        const heading = Math.sin(clock.elapsedTime * 0.12) * 0.9;
        f.yaw += (heading - f.yaw) * dt * 0.35;
        f.x += -Math.sin(f.yaw) * f.speed * dt;
        f.z += -Math.cos(f.yaw) * f.speed * dt;
        f.y += Math.sin(clock.elapsedTime * 0.8 + i) * dt * 0.4;
        f.y = Math.min(36, Math.max(8, f.y));
        f.x = wrap(f.x, cx, WRAP);
        f.z = wrap(f.z, cz, WRAP);
        const dx = f.x - cx;
        const dz = f.z - cz;
        const flat = Math.hypot(dx, dz);
        if (flat < 10) {
          f.x += (dx / (flat + 0.1)) * 18 * dt;
          f.z += (dz / (flat + 0.1)) * 18 * dt;
        }
        _dummy.position.set(f.x, f.y, f.z);
        _dummy.scale.setScalar(f.s * 1.45);
        _dummy.rotation.set(0, f.yaw, Math.sin(clock.elapsedTime * 6 + i) * 0.15);
        _dummy.updateMatrix();
        fishMesh.current.setMatrixAt(i, _dummy.matrix);
        if (!fishPainted.current) fishMesh.current.setColorAt(i, _col.setHex(FISH_COLORS[f.hue]));
      }
      fishMesh.current.instanceMatrix.needsUpdate = true;
      if (!fishPainted.current && fishMesh.current.instanceColor) {
        fishMesh.current.instanceColor.needsUpdate = true;
        fishPainted.current = true;
      }
    }

    if (bubbleMesh.current && !skipSoft) {
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        b.y += b.v * dt;
        b.x += Math.sin(clock.elapsedTime * 0.7 + i) * dt * 0.4;
        if (b.y > 38) {
          b.y = 1 + Math.random() * 4;
          b.x = cx + (Math.random() - 0.5) * 80;
          b.z = cz + (Math.random() - 0.5) * 80;
        }
        b.x = wrap(b.x, cx, WRAP);
        b.z = wrap(b.z, cz, WRAP);
        _dummy.position.set(b.x, b.y, b.z);
        _dummy.scale.setScalar(b.s);
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        bubbleMesh.current.setMatrixAt(i, _dummy.matrix);
      }
      bubbleMesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={group}>
      <mesh
        ref={floor}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        material={floorMat}
        frustumCulled={false}
      >
        <planeGeometry args={[2400, 2400, runtime.mobile ? 32 : 48, runtime.mobile ? 32 : 48]} />
      </mesh>
      <instancedMesh ref={coralMesh} args={[coralGeo, coralMat, count]} frustumCulled={false} />
      <instancedMesh ref={fishMesh} args={[fishGeo, fishMat, fishCount]} frustumCulled={false} />
      <instancedMesh ref={bubbleMesh} args={[bubbleGeo, bubbleMat, bubbleCount]} frustumCulled={false} />
    </group>
  );
}

const _col = new THREE.Color();
