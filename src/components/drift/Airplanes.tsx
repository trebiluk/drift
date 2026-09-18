import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp, FLOOR_Y, spaceFactor } from "@/game/flight";
import { runtime } from "@/game/runtime";

const MIN_SEP = 170;
const ACCENTS = [0x3d6ea8, 0x8a3d44, 0x2f5a48, 0xc4a35a, 0x4a4e62];

type Bird = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  speed: number;
  scale: number;
  phase: number;
};

const _fwd = new THREE.Vector3();

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function place(b: Bird, cam: THREE.Vector3, facing: number, rng: () => number, preferView = false) {
  const side = rng() < 0.5 ? -1 : 1;
  const along = preferView ? 260 + rng() * 220 : 340 + rng() * 780;
  const lateral = (preferView ? 70 + rng() * 130 : 200 + rng() * 420) * side;
  const fx = -Math.sin(facing);
  const fz = -Math.cos(facing);
  const rx = Math.cos(facing);
  const rz = -Math.sin(facing);
  b.x = cam.x + fx * along + rx * lateral;
  b.z = cam.z + fz * along + rz * lateral;
  const band = rng();
  if (preferView) b.y = cam.y + 70 + rng() * 110;
  else if (band < 0.28) b.y = Math.max(FLOOR_Y + 24, cam.y - 35 - rng() * 55);
  else if (band < 0.72) b.y = cam.y + 55 + rng() * 160;
  else b.y = cam.y + 200 + rng() * 280;
  b.y = clamp(b.y, FLOOR_Y + 18, 1350);
  const cross = rng() < 0.42 ? Math.PI * (0.72 + rng() * 0.56) : (rng() - 0.5) * 0.9;
  b.yaw = facing + cross * side;
  b.pitch = (rng() - 0.5) * 0.06;
  b.speed = 34 + rng() * 32;
  b.scale = 8.5 + rng() * 5.5;
  b.phase = rng() * Math.PI * 2;
}

function stepBird(b: Bird, cam: THREE.Vector3, facing: number, dt: number, rng: () => number) {
  const cp = Math.cos(b.pitch);
  const fx = -Math.sin(b.yaw) * cp;
  const fy = Math.sin(b.pitch);
  const fz = -Math.cos(b.yaw) * cp;
  b.x += fx * b.speed * dt;
  b.y += fy * b.speed * dt;
  b.z += fz * b.speed * dt;
  b.phase += dt;

  const dx = b.x - cam.x;
  const dy = b.y - cam.y;
  const dz = b.z - cam.z;
  const flat = Math.hypot(dx, dz);
  if (flat < MIN_SEP) {
    const push = (MIN_SEP - flat) * Math.min(1, dt * 4.2);
    b.x += (dx / (flat + 0.02)) * push;
    b.z += (dz / (flat + 0.02)) * push;
  }
  if (Math.abs(dy) < 32 && flat < 240) {
    b.y += Math.sign(dy || 1) * 55 * dt;
  }
  if (b.y < FLOOR_Y + 12) b.y += (FLOOR_Y + 12 - b.y) * Math.min(1, dt * 2);

  const dist = Math.hypot(dx, dy, dz);
  if (dist > 1550 || dist < 55 || b.y > 1480) place(b, cam, facing, rng, false);
}

function makeMats(accent: number) {
  const body = new THREE.MeshStandardMaterial({
    color: 0xd8e0ea,
    metalness: 0.42,
    roughness: 0.34,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x2c3440,
    metalness: 0.55,
    roughness: 0.38,
  });
  const paint = new THREE.MeshStandardMaterial({
    color: accent,
    metalness: 0.18,
    roughness: 0.48,
  });
  const red = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
  const green = new THREE.MeshBasicMaterial({ color: 0x3dff7a });
  const white = new THREE.MeshBasicMaterial({ color: 0xfff4d6 });
  return { body, dark, paint, red, green, white };
}

function makeAirliner(accent: number) {
  const mats = makeMats(accent);
  const g = new THREE.Group();
  g.rotation.order = "YXZ";

  const fuse = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 4.8, 3, 8), mats.body);
  fuse.rotation.x = Math.PI / 2;
  g.add(fuse);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), mats.body);
  nose.position.z = -2.55;
  nose.scale.set(1, 0.85, 1.1);
  g.add(nose);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.09, 1.35), mats.body);
  wing.position.set(0, -0.14, 0.15);
  g.add(wing);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 4.6), mats.paint);
  stripe.position.set(0.4, 0.02, 0);
  g.add(stripe);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 0.85), mats.paint);
  fin.position.set(0, 0.62, 2.25);
  g.add(fin);

  const stab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.07, 0.55), mats.body);
  stab.position.set(0, 0.16, 2.2);
  g.add(stab);

  for (const x of [-1.85, 1.85]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 1.05, 8), mats.dark);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(x, -0.38, 0.05);
    g.add(eng);
  }

  const left = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mats.red);
  left.position.set(-4.15, -0.12, 0.15);
  left.name = "navRed";
  g.add(left);
  const right = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mats.green);
  right.position.set(4.15, -0.12, 0.15);
  right.name = "navGreen";
  g.add(right);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), mats.white);
  strobe.position.set(0, 1.18, 2.15);
  strobe.name = "strobe";
  g.add(strobe);

  g.userData.mats = mats;
  return g;
}

