import type { AnimProp, Direction, Easing, Emphasis, InOutAnim, Keyframe, Layer } from '@/model/schema'
import { ease } from './easing'

/** Deux images clés plus proches que cela sont au même instant. */
export const KEY_EPSILON = 1e-4

const sameTime = (a: number, b: number) => Math.abs(a - b) < KEY_EPSILON
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// --- Propriétés animables ---------------------------------------------------

type ColorTarget = 'text' | 'fill' | 'stroke' | 'background' | 'frame' | 'icon' | 'subtitles'

/** Couleur animée par la propriété « color » : celle qui caractérise le calque. */
function colorTarget(layer: Layer): ColorTarget | null {
  switch (layer.type) {
    case 'text':
      return 'text'
    case 'background':
      return 'background'
    case 'media':
      return layer.props.stroke ? 'frame' : null
    case 'icon':
      return 'icon'
    case 'subtitles':
      return 'subtitles'
    case 'audio':
    case 'blur':
      return null
    case 'shape':
      if (layer.props.kind === 'line' || layer.props.kind === 'arrow') return 'stroke'
      if (layer.props.fill) return 'fill'
      return layer.props.stroke ? 'stroke' : null
  }
}

export function animatableProps(layer: Layer): AnimProp[] {
  if (layer.type === 'audio') return []
  const props: AnimProp[] = layer.type === 'background' || layer.type === 'subtitles' ? ['opacity'] : ['x', 'y', 'scale', 'rotation', 'opacity']
  if (colorTarget(layer)) props.push('color')
  return props
}

export function getBase(layer: Layer, prop: AnimProp): number | string {
  if (prop !== 'color') return layer.transform[prop]
  switch (layer.type) {
    case 'text':
      return layer.props.color
    case 'background':
      return layer.props.color1
    case 'media':
      return layer.props.stroke ?? '#ffffff'
    case 'icon':
      return layer.props.color
    case 'subtitles':
      return layer.props.style.color
    case 'audio':
    case 'blur':
      return '#ffffff'
    case 'shape':
      return colorTarget(layer) === 'fill' ? (layer.props.fill ?? '#000000') : (layer.props.stroke ?? '#ffffff')
  }
}

export function setBase(layer: Layer, prop: AnimProp, value: number | string): void {
  if (prop !== 'color') {
    layer.transform[prop] = value as number
    return
  }
  const color = value as string
  switch (layer.type) {
    case 'text':
      layer.props.color = color
      break
    case 'background':
      layer.props.color1 = color
      break
    case 'media':
      layer.props.stroke = color
      break
    case 'icon':
      layer.props.color = color
      break
    case 'subtitles':
      layer.props.style.color = color
      break
    case 'audio':
    case 'blur':
      break
    case 'shape':
      if (colorTarget(layer) === 'fill') layer.props.fill = color
      else layer.props.stroke = color
  }
}

// --- Couleurs ---------------------------------------------------------------

function parseHex(hex: string): [number, number, number, number] {
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 255]
}

function toHex(rgba: number[]): string {
  const parts = rgba.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
  if (parts[3] === 'ff') parts.pop()
  return `#${parts.join('')}`
}

export function lerpColor(a: string, b: string, t: number): string {
  const ca = parseHex(a)
  const cb = parseHex(b)
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t))
}

// --- Images clés ------------------------------------------------------------

export function evalKeyframes(kfs: Keyframe[], time: number): number | string {
  if (time <= kfs[0].time) return kfs[0].value
  const last = kfs[kfs.length - 1]
  if (time >= last.time) return last.value
  let i = 0
  while (kfs[i + 1].time <= time) i++
  const a = kfs[i]
  const b = kfs[i + 1]
  const t = ease(a.easing, (time - a.time) / (b.time - a.time))
  if (typeof a.value === 'number' && typeof b.value === 'number') return a.value + (b.value - a.value) * t
  return lerpColor(String(a.value), String(b.value), Math.min(1, Math.max(0, t)))
}

export function isAnimated(layer: Layer, prop: AnimProp): boolean {
  return (layer.keyframes[prop]?.length ?? 0) > 0
}

export function valueAt(layer: Layer, prop: AnimProp, time: number): number | string {
  const kfs = layer.keyframes[prop]
  return kfs?.length ? evalKeyframes(kfs, time) : getBase(layer, prop)
}

/** Copie du calque avec les valeurs des images clés à l'instant `time` (le calque lui-même s'il n'est pas animé). */
export function resolveLayer<L extends Layer>(layer: L, time: number): L {
  const props = (Object.keys(layer.keyframes) as AnimProp[]).filter((p) => isAnimated(layer, p))
  if (props.length === 0) return layer
  const copy = { ...layer, transform: { ...layer.transform }, props: { ...layer.props } } as L
  for (const prop of props) setBase(copy, prop, evalKeyframes(layer.keyframes[prop]!, time))
  return copy
}

export type KeyState = 'none' | 'animated' | 'key'

