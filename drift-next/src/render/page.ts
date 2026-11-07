/**
 * The page's own colour: what is on screen from the first paint until the first picture is ready. A sky blue at about the
 * brightness the picture itself has, so loading in is never a bright or dark jump. index.html and main.tsx use the same colour.
 */
export const PAGE_BG = "#5586b6"

const hex = (s: string): readonly [number, number, number] => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]

export const PAGE_RGB = hex(PAGE_BG)

/** Its brightness on the same weighting the brightness meter uses (0 to 1). */
export const PAGE_LEVEL = (0.2126 * PAGE_RGB[0] + 0.7152 * PAGE_RGB[1] + 0.0722 * PAGE_RGB[2]) / 255

/** The page colour made as bright as `level` (0 to 1): a flat sky blue that reads the same mean brightness as the picture. */
export function levelColor(level: number): string {
  const k = Number.isFinite(level) ? Math.min(1.25, Math.max(0.5, level / PAGE_LEVEL)) : 1
  const c = PAGE_RGB.map((v) => Math.min(255, Math.round(v * k)))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}
