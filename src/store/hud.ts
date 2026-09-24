import { create } from "zustand";
import { clamp, DEFAULT_CRUISE, WORLD_HOME, type MusicId, type WorldMode } from "@/game/flight";
import { runtime, type FxFlags } from "@/game/runtime";

export const RETICLES = ["off", "dot", "plus", "ring"] as const;
export type Reticle = (typeof RETICLES)[number];

export type FeatureFlags = FxFlags & {
  hud: boolean;
  traffic: boolean;
};

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
  world: WorldMode;
  music: MusicId;
  invertLook: boolean;
  invertTurn: boolean;
  lookSens: number;
  easy: boolean;
  fx: FeatureFlags;
  settingsOpen: boolean;
  setPlaying: (v: boolean) => void;
  setReady: (v: boolean) => void;
  setMuted: (v: boolean) => void;
  setMobile: (v: boolean) => void;
  setNightOn: (v: boolean) => void;
  setReticle: (v: Reticle) => void;
  setWorld: (v: WorldMode) => void;
  setMusic: (v: MusicId) => void;
  setInvertLook: (v: boolean) => void;
  setInvertTurn: (v: boolean) => void;
  setLookSens: (v: number) => void;
  setEasy: (v: boolean) => void;
  setFx: (key: keyof FeatureFlags, on: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  patch: (
    p: Partial<Pick<HudState, "altitude" | "speed" | "cruise" | "layer" | "inCloud" | "space" | "night">>,
  ) => void;
};

const FX_DEFAULT: FeatureFlags = {
  airplanes: false,
  contrails: true,
  sun: true,
  stars: true,
  haze: true,
  streaks: true,
  throttle: true,
  hud: true,
  traffic: true,
};

function persistAll(state: {
  nightOn: boolean;
  muted: boolean;
  reticle: Reticle;
  world: WorldMode;
  music: MusicId;
  invertLook: boolean;
  invertTurn: boolean;
  lookSens: number;
  easy: boolean;
  fx: FeatureFlags;
}) {
  try {
    window.localStorage.setItem(
      "drift-fx",
      JSON.stringify({
        night: state.nightOn,
        wind: !state.muted,
        reticle: state.reticle,
        world: state.world,
        music: state.music,
        invertLook: state.invertLook,
        invertTurn: state.invertTurn,
        lookSens: state.lookSens,
        easy: state.easy,
        ...state.fx,
      }),
    );
    window.localStorage.setItem("drift-night-manual", state.nightOn ? "1" : "0");
    window.localStorage.setItem("drift-muted", state.muted ? "1" : "0");
    window.localStorage.setItem("drift-reticle", state.reticle);
  } catch {
    /* ignore */
  }
}

function applyLook(invertLook: boolean, invertTurn: boolean, lookSens: number) {
  runtime.invertLook = invertLook;
  runtime.invertTurn = invertTurn;
  runtime.lookSens = lookSens;
}

export const LOOK_SENS_MIN = 0.5;
export const LOOK_SENS_MAX = 2;

function applyFx(fx: FeatureFlags) {
  runtime.fx.airplanes = fx.airplanes;
  runtime.fx.contrails = fx.contrails;
  runtime.fx.sun = fx.sun;
  runtime.fx.stars = fx.stars;
  runtime.fx.haze = fx.haze;
  runtime.fx.streaks = fx.streaks;
  runtime.fx.throttle = fx.throttle;
}

function placeWorld(mode: WorldMode) {
  runtime.world = mode;
  const home = WORLD_HOME[mode];
  runtime.craft.y = home.y;
  runtime.craft.pitch = home.pitch;
  const sky = mode === "sky" ? "day" : mode;
  document.documentElement.dataset.sky = runtime.nightTarget > 0.5 && mode === "sky" ? "night" : sky;
}

const WORLDS: WorldMode[] = ["sky", "space", "reef"];
const TRACKS: MusicId[] = ["off", "haze", "drift", "tide", "void"];

