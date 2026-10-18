import type { Layer, Project, ShapeProps, Transform } from '@/model/schema'
import { resolveLayer } from './animate'
import { layoutText, type Measure } from './text'

export interface Point {
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

export const rad = (deg: number) => (deg * Math.PI) / 180

export function rotate(p: Point, deg: number): Point {
  const a = rad(deg)
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }
}

/** Coordonnées de composition → repère local du calque (centré, non tourné). */
export function toLocal(t: Transform, p: Point): Point {
  return rotate({ x: p.x - t.x, y: p.y - t.y }, -t.rotation)
}

export function toWorld(t: Transform, p: Point): Point {
  const r = rotate(p, t.rotation)
  return { x: r.x + t.x, y: r.y + t.y }
}

export function arrowHead(p: ShapeProps): { length: number; half: number } {
  return { length: Math.max(p.strokeWidth * 3.5, 12), half: Math.max(p.strokeWidth * 2.2, 8) }
}

export function isStrokeShape(layer: Layer): layer is Layer & { type: 'shape' } {
  return layer.type === 'shape' && (layer.props.kind === 'line' || layer.props.kind === 'arrow')
}

/** Taille propre du calque, avant échelle (le texte se mesure, les lignes ont l'épaisseur de leur trait). */
export function layerSize(layer: Layer, measure: Measure): Size {
  const t = layer.transform
  if (layer.type === 'text') {
    const layout = layoutText(layer.props, t.width, measure)
    const pad = (layer.props.highlight?.padding ?? 0) * 2
    return { w: layout.width + pad, h: layout.height + pad }
  }
  if (layer.type !== 'shape') return { w: t.width, h: t.height }
  if (layer.props.kind === 'line') return { w: t.width, h: Math.max(layer.props.strokeWidth, 1) }
  if (layer.props.kind === 'arrow') return { w: t.width, h: arrowHead(layer.props).half * 2 }
  return { w: t.width, h: t.height }
}

/** Taille à l'écran : taille propre × échelle. */
export function displaySize(layer: Layer, measure: Measure): Size {
  const size = layerSize(layer, measure)
  const s = layer.transform.scale
  return { w: size.w * s, h: size.h * s }
}

/** Fonds, sons et sous-titres ne se sélectionnent pas sur le canevas (on les choisit dans la timeline). */
export function isCanvasSelectable(layer: Layer): boolean {
  return layer.type !== 'background' && layer.type !== 'audio' && layer.type !== 'subtitles'
}

export function isActive(layer: Layer, time: number): boolean {
  return layer.visible && time >= layer.start && time < layer.end
}

/** `tolerance` élargit la zone cliquable (utile pour les lignes fines). */
export function containsPoint(layer: Layer, size: Size, p: Point, tolerance = 0): boolean {
  const l = toLocal(layer.transform, p)
  const hw = size.w / 2 + tolerance
  const hh = size.h / 2 + tolerance
  if (layer.type === 'shape' && layer.props.kind === 'ellipse') {
    return (l.x / hw) ** 2 + (l.y / hh) ** 2 <= 1
  }
  return Math.abs(l.x) <= hw && Math.abs(l.y) <= hh
}

/**
 * Calque visible le plus haut sous le point (les calques verrouillés sont ignorés).
 * On teste la position animée par les images clés, sans les effets d'entrée/sortie.
 */
export function hitTest(project: Project, time: number, p: Point, measure: Measure, tolerance = 0): string | null {
  for (let i = project.layers.length - 1; i >= 0; i--) {
    const layer = project.layers[i]
    if (layer.locked || !isCanvasSelectable(layer) || !isActive(layer, time)) continue
    const resolved = resolveLayer(layer, time)
    if (containsPoint(resolved, displaySize(resolved, measure), p, tolerance)) return layer.id
  }
  return null
}

/** Coins en coordonnées de composition : nw, ne, se, sw. */
export function corners(t: Transform, size: Size): Point[] {
  const hw = size.w / 2
  const hh = size.h / 2
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((c) => toWorld(t, c))
}

/** Demi-dimensions de la boîte englobante alignée sur les axes d'une boîte tournée. */
export function aabbHalfExtents(size: Size, rotation: number): { ex: number; ey: number } {
  const a = rad(rotation)
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  return { ex: (size.w * cos + size.h * sin) / 2, ey: (size.w * sin + size.h * cos) / 2 }
}
