import type { MusicId, WorldMode } from "./flight";

type Voice = {
  osc: OscillatorNode;
  gain: GainNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
};

export type Soundscape = {
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

function voice(ctx: AudioContext, dest: AudioNode, freq: number, type: OscillatorType, amp: number): Voice {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.05 + Math.random() * 0.04;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = freq * 0.012;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(gain);
  gain.connect(dest);
  osc.start();
  lfo.start();
  return { osc, gain, lfo, lfoGain };
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
  windGain.gain.value = 0.2;
  const windSrc = brownNoise(ctx);
  windSrc.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);

  const rumble = ctx.createOscillator();
  rumble.type = "sine";
  rumble.frequency.value = 52;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.03;
  rumble.connect(rumbleGain);
  rumbleGain.connect(master);

  const musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  const musicFilter = ctx.createBiquadFilter();
  musicFilter.type = "lowpass";
  musicFilter.frequency.value = 1400;
  musicFilter.Q.value = 0.4;
  musicBus.connect(musicFilter);
  musicFilter.connect(master);

  const pads: Voice[] = [
    voice(ctx, musicBus, 110, "sine", 0),
    voice(ctx, musicBus, 164.81, "sine", 0),
    voice(ctx, musicBus, 220, "triangle", 0),
    voice(ctx, musicBus, 329.63, "sine", 0),
    voice(ctx, musicBus, 65.41, "sine", 0),
    voice(ctx, musicBus, 392, "sine", 0),
  ];

  windSrc.start();
  rumble.start();

  let muted = false;
  let track: MusicId = "haze";
  const targetMaster = () => (muted ? 0 : 0.42);

  const mixFor = (id: MusicId) => {
    // relative voice amps for [110, 165, 220, 330, 65, 392]
    if (id === "off") return [0, 0, 0, 0, 0, 0];
    if (id === "haze") return [0.07, 0.055, 0.04, 0.028, 0.05, 0.012];
    if (id === "drift") return [0.02, 0.045, 0.055, 0.04, 0.03, 0.03];
    if (id === "tide") return [0.08, 0.02, 0.03, 0.01, 0.09, 0];
    return [0.06, 0.02, 0.018, 0.012, 0.1, 0.008];
  };

  const applyTrack = (id: MusicId) => {
    const mix = mixFor(id);
    const t = ctx.currentTime;
    const musicLevel = id === "off" ? 0 : 0.9;
    musicBus.gain.setTargetAtTime(musicLevel, t, 0.6);
    pads.forEach((p, i) => p.gain.gain.setTargetAtTime(mix[i], t, 0.8));
    if (id === "tide") musicFilter.frequency.setTargetAtTime(680, t, 0.5);
    else if (id === "void") musicFilter.frequency.setTargetAtTime(900, t, 0.5);
    else musicFilter.frequency.setTargetAtTime(1600, t, 0.5);
  };

  const unlock = () => {
    if (ctx.state === "suspended") void ctx.resume();
    master.gain.setTargetAtTime(targetMaster(), ctx.currentTime, 0.12);
    applyTrack(track);
  };

  const onVis = () => {
    if (document.visibilityState === "visible" && ctx.state === "suspended") {
      void ctx.resume();
    }
  };
  document.addEventListener("visibilitychange", onVis);

  return {
    unlock,
    setMuted: (next) => {
      muted = next;
      master.gain.setTargetAtTime(targetMaster(), ctx.currentTime, 0.05);
    },
    setTrack: (id) => {
      track = id;
      applyTrack(id);
    },
    update: (speed, inCloud, altitude, world) => {
      if (ctx.state !== "running") return;
      const air =
        world === "reef"
          ? 0.08 + speed / 140
          : world === "space"
            ? 0.04 + speed / 180
            : 0.12 + speed / 90 + inCloud * 0.22;
      windGain.gain.setTargetAtTime(air, ctx.currentTime, 0.12);
      const f0 = world === "reef" ? 180 : world === "space" ? 140 : 240;
      windFilter.frequency.setTargetAtTime(f0 + speed * 8 + altitude * 0.02, ctx.currentTime, 0.15);
      rumble.frequency.setTargetAtTime(40 + Math.min(altitude, 1800) * 0.01, ctx.currentTime, 0.2);
      rumbleGain.gain.setTargetAtTime(world === "space" ? 0.018 : 0.03, ctx.currentTime, 0.2);
    },
    dispose: () => {
      document.removeEventListener("visibilitychange", onVis);
      try {
        windSrc.stop();
        rumble.stop();
        for (const p of pads) {
          p.osc.stop();
          p.lfo?.stop();
        }
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
