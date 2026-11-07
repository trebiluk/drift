import assert from "node:assert/strict"
import { test } from "node:test"
import { FADE_S, MAX_LEVEL, createAmbient, type Ctx, type Param } from "./ambient.ts"
import {
  BOWL_FADE_S, BOWL_GAP_S, BOWL_LOWPASS_HZ, BOWL_NOTES_HZ, BOWL_PARTIALS, BOWL_RISE_S, OCEAN_LOWPASS_HZ, RAIN_BAND_HZ, TRACKS, TRACK_KEY, TRACK_LEVEL,
  bowlPlan, brownNoise, installTracks, isTrack, nextTrack, pinkNoise, readTrack, trackName, writeTrack,
} from "./tracks.ts"
import { trackOptionLabel } from "../ui/soundtrack.ts"

installTracks()

test("four tracks, Calm first; the button steps through them and comes back round", () => {
  assert.deepEqual([...TRACKS], ["calm", "rain", "ocean", "bowls"])
  let t = TRACKS[0]
  const seen = [t]
  for (let i = 0; i < 4; i++) { t = nextTrack(t); seen.push(t) }
  assert.deepEqual(seen, ["calm", "rain", "ocean", "bowls", "calm"])
  assert.equal(trackOptionLabel("rain"), "Sound track: Rain", "the state is in words")
  assert.equal(trackName("bowls"), "Bowls")
})

test("Calm on a first visit; the choice is remembered; anything odd in storage reads as Calm", () => {
  const mem = new Map<string, string>()
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  assert.equal(readTrack(store), "calm")
  writeTrack(store, "ocean")
  assert.equal(mem.get(TRACK_KEY), "ocean")
  assert.equal(readTrack(store), "ocean")
  mem.set(TRACK_KEY, "<script>")
  assert.equal(readTrack(store), "calm")
  assert.equal(isTrack("loud"), false)
  const blocked = { getItem: () => { throw new Error("x") }, setItem: () => { throw new Error("x") } }
  assert.equal(readTrack(blocked), "calm")
  assert.doesNotThrow(() => writeTrack(blocked, "rain"))
})

test("the noise stays inside -1..1, centred, and the same seed gives the same sound", () => {
  for (const make of [pinkNoise, brownNoise]) {
    const a = make(48000, 7)
    let sum = 0
    let peak = 0
    for (const v of a) { sum += v; peak = Math.max(peak, Math.abs(v)) }
    assert.ok(peak <= 1, "never clips past full scale")
    assert.ok(peak > 0.05, "not silent")
    assert.ok(Math.abs(sum / a.length) < 0.2, "no big offset")
    assert.deepEqual(Array.from(make(500, 3)), Array.from(make(500, 3)))
  }
})

test("brown noise is smoother (deeper) than pink: smaller steps from one sample to the next", () => {
  const step = (a: Float32Array) => { let s = 0; for (let i = 1; i < a.length; i++) s += Math.abs(a[i] - a[i - 1]); return s / (a.length - 1) }
  const p = pinkNoise(20000, 5)
  const b = brownNoise(20000, 5)
  const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length)
  assert.ok(step(b) / rms(b) < step(p) / rms(p))
})

test("no sharp sounds: rain stays under 1.8 kHz, ocean under 420 Hz, bowls are rubbed (2.5 s swell) and filtered", () => {
  assert.ok(RAIN_BAND_HZ[1] <= 1800 && RAIN_BAND_HZ[0] >= 300)
  assert.ok(OCEAN_LOWPASS_HZ <= 500)
  assert.ok(BOWL_RISE_S >= 2, "a bowl never starts with a hit")
  assert.ok(BOWL_FADE_S >= 10)
  assert.ok(BOWL_LOWPASS_HZ <= 1200)
  for (const n of BOWL_NOTES_HZ) assert.ok(n >= 180 && n <= 300, "low, soft notes")
  assert.ok(BOWL_PARTIALS.every(([, a], i) => i === 0 || a < BOWL_PARTIALS[i - 1][1]), "higher partials are quieter")
})