function makeTrail() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xeaf4ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return { mesh, mat, geo };
}

export function Airplanes() {
  const root = useRef<THREE.Group>(null);
  const count = runtime.mobile ? 4 : 5;

  const pack = useMemo(() => {
    const birds: Bird[] = [];
    const crafts: THREE.Group[] = [];
    const trails: ReturnType<typeof makeTrail>[] = [];
    const rngs: Array<() => number> = [];
    for (let i = 0; i < count; i++) {
      const rng = mulberry(1100 + i * 97);
      rngs.push(rng);
      birds.push({ x: 0, y: 200, z: 400 + i * 80, yaw: 0, pitch: 0, speed: 40, scale: 24, phase: rng() * 6 });
      crafts.push(makeAirliner(ACCENTS[i % ACCENTS.length]));
      trails.push(makeTrail());
    }
    return { birds, crafts, trails, rngs };
  }, [count]);

  useEffect(() => {
    const parent = root.current;
    if (!parent) return;
    for (let i = 0; i < pack.crafts.length; i++) {
      parent.add(pack.crafts[i]);
      parent.add(pack.trails[i].mesh);
    }
    return () => {
      for (const c of pack.crafts) {
        parent.remove(c);
        c.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const m = mesh.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m?.dispose();
        });
      }
      for (const t of pack.trails) {
        parent.remove(t.mesh);
        t.geo.dispose();
        t.mat.dispose();
      }
    };
  }, [pack]);

  const seeded = useRef(false);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { birds, crafts, trails, rngs } = pack;
    camera.getWorldDirection(_fwd);
    const facing = Math.atan2(-_fwd.x, -_fwd.z);
    const space = spaceFactor(camera.position.y);
    const show = space < 0.72 && camera.position.y < 1280;

    if (!seeded.current) {
      for (let i = 0; i < birds.length; i++) place(birds[i], camera.position, facing, rngs[i], i < 2);
      seeded.current = true;
    }

    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      const craft = crafts[i];
      if (!show) {
        craft.visible = false;
        trails[i].mat.opacity = 0;
        trails[i].mesh.visible = false;
        continue;
      }
      stepBird(b, camera.position, facing, dt, rngs[i]);
      craft.visible = true;
      craft.position.set(b.x, b.y, b.z);
      craft.rotation.y = b.yaw + Math.PI;
      craft.rotation.x = -b.pitch;
      craft.rotation.z = Math.sin(b.phase * 0.35) * 0.05;
      craft.scale.setScalar(b.scale);

      const night = runtime.night;
      const blink = night > 0.25 && Math.sin(b.phase * 6) > 0.15;
      const strobeOn = night > 0.25 && Math.sin(b.phase * 11) > 0.65;
      const red = craft.getObjectByName("navRed") as THREE.Mesh | undefined;
      const green = craft.getObjectByName("navGreen") as THREE.Mesh | undefined;
      const strobe = craft.getObjectByName("strobe") as THREE.Mesh | undefined;
      if (red) red.visible = blink;
      if (green) green.visible = blink;
      if (strobe) strobe.visible = strobeOn;

      const trail = trails[i];
      const back = 90 + b.scale * 5;
      const cp = cpSafe(b.pitch);
      const tx = Math.sin(b.yaw) * cp;
      const ty = -Math.sin(b.pitch);
      const tz = Math.cos(b.yaw) * cp;
      const hx = b.x + tx * b.scale * 2.8;
      const hy = b.y;
      const hz = b.z + tz * b.scale * 2.8;
      trail.mesh.visible = true;
      trail.mesh.position.set(hx + tx * back * 0.5, hy + ty * back * 0.5, hz + tz * back * 0.5);
      trail.mesh.lookAt(hx + tx * back, hy + ty * back, hz + tz * back);
      trail.mesh.scale.set(0.45, 0.45, back);
      const dist = Math.hypot(b.x - camera.position.x, b.y - camera.position.y, b.z - camera.position.z);
      trail.mat.opacity = THREE.MathUtils.clamp(1 - dist / 1400, 0, 1) * 0.28 * (1 - runtime.inCloud * 0.55);
    }
  });

  return <group ref={root} />;
}

function cpSafe(pitch: number) {
  return Math.cos(pitch);
}
