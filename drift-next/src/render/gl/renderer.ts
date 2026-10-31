import { meanLuma, meterSize } from "../../ui/meter.ts"
import { SKY_HORIZON, hazeRgb } from "../palette.ts"
import { DECK_SIZE, GROUND_Y, SHADOW_FLOATS, SPRITE_FLOATS, lookOf, makeDeckTexture, packShadows, packSprites, wrapDeck } from "../scene.ts"
import { TIER_TABLE, type Tier } from "../tiers.ts"
import type { WorldFrame } from "../types.ts"
import { FLAT_FRAG, FULL_VERT, SHADOW_FRAG, SHADOW_VERT, SPRITE_VERT, bgFrag, spriteFrag } from "./shaders.ts"

/**
 * The WebGL2 drawer behind the Lite, Normal and Fancy tiers. It draws the world (sky, cloud-sea floor, shadows, clouds and the
 * haze inside a cloud) onto its own canvas. The veil, the pull marker and the glider are drawn on a 2D canvas above it.
 *
 * Plain WebGL2, no library: the design doc names `three`, but it is not installed here and adding it would change the lockfile.
 * This file is the only place that knows about GL, so swapping the engine later touches this file and shaders.ts.
 */

type GlTier = Exclude<Tier, "still">
const GL_TIERS: readonly GlTier[] = ["light", "balanced", "full"]

type Prog = { p: WebGLProgram; loc: (name: string) => WebGLUniformLocation | null }

type Resources = {
  bg: Record<GlTier, Prog>
  sprite: Record<GlTier, Prog>
  shadow: Prog
  flat: Prog
  deck: WebGLTexture
  spriteBuf: WebGLBuffer
  shadowBuf: WebGLBuffer
  spriteVao: WebGLVertexArrayObject
  shadowVao: WebGLVertexArrayObject
}

export type GlHooks = {
  /** The browser took the GL context away. The caller should draw the world another way until `onRestored`. */
  onLost: () => void
  /** The context is back and everything has been rebuilt. */
  onRestored: () => void
}

export type GlOpts = {
  /** The most clouds that will ever be drawn in one frame. */
  capacity: number
}

export type GlWorld = {
  /** Draws the world for this frame. With `measure`, also renders a small copy to read its brightness back a little later. */
  draw: (f: WorldFrame, measure: boolean) => void
  /** The newest brightness reading of the picture (0..1), or null before the first one or if reading is not possible. */
  reading: () => number | null
  isLost: () => boolean
  state: () => { lost: boolean; losses: number; restores: number; meterOk: boolean; readings: number }
  /** For testers only: ask the browser to take the context away, or give it back. Returns false if it cannot. */
  testLose: () => boolean
  testRestore: () => boolean
  dispose: () => void
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)
  if (!s) throw new Error("no shader")
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return s
}

function program(gl: WebGL2RenderingContext, vert: string, frag: string): Prog {
  const vs = compile(gl, gl.VERTEX_SHADER, vert)
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag)
  const p = gl.createProgram()
  if (!p) throw new Error("no program")
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  // Do not ask whether it worked yet: the driver can compile every program at once if nobody waits (see check below).
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  const cache = new Map<string, WebGLUniformLocation | null>()
  return {
    p,
    loc: (name) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name))
      return cache.get(name) ?? null
    },
  }
}

