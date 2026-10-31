import assert from "node:assert/strict"
import { test } from "node:test"
import { CLOUD_BODY, CLOUD_SHADE, SEA_FAR, SEA_HORIZON, SKY_HORIZON, SKY_TOP } from "../palette.ts"
import { LOOK } from "../scene.ts"
import { FLAT_FRAG, FULL_VERT, SHADOW_FRAG, SHADOW_VERT, SPRITE_VERT, bgFrag, spriteFrag } from "./shaders.ts"

// GLSL cannot be compiled in Node. These hold the text to what matters; the Chromium run compiles and draws it for real.

const all = (): Record<string, string> => ({
  FULL_VERT,
  FLAT_FRAG,
  SPRITE_VERT,
  SHADOW_VERT,
  SHADOW_FRAG,
  bg0: bgFrag(0, 0.8),
  bg1: bgFrag(1, 0.8),
  bg2: bgFrag(2, 0.8),
  bg3: bgFrag(3, 1.4),
  sprite1: spriteFrag(1),
  sprite2: spriteFrag(2),
  sprite3: spriteFrag(3),
})

/**
 * What the GPU compiler is left with after #if / #elif / #else / #endif: only the lines for the tier's #define values.
 * Only the simple forms the shaders use are understood: NAME > n, NAME == n.
 */
function active(src: string): string {
  const defs = new Map<string, number>()
  const keep: string[] = []
  const stack: { on: boolean; taken: boolean; parent: boolean }[] = []
  const on = () => stack.every((x) => x.on)
  const test = (cond: string) => {
    const m = /^\s*(\w+)\s*(>|==)\s*(\d+)\s*$/.exec(cond)
    assert.ok(m, `unsupported #if: ${cond}`)
    const v = defs.get(m[1]) ?? 0
    return m[2] === ">" ? v > Number(m[3]) : v === Number(m[3])
  }
  for (const line of src.split("\n")) {
    const t = line.trim()
    if (t.startsWith("#if ")) {
      const parent = on()
      const c = parent && test(t.slice(4))
      stack.push({ on: c, taken: c, parent })
    } else if (t.startsWith("#elif ")) {
      const top = stack[stack.length - 1]
      const c = top.parent && !top.taken && test(t.slice(6))
      top.on = c
      top.taken = top.taken || c
    } else if (t === "#else") {
      const top = stack[stack.length - 1]
      top.on = top.parent && !top.taken
      top.taken = true
    } else if (t === "#endif") {
      stack.pop()
    } else if (on()) {
      const d = /^#define\s+(\w+)\s+(\d+)/.exec(t)
      if (d) defs.set(d[1], Number(d[2]))
      keep.push(line)
    }
  }
  assert.equal(stack.length, 0, "every #if is closed")
  return keep.join("\n")
}

const taps = (src: string) => (active(src).match(/texture\(/g) ?? []).length

test("every shader starts with the version line and has balanced brackets", () => {
  for (const [name, src] of Object.entries(all())) {
    assert.ok(src.startsWith("#version 300 es\n"), `${name} must start with the version line`)
    for (const [open, close] of [["(", ")"], ["{", "}"], ["[", "]"]]) {
      assert.equal(src.split(open).length, src.split(close).length, `${name}: ${open} and ${close} must match`)
    }
    assert.ok(!/\$\{|undefined|NaN/.test(src), `${name} must not hold a leftover template or a bad number`)
  }
})

test("the colours in the shaders are the palette's, not a second copy that can drift", () => {
  const v = (c: readonly number[]) => c.map((x) => (Number.isInteger(x / 255) ? `${x / 255}.0` : (x / 255).toFixed(5))).join(", ")
  const bg = bgFrag(2, 0.8)
  for (const c of [SKY_TOP, SKY_HORIZON, SEA_HORIZON, SEA_FAR]) assert.ok(bg.includes(`vec3(${v(c)})`), `sky or sea colour ${c} missing`)
  const sprite = spriteFrag(2)
  for (const c of [CLOUD_BODY, CLOUD_SHADE]) assert.ok(sprite.includes(`vec3(${v(c)})`), `cloud colour ${c} missing`)
})

test("a cloud is never brighter than the off-white body colour, on any tier", () => {
  assert.ok(spriteFrag(1).includes("vec4(BODY,"), "the soft disc is the body colour itself")
  for (const n of [2, 3] as const) assert.ok(spriteFrag(n).includes("col = min(col, BODY);"), `cloud ${n} clamps to the body colour`)
})

test("the floor does more work on each step up: 1, 2 and 5 lookups, and the horizon haze only on Fancy", () => {
  assert.equal(taps(bgFrag(0, 0.8)), 0)
  assert.equal(taps(bgFrag(1, 0.8)), 1)
  assert.equal(taps(bgFrag(2, 0.8)), 2)
  assert.equal(taps(bgFrag(3, 1.4)), 5)
  assert.ok(active(bgFrag(3, 1.4)).includes("0.45 * (1.0 - smoothstep(0.0, 0.1, sd))"))
  assert.ok(!active(bgFrag(2, 0.8)).includes("0.45 * (1.0 - smoothstep"))
  assert.ok(!active(bgFrag(1, 0.8)).includes("float rel"), "Lite has no relief")
  assert.ok(active(bgFrag(2, 0.8)).includes("rel") && active(bgFrag(3, 1.4)).includes("rel"), "Normal and Fancy have relief")
  assert.notEqual(bgFrag(1, 0.8), bgFrag(2, 0.8))
  assert.notEqual(bgFrag(2, 0.8), bgFrag(3, 1.4))
})

test("the clouds have one, three and five lobes, and only Fancy has the wobbly edge, the rim and the distance haze", () => {
  const lite = active(spriteFrag(1))
  const normal = active(spriteFrag(2))
  const fancy = active(spriteFrag(3))
  assert.ok(!lite.includes("lobeOf") && !lite.includes("for (int i"), "Lite is a flat soft disc")
  assert.ok(normal.includes("for (int i = 0; i < LOBES; i++)"), "Normal has lobes")
  assert.ok(spriteFrag(2).includes("#define LOBES 3"))
  assert.ok(spriteFrag(3).includes("#define LOBES 5"))
  for (const piece of ["0.035 * sin(5.0 * p.x", "float rim", "uFog * 0.45"]) {
    assert.ok(fancy.includes(piece), `Fancy has ${piece}`)
    assert.ok(!normal.includes(piece), `Normal does not have ${piece}`)
    assert.ok(!lite.includes(piece), `Lite does not have ${piece}`)
  }
  assert.ok(normal.includes("lit") && fancy.includes("lit") && !lite.includes("lit"), "Normal and Fancy are lit; Lite is flat")
})

test("the tier table in scene.ts and the shaders line up: each GL tier asks for a different floor and cloud", () => {
  const seen = new Set(["light", "balanced", "full"].map((t) => `${LOOK[t as "light"].floor}/${LOOK[t as "light"].cloud}`))
  assert.equal(seen.size, 3)
})

test("nothing in the shaders flashes: no time input, no random numbers, no glow", () => {
  for (const [name, src] of Object.entries(all())) {
    assert.ok(!/uTime|iTime|fract\(sin|rand\(|hash\(|glow|flash/i.test(src), `${name} must not animate by itself or borrow a noise snippet`)
  }
})