export function keyState(layer: Layer, prop: AnimProp, time: number): KeyState {
  const kfs = layer.keyframes[prop]
  if (!kfs?.length) return 'none'
  return kfs.some((k) => sameTime(k.time, time)) ? 'key' : 'animated'
}

export function upsertKeyframe(layer: Layer, prop: AnimProp, time: number, value: number | string): void {
  const kfs = (layer.keyframes[prop] ??= [])
  const existing = kfs.find((k) => sameTime(k.time, time))
  if (existing) {
    existing.value = value
    return
  }
  const index = kfs.findIndex((k) => k.time > time)
  // La nouvelle image clé reprend la courbe de celle qui la précède.
  const previous = index === -1 ? kfs[kfs.length - 1] : kfs[index - 1]
  const key: Keyframe = { time, value, easing: previous?.easing ?? 'ease' }
  if (index === -1) kfs.push(key)
  else kfs.splice(index, 0, key)
}

/** Ajoute une image clé à `time`, ou la retire si elle existe déjà. */
export function toggleKeyframe(layer: Layer, prop: AnimProp, time: number): void {
  const kfs = layer.keyframes[prop]
  if (!kfs?.length) {
    layer.keyframes[prop] = [{ time, value: getBase(layer, prop), easing: 'ease' }]
    return
  }
  const index = kfs.findIndex((k) => sameTime(k.time, time))
  if (index === -1) {
    upsertKeyframe(layer, prop, time, evalKeyframes(kfs, time))
    return
  }
  if (kfs.length === 1) {
    setBase(layer, prop, kfs[0].value)
    delete layer.keyframes[prop]
    return
  }
  kfs.splice(index, 1)
}

/** Supprime l'animation d'une propriété en gardant la valeur affichée à `time`. */
export function clearKeyframes(layer: Layer, prop: AnimProp, time: number): void {
  const kfs = layer.keyframes[prop]
  if (!kfs?.length) return
  setBase(layer, prop, evalKeyframes(kfs, time))
  delete layer.keyframes[prop]
}

/**
 * Exécute une modification « comme si » le calque était figé à `time` : la recette voit les
 * valeurs animées, et toute propriété animée qu'elle change devient une image clé à `time`.
 * C'est ce qui permet au glisser, aux poignées et au panneau de propriétés d'animer sans mode spécial.
 */
export function editResolved(draft: Layer, time: number, recipe: (layer: Layer) => void): void {
  const animated = animatableProps(draft).filter((p) => isAnimated(draft, p))
  if (animated.length === 0) {
    recipe(draft)
    return
  }
  const base = new Map(animated.map((p) => [p, getBase(draft, p)]))
  const resolved = new Map(animated.map((p) => [p, evalKeyframes(draft.keyframes[p]!, time)]))
  for (const p of animated) setBase(draft, p, resolved.get(p)!)

  recipe(draft)

  for (const p of animated) {
    // La recette a pu supprimer l'animation : la valeur courante devient alors la valeur de base.
    if (!isAnimated(draft, p)) continue
    const value = getBase(draft, p)
    setBase(draft, p, base.get(p)!)
    if (value !== resolved.get(p)) upsertKeyframe(draft, p, time, value)
  }
}

// --- Groupes d'images clés (une colonne de losanges dans la timeline) ------------

/** Instants distincts où le calque a au moins une image clé. */
export function keyTimes(layer: Layer): number[] {
  const times: number[] = []
  for (const kfs of Object.values(layer.keyframes)) {
    for (const k of kfs ?? []) if (!times.some((t) => sameTime(t, k.time))) times.push(k.time)
  }
  return times.sort((a, b) => a - b)
}

export function moveKeyGroup(layer: Layer, from: number, to: number): void {
  if (sameTime(from, to)) return
  for (const kfs of Object.values(layer.keyframes)) {
    if (!kfs) continue
    const moving = kfs.find((k) => sameTime(k.time, from))
    if (!moving) continue
    // Une image clé déjà présente à l'arrivée est remplacée.
    const clash = kfs.findIndex((k) => k !== moving && sameTime(k.time, to))
    if (clash !== -1) kfs.splice(clash, 1)
    moving.time = to
    kfs.sort((a, b) => a.time - b.time)
  }
}

export function deleteKeyGroup(layer: Layer, time: number): void {
  for (const prop of Object.keys(layer.keyframes) as AnimProp[]) {
    const kfs = layer.keyframes[prop]!
    const index = kfs.findIndex((k) => sameTime(k.time, time))
    if (index === -1) continue
    if (kfs.length === 1) {
      setBase(layer, prop, kfs[0].value)
      delete layer.keyframes[prop]
    } else {
      kfs.splice(index, 1)
    }
  }
}

export function setKeyGroupEasing(layer: Layer, time: number, easing: Easing): void {
  for (const kfs of Object.values(layer.keyframes)) {
    for (const k of kfs ?? []) if (sameTime(k.time, time)) k.easing = easing
  }
}

