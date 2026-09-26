import type { MusicId, WorldMode } from "./flight";

type Soundscape = {
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  setTrack: (id: MusicId) => void;
  update: (speed: number, inCloud: number, altitude: number, world: WorldMode) => void;
  dispose: () => void;
};

function ctxCtor() {
  return window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function brownNoise(ctx: AudioContext, seconds = 3) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 4.2;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

function clipUrl(file: string) {
  const path = window.location.pathname;
  const dir = path.endsWith("/") ? path : `${path}/`;
  return `${dir}sounds/${file}`;
}

const CLIPS: Partial<Record<MusicId, string>> = {
  rain: "rain.mp3",
  ocean: "ocean.mp3",
  bowls: "bowls.mp3",
  focus: "focus.mp3",
  keys: "keys.mp3",
};

const CLIP_VOLUME: Partial<Record<MusicId, number>> = {
  rain: 0.72,
  ocean: 0.8,
  bowls: 0.9,
  focus: 0.66,
  keys: 0.74,
};

export function createSoundscape(): Soundscape {
  const Ctor = ctxCtor();
  const ctx = new Ctor({ latencyHint: "playback" });
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const windFilter = ctx.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 380;
  windFilter.Q.value = 0.65;
  const windGain = ctx.createGain();
  windGain.gain.value = 0;
  const windSrc = brownNoise(ctx);
  windSrc.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);

  const rumble = ctx.createOscillator();
  rumble.type = "sine";
  rumble.frequency.value = 52;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0;
  rumble.connect(rumbleGain);
  rumbleGain.connect(master);

  windSrc.start();
  rumble.start();

  let windOn = false;
  let track: MusicId = "off";
  let heard = false;
  let clip: HTMLAudioElement | null = null;

  const stopClip = () => {
    if (!clip) return;
    clip.pause();
    clip.src = "";
    clip = null;
  };

  const startClip = () => {
    const file = CLIPS[track];
    if (!file) {
      stopClip();
      return;
    }
    if (clip?.dataset.track === track && !clip.paused) return;
    stopClip();
    const el = new Audio(clipUrl(file));
    el.loop = true;
    el.preload = "auto";
    el.volume = CLIP_VOLUME[track] ?? 0.7;
    el.dataset.track = track;
    clip = el;
    void el.play().catch(() => {
      /* the next tap will try again */
    });
  };

  const unlock = () => {
    heard = true;
    master.gain.value = 0.55;
    const resume = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    void resume.then(() => {
      if (ctx.state === "running") master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.08);
    });
    if (CLIPS[track]) startClip();
  };

  const onVis = () => {
    if (document.visibilityState !== "visible") {
      clip?.pause();
      return;
    }
    if (heard && CLIPS[track]) startClip();
    if (ctx.state === "suspended") void ctx.resume();
  };
  document.addEventListener("visibilitychange", onVis);

  const api: Soundscape = {
    unlock,
    setMuted: (windOff) => {
      windOn = !windOff;
      if (windOn) return;
      if (ctx.state === "running") {
        windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        rumbleGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      } else {
        windGain.gain.value = 0;
        rumbleGain.gain.value = 0;
      }
    },
    setTrack: (id) => {
      track = id;
      if (!CLIPS[id]) {
        stopClip();
        return;
      }
      if (heard) startClip();
    },
    update: (speed, inCloud, altitude, world) => {
      if (ctx.state !== "running") return;
      const calm = Boolean(CLIPS[track]);
      const air = windOn
        ? (world === "reef"
            ? 0.06 + speed / 180
            : world === "space"
              ? 0.03 + speed / 220
              : 0.08 + speed / 120 + inCloud * 0.16) * (calm ? 0.45 : 1)
        : 0;
      windGain.gain.setTargetAtTime(air, ctx.currentTime, 0.12);
      const f0 = world === "reef" ? 180 : world === "space" ? 140 : 240;
      windFilter.frequency.setTargetAtTime(f0 + speed * 8 + altitude * 0.02, ctx.currentTime, 0.15);
      rumble.frequency.setTargetAtTime(40 + Math.min(altitude, 1800) * 0.01, ctx.currentTime, 0.2);
      rumbleGain.gain.setTargetAtTime(windOn ? (world === "space" ? 0.018 : 0.03) : 0, ctx.currentTime, 0.2);
    },
    dispose: () => {
      document.removeEventListener("visibilitychange", onVis);
      stopClip();
      try {
        windSrc.stop();
        rumble.stop();
        void ctx.close();
      } catch {
        /* already closed */
      }
      if (active === api) active = null;
    },
  };
  return api;
}

let active: Soundscape | null = null;

export function sharedSoundscape() {
  if (!active) active = createSoundscape();
  return active;
}

export function previewSound(id: MusicId) {
  const audio = sharedSoundscape();
  audio.setTrack(id);
  if (CLIPS[id]) audio.unlock();
}
