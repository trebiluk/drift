import assert from "node:assert/strict"
import { test } from "node:test"
import {
  BASE_LEVEL, CHORDS, CUTOFF_HZ, CUTOFF_SWEEP_HZ, DETUNE_CENTS, DETUNE_MIX, FADE_S, GLIDE_S, HOLD_S, MAX_LEVEL, SWELL_S, WAVES,
  chordPlan, createAmbient, hz, levelFor, nextChord, rampAt, repeatsAtEnd, rng, type Ctx, type Param,
} from "./ambient.ts"

type Call = [string, ...number[]]
function fakeParam(v = 0): Param & { calls: Call[] } {
  const p = {
    value: v,
    calls: [] as Call[],
    setValueAtTime(x: number, t: number) { p.calls.push(["set", x, t]); p.value = x },
    linearRampToValueAtTime(x: number, t: number) { p.calls.push(["linear", x, t]) },
    setTargetAtTime(x: number, t: number, tc: number) { p.calls.push(["target", x, t, tc]) },
    exponentialRampToValueAtTime(x: number, t: number) { p.calls.push(["exp", x, t]) },
    cancelScheduledValues(t: number) { p.calls.push(["cancel", t]) },
  }
  return p
}
function fakeCtx() {
  const made = { osc: [] as { type: OscillatorType; frequency: ReturnType<typeof fakeParam>; started: boolean; stopped: boolean }[], gain: [] as { gain: ReturnType<typeof fakeParam> }[], filter: [] as { type: BiquadFilterType; frequency: ReturnType<typeof fakeParam> }[] }
  const node = () => ({ connect: () => undefined, disconnect: () => undefined })
  const c = {
    currentTime: 0,
    state: "running",
    destination: node(),
    suspended: 0,
    resumed: 0,
    closed: false,
    made,
    createOscillator() {
      const o = { ...node(), type: "sine" as OscillatorType, frequency: fakeParam(440), detune: fakeParam(0), started: false, stopped: false, start() { o.started = true }, stop() { o.stopped = true } }
      made.osc.push(o)
      return o
    },
    createGain() { const g = { ...node(), gain: fakeParam(1) }; made.gain.push(g); return g },
    createBiquadFilter() { const f = { ...node(), type: "lowpass" as BiquadFilterType, frequency: fakeParam(350), Q: fakeParam(1) }; made.filter.push(f); return f },
    async resume() { c.resumed++; c.state = "running" },
    async suspend() { c.suspended++; c.state = "suspended" },
    async close() { c.closed = true },
  }
  return c
}
/** The master fade gain: the last gain node, the one connected to the speakers. */
const fadeParam = (c: ReturnType<typeof fakeCtx>) => c.made.gain[0].gain

test("no sound and no audio context until the player turns sound on", () => {
  let made = 0
  const a = createAmbient(() => { made++; return fakeCtx() as unknown as Ctx }, 1)
  a.setSpeed(1)
  a.setPaused(false)
  a.setHidden(false)
  assert.equal(made, 0, "nothing is created on load: the first visit is silent")
  assert.equal(a.state().started, false)
  a.setOn(true)
  assert.equal(made, 1, "turning on (a click, tap or key) creates it")
  a.setOn(false)
  a.setOn(true)
  assert.equal(made, 1, "once")
  a.dispose()
})

test("turning on fades in from silence over at least 2 s; no jump at the start", () => {
  const c = fakeCtx()
  const a = createAmbient(() => c as unknown as Ctx, 1)
  c.currentTime = 3
  a.setOn(true)
  const calls = fadeParam(c).calls
  const set = calls.filter((x) => x[0] === "set")
  const ramp = calls.find((x) => x[0] === "linear")
  assert.ok(set.every((x) => x[1] === 0), "every fixed value set on the fade is 0: it starts silent")
  assert.ok(ramp && ramp[1] === 1 && (ramp[2] as number) - 3 >= 2, `ramp ${JSON.stringify(ramp)}`)
  assert.ok(FADE_S >= 2)
  a.dispose()
})

test("turning off part-way through the fade-in starts the fade-out from where the sound is: no click", () => {
  const c = fakeCtx()
  const a = createAmbient(() => c as unknown as Ctx, 1)
  a.setOn(true)
  c.currentTime = FADE_S / 2 // halfway up
  fadeParam(c).calls.length = 0
  a.setOn(false)
  const calls = fadeParam(c).calls
  const set = calls.find((x) => x[0] === "set")
  const ramp = calls.find((x) => x[0] === "linear")
  assert.ok(set && Math.abs((set[1] as number) - 0.5) < 1e-9, `held at the halfway level, got ${JSON.stringify(set)}`)
  assert.ok(ramp && ramp[1] === 0 && (ramp[2] as number) - c.currentTime >= 2)
  assert.equal(a.state().audible, false)
  a.dispose()
})

