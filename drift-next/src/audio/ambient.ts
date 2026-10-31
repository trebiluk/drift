/**
 * Soft ambient sound: a calm, long pad that never loops audibly. Muted until the player turns it on.
 *
 * Three chord voices, each two oscillators (a sine, and a triangle at half its loudness 2 cents above it, so the two only
 * swell together slowly and shallowly, never a wobble), through one low-pass filter whose cutoff
 * sweeps very slowly. Every 18 to 30 s the chord drifts to another soft voicing: each voice glides to its new note over 6 to 9 s,
 * so there is never a new attack. The walk is seeded and never repeats a chord back-to-back or goes back and forth, and the
 * slow swells run on periods that do not line up, so a few minutes of listening has no obvious repeat.
 *
 * No sharp sounds: only sine and triangle waves, a filter that never opens past about 1.1 kHz, notes between about 90 and
 * 420 Hz. Every change of loudness is a ramp from where the sound is now, at least 2 s long, so nothing clicks or pops.
 * The audio context is created only when the player turns sound on (a click, a tap or a key: a user gesture).
 *
 * Written against a small slice of Web Audio (the types below), so tests drive it with a fake context.
 */

export type Param = {
  value: number
  setValueAtTime(v: number, t: number): unknown
  linearRampToValueAtTime(v: number, t: number): unknown
  setTargetAtTime(v: number, t: number, timeConstant: number): unknown
  exponentialRampToValueAtTime(v: number, t: number): unknown
  cancelScheduledValues(t: number): unknown
}
export type Node = { connect(to: Node | Param): unknown; disconnect(): unknown }
export type Osc = Node & { type: OscillatorType; frequency: Param; detune: Param; start(t?: number): unknown; stop(t?: number): unknown }
export type GainNode_ = Node & { gain: Param }
export type Filter = Node & { type: BiquadFilterType; frequency: Param; Q: Param }
export type Ctx = {
  currentTime: number
  destination: Node
  state: string
  createOscillator(): Osc
  createGain(): GainNode_
  createBiquadFilter(): Filter
  resume(): Promise<unknown>
  suspend(): Promise<unknown>
  close(): Promise<unknown>
}

export const FADE_S = 2.5 // every fade in or out takes this long (the brief asks for 2 s or more)
export const BASE_LEVEL = 0.1 // master loudness at the slowest speed
export const MAX_LEVEL = 0.16 // never louder than this, however fast
export const LEVEL_TAU_S = 2 // speed changes reach the loudness this smoothly (time constant)
export const HOLD_S = [18, 30] as const // how long one chord stays before drifting
export const GLIDE_S = [6, 9] as const // how long a drift between chords takes
export const DETUNE_CENTS = 2 // the detuned partner: close enough that it swells over seconds, not a pulse
export const DETUNE_MIX = 0.5 // and at half the loudness, so the swell is shallow
export const CUTOFF_HZ = 720 // the filter's middle; it sweeps CUTOFF_SWEEP_HZ either side
export const CUTOFF_SWEEP_HZ = 340
export const WAVES: readonly OscillatorType[] = ["sine", "triangle"]
/** Slow swells (seconds per cycle): the filter, then one per voice. Chosen so no two line up for a very long time. */
export const SWELL_S = [47, 29, 41, 53] as const

/** Soft voicings in D major / B minor, low and open (MIDI note numbers, one per voice). */
export const CHORDS: readonly (readonly [number, number, number])[] = [
  [50, 57, 66], // D
  [47, 54, 62], // Bm
  [43, 50, 59], // G
  [52, 59, 67], // Em
  [45, 52, 61], // A
  [42, 49, 57], // F#m
]

export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

/** Loudness for a speed between 0 (slowest) and 1 (fastest): a little louder when faster, never past MAX_LEVEL. */
export function levelFor(speed01: number): number {
  const s = Number.isFinite(speed01) ? clamp(speed01, 0, 1) : 0
  return Math.min(MAX_LEVEL, BASE_LEVEL + s * (MAX_LEVEL - BASE_LEVEL))
}

/** A small seeded random source, so the walk can be tested (and differs each visit in play). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Would adding `next` make the end of `seq` repeat itself (the last k chords the same as the k before them)? */
export function repeatsAtEnd(seq: readonly number[], next: number): boolean {
  const s = [...seq, next]
  for (let k = 1; 2 * k <= s.length; k++) {
    let same = true
    for (let i = 0; i < k; i++) if (s[s.length - 1 - i] !== s[s.length - 1 - k - i]) { same = false; break }
    if (same) return true
  }
  return false
}

