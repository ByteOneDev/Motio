import type { Measure } from './text'

const cache = new Map<string, number>()
let ctx: OffscreenCanvasRenderingContext2D | null = null

/** Mesure via un canvas hors écran, avec cache (vidé quand de nouvelles polices se chargent). */
export const canvasMeasure: Measure = (text, font, letterSpacing) => {
  const key = `${font}\u0000${letterSpacing}\u0000${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  ctx ??= new OffscreenCanvas(1, 1).getContext('2d')!
  ctx.font = font
  ctx.letterSpacing = `${letterSpacing}px`
  const width = ctx.measureText(text).width
  if (cache.size > 10_000) cache.clear()
  cache.set(key, width)
  return width
}

export function clearMeasureCache(): void {
  cache.clear()
}
