import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { runtime } from "@/game/runtime";
import { PLANET_FRAG, PLANET_VERT } from "@/game/shaders";

type Body = {
  x: number;
  y: number;
  z: number;
  r: number;
  a: THREE.Color;
  b: THREE.Color;
  seed: number;
  spin: number;
  rings: boolean;
};

const WRAP = 2600;

function wrap(v: number, c: number, h: number) {
  const span = h * 2;
  while (v - c > h) v -= span;
  while (v - c < -h) v += span;
  return v;
}

function makeBodies(): Body[] {
  const palettes: [number, number][] = [
    [0xc45a32, 0xe8c07a],
    [0x3a6ea8, 0xb7d4ea],
    [0x6b3fa0, 0xd9a45b],
    [0x2f6b58, 0x9ad0c0],
    [0xa33b44, 0xf0d2a8],
  ];
  return palettes.map((p, i) => {
    const ang = (i / palettes.length) * Math.PI * 2;
    const dist = 420 + i * 180;
    return {
      x: Math.cos(ang) * dist,
      y: 1540 + (i % 3) * 90,
      z: Math.sin(ang) * dist - 280,
      r: 42 + i * 18,
      a: new THREE.Color(p[0]),
      b: new THREE.Color(p[1]),
      seed: i * 1.7 + 0.4,
      spin: 0.02 + i * 0.01,
      rings: i === 2,
    };
  });
}

export function SpaceField() {
  const group = useRef<THREE.Group>(null);
  const bodies = useMemo(makeBodies, []);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 32, 24), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(1.45, 2.15, 64), []);
  const mats = useMemo(
    () =>
      bodies.map(
        (b) =>
          new THREE.ShaderMaterial({
            uniforms: {
              uA: { value: b.a },
              uB: { value: b.b },
              uSeed: { value: b.seed },
            },
            vertexShader: PLANET_VERT,
            fragmentShader: PLANET_FRAG,
            toneMapped: false,
            fog: false,
          }),
      ),
    [bodies],
  );
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xc8b48a,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      geo.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      mats.forEach((m) => m.dispose());
    },
    [geo, ringGeo, ringMat, mats],
  );

  useFrame(({ camera }, dt) => {
    const root = group.current;
    if (!root) return;
    root.visible = runtime.spaceAmt > 0.04;
    if (!root.visible) return;
    const cx = camera.position.x;
    const cz = camera.position.z;
    bodies.forEach((b, i) => {
      b.x = wrap(b.x, cx, WRAP);
      b.z = wrap(b.z, cz, WRAP);
      const node = root.children[i];
      if (!node) return;
      node.position.set(b.x, b.y, b.z);
      node.rotation.y += dt * b.spin;
    });
  });

  return (
    <group ref={group}>
      {bodies.map((b, i) => (
        <group key={i} position={[b.x, b.y, b.z]} scale={b.r}>
          <mesh geometry={geo} material={mats[i]} />
          {b.rings && (
            <mesh
              geometry={ringGeo}
              material={ringMat}
              rotation={[Math.PI / 2.6, 0.2, 0.15]}
            />
          )}
        </group>
      ))}
    </group>
  );
}