function build(gl: WebGL2RenderingContext, deckPixels: Uint8Array, capacity: number): Resources {
  // Every program for every tier is started now, so a step up or down later never waits on a compile.
  const bg = {} as Record<GlTier, Prog>
  const sprite = {} as Record<GlTier, Prog>
  for (const t of GL_TIERS) {
    const look = lookOf(t)
    bg[t] = program(gl, FULL_VERT, bgFrag(look.floor, TIER_TABLE[t].aa ? 1.4 : 0.8))
    sprite[t] = program(gl, SPRITE_VERT, spriteFrag(look.cloud as 1 | 2 | 3))
  }
  const shadow = program(gl, SHADOW_VERT, SHADOW_FRAG)
  const flat = program(gl, FULL_VERT, FLAT_FRAG)
  const all = [...GL_TIERS.map((t) => bg[t]), ...GL_TIERS.map((t) => sprite[t]), shadow, flat]
  for (const pr of all) {
    if (!gl.getProgramParameter(pr.p, gl.LINK_STATUS)) throw new Error(`shader link failed: ${gl.getProgramInfoLog(pr.p) ?? ""}`)
  }

  const deck = gl.createTexture()
  const spriteBuf = gl.createBuffer()
  const shadowBuf = gl.createBuffer()
  const spriteVao = gl.createVertexArray()
  const shadowVao = gl.createVertexArray()
  if (!deck || !spriteBuf || !shadowBuf || !spriteVao || !shadowVao) throw new Error("no GL objects")

  gl.bindTexture(gl.TEXTURE_2D, deck)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, DECK_SIZE, DECK_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, deckPixels)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  // clouds: x, y, radius, alpha | shape, haze  (one record per cloud)
  gl.bindVertexArray(spriteVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuf)
  gl.bufferData(gl.ARRAY_BUFFER, capacity * SPRITE_FLOATS * 4, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, SPRITE_FLOATS * 4, 0)
  gl.vertexAttribDivisor(0, 1)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, SPRITE_FLOATS * 4, 16)
  gl.vertexAttribDivisor(1, 1)

  // shadows: x, y, rx, ry | alpha
  gl.bindVertexArray(shadowVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, shadowBuf)
  gl.bufferData(gl.ARRAY_BUFFER, capacity * SHADOW_FLOATS * 4, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, SHADOW_FLOATS * 4, 0)
  gl.vertexAttribDivisor(0, 1)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, SHADOW_FLOATS * 4, 16)
  gl.vertexAttribDivisor(1, 1)

  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  for (const t of GL_TIERS) {
    gl.useProgram(bg[t].p)
    gl.uniform1i(bg[t].loc("uDeck"), 0)
  }
  // Until the first picture is drawn the canvas shows the horizon colour, not black or white.
  gl.clearColor(SKY_HORIZON[0] / 255, SKY_HORIZON[1] / 255, SKY_HORIZON[2] / 255, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  return { bg, sprite, shadow, flat, deck, spriteBuf, shadowBuf, spriteVao, shadowVao }
}

