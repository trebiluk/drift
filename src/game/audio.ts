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

  const bedFilter = ctx.createBiquadFilter();
  bedFilter.type = "lowpass";
  bedFilter.frequency.value = 800;
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0;
  windSrc.connect(bedFilter);
  bedFilter.connect(bedGain);
  bedGain.connect(master);

  const tone = (type: OscillatorType) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    return { osc, gain };
  };
  const bowl = tone("sine");
  const bowlRing = tone("sine");
  const key = tone("triangle");

  windSrc.start();
  rumble.start();

  let windOn = false;
  let track: MusicId = "off";
  let nextNote = 0;
  let noteStep = 0;
  const bowls = [174.61, 196, 220, 261.63, 329.63, 392];
  const keys = [261.63, 293.66, 329.63, 349.23, 392, 440];

  const hush = (node: GainNode) => {
    if (ctx.state === "running") node.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
    else node.gain.value = 0;
  };

  const setBed = (type: BiquadFilterType, freq: number, q: number, gain: number) => {
    bedFilter.type = type;
    bedFilter.Q.value = q;
    if (ctx.state === "running") {
      bedFilter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.2);
      bedGain.gain.setTargetAtTime(gain, ctx.currentTime, 0.3);
    } else {
      bedFilter.frequency.value = freq;
      bedGain.gain.value = gain;
    }
  };

  const applyTrack = () => {
    hush(bowl.gain);
    hush(bowlRing.gain);
    hush(key.gain);
    nextNote = ctx.currentTime + 0.35;
    if (track === "rain") setBed("bandpass", 1700, 0.5, 0.14);
    else if (track === "ocean") setBed("lowpass", 380, 0.7, 0.2);
    else if (track === "focus") setBed("bandpass", 620, 0.28, 0.08);
    else setBed("lowpass", 800, 0.5, 0);
  };

  const strike = (
    voice: { osc: OscillatorNode; gain: GainNode },
    freq: number,
    peak: number,
    decay: number,
  ) => {
    const t = ctx.currentTime;
    voice.osc.frequency.setValueAtTime(freq, t);
    const g = voice.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + 0.03);
    g.exponentialRampToValueAtTime(0.0001, t + decay);
  };

  const unlock = () => {
    const resume = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    void resume.then(() => {
      master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.08);
      applyTrack();
    });
  };

  ctx.onstatechange = () => {
    if (ctx.state === "running") applyTrack();
  };

  const onVis = () => {
    if (document.visibilityState === "visible" && ctx.state === "suspended") {
      void ctx.resume();
    }
  };
  document.addEventListener("visibilitychange", onVis);

  return {
    unlock,
    setMuted: (windOff) => {
      windOn = !windOff;
      if (windOn) return;
      const level = 0;
      if (ctx.state === "running") {
        windGain.gain.setTargetAtTime(level, ctx.currentTime, 0.08);
        rumbleGain.gain.setTargetAtTime(level, ctx.currentTime, 0.08);
      } else {
        windGain.gain.value = level;
        rumbleGain.gain.value = level;
      }
    },
    setTrack: (id) => {
      track = id;
      noteStep = 0;
      applyTrack();
    },
    update: (speed, inCloud, altitude, world) => {
      if (ctx.state !== "running") return;
      if (track === "rain") {
        bedGain.gain.setTargetAtTime(0.07 + Math.random() * 0.16, ctx.currentTime, 0.05);
      } else if (track === "ocean") {
        const wave = 0.1 + (0.5 + 0.5 * Math.sin(ctx.currentTime * 0.17)) * 0.16;
        bedGain.gain.setTargetAtTime(wave, ctx.currentTime, 0.45);
      } else if (track === "bowls" && ctx.currentTime >= nextNote) {
        const freq = bowls[noteStep % bowls.length] ?? 220;
        noteStep += 1;
        nextNote = ctx.currentTime + 8;
        strike(bowl, freq, 0.1, 6.4);
        strike(bowlRing, freq * 2, 0.03, 4);
      } else if (track === "keys" && ctx.currentTime >= nextNote) {
        const freq = keys[noteStep % keys.length] ?? 330;
        noteStep += 1;
        nextNote = ctx.currentTime + 5;
        strike(key, freq, 0.055, 1.7);
      }
      const calm = track === "rain" || track === "ocean" || track === "focus" || track === "bowls" || track === "keys";
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
      try {
        windSrc.stop();
        rumble.stop();
        bowl.osc.stop();
        bowlRing.osc.stop();
        key.osc.stop();
        void ctx.close();
      } catch {
        /* already closed */
      }
    },
  };
}

export function createWindAudio(): Soundscape {
  return createSoundscape();
}
