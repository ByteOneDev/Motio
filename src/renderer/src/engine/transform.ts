import type { Layer } from '@/model/schema'
import { isStrokeShape, rotate, type Point, type Size } from './geometry'

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const HANDLE_DIR: Record<Handle, readonly [number, number]> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
}

const ALL_HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** Poignées proposées : un texte se redimensionne par les coins (taille) ou les côtés (largeur). */
export function handlesFor(layer: Layer): Handle[] {
  if (layer.type === 'background' || layer.type === 'audio' || layer.type === 'subtitles') return []
  if (isStrokeShape(layer)) return ['w', 'e']
  if (layer.type === 'text') return ['nw', 'ne', 'se', 'sw', 'w', 'e']
  return ALL_HANDLES
}

export function isCorner(handle: Handle): boolean {
  const [hx, hy] = HANDLE_DIR[handle]
  return hx !== 0 && hy !== 0
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

interface ResizeOptions {
  keepRatio?: boolean
  fromCenter?: boolean
  minSize?: number
}

/**
 * Redimensionne une boîte (éventuellement tournée) en tirant une poignée vers `pointer`.
 * Le côté opposé reste fixe, sauf avec `fromCenter`.
 */
export function resizeBox(start: Box, handle: Handle, pointer: Point, opts: ResizeOptions = {}): Omit<Box, 'rotation'> {
  const [hx, hy] = HANDLE_DIR[handle]
  const min = opts.minSize ?? 1
  const p = rotate({ x: pointer.x - start.x, y: pointer.y - start.y }, -start.rotation)

  // Point fixe dans le repère local.
  const ax = opts.fromCenter ? 0 : (-hx * start.w) / 2
  const ay = opts.fromCenter ? 0 : (-hy * start.h) / 2
  const k = opts.fromCenter ? 2 : 1

  let w = hx ? Math.max(min, (p.x - ax) * hx * k) : start.w
  let h = hy ? Math.max(min, (p.y - ay) * hy * k) : start.h

  if (opts.keepRatio) {
    const s = hx && hy ? Math.max(w / start.w, h / start.h) : hx ? w / start.w : h / start.h
    w = Math.max(min, start.w * s)
    h = Math.max(min, start.h * s)
  }

  const local = opts.fromCenter
    ? { x: 0, y: 0 }
    : { x: hx ? ax + (hx * w) / 2 : 0, y: hy ? ay + (hy * h) / 2 : 0 }
  const offset = rotate(local, start.rotation)
  return { x: start.x + offset.x, y: start.y + offset.y, w, h }
}

export interface Modifiers {
  shift: boolean
  alt: boolean
}

/**
 * Applique un redimensionnement à `draft`, à partir de l'état du calque au début du geste.
 * `startSize` est la taille affichée (échelle comprise) ; les dimensions écrites sont avant échelle.
 */
export function resizeLayer(draft: Layer, start: Layer, startSize: Size, handle: Handle, pointer: Point, mods: Modifiers): void {
  const box: Box = { x: start.transform.x, y: start.transform.y, w: startSize.w, h: startSize.h, rotation: start.transform.rotation }
  const scale = start.transform.scale

  if (draft.type === 'text' && start.type === 'text') {
    if (isCorner(handle)) {
      // Coin : on met tout le texte à l'échelle.
      const r = resizeBox(box, handle, pointer, { keepRatio: true, fromCenter: mods.alt, minSize: 4 })
      const s = r.w / box.w
      draft.props.fontSize = Math.max(1, Math.round(start.props.fontSize * s * 10) / 10)
      draft.props.letterSpacing = start.props.letterSpacing * s
      draft.transform.width = Math.max(1, start.transform.width * s)
      draft.transform.x = r.x
      draft.transform.y = r.y
    } else {
      // Côté : on fixe la largeur de la zone de texte, le texte passe à la ligne.
      const r = resizeBox(box, handle, pointer, { fromCenter: mods.alt, minSize: start.props.fontSize })
      draft.props.autoWidth = false
      draft.transform.width = r.w / scale
      draft.transform.x = r.x
      draft.transform.y = r.y
    }
    return
  }

  // Une image garde ses proportions par les coins (Maj pour les libérer) ; une forme, l'inverse.
  const keepRatio = draft.type === 'media' ? isCorner(handle) !== mods.shift : mods.shift
  const r = resizeBox(box, handle, pointer, { keepRatio, fromCenter: mods.alt, minSize: 2 })
  draft.transform.x = r.x
  draft.transform.y = r.y
  draft.transform.width = r.w / scale
  if (!isStrokeShape(draft)) draft.transform.height = r.h / scale
}

export function normalizeAngle(deg: number): number {
  let a = deg % 360
  if (a > 180) a -= 360
  if (a <= -180) a += 360
  return a
}

function angleDeg(c: Point, p: Point): number {
  return (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI
}

/** Rotation relative au point de départ du geste ; `snap` arrondit à 15°. */
export function rotationFromDrag(startRotation: number, center: Point, from: Point, to: Point, snap: boolean): number {
  let r = startRotation + angleDeg(center, to) - angleDeg(center, from)
  if (snap) r = Math.round(r / 15) * 15
  return normalizeAngle(r)
}

export interface Guide {
  axis: 'x' | 'y'
  value: number
}

export interface SnapTargets {
  xs: number[]
  ys: number[]
}

/**
 * Aimante la position d'un calque : son centre sur le centre de la composition
 * et ceux des autres calques, ses bords sur les bords de la composition.
 */
export function snapPosition(
  pos: Point,
  half: { ex: number; ey: number },
  comp: { width: number; height: number },
  targets: SnapTargets,
  threshold: number,
): { x: number; y: number; guides: Guide[] } {
  const axis = (value: number, extent: number, size: number, others: number[]) => {
    const candidates: { offset: number; target: number }[] = [
      { offset: 0, target: size / 2 },
      ...others.map((target) => ({ offset: 0, target })),
      { offset: -extent, target: 0 },
      { offset: extent, target: size },
    ]
    let best: { delta: number; target: number } | null = null
    for (const c of candidates) {
      const delta = c.target - (value + c.offset)
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, target: c.target }
      }
    }
    return best
  }

  const sx = axis(pos.x, half.ex, comp.width, targets.xs)
  const sy = axis(pos.y, half.ey, comp.height, targets.ys)
  const guides: Guide[] = []
  if (sx) guides.push({ axis: 'x', value: sx.target })
  if (sy) guides.push({ axis: 'y', value: sy.target })
  return { x: pos.x + (sx?.delta ?? 0), y: pos.y + (sy?.delta ?? 0), guides }
}
