import { current, isDraft } from 'immer'
import { createInOut, newId, uniqueName } from './factories'
import type { Layer, Project, ShapeLayer } from './schema'

/** Un calque peut-il être coupé à l'instant `t` ? (il faut un vrai morceau de chaque côté) */
export function canSplit(layer: Layer, t: number): boolean {
  return !layer.locked && t > layer.start + 0.01 && t < layer.end - 0.01
}

/**
 * Coupe les calques à l'instant `t` (outil « Couper »). La partie gauche garde son entrée,
 * la partie droite sa sortie ; médias et sons reprennent là où la coupe a eu lieu.
 * Renvoie les identifiants des parties droites, insérées juste au-dessus des gauches.
 */
export function splitLayers(draft: Project, ids: string[], t: number): string[] {
  const created: string[] = []
  for (let i = draft.layers.length - 1; i >= 0; i--) {
    const left = draft.layers[i]
    if (!ids.includes(left.id) || !canSplit(left, t)) continue
    // Dans une modification du store, `left` est un brouillon Immer : on clone sa valeur actuelle.
    const right = structuredClone(isDraft(left) ? current(left) : left) as Layer
    right.id = newId()
    right.name = uniqueName(left.name, draft.layers)
    right.start = t
    left.end = t
    // Une coupe est franche : pas de sortie à gauche, pas d'entrée à droite.
    left.animOut = null
    right.animIn = null
    const cut = t - left.start
    if (right.emphasis) {
      const remaining = right.emphasis.at + (right.emphasis.repeat ? Infinity : right.emphasis.duration) - cut
      right.emphasis = remaining > 0 ? { ...right.emphasis, at: Math.max(0, right.emphasis.at - cut) } : null
    }
    if (right.type === 'media') right.props.videoStart += cut
    if (right.type === 'audio' && left.type === 'audio') {
      right.props.sourceStart += cut
      right.props.fadeIn = 0
      left.props.fadeOut = 0
    }
    draft.layers.splice(i + 1, 0, right)
    created.push(right.id)
  }
  return created
}

// --- Transitions -----------------------------------------------------------------

export type OverlayTransition = 'fade-black' | 'flash' | 'wipe' | 'curtain' | 'iris'

export const OVERLAY_TRANSITIONS: { id: OverlayTransition; label: string; hint: string }[] = [
  { id: 'fade-black', label: 'Fondu au noir', hint: 'L’image passe par le noir' },
  { id: 'flash', label: 'Flash blanc', hint: 'Éclair lumineux, très « trailer »' },
  { id: 'wipe', label: 'Volet coloré', hint: 'Un aplat traverse l’écran' },
  { id: 'curtain', label: 'Double volet', hint: 'Deux aplats décalés' },
  { id: 'iris', label: 'Iris', hint: 'Un cercle couvre puis découvre l’image' },
]

function fullFrame(project: Project, name: string, color: string, start: number, end: number): ShapeLayer {
  return {
    id: newId(),
    name: uniqueName(`Transition · ${name}`, project.layers),
    type: 'shape',
    start,
    end,
    visible: true,
    locked: false,
    transform: { x: project.width / 2, y: project.height / 2, width: project.width, height: project.height, rotation: 0, opacity: 1, scale: 1 },
    animIn: null,
    animOut: null,
    emphasis: null,
    keyframes: {},
    props: { kind: 'rect', fill: color, stroke: null, strokeWidth: 0, radius: 0 },
  }
}

/**
 * Transition « par-dessus l'image », centrée sur l'instant `t` : des calques plein cadre
 * qui couvrent la coupe puis s'effacent. Renvoie les calques à ajouter en haut de la pile.
 */
export function overlayTransition(project: Project, kind: OverlayTransition, t: number, accent: string): Layer[] {
  const length = kind === 'flash' ? 0.5 : kind === 'curtain' ? 1 : 0.8
  const start = Math.max(0, Math.min(t - length / 2, project.duration - length))
  const end = start + length
  const half = length / 2
  const anim = (preset: 'fade' | 'wipe' | 'pop', entering: boolean, duration: number, layer: Layer) => ({
    ...createInOut(preset, layer, project, entering),
    duration,
    direction: 'right' as const,
    easing: entering ? ('easeIn' as const) : ('easeOut' as const),
  })

  switch (kind) {
    case 'fade-black': {
      const l = fullFrame(project, 'Fondu au noir', '#000000', start, end)
      l.animIn = anim('fade', true, half, l)
      l.animOut = anim('fade', false, half, l)
      return [l]
    }
    case 'flash': {
      const l = fullFrame(project, 'Flash', '#ffffff', start, end)
      l.animIn = anim('fade', true, 0.06, l)
      l.animOut = { ...anim('fade', false, length - 0.06, l), easing: 'easeOut' }
      return [l]
    }
    case 'wipe': {
      const l = fullFrame(project, 'Volet', accent, start, end)
      l.animIn = anim('wipe', true, half, l)
      l.animOut = anim('wipe', false, half, l)
      return [l]
    }
    case 'curtain': {
      const a = fullFrame(project, 'Volet 1', accent, start, end - 0.15)
      const b = fullFrame(project, 'Volet 2', '#ff4d8d', start + 0.15, end)
      for (const l of [a, b]) {
        l.animIn = anim('wipe', true, 0.35, l)
        l.animOut = anim('wipe', false, 0.35, l)
      }
      return [a, b]
    }
    case 'iris': {
      // Un cercle assez grand pour couvrir les coins du cadre.
      const d = Math.hypot(project.width, project.height) * 1.05
      const l = fullFrame(project, 'Iris', accent, start, end)
      l.props.kind = 'ellipse'
      l.transform.width = d
      l.transform.height = d
      l.animIn = anim('pop', true, half, l)
      l.animOut = anim('pop', false, half, l)
      return [l]
    }
  }
}

