import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { runtime } from "@/game/runtime";
import { REEF_FRAG, REEF_VERT } from "@/game/shaders";

const SUN = new THREE.Vector3(1.15, 0.58, 0.42).normalize();

type Coral = { x: number; z: number; h: number; s: number; hue: number };
type Fish = { x: number; y: number; z: number; yaw: number; speed: number; s: number; hue: number };

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

export function ReefField() {
  const group = useRef<THREE.Group>(null);
  const floor = useRef<THREE.Mesh>(null);
  const coralMesh = useRef<THREE.InstancedMesh>(null);
  const fishMesh = useRef<THREE.InstancedMesh>(null);
  const count = runtime.mobile ? 28 : 42;
  const fishCount = runtime.mobile ? 14 : 22;

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

  const coralGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 6), []);
  const coralMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05, fog: true }),
    [],
  );
  const fishGeo = useMemo(() => new THREE.BoxGeometry(1.8, 0.55, 0.35), []);
  const fishMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1, fog: true }),
    [],
  );

  useEffect(
    () => () => {
      floorMat.dispose();
      coralGeo.dispose();
      coralMat.dispose();
      fishGeo.dispose();
      fishMat.dispose();
    },
    [floorMat, coralGeo, coralMat, fishGeo, fishMat],
  );

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
        coralMesh.current.setColorAt(i, _col.setHex(CORAL_COLORS[c.hue]));
      }
      coralMesh.current.instanceMatrix.needsUpdate = true;
      if (coralMesh.current.instanceColor) coralMesh.current.instanceColor.needsUpdate = true;
    }

    if (fishMesh.current) {
      for (let i = 0; i < school.length; i++) {
        const f = school[i];
        f.yaw += Math.sin(clock.elapsedTime * 0.4 + i) * dt * 0.35;
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
        _dummy.scale.set(f.s, f.s, f.s);
        _dummy.rotation.set(0, f.yaw, Math.sin(clock.elapsedTime * 6 + i) * 0.15);
        _dummy.updateMatrix();
        fishMesh.current.setMatrixAt(i, _dummy.matrix);
        fishMesh.current.setColorAt(i, _col.setHex(FISH_COLORS[f.hue]));
      }
      fishMesh.current.instanceMatrix.needsUpdate = true;
      if (fishMesh.current.instanceColor) fishMesh.current.instanceColor.needsUpdate = true;
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
        <planeGeometry args={[2400, 2400, 96, 96]} />
      </mesh>
      <instancedMesh ref={coralMesh} args={[coralGeo, coralMat, count]} frustumCulled={false} />
      <instancedMesh ref={fishMesh} args={[fishGeo, fishMat, fishCount]} frustumCulled={false} />
    </group>
  );
}

const _col = new THREE.Color();
