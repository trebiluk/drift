type WindAudio = {
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  update: (speed: number, inCloud: number, altitude: number) => void;
  dispose: () => void;
};

export function createWindAudio(): WindAudio {
  const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor({ latencyHint: "playback" });
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const seconds = 3;
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

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 380;
  filter.Q.value = 0.65;

  const windGain = ctx.createGain();
  windGain.gain.value = 0.2;

  src.connect(filter);
  filter.connect(windGain);
  windGain.connect(master);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 52;
  const oscGain = ctx.createGain();
  oscGain.gain.value = 0.03;
  osc.connect(oscGain);
  oscGain.connect(master);

  src.start();
  osc.start();

  let muted = false;
  const targetMaster = () => (muted ? 0 : 0.42);

  const unlock = () => {
    if (ctx.state === "suspended") void ctx.resume();
    master.gain.setTargetAtTime(targetMaster(), ctx.currentTime, 0.12);
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
    update: (speed, inCloud, altitude) => {
      if (ctx.state !== "running") return;
      const air = 0.12 + speed / 90 + inCloud * 0.22;
      windGain.gain.setTargetAtTime(air, ctx.currentTime, 0.12);
      filter.frequency.setTargetAtTime(240 + speed * 10 + altitude * 0.04, ctx.currentTime, 0.15);
      osc.frequency.setTargetAtTime(46 + Math.min(altitude, 1800) * 0.012, ctx.currentTime, 0.2);
    },
    dispose: () => {
      document.removeEventListener("visibilitychange", onVis);
      try {
        src.stop();
        osc.stop();
        void ctx.close();
      } catch {
        /* already closed */
      }
    },
  };
}