export function loadSavedOptions() {
  let fx: FeatureFlags = { ...FX_DEFAULT };
  let nightOn = false;
  let muted = true;
  let reticle: Reticle = "off";
  let world: WorldMode = "sky";
  let music: MusicId = "haze";
  let invertLook = false;
  let invertTurn = false;
  let lookSens = 1;
  let easy = false;
  let forcePlanesOff = false;
  let forceWindOff = false;
  try {
    const raw = window.localStorage.getItem("drift-fx");
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>;
      for (const key of Object.keys(FX_DEFAULT) as (keyof FeatureFlags)[]) {
        if (typeof p[key] === "boolean") fx[key] = p[key] as boolean;
      }
      if (typeof p.night === "boolean") nightOn = p.night;
      if (typeof p.wind === "boolean") muted = !p.wind;
      if (typeof p.reticle === "string" && (RETICLES as readonly string[]).includes(p.reticle)) {
        reticle = p.reticle as Reticle;
      }
      if (typeof p.world === "string" && WORLDS.includes(p.world as WorldMode)) world = p.world as WorldMode;
      if (typeof p.music === "string" && TRACKS.includes(p.music as MusicId)) music = p.music as MusicId;
      if (typeof p.invertLook === "boolean") invertLook = p.invertLook;
      if (typeof p.invertTurn === "boolean") invertTurn = p.invertTurn;
      if (typeof p.lookSens === "number" && Number.isFinite(p.lookSens)) {
        lookSens = clamp(p.lookSens, LOOK_SENS_MIN, LOOK_SENS_MAX);
      }
      if (typeof p.easy === "boolean") easy = p.easy;
    } else {
      nightOn = window.localStorage.getItem("drift-night-manual") === "1";
      muted = window.localStorage.getItem("drift-muted") !== "0";
      const reticleSaved = window.localStorage.getItem("drift-reticle");
      if (reticleSaved && (RETICLES as readonly string[]).includes(reticleSaved)) {
        reticle = reticleSaved as Reticle;
      }
    }
    if (window.localStorage.getItem("drift-wind-off") !== "1") {
      muted = true;
      forceWindOff = true;
      window.localStorage.setItem("drift-wind-off", "1");
      window.localStorage.setItem("drift-muted", "1");
    }
    if (window.localStorage.getItem("drift-planes-off") !== "1") {
      fx.airplanes = false;
      forcePlanesOff = true;
      window.localStorage.setItem("drift-planes-off", "1");
    }
  } catch {
    /* ignore */
  }
  applyFx(fx);
  applyLook(invertLook, invertTurn, lookSens);
  runtime.night = nightOn ? 1 : 0;
  runtime.nightTarget = nightOn ? 1 : 0;
  runtime.muted = muted;
  runtime.music = music;
  runtime.easy = easy;
  placeWorld(world);
  useHud.setState({ fx, nightOn, muted, reticle, world, music, invertLook, invertTurn, lookSens, easy });
  if (forcePlanesOff || forceWindOff) {
    persistAll({ nightOn, muted, reticle, world, music, invertLook, invertTurn, lookSens, easy, fx });
  }
}

export function resetOptions() {
  const fx: FeatureFlags = { ...FX_DEFAULT };
  applyFx(fx);
  applyLook(false, false, 1);
  runtime.night = 0;
  runtime.nightTarget = 0;
  runtime.muted = true;
  runtime.music = "haze";
  runtime.easy = false;
  placeWorld("sky");
  useHud.setState({
    fx,
    nightOn: false,
    muted: true,
    reticle: "off",
    world: "sky",
    music: "haze",
    invertLook: false,
    invertTurn: false,
    lookSens: 1,
    easy: false,
  });
  persistAll({
    nightOn: false,
    muted: true,
    reticle: "off",
    world: "sky",
    music: "haze",
    invertLook: false,
    invertTurn: false,
    lookSens: 1,
    easy: false,
    fx,
  });
}

export const useHud = create<HudState>((set, get) => ({
  playing: false,
  ready: false,
  altitude: 148,
  speed: 24,
  cruise: DEFAULT_CRUISE,
  layer: "Among the clouds",
  inCloud: 0,
  space: 0,
  muted: true,
  mobile: false,
  night: 0,
  nightOn: false,
  reticle: "off",
  world: "sky",
  music: "haze",
  invertLook: false,
  invertTurn: false,
  lookSens: 1,
  easy: false,
  fx: { ...FX_DEFAULT },
  settingsOpen: false,
  reducedMotion:
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  setPlaying: (playing) => set({ playing }),
  setReady: (ready) => set({ ready }),
  setMuted: (muted) => {
    set({ muted });
    persistAll({ ...get(), muted });
    runtime.muted = muted;
  },
  setMobile: (mobile) => set({ mobile }),
  setNightOn: (nightOn) => {
    runtime.nightTarget = nightOn ? 1 : 0;
    set({ nightOn });
    persistAll({ ...get(), nightOn });
    const world = get().world;
    document.documentElement.dataset.sky = nightOn && world === "sky" ? "night" : world === "sky" ? "day" : world;
  },
  setReticle: (reticle) => {
    set({ reticle });
    persistAll({ ...get(), reticle });
  },
  setWorld: (world) => {
    placeWorld(world);
    set({ world });
    persistAll({ ...get(), world });
  },
  setMusic: (music) => {
    runtime.music = music;
    set({ music });
    persistAll({ ...get(), music });
  },
  setInvertLook: (invertLook) => {
    set({ invertLook });
    applyLook(invertLook, get().invertTurn, get().lookSens);
    persistAll({ ...get(), invertLook });
  },
  setInvertTurn: (invertTurn) => {
    set({ invertTurn });
    applyLook(get().invertLook, invertTurn, get().lookSens);
    persistAll({ ...get(), invertTurn });
  },
  setLookSens: (value) => {
    const lookSens = clamp(value, LOOK_SENS_MIN, LOOK_SENS_MAX);
    set({ lookSens });
    applyLook(get().invertLook, get().invertTurn, lookSens);
    persistAll({ ...get(), lookSens });
  },
  setEasy: (easy) => {
    runtime.easy = easy;
    set({ easy });
    persistAll({ ...get(), easy });
  },
  setFx: (key, on) => {
    const fx = { ...get().fx, [key]: on };
    applyFx(fx);
    set({ fx });
    persistAll({ ...get(), fx });
  },
  setSettingsOpen: (settingsOpen) => {
    runtime.uiCapture = settingsOpen;
    if (!settingsOpen) runtime.uiPointers.clear();
    set({ settingsOpen });
  },
  patch: (p) => set(p),
}));
