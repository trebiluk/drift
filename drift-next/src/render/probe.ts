import type { Tier } from "./tiers.ts"

/** Everything the probe may ask the browser. Injected so it can be tested without one. */
export type ProbeEnv = {
  context?: (kind: "webgl2" | "webgl") => unknown
  renderer?: () => string // GPU name, if the browser will say
  userAgent?: string
  cores?: number
  memoryGb?: number
  media?: (query: string) => boolean
  touchPoints?: number
}

export type Caps = {
  gl: 0 | 1 | 2
  software: boolean // a CPU "GPU": WebGL starts but crawls
  cros: boolean
  cores: number | null
  memoryGb: number | null
  reducedMotion: boolean
  touch: boolean
}

const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function detectCaps(env: ProbeEnv): Caps {
  const gl = safe<0 | 1 | 2>(() => (env.context?.("webgl2") ? 2 : env.context?.("webgl") ? 1 : 0), 0)
  const name = gl ? safe(() => env.renderer?.() ?? "", "") : ""
  return {
    gl,
    software: SOFTWARE_GL.test(name),
    cros: /\bCrOS\b/.test(env.userAgent ?? ""),
    cores: typeof env.cores === "number" && env.cores > 0 ? env.cores : null,
    memoryGb: typeof env.memoryGb === "number" && env.memoryGb > 0 ? env.memoryGb : null,
    reducedMotion: safe(() => env.media?.("(prefers-reduced-motion: reduce)") ?? false, false),
    touch: (env.touchPoints ?? 0) > 0 || safe(() => env.media?.("(pointer: coarse)") ?? false, false),
  }
}

/** Where to begin. Never `full`: that tier is only reached by climbing after the screen proves it keeps up. */
export function startTier(c: Caps, lowPower = false): Tier {
  if (c.gl === 0 || c.software) return "still"
  if (c.gl === 1 || c.reducedMotion || lowPower) return "light"
  if (c.cros || (c.cores !== null && c.cores <= 4) || (c.memoryGb !== null && c.memoryGb <= 4)) return "light"
  return "balanced"
}

/** The real browser. Not covered by unit tests (needs a browser); see the PR notes. */
export function browserEnv(): ProbeEnv {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { deviceMemory?: number })
  let last: WebGLRenderingContext | null = null
  return {
    context: (kind) => {
      if (typeof document === "undefined") return null
      const gl = document.createElement("canvas").getContext(kind) as WebGLRenderingContext | null
      if (gl) last = gl
      return gl
    },
    renderer: () => {
      const ext = last?.getExtension("WEBGL_debug_renderer_info")
      const name = ext && last ? String(last.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ""
      last?.getExtension("WEBGL_lose_context")?.loseContext()
      return name
    },
    userAgent: nav?.userAgent,
    cores: nav?.hardwareConcurrency,
    memoryGb: nav?.deviceMemory,
    media: (q) => (typeof matchMedia === "undefined" ? false : matchMedia(q).matches),
    touchPoints: nav?.maxTouchPoints,
  }
}
