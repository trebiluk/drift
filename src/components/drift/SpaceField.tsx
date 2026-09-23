import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { runtime } from "@/game/runtime";
import { NEBULA_FRAG, NEBULA_VERT, PLANET_FRAG, PLANET_VERT } from "@/game/shaders";

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

type Cloud = {
  dir: THREE.Vector3;
  scale: number;
  a: THREE.Color;
  b: THREE.Color;
  seed: number;
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
    [0x1d3b73, 0x7ec8e3],
  ];
  return palettes.map((p, i) => {
    const ang = (i / palettes.length) * Math.PI * 2;
    const dist = 380 + i * 160;
    return {
      x: Math.cos(ang) * dist,
      y: 1520 + (i % 3) * 110,
      z: Math.sin(ang) * dist - 240,
      r: 38 + i * 16,
      a: new THREE.Color(p[0]),
      b: new THREE.Color(p[1]),
      seed: i * 1.7 + 0.4,
      spin: 0.018 + i * 0.008,
      rings: i === 2 || i === 5,
    };
  });
}

function makeClouds(): Cloud[] {
  const tints: [number, number][] = [
    [0x5b2d8a, 0x1a4d8c],
    [0x8c1f3a, 0x2a1a6e],
    [0x1f6b7a, 0x4a1f7a],
    [0x6a2048, 0x14306a],
    [0x2c1d6e, 0x8a3a2a],
  ];
  return tints.map((t, i) => {
    const a = (i / tints.length) * Math.PI * 2 + 0.4;
    return {
      dir: new THREE.Vector3(Math.cos(a) * 0.85, (i % 2 === 0 ? 0.22 : -0.12), Math.sin(a) * 0.85).normalize(),
      scale: 520 + i * 90,
      a: new THREE.Color(t[0]),
      b: new THREE.Color(t[1]),
      seed: i * 2.17,
    };
  });
}

export function SpaceField() {
  const group = useRef<THREE.Group>(null);
  const nebula = useRef<THREE.Group>(null);
  const bodies = useMemo(makeBodies, []);
  const clouds = useMemo(makeClouds, []);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 24, 16), []);
  const glowGeo = useMemo(() => new THREE.SphereGeometry(1.12, 16, 12), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(1.42, 2.28, 40), []);
  const planeGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
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
  const glowMats = useMemo(
    () =>
      bodies.map(
        (b) =>
          new THREE.MeshBasicMaterial({
            color: b.b,
            transparent: true,
            opacity: 0.18,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
          }),
      ),
    [bodies],
  );
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xd2c09a,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  const nebMats = useMemo(
    () =>
      clouds.map(
        (c) =>
          new THREE.ShaderMaterial({
            uniforms: {
              uA: { value: c.a },
              uB: { value: c.b },
              uTime: { value: 0 },
              uSeed: { value: c.seed },
            },
            vertexShader: NEBULA_VERT,
            fragmentShader: NEBULA_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
            side: THREE.DoubleSide,
          }),
      ),
    [clouds],
  );

  useEffect(
    () => () => {
      geo.dispose();
      glowGeo.dispose();
      ringGeo.dispose();
      planeGeo.dispose();
      ringMat.dispose();
      mats.forEach((m) => m.dispose());
      glowMats.forEach((m) => m.dispose());
      nebMats.forEach((m) => m.dispose());
    },
    [geo, glowGeo, ringGeo, planeGeo, ringMat, mats, glowMats, nebMats],
  );

  useFrame(({ camera, clock }, dt) => {
    const root = group.current;
    if (!root) return;
    const ng = nebula.current;
    const vis = runtime.spaceAmt > 0.04;
    root.visible = vis;
    if (ng) ng.visible = vis;
    if (!vis) return;
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
    if (ng) {
      ng.position.copy(camera.position);
      clouds.forEach((c, i) => {
        const node = ng.children[i];
        if (!node) return;
        node.position.copy(c.dir).multiplyScalar(900);
        node.lookAt(camera.position);
        nebMats[i].uniforms.uTime.value = clock.elapsedTime;
      });
    }
  });

  return (
    <group>
      <group ref={group}>
        {bodies.map((b, i) => (
          <group key={i} position={[b.x, b.y, b.z]} scale={b.r}>
            <mesh geometry={geo} material={mats[i]} />
            <mesh geometry={glowGeo} material={glowMats[i]} />
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
      <group ref={nebula} frustumCulled={false}>
        {clouds.map((c, i) => (
          <mesh
            key={i}
            geometry={planeGeo}
            material={nebMats[i]}
            scale={c.scale}
            renderOrder={-40}
            frustumCulled={false}
          />
        ))}
      </group>
    </group>
  );
}