/**
 * The next chord after `history` (oldest first): never the one playing now or the one before it (no back-and-forth), and
 * never one that would make the walk repeat a stretch it just played (A B C D A B C D). Picked at random among the rest.
 */
export function nextChord(history: readonly number[], r: () => number): number {
  const now = history[history.length - 1] ?? -1
  const before = history[history.length - 2] ?? -1
  const fresh: number[] = []
  const ok: number[] = []
  for (let i = 0; i < CHORDS.length; i++) {
    if (i === now || i === before) continue
    ok.push(i)
    if (!repeatsAtEnd(history, i)) fresh.push(i)
  }
  const pick = fresh.length > 0 ? fresh : ok
  return pick[Math.floor(r() * pick.length) % pick.length]
}
export const HISTORY = 24 // chords remembered: enough to stop any repeat a listener could notice within a lesson

/** The chord plan for `seconds` of listening: when each chord starts and which it is. Pure, for tests and for the engine. */
export function chordPlan(seed: number, seconds: number): { at: number; chord: number; glide: number }[] {
  const r = rng(seed)
  const out: { at: number; chord: number; glide: number }[] = [{ at: 0, chord: Math.floor(r() * CHORDS.length), glide: 0 }]
  const history = [out[0].chord]
  let t = 0
  while (true) {
    t += HOLD_S[0] + r() * (HOLD_S[1] - HOLD_S[0])
    if (t > seconds) break
    const next = nextChord(history, r)
    history.push(next)
    if (history.length > HISTORY) history.shift()
    out.push({ at: t, chord: next, glide: GLIDE_S[0] + r() * (GLIDE_S[1] - GLIDE_S[0]) })
  }
  return out
}

/** A loudness that moves only by ramps: where it is at time `t`, so the next ramp starts there and never jumps. */
export type Ramp = { from: number; to: number; t0: number; t1: number }
export function rampAt(r: Ramp, t: number): number {
  if (t <= r.t0) return r.from
  if (t >= r.t1) return r.to
  return r.from + ((r.to - r.from) * (t - r.t0)) / (r.t1 - r.t0)
}

export type Ambient = {
  /** The player's choice. Turning on creates the audio (call it from a click, tap or key). */
  setOn(on: boolean): void
  isOn(): boolean
  /** 0 slowest .. 1 fastest. Smoothed; capped. */
  setSpeed(speed01: number): void
  /** The game is paused: fade out, and back in on resume (if sound is on). */
  setPaused(paused: boolean): void
  /** The tab is hidden: fade out, then let the audio sleep. */
  setHidden(hidden: boolean): void
  /** For tests and the debug readout. */
  state(): { on: boolean; audible: boolean; started: boolean; fade: Ramp; chord: number }
  dispose(): void
}

/**
 * The engine. `make` creates the audio context; it is called once, the first time sound is turned on.
 * `seed` picks the chord walk. `now` is only for tests that drive time by hand.
 */