test("pausing and a hidden tab both fade out, then the audio sleeps; coming back fades in again", async () => {
  for (const which of ["paused", "hidden"] as const) {
    const c = fakeCtx()
    const a = createAmbient(() => c as unknown as Ctx, 2)
    a.setOn(true)
    c.currentTime = 10
    which === "paused" ? a.setPaused(true) : a.setHidden(true)
    let ramp = fadeParam(c).calls.filter((x) => x[0] === "linear").pop()
    assert.ok(ramp && ramp[1] === 0 && (ramp[2] as number) - 10 >= 2, `${which}: fades out over 2 s or more`)
    assert.equal(a.state().audible, false)
    await new Promise((r) => setTimeout(r, (FADE_S + 0.4) * 1000))
    assert.equal(c.suspended, 1, `${which}: the audio sleeps once silent`)
    c.currentTime = 30
    which === "paused" ? a.setPaused(false) : a.setHidden(false)
    ramp = fadeParam(c).calls.filter((x) => x[0] === "linear").pop()
    assert.ok(ramp && ramp[1] === 1, `${which}: fades back in`)
    assert.equal(c.resumed, 1, `${which}: wakes the audio`)
    a.dispose()
  }
})

test("a hidden tab or a pause while sound is off stays silent and never creates audio", () => {
  let made = 0
  const a = createAmbient(() => { made++; return fakeCtx() as unknown as Ctx }, 1)
  a.setHidden(true)
  a.setHidden(false)
  a.setPaused(true)
  a.setPaused(false)
  assert.equal(made, 0)
  assert.equal(a.state().audible, false)
  a.dispose()
})

test("loudness follows speed gently: a little louder when faster, never past the cap, smoothed", () => {
  assert.equal(levelFor(0), BASE_LEVEL)
  assert.equal(levelFor(1), MAX_LEVEL)
  assert.ok(levelFor(0.5) > levelFor(0.2))
  for (const v of [2, 50, Infinity]) assert.ok(levelFor(v) <= MAX_LEVEL)
  for (const v of [-1, NaN]) assert.equal(levelFor(v), BASE_LEVEL)
  assert.ok(MAX_LEVEL <= 0.2 && MAX_LEVEL / BASE_LEVEL <= 1.7, "faster is only a little louder")
  const c = fakeCtx()
  const a = createAmbient(() => c as unknown as Ctx, 1)
  a.setOn(true)
  a.setSpeed(1)
  const level = c.made.gain[1].gain.calls.find((x) => x[0] === "target")
  assert.ok(level && level[1] === MAX_LEVEL && (level[3] as number) >= 1, `smoothed, not stepped: ${JSON.stringify(level)}`)
  a.dispose()
})

test("only soft sounds: sine and triangle, notes between 90 and 420 Hz, the filter never opens past 1.1 kHz", () => {
  assert.deepEqual([...WAVES].sort(), ["sine", "triangle"])
  for (const ch of CHORDS) for (const n of ch) assert.ok(hz(n) >= 90 && hz(n) <= 420, `${n} is ${hz(n).toFixed(0)} Hz`)
  assert.ok(CUTOFF_HZ + CUTOFF_SWEEP_HZ <= 1100 && CUTOFF_HZ - CUTOFF_SWEEP_HZ >= 200)
  const c = fakeCtx()
  const a = createAmbient(() => c as unknown as Ctx, 1)
  a.setOn(true)
  assert.ok(c.made.osc.every((o) => o.type === "sine" || o.type === "triangle"))
  assert.equal(c.made.osc.filter((o) => o.frequency.value >= 90).length, 6, "three voices of two oscillators each")
  assert.ok(c.made.osc.every((o) => o.started))
  a.dispose()
  assert.ok(c.made.osc.every((o) => o.stopped) && c.closed, "dispose stops everything and closes the audio")
})

