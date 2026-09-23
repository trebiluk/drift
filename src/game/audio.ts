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

function voice(ctx: AudioContext, dest: AudioNode, freq: number): Voice {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(dest);
  osc.start();
  return { osc, gain };
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

  const pads: Voice[] = [110, 164.81, 220, 329.63].map((freq) => voice(ctx, musicBus, freq));

  const breathe = ctx.createOscillator();
  breathe.type = "sine";
  breathe.frequency.value = 0.06;
  const breatheGain = ctx.createGain();
  breatheGain.gain.value = 14;
  breathe.connect(breatheGain);
  breatheGain.connect(pads[2].osc.frequency);

  windSrc.start();
  rumble.start();
  breathe.start();

  let muted = false;
  let track: MusicId = "haze";
  let chord = 0;
  let nextChord = 0;
  const targetMaster = () => (muted ? 0 : 0.5);

  const chords: Record<Exclude<MusicId, "off">, number[][]> = {
    haze: [
      [110, 164.81, 220, 329.63],
      [98, 146.83, 196, 293.66],
    ],
    drift: [
      [146.83, 220, 293.66, 440],
      [130.81, 196, 261.63, 392],
    ],
    tide: [
      [82.41, 123.47, 164.81, 246.94],
      [87.31, 130.81, 174.61, 261.63],
    ],
    void: [
      [65.41, 98, 130.81, 196],
      [73.42, 110, 146.83, 220],
    ],
  };

  const mixFor = (id: MusicId) => {
    if (id === "off") return [0, 0, 0, 0];
    if (id === "haze") return [0.16, 0.11, 0.08, 0.05];
    if (id === "drift") return [0.06, 0.12, 0.1, 0.07];
    if (id === "tide") return [0.2, 0.08, 0.05, 0.02];
    return [0.18, 0.05, 0.04, 0.03];
  };

  const applyTrack = () => {
    const id = track;
    const mix = mixFor(id);
    const running = ctx.state === "running";
    const t = ctx.currentTime;
    const bus = id === "off" ? 0 : 0.72;
    if (running) {
      musicBus.gain.setTargetAtTime(bus, t, 0.35);
      pads.forEach((p, i) => p.gain.gain.setTargetAtTime(mix[i] ?? 0, t, 0.4));
    } else {
      musicBus.gain.value = bus;
      pads.forEach((p, i) => {
        p.gain.gain.value = mix[i] ?? 0;
      });
    }
    const cutoff = id === "tide" ? 720 : id === "void" ? 880 : 1800;
    if (running) musicFilter.frequency.setTargetAtTime(cutoff, t, 0.4);
    else musicFilter.frequency.value = cutoff;
    if (id !== "off") {
      const notes = chords[id][chord % 2];
      pads.forEach((p, i) => {
        const freq = notes[i] ?? notes[0];
        if (running) p.osc.frequency.setTargetAtTime(freq, t, 0.45);
        else p.osc.frequency.value = freq;
      });
    }
  };

  const unlock = () => {
    const resume = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    void resume.then(() => {
      master.gain.setTargetAtTime(targetMaster(), ctx.currentTime, 0.08);
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
    setMuted: (next) => {
      muted = next;
      master.gain.setTargetAtTime(targetMaster(), ctx.currentTime, 0.05);
    },
    setTrack: (id) => {
      track = id;
      chord = 0;
      nextChord = ctx.currentTime + 9;
      applyTrack();
    },
    update: (speed, inCloud, altitude, world) => {
      if (ctx.state !== "running") return;
      if (track !== "off" && ctx.currentTime > nextChord) {
        chord = (chord + 1) % 2;
        nextChord = ctx.currentTime + 11;
        applyTrack();
      }
      const air =
        world === "reef"
          ? 0.06 + speed / 180
          : world === "space"
            ? 0.03 + speed / 220
            : 0.08 + speed / 120 + inCloud * 0.16;
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
        breathe.stop();
        for (const p of pads) p.osc.stop();
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