export function keyGroupEasing(layer: Layer, time: number): Easing | null {
  const easings = new Set<Easing>()
  for (const kfs of Object.values(layer.keyframes)) {
    for (const k of kfs ?? []) if (sameTime(k.time, time)) easings.add(k.easing)
  }
  return easings.size === 1 ? [...easings][0] : null
}

// --- Animations prédéfinies -------------------------------------------------

/** Ajustements appliqués au rendu par les animations prédéfinies, à un instant donné. */
export interface Modifiers {
  dx: number
  dy: number
  scale: number
  rotation: number
  opacity: number
  /** Flou, en pixels de composition. */
  blur: number
  /** Part visible du texte (machine à écrire) ou du tracé, 0 → 1. */
  reveal: number
  /** Volet : part visible de la boîte, depuis le bord d'où part le mouvement. */
  wipe: { direction: Direction; amount: number; entering: boolean } | null
}

export const IDENTITY: Readonly<Modifiers> = { dx: 0, dy: 0, scale: 1, rotation: 0, opacity: 1, blur: 0, reveal: 1, wipe: null }

export const DIRECTION_VECTOR: Record<Direction, { x: number; y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

/** Fenêtres temporelles de l'entrée et de la sortie, réduites si le calque est trop court pour les deux. */
export function animWindows(layer: Layer): { inEnd: number; outStart: number } {
  const len = Math.max(0, layer.end - layer.start)
  const dIn = layer.animIn?.duration ?? 0
  const dOut = layer.animOut?.duration ?? 0
  const k = dIn + dOut > len && dIn + dOut > 0 ? len / (dIn + dOut) : 1
  return { inEnd: layer.start + dIn * k, outStart: layer.end - dOut * k }
}

/** Fenêtre de la mise en avant (jusqu'au début de la sortie si elle se répète). */
export function emphasisWindow(layer: Layer): { start: number; end: number } | null {
  const e = layer.emphasis
  if (!e) return null
  const start = layer.start + e.at
  const end = e.repeat ? animWindows(layer).outStart : Math.min(start + e.duration, layer.end)
  return end > start ? { start, end } : null
}

function applyInOut(m: Modifiers, anim: InOutAnim, v: number, entering: boolean, unit: number): void {
  const vec = DIRECTION_VECTOR[anim.direction]
  // Entrée : l'élément arrive en allant dans `direction` ; sortie : il repart dans `direction`.
  const sign = entering ? -1 : 1
  const hidden = 1 - v
  switch (anim.preset) {
    case 'fade':
      m.opacity *= clamp01(v)
      break
    case 'slide':
      m.dx += sign * vec.x * anim.distance * hidden
      m.dy += sign * vec.y * anim.distance * hidden
      m.opacity *= clamp01(v * 1.5)
      break
    case 'pop':
      m.scale *= Math.max(0, v)
      m.opacity *= clamp01(v * 4)
      break
    case 'zoom':
      m.scale *= 1 + 0.35 * hidden
      m.opacity *= clamp01(v)
      break
    case 'blur':
      m.blur += 30 * unit * clamp01(hidden)
      m.opacity *= clamp01(v)
      break
    case 'wipe':
      m.wipe = { direction: anim.direction, amount: clamp01(v), entering }
      break
    case 'typewriter':
    case 'draw':
      m.reveal = Math.min(m.reveal, clamp01(v))
      break
  }
}

function applyEmphasis(m: Modifiers, e: Emphasis, u: number, unit: number): void {
  const k = e.intensity
  const fade = 1 - u
  switch (e.preset) {
    case 'pulse':
      m.scale *= 1 + 0.15 * k * Math.sin(Math.PI * u)
      break
    case 'shake':
      m.dx += 18 * unit * k * Math.sin(u * Math.PI * 10) * fade
      break
    case 'wobble':
      m.rotation += 8 * k * Math.sin(u * Math.PI * 6) * fade
      break
    case 'bounce':
      m.dy -= 50 * unit * k * Math.abs(Math.sin(u * Math.PI * 2)) * (1 - 0.5 * u)
      break
    case 'flash':
      m.opacity *= Math.max(0, 1 - 0.8 * k * (0.5 - 0.5 * Math.cos(u * Math.PI * 4)))
      break
  }
}

export function presetModifiers(layer: Layer, time: number, comp: { width: number; height: number }): Modifiers {
  const m: Modifiers = { ...IDENTITY }
  const unit = Math.min(comp.width, comp.height) / 1080
  const { inEnd, outStart } = animWindows(layer)

  if (layer.animIn && time < inEnd) {
    const v = ease(layer.animIn.easing, (time - layer.start) / (inEnd - layer.start))
    applyInOut(m, layer.animIn, v, true, unit)
  }
  if (layer.animOut && time > outStart) {
    const v = 1 - ease(layer.animOut.easing, (time - outStart) / (layer.end - outStart))
    applyInOut(m, layer.animOut, v, false, unit)
  }

  const e = layer.emphasis
  const w = emphasisWindow(layer)
  if (e && w && time >= w.start && time < w.end) {
    const rel = time - w.start
    applyEmphasis(m, e, (rel % e.duration) / e.duration, unit)
  }
  return m
}