/**
 * Fondu enchaîné entre deux calques qui se suivent : ils se chevauchent le temps du fondu,
 * le premier s'efface pendant que le second apparaît. Avec un seul calque : fondus d'entrée et de sortie.
 */
export function crossfade(draft: Project, ids: string[], duration = 0.6): boolean {
  const layers = draft.layers.filter((l) => ids.includes(l.id) && !l.locked).sort((a, b) => a.start - b.start)
  if (layers.length === 1) {
    const [l] = layers
    const d = Math.min(duration, (l.end - l.start) / 2)
    l.animIn = { ...createInOut('fade', l, draft, true), duration: d }
    l.animOut = { ...createInOut('fade', l, draft, false), duration: d }
    return true
  }
  if (layers.length !== 2) return false
  const [a, b] = layers
  const overlap = a.end - b.start
  if (overlap < duration) {
    // On allonge chacun de la moitié de ce qui manque, sans sortir du projet.
    const missing = duration - Math.max(0, overlap)
    a.end = Math.min(draft.duration, a.end + missing / 2)
    b.start = Math.max(0, b.start - missing / 2)
  }
  const d = Math.max(0.1, a.end - b.start)
  a.animOut = { ...createInOut('fade', a, draft, false), duration: d, easing: 'linear' }
  b.animIn = { ...createInOut('fade', b, draft, true), duration: d, easing: 'linear' }
  return true
}

// --- Recadrage dans le temps -----------------------------------------------------

/**
 * Déplace le début d'un calque en gardant son contenu à sa place : une vidéo ou un son
 * commence alors plus loin dans la source (comme dans un logiciel de montage).
 */
export function setLayerStart(layer: Layer, start: number): void {
  const shift = start - layer.start
  layer.start = start
  if (layer.type === 'media') layer.props.videoStart = Math.max(0, layer.props.videoStart + shift)
  if (layer.type === 'audio') layer.props.sourceStart = Math.max(0, layer.props.sourceStart + shift)
}

/** « Début ici » / « Fin ici » : recadre les calques sélectionnés sur la tête de lecture. */
export function trimToTime(draft: Project, ids: string[], t: number, side: 'start' | 'end'): number {
  let count = 0
  for (const layer of draft.layers) {
    if (!ids.includes(layer.id) || layer.locked) continue
    if (side === 'start' && t < layer.end - 0.05 && t !== layer.start) {
      setLayerStart(layer, t)
      count++
    } else if (side === 'end' && t > layer.start + 0.05 && t !== layer.end) {
      layer.end = t
      count++
    }
  }
  return count
}

/**
 * « Caler sur les temps » : les calques sélectionnés, dans l'ordre où ils apparaissent,
 * démarrent chacun sur un temps successif de la musique (à partir du premier d'entre eux).
 * Leur durée et leurs images clés suivent. Renvoie le nombre de calques déplacés.
 */
export function snapToBeats(draft: Project, ids: string[], beats: number[], every = 1): number {
  const layers = draft.layers.filter((l) => ids.includes(l.id) && !l.locked).sort((a, b) => a.start - b.start)
  if (layers.length === 0 || beats.length === 0) return 0
  let index = beats.findIndex((b) => b >= layers[0].start - 0.05)
  if (index === -1) return 0
  let moved = 0
  for (const layer of layers) {
    const beat = beats[index]
    if (beat === undefined) break
    const shift = Math.max(-layer.start, Math.min(beat - layer.start, draft.duration - layer.end))
    layer.start += shift
    layer.end += shift
    for (const kfs of Object.values(layer.keyframes)) for (const k of kfs ?? []) k.time += shift
    index += every
    moved++
  }
  return moved
}