test("bowls come every 14 to 22 s, never the same note twice in a row, and the plan repeats from a seed", () => {
  const plan = bowlPlan(11, 3600)
  assert.ok(plan.length > 150)
  for (let i = 1; i < plan.length; i++) {
    const gap = plan[i].at - plan[i - 1].at
    assert.ok(gap >= BOWL_GAP_S[0] - 1e-9 && gap <= BOWL_GAP_S[1] + 1e-9, `gap ${gap}`)
    assert.notEqual(plan[i].hz, plan[i - 1].hz)
  }
  assert.deepEqual(bowlPlan(11, 200), bowlPlan(11, 200))
})

test("no track is louder than the pad, under the same cap", () => {
  for (const t of TRACKS) assert.ok(TRACK_LEVEL[t] <= TRACK_LEVEL.calm)
  assert.ok(MAX_LEVEL <= 0.16)
})

// ---- the engine, driven by a fake audio context ----
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
function fakeCtx(withBuffers: boolean) {
  const gains: { gain: ReturnType<typeof fakeParam> }[] = []
  const sources: { loop: boolean; started: boolean; stopped: boolean }[] = []
  const node = () => ({ connect: () => undefined, disconnect: () => undefined })
  const c: Record<string, unknown> = {
    currentTime: 0,
    state: "running",
    sampleRate: 8000,
    destination: node(),
    gains,
    sources,
    createOscillator() { return { ...node(), type: "sine", frequency: fakeParam(440), detune: fakeParam(0), start() {}, stop() {} } },
    createGain() { const g = { ...node(), gain: fakeParam(1) }; gains.push(g); return g },
    createBiquadFilter() { return { ...node(), type: "lowpass", frequency: fakeParam(350), Q: fakeParam(1) } },
    async resume() {},
    async suspend() {},
    async close() {},
  }
  if (withBuffers) {
    c.createBuffer = (_ch: number, n: number) => { const d = new Float32Array(n); return { getChannelData: () => d } }
    c.createBufferSource = () => { const s = { ...node(), buffer: null, loop: false, started: false, stopped: false, start() { s.started = true }, stop() { s.stopped = true } }; sources.push(s); return s }
  }
  return c
}

test("switching tracks cross-fades over the same 2.5 s: the new one ramps up, the old one ramps to 0", () => {
  const c = fakeCtx(true)
  const a = createAmbient(() => c as unknown as Ctx, 1)
  a.setOn(true)
  const before = (c.gains as { gain: ReturnType<typeof fakeParam> }[]).length
  ;(c as { currentTime: number }).currentTime = 10
  a.setTrack("rain")
  assert.equal(a.state().playing, "rain")
  const gains = c.gains as { gain: ReturnType<typeof fakeParam> }[]
  const ramps = gains.flatMap((g) => g.gain.calls.filter((k) => k[0] === "linear" && k[2] === 10 + FADE_S))
  assert.ok(ramps.some((k) => k[1] === TRACK_LEVEL.rain), "rain ramps up to its level")
  assert.ok(ramps.some((k) => k[1] === 0), "the pad ramps down to 0")
  assert.ok(gains.length > before, "rain was built only when chosen")
  assert.ok((c.sources as { loop: boolean }[]).every((s) => s.loop), "the noise loops")
  a.dispose()
})

test("a browser that can't make noise keeps the pad for Rain and Ocean, and says so", () => {
  const c = fakeCtx(false)
  const a = createAmbient(() => c as unknown as Ctx, 1)
  a.setOn(true)
  a.setTrack("ocean")
  assert.equal(a.state().track, "ocean")
  assert.equal(a.state().playing, "calm")
  a.setTrack("bowls")
  assert.equal(a.state().playing, "bowls", "bowls need no noise, so they still play")
  a.dispose()
})

test("choosing a track never starts sound: Off stays silent and makes no audio context", () => {
  let made = 0
  const a = createAmbient(() => { made++; return fakeCtx(true) as unknown as Ctx }, 1)
  a.setTrack("rain")
  assert.equal(made, 0)
  assert.equal(a.state().audible, false)
  a.setOn(true)
  assert.equal(made, 1)
  assert.equal(a.state().playing, "rain", "the saved track plays from the start once sound is on")
  a.dispose()
})