export function createAmbient(make: () => Ctx | null, seed: number = Date.now()): Ambient {
  let ctx: Ctx | null = null
  let fadeGain: GainNode_ | null = null
  let levelGain: GainNode_ | null = null
  const oscs: Osc[] = []
  const voices: { a: Osc; b: Osc; amp: GainNode_ }[] = []
  let on = false
  let paused = false
  let hidden = false
  let speed = 0
  let fade: Ramp = { from: 0, to: 0, t0: 0, t1: 0 }
  let chord = 0
  const history: number[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let sleepTimer: ReturnType<typeof setTimeout> | null = null
  const r = rng(seed)

  const wanted = () => on && !paused && !hidden

  const build = (c: Ctx) => {
    const t = c.currentTime
    fadeGain = c.createGain()
    fadeGain.gain.setValueAtTime(0, t)
    levelGain = c.createGain()
    levelGain.gain.setValueAtTime(levelFor(speed), t)
    const filter = c.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.setValueAtTime(CUTOFF_HZ, t)
    filter.Q.setValueAtTime(0.5, t)
    // the slow filter sweep: an oscillator far below hearing, scaled to +/- CUTOFF_SWEEP_HZ
    const sweep = c.createOscillator()
    sweep.type = "sine"
    sweep.frequency.setValueAtTime(1 / SWELL_S[0], t)
    const sweepDepth = c.createGain()
    sweepDepth.gain.setValueAtTime(CUTOFF_SWEEP_HZ, t)
    sweep.connect(sweepDepth)
    sweepDepth.connect(filter.frequency)
    oscs.push(sweep)

    chord = Math.floor(r() * CHORDS.length)
    history.push(chord)
    CHORDS[chord].forEach((note, i) => {
      const amp = c.createGain()
      amp.gain.setValueAtTime(1 / (3 * (1 + DETUNE_MIX)), t) // three voices: the sum stays near 1 before the level and fade gains
      // each voice breathes a little (+/- 15%) on its own slow period
      const breath = c.createOscillator()
      breath.type = "sine"
      breath.frequency.setValueAtTime(1 / SWELL_S[1 + i], t)
      const breathDepth = c.createGain()
      breathDepth.gain.setValueAtTime(0.15 / (3 * (1 + DETUNE_MIX)), t)
      breath.connect(breathDepth)
      breathDepth.connect(amp.gain)
      oscs.push(breath)
      const a = c.createOscillator()
      a.type = WAVES[0]
      a.frequency.setValueAtTime(hz(note), t)
      const b = c.createOscillator()
      b.type = WAVES[1]
      b.frequency.setValueAtTime(hz(note), t)
      b.detune.setValueAtTime(DETUNE_CENTS, t)
      const bMix = c.createGain()
      bMix.gain.setValueAtTime(DETUNE_MIX, t)
      a.connect(amp)
      b.connect(bMix)
      bMix.connect(amp)
      amp.connect(filter)
      oscs.push(a, b)
      voices.push({ a, b, amp })
    })
    filter.connect(levelGain)
    levelGain.connect(fadeGain)
    fadeGain.connect(c.destination)
    for (const o of oscs) o.start(t)
    schedule()
  }

  // the chord walk: every 18-30 s each voice glides to a note of the next chord
  const schedule = () => {
    if (timer) clearTimeout(timer)
    const hold = HOLD_S[0] + r() * (HOLD_S[1] - HOLD_S[0])
    timer = setTimeout(() => {
      if (!ctx) return
      chord = nextChord(history, r)
      history.push(chord)
      if (history.length > HISTORY) history.shift()
      const glide = GLIDE_S[0] + r() * (GLIDE_S[1] - GLIDE_S[0])
      const t = ctx.currentTime
      CHORDS[chord].forEach((note, i) => {
        for (const o of [voices[i].a, voices[i].b]) {
          o.frequency.cancelScheduledValues(t)
          o.frequency.setValueAtTime(o.frequency.value, t)
          o.frequency.exponentialRampToValueAtTime(hz(note), t + glide)
        }
      })
      schedule()
    }, hold * 1000)
  }

  // every loudness change: from where it is now, to where it should be, over FADE_S
  const apply = () => {
    if (!ctx || !fadeGain) return
    const t = ctx.currentTime
    const target = wanted() ? 1 : 0
    const here = rampAt(fade, t)
    if (fade.to === target && t <= fade.t1) return // already heading there
    fade = { from: here, to: target, t0: t, t1: t + FADE_S }
    fadeGain.gain.cancelScheduledValues(t)
    fadeGain.gain.setValueAtTime(here, t)
    fadeGain.gain.linearRampToValueAtTime(target, t + FADE_S)
    if (sleepTimer) clearTimeout(sleepTimer)
    sleepTimer = null
    if (target === 0) {
      // once silent, let the audio sleep (saves battery on a Chromebook)
      sleepTimer = setTimeout(() => {
        if (ctx && !wanted()) void ctx.suspend().catch(() => {})
      }, (FADE_S + 0.25) * 1000)
    } else if (ctx.state === "suspended") void ctx.resume().catch(() => {})
  }

  return {
    setOn(v) {
      on = v
      if (on && !ctx) {
        try {
          ctx = make()
        } catch {
          ctx = null
        }
        if (ctx) build(ctx)
      }
      apply()
    },
    isOn: () => on,
    setSpeed(v) {
      speed = Number.isFinite(v) ? clamp(v, 0, 1) : 0
      if (!ctx || !levelGain) return
      levelGain.gain.setTargetAtTime(levelFor(speed), ctx.currentTime, LEVEL_TAU_S)
    },
    setPaused(v) {
      paused = v
      apply()
    },
    setHidden(v) {
      hidden = v
      apply()
    },
    state: () => ({ on, audible: wanted() && ctx !== null, started: ctx !== null, fade: { ...fade }, chord }),
    dispose() {
      if (timer) clearTimeout(timer)
      if (sleepTimer) clearTimeout(sleepTimer)
      timer = null
      sleepTimer = null
      for (const o of oscs) {
        try {
          o.stop()
        } catch {
          /* already stopped */
        }
      }
      oscs.length = 0
      voices.length = 0
      if (ctx) void ctx.close().catch(() => {})
      ctx = null
    },
  }
}
