/**
 * Calm sound tracks (DRIFT-2-DIRECTION step 5): Calm (the existing pad), Rain, Ocean and Bowls, as in 1.12.4, but
 * made in the browser, not from recordings, so there is nothing to license and nothing to download.
 *
 * - **Rain:** soft pink noise between about 400 Hz and 1.8 kHz, breathing a little (+/- 18%) over 23 s.
 * - **Ocean:** deep brown noise under 420 Hz that swells like slow waves (one every 9 s, with a slower 23 s swell on top).
 * - **Bowls:** a rubbed singing bowl every 14 to 22 s: three soft sine partials that swell in over 2.5 s (never struck)
 *   and fade over 14 s, through a low-pass at 1.2 kHz. Seeded, never the same note twice in a row.
 *
 * The same rules as the pad: no sharp sounds, every change of loudness is a ramp of 2 s or more, nothing louder than the
 * pad's cap. Switching tracks cross-fades over the same 2.5 s. Sound stays Off until the player turns it on, and the
 * Sound button names the track in words, so nothing is ever only heard.
 */
import { FADE_S, rng, setTrackMaker, type Ctx, type GainNode_, type Node, type Param } from "./ambient.ts"

export const TRACKS = ["calm", "rain", "ocean", "bowls"] as const
export type Track = (typeof TRACKS)[number]
export const TRACK_KEY = "drift2-track"
export const TRACK_TEXT: Record<"label" | Track, string> = { label: "Sound track", calm: "Calm", rain: "Rain", ocean: "Ocean", bowls: "Bowls" }

/** How loud each track sits under the shared level and fade gains, so the four feel about as loud as each other. */
// Measured in Chromium (RMS at the speakers): at 0.32 / 0.55 / 0.5 the three came out about 4x quieter than Calm, so they
// were raised. Noise sounds louder than a tone at the same RMS, so Rain sits a little under the pad on purpose.
export const TRACK_LEVEL: Record<Track, number> = { calm: 1, rain: 0.85, ocean: 1, bowls: 1 }

export const RAIN_BAND_HZ = [400, 1800] as const
export const RAIN_SWELL_S = 23
export const OCEAN_LOWPASS_HZ = 420
export const WAVE_S = 9
export const OCEAN_SWELL_S = 23
export const BOWL_GAP_S = [14, 22] as const
export const BOWL_RISE_S = 2.5
export const BOWL_FADE_S = 14
export const BOWL_LOWPASS_HZ = 1200
/** Soft, low bowl notes (G3 to D4) and their partials: a rubbed bowl's ratios, quieter as they rise. */
export const BOWL_NOTES_HZ = [196, 220, 247, 262, 294] as const
export const BOWL_PARTIALS = [
  [1, 1],
  [2.76, 0.35],
  [5.4, 0.12],
] as const

export const isTrack = (v: unknown): v is Track => typeof v === "string" && (TRACKS as readonly string[]).includes(v)
export const nextTrack = (t: Track): Track => TRACKS[(TRACKS.indexOf(t) + 1) % TRACKS.length]
export const trackName = (t: Track) => TRACK_TEXT[t]

type Store = Pick<Storage, "getItem" | "setItem"> | null | undefined
export function readTrack(store: Store): Track {
  try {
    const v = store?.getItem(TRACK_KEY)
    return isTrack(v) ? v : "calm"
  } catch {
    return "calm"
  }
}
export function writeTrack(store: Store, t: Track) {
  try {
    store?.setItem(TRACK_KEY, t)
  } catch {
    /* a private window: the choice lasts until the page closes */
  }
}

/** Pink-ish noise (Paul Kellet's economy filter on white noise), scaled to stay inside -1..1. Seeded. */
export function pinkNoise(n: number, seed: number): Float32Array {
  const r = rng(seed)
  const out = new Float32Array(n)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1
    b0 = 0.99765 * b0 + w * 0.099046
    b1 = 0.963 * b1 + w * 0.2965164
    b2 = 0.57 * b2 + w * 1.0526913
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2
  }
  return clip(out)
}

/** Brown noise (a leaky sum of white noise): deep and soft, like surf heard from far off. Seeded. */
export function brownNoise(n: number, seed: number): Float32Array {
  const r = rng(seed)
  const out = new Float32Array(n)
  let last = 0
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (r() * 2 - 1)) / 1.02
    out[i] = last * 3.5
  }
  return clip(out)
}

function clip(a: Float32Array): Float32Array {
  for (let i = 0; i < a.length; i++) a[i] = Math.max(-1, Math.min(1, a[i]))
  return a
}

/** The bowls: when each one sounds, its note, from a seed. Gaps of 14 to 22 s; never the same note twice in a row. */
export function bowlPlan(seed: number, seconds: number): { at: number; hz: number }[] {
  const r = rng(seed)
  const out: { at: number; hz: number }[] = []
  let t = 1 + r() * 3
  let last = -1
  while (t < seconds) {
    let i = Math.floor(r() * BOWL_NOTES_HZ.length)
    if (i === last) i = (i + 1 + Math.floor(r() * (BOWL_NOTES_HZ.length - 1))) % BOWL_NOTES_HZ.length
    last = i
    out.push({ at: t, hz: BOWL_NOTES_HZ[i] })
    t += BOWL_GAP_S[0] + r() * (BOWL_GAP_S[1] - BOWL_GAP_S[0])
  }
  return out
}

// ---- the graphs (Web Audio). A context without buffers (very old browsers, some tests) gets Calm and Bowls only. ----

