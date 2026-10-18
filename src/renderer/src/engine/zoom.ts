import type { MediaLayer } from '@/model/schema'

export interface ZoomState {
  scale: number
  /** Centre visé, en fraction de la source (0–1). */
  cx: number
  cy: number
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/**
 * Zoom caméra d'un média à l'instant `time` : chaque zoom monte en douceur pendant `ramp`,
 * tient, puis redescend. Si deux zooms se recouvrent, le plus avancé l'emporte.
 */
export function zoomAt(layer: MediaLayer, time: number): ZoomState {
  const rel = time - layer.start
  let best: ZoomState = { scale: 1, cx: 0.5, cy: 0.5 }
  let bestWeight = 0
  for (const z of layer.props.zooms) {
    if (rel < z.at || rel > z.at + z.duration) continue
    const ramp = Math.min(z.ramp, z.duration / 2)
    const w = ramp > 0 ? Math.min(smooth((rel - z.at) / ramp), smooth((z.at + z.duration - rel) / ramp)) : 1
    if (w > bestWeight) {
      bestWeight = w
      best = { scale: 1 + (z.scale - 1) * w, cx: 0.5 + (z.cx - 0.5) * w, cy: 0.5 + (z.cy - 0.5) * w }
    }
  }
  return best
}

/**
 * Applique un zoom à une zone de la source (sx, sy, sw, sh) : on prend une zone plus petite,
 * centrée sur le point visé, sans jamais sortir de la zone de départ.
 */
export function zoomRect(
  base: { sx: number; sy: number; sw: number; sh: number },
  zoom: ZoomState,
  source: { width: number; height: number },
): { sx: number; sy: number; sw: number; sh: number } {
  if (zoom.scale <= 1.0001) return base
  const sw = base.sw / zoom.scale
  const sh = base.sh / zoom.scale
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
  return {
    sx: clamp(zoom.cx * source.width - sw / 2, base.sx, base.sx + base.sw - sw),
    sy: clamp(zoom.cy * source.height - sh / 2, base.sy, base.sy + base.sh - sh),
    sw,
    sh,
  }
}