test("the chord walk never repeats a chord back-to-back and never goes back and forth", () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const plan = chordPlan(seed, 600)
    for (let i = 1; i < plan.length; i++) {
      assert.notEqual(plan[i].chord, plan[i - 1].chord, `seed ${seed}: repeat at ${i}`)
      if (i >= 2) assert.notEqual(plan[i].chord, plan[i - 2].chord, `seed ${seed}: back and forth at ${i}`)
    }
  }
  const r = rng(5)
  for (let k = 0; k < 500; k++) { const n = nextChord([1, 0], r); assert.ok(n !== 0 && n !== 1 && n >= 0 && n < CHORDS.length) }
  assert.equal(repeatsAtEnd([0, 4, 1, 5, 0, 4, 1], 5), true, "A B C D A B C D is caught")
  assert.equal(repeatsAtEnd([0, 4, 1, 5, 0, 4, 1], 2), false)
})

test("three minutes of listening: several chords, unevenly spaced, and no repeating cycle", () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const plan = chordPlan(seed, 180)
    assert.ok(plan.length >= 6, `seed ${seed}: only ${plan.length} chords in 3 minutes`)
    assert.ok(new Set(plan.map((p) => p.chord)).size >= 4, `seed ${seed}: too few different chords`)
    const gaps = plan.slice(1).map((p, i) => p.at - plan[i].at)
    assert.ok(gaps.every((g) => g >= HOLD_S[0] && g <= HOLD_S[1]))
    assert.ok(new Set(gaps.map((g) => g.toFixed(1))).size > 1, "the timing is not a fixed beat")
    assert.ok(plan.slice(1).every((p) => p.glide >= GLIDE_S[0] && p.glide <= GLIDE_S[1]), "every change is a slow glide")
    const seq = plan.map((p) => p.chord).join(",")
    for (let period = 3; period <= Math.floor(plan.length / 2); period++) {
      const c = plan.map((p) => p.chord)
      let cyc = true
      for (let i = period; i < c.length; i++) if (c[i] !== c[i - period]) { cyc = false; break }
      assert.ok(!cyc, `seed ${seed}: the chords cycle every ${period}: ${seq}`)
    }
  }
})

test("the slow swells run on long periods that do not line up", () => {
  assert.equal(new Set(SWELL_S).size, SWELL_S.length)
  for (const s of SWELL_S) assert.ok(s >= 20)
  // no two periods share a factor: together they only line up after their product, far longer than a lesson
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  for (let i = 0; i < SWELL_S.length; i++) for (let j = i + 1; j < SWELL_S.length; j++) assert.equal(gcd(SWELL_S[i], SWELL_S[j]), 1)
})

test("a ramp is read where it is: before, during and after", () => {
  const r = { from: 0.2, to: 1, t0: 10, t1: 12 }
  assert.equal(rampAt(r, 5), 0.2)
  assert.ok(Math.abs(rampAt(r, 11) - 0.6) < 1e-12)
  assert.equal(rampAt(r, 20), 1)
})

test("ten minutes of listening: no stretch of chords is ever played twice in a row", () => {
  let worst = 0
  for (let seed = 1; seed <= 1000; seed++) {
    const c = chordPlan(seed, 600).map((p) => p.chord)
    for (let end = 2; end <= c.length; end++) for (let k = 2; 2 * k <= end; k++) {
      let same = true
      for (let i = 0; i < k; i++) if (c[end - 1 - i] !== c[end - 1 - k - i]) { same = false; break }
      if (same) worst = Math.max(worst, k)
    }
  }
  assert.equal(worst, 0, `a stretch of ${worst} chords repeated back to back`)
})

test("the detuned partner swells slowly and shallowly: no wobble or pulse", () => {
  // two tones a few cents apart rise and fall together once per beat; keep the slowest beat over 2 s, and the depth gentle
  const lowest = Math.min(...CHORDS.flat().map(hz)), highest = Math.max(...CHORDS.flat().map(hz))
  const beatHz = (f: number) => f * (2 ** (DETUNE_CENTS / 1200) - 1)
  assert.ok(1 / beatHz(lowest) >= 6, `the lowest note swells every ${(1 / beatHz(lowest)).toFixed(1)} s`)
  assert.ok(1 / beatHz(highest) >= 2, `the highest note swells every ${(1 / beatHz(highest)).toFixed(1)} s`)
  // depth: the loudest and quietest moment of a sine plus a partner at DETUNE_MIX (a triangle's first harmonic is 0.81)
  const k = DETUNE_MIX * 0.81
  assert.ok((1 + k) / (1 - k) <= 2.5, `swell depth ${((1 + k) / (1 - k)).toFixed(2)}x`)
})