/** null when this browser cannot give WebGL2; the caller then draws the world with Canvas 2D. */
export function createGlWorld(canvas: HTMLCanvasElement, hooks: GlHooks, opts: GlOpts): GlWorld | null {
  let gl: WebGL2RenderingContext | null = null
  try {
    gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false }) as WebGL2RenderingContext | null
  } catch {
    gl = null
  }
  if (!gl) return null
  const g = gl
  const deckPixels = makeDeckTexture()
  const spriteData = new Float32Array(opts.capacity * SPRITE_FLOATS)
  const shadowData = new Float32Array(opts.capacity * SHADOW_FLOATS)
  let res: Resources | null = null
  try {
    res = build(g, deckPixels, opts.capacity)
  } catch {
    return null
  }

  let lost = false
  let losses = 0
  let restores = 0
  let disposed = false
  let meterOk = true
  let readings = 0
  let latest: number | null = null
  let fbo: WebGLFramebuffer | null = null
  let fboTex: WebGLTexture | null = null
  let fboW = 0
  let fboH = 0
  let pending: { sync: WebGLSync; mw: number; mh: number } | null = null
  let scratch = new Uint8Array(0)
  const loseExt = g.getExtension("WEBGL_lose_context")

  const onLostEvent = (e: Event) => {
    e.preventDefault() // lets the browser give the context back
    lost = true
    losses++
    pending = null
    fbo = null
    fboTex = null
    fboW = 0
    fboH = 0
    hooks.onLost()
  }
  const onRestoredEvent = () => {
    try {
      res = build(g, deckPixels, opts.capacity)
      latest = null
      lost = false
      restores++
      hooks.onRestored()
    } catch {
      // Could not rebuild: count it as another loss, which makes the caller give up on GL for good.
      lost = true
      losses++
      hooks.onLost()
    }
  }
  canvas.addEventListener("webglcontextlost", onLostEvent)
  canvas.addEventListener("webglcontextrestored", onRestoredEvent)

  const ensureMeter = (mw: number, mh: number): boolean => {
    if (fbo && fboW === mw && fboH === mh) return true
    if (fbo) g.deleteFramebuffer(fbo)
    if (fboTex) g.deleteTexture(fboTex)
    fbo = g.createFramebuffer()
    fboTex = g.createTexture()
    if (!fbo || !fboTex) return false
    g.bindTexture(g.TEXTURE_2D, fboTex)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, mw, mh, 0, g.RGBA, g.UNSIGNED_BYTE, null)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    g.bindFramebuffer(g.FRAMEBUFFER, fbo)
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, fboTex, 0)
    const ok = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    fboW = mw
    fboH = mh
    return ok
  }

  /**
   * Picks up a brightness reading once the GPU has finished the small picture. It never waits: the fence says when the pixels
   * are ready, and only then are they read, so the read does not stall the GPU. Called at the top of a frame, before new work.
   */
  const poll = () => {
    if (!pending) return
    const st = g.clientWaitSync(pending.sync, 0, 0)
    if (st === g.WAIT_FAILED) {
      meterOk = false
      g.deleteSync(pending.sync)
      pending = null
      return
    }
    if (st !== g.ALREADY_SIGNALED && st !== g.CONDITION_SATISFIED) return
    const { mw, mh } = pending
    g.deleteSync(pending.sync)
    pending = null
    if (!fbo || fboW !== mw || fboH !== mh) return // the screen changed shape since: wait for the next picture
    const bytes = mw * mh * 4
    if (scratch.length < bytes) scratch = new Uint8Array(bytes)
    g.bindFramebuffer(g.FRAMEBUFFER, fbo)
    g.readPixels(0, 0, mw, mh, g.RGBA, g.UNSIGNED_BYTE, scratch)
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    latest = meanLuma(scratch.subarray(0, bytes))
    readings++
  }

  const scene = (r: Resources, f: WorldFrame, tier: GlTier, nSprites: number, nShadows: number) => {
    const ct = Math.cos(f.tilt)
    const st = Math.sin(f.tilt)

    // 1. sky and cloud-sea floor
    g.disable(g.BLEND)
    const bg = r.bg[tier]
    g.useProgram(bg.p)
    g.uniform2f(bg.loc("uSize"), f.w, f.h)
    g.uniform2f(bg.loc("uC"), f.cx, f.cy)
    g.uniform1f(bg.loc("uF"), f.f)
    g.uniform1f(bg.loc("uHorizon"), f.horizon)
    g.uniform2f(bg.loc("uTilt"), ct, st)
    g.uniform3f(bg.loc("uCam"), wrapDeck(f.pose.x), Math.max(1, f.pose.y - GROUND_Y), wrapDeck(f.pose.z))
    g.uniform2f(bg.loc("uYaw"), Math.sin(f.pose.yaw), Math.cos(f.pose.yaw))
    g.uniform2f(bg.loc("uPitch"), Math.sin(f.pose.pitch), Math.cos(f.pose.pitch))
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, r.deck)
    g.bindVertexArray(null)
    g.drawArrays(g.TRIANGLES, 0, 3)

    g.enable(g.BLEND)
    g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA)

    // 2. shadows on the floor
    if (nShadows > 0) {
      const sh = r.shadow
      g.useProgram(sh.p)
      g.uniform2f(sh.loc("uSize"), f.w, f.h)
      g.uniform2f(sh.loc("uC"), f.cx, f.cy)
      g.uniform1f(sh.loc("uHorizon"), f.horizon)
      g.uniform2f(sh.loc("uTilt"), ct, st)
      g.bindVertexArray(r.shadowVao)
      g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, nShadows)
    }

    // 3. clouds, far to near
    if (nSprites > 0) {
      const sp = r.sprite[tier]
      g.useProgram(sp.p)
      g.uniform2f(sp.loc("uSize"), f.w, f.h)
      g.uniform1f(sp.loc("uFog"), tier === "full" ? 1 : 0)
      g.bindVertexArray(r.spriteVao)
      g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, nSprites)
    }
    g.bindVertexArray(null)

    // 4. the haze inside a cloud
    if (f.haze > 0.002) {
      const fl = r.flat
      const c = hazeRgb(f.hazeLevel)
      g.useProgram(fl.p)
      g.uniform2f(fl.loc("uSize"), f.w, f.h)
      g.uniform3f(fl.loc("uColor"), c[0] / 255, c[1] / 255, c[2] / 255)
      g.uniform1f(fl.loc("uAlpha"), Math.min(1, f.haze))
      g.drawArrays(g.TRIANGLES, 0, 3)
    }
    g.disable(g.BLEND)
  }

  const draw = (f: WorldFrame, measure: boolean) => {
    const r = res
    if (lost || disposed || !r || g.isContextLost()) return
    const tier: GlTier = f.tier === "still" ? "light" : f.tier
    const look = lookOf(tier)
    poll()

    const nSprites = packSprites(spriteData, f.puffs, f.cx, f.cy, f.tilt)
    const nShadows = look.shadows > 0 ? packShadows(shadowData, f.shadows, f.cx, f.cy, f.tilt) : 0
    if (nSprites > 0) {
      g.bindBuffer(g.ARRAY_BUFFER, r.spriteBuf)
      g.bufferData(g.ARRAY_BUFFER, spriteData.subarray(0, nSprites * SPRITE_FLOATS), g.DYNAMIC_DRAW) // a fresh store each frame, so the GPU never waits on last frame's
    }
    if (nShadows > 0) {
      g.bindBuffer(g.ARRAY_BUFFER, r.shadowBuf)
      g.bufferData(g.ARRAY_BUFFER, shadowData.subarray(0, nShadows * SHADOW_FLOATS), g.DYNAMIC_DRAW)
    }
    g.bindBuffer(g.ARRAY_BUFFER, null)

    g.bindFramebuffer(g.FRAMEBUFFER, null)
    g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight)
    scene(r, f, tier, nSprites, nShadows)

    // The guard's eyes: the same scene again, tiny, into a texture whose pixels are read back without waiting.
    if (measure && meterOk && !pending) {
      try {
        const { mw, mh } = meterSize(f.w, f.h)
        if (!ensureMeter(mw, mh)) {
          meterOk = false
          return
        }
        g.bindFramebuffer(g.FRAMEBUFFER, fbo)
        g.viewport(0, 0, mw, mh)
        scene(r, f, tier, nSprites, nShadows)
        g.bindFramebuffer(g.FRAMEBUFFER, null)
        // The fence marks the end of this frame's work. The pixels are read on a later frame, once it is signalled.
        const sync = g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE, 0)
        if (sync) pending = { sync, mw, mh }
        else meterOk = false
        g.flush()
      } catch {
        meterOk = false
        g.bindFramebuffer(g.FRAMEBUFFER, null)
      }
    }
  }

  return {
    draw,
    reading: () => (meterOk ? latest : null),
    isLost: () => lost,
    state: () => ({ lost, losses, restores, meterOk, readings }),
    testLose: () => {
      if (!loseExt || lost) return false
      loseExt.loseContext()
      return true
    },
    testRestore: () => {
      if (!loseExt || !g.isContextLost()) return false
      loseExt.restoreContext()
      return true
    },
    dispose: () => {
      disposed = true
      canvas.removeEventListener("webglcontextlost", onLostEvent)
      canvas.removeEventListener("webglcontextrestored", onRestoredEvent)
      try {
        loseExt?.loseContext() // hands the GPU memory back now
      } catch {
        /* already gone */
      }
    },
  }
}
