import { createCraft, DEFAULT_CRUISE, type Craft, type MusicId, type WorldMode } from "./flight";
import type { TrafficSnapshot } from "./traffic";

export type { MusicId, WorldMode } from "./flight";

export type PointerState = {
  nx: number;
  ny: number;
  active: boolean;
  isMouse: boolean;
  ready: boolean;
};

export type StickState = {
  active: boolean;
  pointerId: number | null;
  originX: number;
  originY: number;
  x: number;
  y: number;
};

export type FxFlags = {
  airplanes: boolean;
  contrails: boolean;
  sun: boolean;
  stars: boolean;
  haze: boolean;
  streaks: boolean;
  throttle: boolean;
};

export type Runtime = {
  playing: boolean;
  muted: boolean;
  mobile: boolean;
  craft: Craft;
  keys: Set<string>;
  injectedKeys: string[] | null;
  steerOverride: number | null;
  pointer: PointerState;
  stick: StickState;
  uiPointers: Set<number>;
  time: number;
  inCloud: number;
  cruise: number;
  uiCapture: boolean;
  night: number;
  nightTarget: number;
  fx: FxFlags;
  world: WorldMode;
  music: MusicId;
  spaceAmt: number;
  reefAmt: number;
  invertLook: boolean;
  invertTurn: boolean;
  lookSens: number;
  easy: boolean;
  traffic: TrafficSnapshot | null;
  lod: number;
};

export const runtime: Runtime = {
  playing: false,
  muted: true,
  mobile: false,
  craft: createCraft(),
  keys: new Set(),
  injectedKeys: null,
  steerOverride: null,
  pointer: { nx: 0, ny: 0, active: false, isMouse: true, ready: false },
  stick: { active: false, pointerId: null, originX: 0, originY: 0, x: 0, y: 0 },
  uiPointers: new Set(),
  time: 0,
  inCloud: 0,
  cruise: DEFAULT_CRUISE,
  uiCapture: false,
  night: 0,
  nightTarget: 0,
  fx: {
    airplanes: false,
    contrails: true,
    sun: true,
    stars: true,
    haze: true,
    streaks: true,
    throttle: true,
  },
  world: "sky",
  music: "haze",
  spaceAmt: 0,
  reefAmt: 0,
  invertLook: false,
  invertTurn: false,
  lookSens: 1,
  easy: false,
  traffic: null,
  lod: 0,
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  getPitch: () => number;
  setAltitude?: (y: number) => void;
  setSteer?: (v: number) => void;
  setKeys?: (codes: string[]) => void;
  setCruise?: (v: number) => void;
  isMobile?: () => boolean;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

export function installControlsTest() {
  if (typeof window === "undefined") return;
  window.__controlsTest = {
    getYaw: () => runtime.craft.yaw,
    getSpeed: () => runtime.craft.speed,
    getPitch: () => runtime.craft.pitch,
    setAltitude: (y: number) => {
      runtime.craft.y = y;
    },
    setSteer: (v: number) => {
      runtime.steerOverride = v;
    },
    setKeys: (codes: string[]) => {
      runtime.injectedKeys = codes;
      if (codes.length === 0) runtime.steerOverride = null;
    },
    setCruise: (v: number) => {
      runtime.cruise = v;
    },
    isMobile: () => runtime.mobile,
  };
}

function resetStick() {
  runtime.stick.active = false;
  runtime.stick.pointerId = null;
  runtime.stick.x = 0;
  runtime.stick.y = 0;
}

export function startFlight() {
  runtime.playing = true;
  runtime.pointer.nx = 0;
  runtime.pointer.ny = 0;
  runtime.pointer.ready = false;
  runtime.pointer.active = false;
  runtime.uiCapture = false;
  runtime.uiPointers.clear();
  resetStick();
}

export function resetCraft() {
  runtime.craft = createCraft();
  runtime.playing = false;
  runtime.injectedKeys = null;
  runtime.steerOverride = null;
  runtime.uiCapture = false;
  runtime.uiPointers.clear();
  resetStick();
  runtime.keys.clear();
}
