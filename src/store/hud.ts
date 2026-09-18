import { create } from "zustand";
import { DEFAULT_CRUISE } from "@/game/flight";
import { runtime } from "@/game/runtime";

export const RETICLES = ["off", "dot", "plus", "ring"] as const;
export type Reticle = (typeof RETICLES)[number];

export type HudState = {
  playing: boolean;
  ready: boolean;
  altitude: number;
  speed: number;
  cruise: number;
  layer: string;
  inCloud: number;
  space: number;
  muted: boolean;
  reducedMotion: boolean;
  mobile: boolean;
  night: number;
  nightOn: boolean;
  reticle: Reticle;
  setPlaying: (v: boolean) => void;
  setReady: (v: boolean) => void;
  setMuted: (v: boolean) => void;
  setMobile: (v: boolean) => void;
  setNightOn: (v: boolean) => void;
  setReticle: (v: Reticle) => void;
  patch: (
    p: Partial<Pick<HudState, "altitude" | "speed" | "cruise" | "layer" | "inCloud" | "space" | "night">>,
  ) => void;
};

export const useHud = create<HudState>((set) => ({
  playing: false,
  ready: false,
  altitude: 268,
  speed: 24,
  cruise: DEFAULT_CRUISE,
  layer: "Among the clouds",
  inCloud: 0,
  space: 0,
  muted: false,
  mobile: false,
  night: 0,
  nightOn: false,
  reticle: "off",
  reducedMotion:
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  setPlaying: (playing) => set({ playing }),
  setReady: (ready) => set({ ready }),
  setMuted: (muted) => set({ muted }),
  setMobile: (mobile) => set({ mobile }),
  setNightOn: (nightOn) => {
    runtime.nightTarget = nightOn ? 1 : 0;
    set({ nightOn });
    try {
      window.localStorage.setItem("drift-night-manual", nightOn ? "1" : "0");
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.sky = nightOn ? "night" : "day";
  },
  setReticle: (reticle) => {
    set({ reticle });
    try {
      window.localStorage.setItem("drift-reticle", reticle);
    } catch {
      /* ignore */
    }
  },
  patch: (p) => set(p),
}));
