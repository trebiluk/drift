import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createSoundscape } from "@/game/audio";
import { detectTouchMode } from "@/game/device";
import { clamp } from "@/game/flight";
import { attachInput, detachInput } from "@/game/input";
import { installControlsTest, runtime, startFlight } from "@/game/runtime";
import { loadSavedOptions, useHud } from "@/store/hud";
import { Overlay } from "./Overlay";
import { World } from "./World";

function syncTouchMode() {
  const touch = detectTouchMode();
  runtime.mobile = touch;
  document.documentElement.dataset.input = touch ? "touch" : "desk";
  useHud.getState().setMobile(touch);
  return touch;
}

export function DriftExperience() {
  const audioRef = useRef<ReturnType<typeof createSoundscape> | null>(null);
  const muted = useHud((s) => s.muted);
  const playing = useHud((s) => s.playing);
  const music = useHud((s) => s.music);
  const [touchMode, setTouchMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return syncTouchMode();
  });

  useEffect(() => {
    setTouchMode(syncTouchMode());
    attachInput();
    installControlsTest();
    const cruiseSaved = window.localStorage.getItem("drift-cruise");
    if (cruiseSaved != null) {
      const n = Number(cruiseSaved);
      if (Number.isFinite(n)) {
        runtime.cruise = clamp(n, 0, 1);
        useHud.getState().patch({ cruise: runtime.cruise });
      }
    }
    loadSavedOptions();
    const onMode = () => setTouchMode(syncTouchMode());
    const mqs = [
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(hover: none)"),
      window.matchMedia("(max-width: 720px)"),
    ];
    for (const mq of mqs) mq.addEventListener("change", onMode);
    window.addEventListener("orientationchange", onMode);
    return () => {
      for (const mq of mqs) mq.removeEventListener("change", onMode);
      window.removeEventListener("orientationchange", onMode);
      detachInput();
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setMuted(muted);
    runtime.muted = muted;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("drift-muted", muted ? "1" : "0");
    }
  }, [muted]);

  useEffect(() => {
    audioRef.current?.setTrack(music);
  }, [music]);

  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      audioRef.current?.update(runtime.craft.speed, runtime.inCloud, runtime.craft.y, runtime.world);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  const handleStart = () => {
    if (!audioRef.current) audioRef.current = createSoundscape();
    audioRef.current.unlock();
    audioRef.current.setMuted(useHud.getState().muted);
    audioRef.current.setTrack(useHud.getState().music);
    startFlight();
    useHud.getState().setPlaying(true);
  };

  return (
    <main className="sky-wash relative h-dvh w-full overflow-hidden text-cloud select-none">
      <div className="absolute inset-0 touch-none">
        <Canvas
          camera={{ fov: 72, near: 0.4, far: 7600, position: [0, 148, 0] }}
          dpr={touchMode ? [1, 1.35] : [1, 2]}
          gl={{
            antialias: !touchMode,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
            alpha: false,
            preserveDrawingBuffer: true,
          }}
          onCreated={({ gl, camera }) => {
            gl.setClearColor("#0c4aaa", 1);
            gl.toneMappingExposure = 1;
            camera.rotation.order = "YXZ";
            useHud.getState().setReady(true);
          }}
        >
          <World />
        </Canvas>
      </div>
      <Overlay onStart={handleStart} />
    </main>
  );
}