export type BufferCtx = Ctx & {
  sampleRate: number
  createBuffer(channels: number, length: number, rate: number): { getChannelData(ch: number): Float32Array }
  createBufferSource(): Node & { buffer: unknown; loop: boolean; start(t?: number): unknown; stop(t?: number): unknown }
}
export const canBuffer = (c: Ctx): c is BufferCtx =>
  typeof (c as Partial<BufferCtx>).createBuffer === "function" && typeof (c as Partial<BufferCtx>).createBufferSource === "function"

/** What a built track hands back: its own gain (for the cross-fade), and a way to stop it. */
export type TrackGraph = { gain: GainNode_; stop(): void }

function slowSwell(c: Ctx, target: Param, periodS: number, depth: number, t: number): { stop(): void } {
  const lfo = c.createOscillator()
  lfo.type = "sine"
  lfo.frequency.setValueAtTime(1 / periodS, t)
  const d = c.createGain()
  d.gain.setValueAtTime(depth, t)
  lfo.connect(d)
  d.connect(target)
  lfo.start(t)
  return { stop: () => { try { lfo.stop() } catch { /* stopped */ } } }
}

function noiseTrack(c: BufferCtx, out: Node, data: Float32Array, setup: (src: Node, gain: GainNode_, t: number) => (() => void)[]): TrackGraph {
  const t = c.currentTime
  const buf = c.createBuffer(1, data.length, c.sampleRate)
  buf.getChannelData(0).set(data)
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = true
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t)
  const stops = setup(src, gain, t)
  gain.connect(out)
  src.start(t)
  return { gain, stop: () => { try { src.stop() } catch { /* stopped */ } for (const s of stops) s() } }
}

export function buildRain(c: BufferCtx, out: Node, seed: number): TrackGraph {
  return noiseTrack(c, out, pinkNoise(Math.round(c.sampleRate * 4), seed), (src, gain, t) => {
    const hp = c.createBiquadFilter()
    hp.type = "highpass"
    hp.frequency.setValueAtTime(RAIN_BAND_HZ[0], t)
    const lp = c.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.setValueAtTime(RAIN_BAND_HZ[1], t)
    const body = c.createGain()
    body.gain.setValueAtTime(1, t)
    src.connect(hp)
    hp.connect(lp)
    lp.connect(body)
    body.connect(gain)
    return [slowSwell(c, body.gain, RAIN_SWELL_S, 0.18, t).stop]
  })
}

export function buildOcean(c: BufferCtx, out: Node, seed: number): TrackGraph {
  return noiseTrack(c, out, brownNoise(Math.round(c.sampleRate * 6), seed), (src, gain, t) => {
    const lp = c.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.setValueAtTime(OCEAN_LOWPASS_HZ, t)
    const body = c.createGain()
    body.gain.setValueAtTime(0.55, t) // waves swing it between about 0.1 and 1
    src.connect(lp)
    lp.connect(body)
    body.connect(gain)
    return [slowSwell(c, body.gain, WAVE_S, 0.35, t).stop, slowSwell(c, body.gain, OCEAN_SWELL_S, 0.1, t).stop]
  })
}

/** Bowls: plays the seeded plan as it comes due. `every` lets tests drive the clock. */
export function buildBowls(c: Ctx, out: Node, seed: number, every: (fn: () => void, ms: number) => () => void = defaultTimer): TrackGraph {
  const t0 = c.currentTime
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t0)
  const lp = c.createBiquadFilter()
  lp.type = "lowpass"
  lp.frequency.setValueAtTime(BOWL_LOWPASS_HZ, t0)
  lp.connect(gain)
  gain.connect(out)
  const plan = bowlPlan(seed, 60 * 60 * 4) // four hours: far longer than a lesson
  let next = 0
  const ring = (hzBase: number, at: number) => {
    const env = c.createGain()
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(1, at + BOWL_RISE_S) // rubbed, not struck: a slow swell in
    env.gain.exponentialRampToValueAtTime(0.001, at + BOWL_RISE_S + BOWL_FADE_S)
    env.connect(lp)
    for (const [ratio, amp] of BOWL_PARTIALS) {
      const o = c.createOscillator()
      o.type = "sine"
      o.frequency.setValueAtTime(hzBase * ratio, at)
      const g = c.createGain()
      g.gain.setValueAtTime(amp / 1.47, at)
      o.connect(g)
      g.connect(env)
      o.start(at)
      o.stop(at + BOWL_RISE_S + BOWL_FADE_S + 0.5)
    }
  }
  const tick = () => {
    const now = c.currentTime - t0
    while (next < plan.length && plan[next].at <= now + 1) {
      ring(plan[next].hz, t0 + Math.max(plan[next].at, now))
      next++
    }
  }
  tick()
  const cancel = every(tick, 500)
  return { gain, stop: cancel }
}

function defaultTimer(fn: () => void, ms: number) {
  const id = setInterval(fn, ms)
  return () => clearInterval(id)
}

/** Registers the tracks with the engine (main.tsx imports this file once). */
export function installTracks() {
  setTrackMaker({
    level: (t) => (isTrack(t) ? TRACK_LEVEL[t] : 1),
    build(c, t, out, seed) {
      if (t === "bowls") return buildBowls(c, out, seed + 3)
      if (!canBuffer(c)) return null
      if (t === "rain") return buildRain(c, out, seed + 1)
      if (t === "ocean") return buildOcean(c, out, seed + 2)
      return null
    },
  })
}
