import type { Layer, Project } from '@/model/schema'
import { resolveLayer } from './animate'
import { aabbHalfExtents, displaySize } from './geometry'
import type { Measure } from './text'

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

interface Bounds {
  id: string
  x: number
  y: number
  ex: number
  ey: number
}

function bounds(layer: Layer, time: number, measure: Measure): Bounds {
  const r = resolveLayer(layer, time)
  const { ex, ey } = aabbHalfExtents(displaySize(r, measure), r.transform.rotation)
  return { id: layer.id, x: r.transform.x, y: r.transform.y, ex, ey }
}

/**
 * Nouvelle position (centre) de chaque calque : un seul calque s'aligne sur le cadre,
 * plusieurs s'alignent entre eux (sur leur boîte englobante commune).
 */
export function alignPositions(project: Project, ids: string[], mode: AlignMode, time: number, measure: Measure): Map<string, { x: number; y: number }> {
  const items = project.layers.filter((l) => ids.includes(l.id) && !l.locked && l.type !== 'audio' && l.type !== 'background').map((l) => bounds(l, time, measure))
  const frame =
    items.length === 1
      ? { left: 0, right: project.width, top: 0, bottom: project.height }
      : {
          left: Math.min(...items.map((b) => b.x - b.ex)),
          right: Math.max(...items.map((b) => b.x + b.ex)),
          top: Math.min(...items.map((b) => b.y - b.ey)),
          bottom: Math.max(...items.map((b) => b.y + b.ey)),
        }
  const out = new Map<string, { x: number; y: number }>()
  for (const b of items) {
    let { x, y } = b
    if (mode === 'left') x = frame.left + b.ex
    if (mode === 'hcenter') x = (frame.left + frame.right) / 2
    if (mode === 'right') x = frame.right - b.ex
    if (mode === 'top') y = frame.top + b.ey
    if (mode === 'vcenter') y = (frame.top + frame.bottom) / 2
    if (mode === 'bottom') y = frame.bottom - b.ey
    out.set(b.id, { x, y })
  }
  return out
}

/** Répartit les centres à intervalles égaux entre les deux calques extrêmes (3 calques ou plus). */
export function distributePositions(project: Project, ids: string[], axis: 'x' | 'y', time: number, measure: Measure): Map<string, { x: number; y: number }> {
  const items = project.layers.filter((l) => ids.includes(l.id) && !l.locked && l.type !== 'audio' && l.type !== 'background').map((l) => bounds(l, time, measure))
  const out = new Map<string, { x: number; y: number }>()
  if (items.length < 3) return out
  items.sort((a, b) => a[axis] - b[axis])
  const first = items[0][axis]
  const step = (items[items.length - 1][axis] - first) / (items.length - 1)
  items.forEach((b, i) => out.set(b.id, { x: axis === 'x' ? first + i * step : b.x, y: axis === 'y' ? first + i * step : b.y }))
  return out
}
