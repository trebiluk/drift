import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createWindAudio } from "@/game/audio";
import { detectTouchMode } from "@/game/device";
import { clamp } from "@/game/flight";
import { attachInput, detachInput } from "@/game/input";
import { installControlsTest, runtime, startFlight } from "@/game/runtime";
import { RETICLES, useHud, type Reticle } from "@/store/hud";
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
  const audioRef = useRef<ReturnType<typeof createWindAudio> | null>(null);
  const muted = useHud((s) => s.muted);
  const playing = useHud((s) => s.playing);
  const [touchMode, setTouchMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return syncTouchMode();
  });

  useEffect(() => {
    setTouchMode(syncTouchMode());
    attachInput();
    installControlsTest();
    const saved = window.localStorage.getItem("drift-muted");
    if (saved === "1") {
      runtime.muted = true;
      useHud.getState().setMuted(true);
    }
    const cruiseSaved = window.localStorage.getItem("drift-cruise");
    if (cruiseSaved != null) {
      const n = Number(cruiseSaved);
      if (Number.isFinite(n)) {
        runtime.cruise = clamp(n, 0, 1);
        useHud.getState().patch({ cruise: runtime.cruise });
      }
    }
    const nightSaved = window.localStorage.getItem("drift-night-manual");
    if (nightSaved === "1") {
      runtime.night = 1;
      runtime.nightTarget = 1;
      useHud.getState().setNightOn(true);
    } else {
      runtime.night = 0;
      runtime.nightTarget = 0;
      useHud.getState().setNightOn(false);
    }
    const reticleSaved = window.localStorage.getItem("drift-reticle");
    if (reticleSaved && (RETICLES as readonly string[]).includes(reticleSaved)) {
      useHud.getState().setReticle(reticleSaved as Reticle);
    }
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
    if (!playing) return;
    let id = 0;
    const tick = () => {
      audioRef.current?.update(runtime.craft.speed, runtime.inCloud, runtime.craft.y);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  const handleStart = () => {
    if (!audioRef.current) audioRef.current = createWindAudio();
    audioRef.current.unlock();
    audioRef.current.setMuted(useHud.getState().muted);
    startFlight();
    useHud.getState().setPlaying(true);
  };

  return (
    <main className="sky-wash relative h-dvh w-full overflow-hidden text-cloud select-none">
      <div className="absolute inset-0 touch-none">
        <Canvas
          camera={{ fov: 72, near: 0.4, far: 7600, position: [0, 268, 0] }}
          dpr={touchMode ? [1, 1.35] : [1, 2]}
          gl={{
            antialias: !touchMode,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            alpha: false,
            preserveDrawingBuffer: true,
          }}
          onCreated={({ gl, camera }) => {
            gl.setClearColor("#1a58b8", 1);
            gl.toneMappingExposure = 1.06;
            camera.rotation.order = "YXZ";
            useHud.getState().setReady(true);
          }}
        >
          <World />
        </Canvas>
      </div>
      <Overlay
        onStart={handleStart}
        onToggleMute={() => useHud.getState().setMuted(!useHud.getState().muted)}
        onToggleNight={() => useHud.getState().setNightOn(!useHud.getState().nightOn)}
      />
    </main>
  );
}
