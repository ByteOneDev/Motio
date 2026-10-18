import { upsertKeyframe } from '@/engine/animate'
import { alignPositions, distributePositions, type AlignMode } from '@/engine/align'
import { canvasMeasure } from '@/engine/measure'
import { beatTimes } from '@/engine/beats'
import { canSplit, crossfade, overlayTransition, snapToBeats, splitLayers, trimToTime, type OverlayTransition } from '@/model/editing'
import type { AnimProp } from '@/model/schema'
import { useEditor } from '@/store/editor'
import { notify } from './toast'

const s = () => useEditor.getState()

/** Calques visés : la sélection, sinon tous les calques non verrouillés sous la tête de lecture. */
function targets(): string[] {
  const { selection, project, time } = s()
  if (selection.length) return selection
  return project.layers.filter((l) => !l.locked && l.start < time && l.end > time).map((l) => l.id)
}

/** Couper (⌘B) : sépare les calques en deux à la tête de lecture. */
export function splitAtPlayhead(): void {
  const { time, project } = s()
  const ids = targets().filter((id) => {
    const l = project.layers.find((x) => x.id === id)
    return l && canSplit(l, time)
  })
  if (ids.length === 0) {
    notify('Placez la tête de lecture au milieu d’un calque pour le couper.')
    return
  }
  let created: string[] = []
  s().update(ids.length > 1 ? `Couper ${ids.length} calques` : 'Couper', (draft) => {
    created = splitLayers(draft, ids, time)
  })
  s().select(created)
}

export function addTransition(kind: OverlayTransition): void {
  const { project, time } = s()
  const layers = overlayTransition(project, kind, time, project.palette[0] ?? '#7c5cff')
  s().update('Ajouter une transition', (draft) => {
    draft.layers.push(...layers)
  })
  s().select(layers.map((l) => l.id))
}

export function crossfadeSelection(): void {
  const ids = s().selection
  if (ids.length < 1 || ids.length > 2) {
    notify('Sélectionnez deux calques qui se suivent (ou un seul pour un fondu d’entrée et de sortie).')
    return
  }
  let ok = false
  s().update('Fondu enchaîné', (draft) => {
    ok = crossfade(draft, ids)
  })
  if (!ok) notify('Le fondu enchaîné s’applique à deux calques non verrouillés.')
}

export function trimSelection(side: 'start' | 'end'): void {
  const { selection, time } = s()
  if (selection.length === 0) {
    notify('Sélectionnez les calques à recadrer.')
    return
  }
  s().update(side === 'start' ? 'Début ici' : 'Fin ici', (draft) => void trimToTime(draft, selection, time, side))
}

export function align(mode: AlignMode): void {
  const { project, selection, time } = s()
  const positions = alignPositions(project, selection, mode, time, canvasMeasure)
  if (positions.size === 0) return
  s().updateLayers([...positions.keys()], 'Aligner', (l) => {
    const p = positions.get(l.id)!
    l.transform.x = p.x
    l.transform.y = p.y
  })
}

export function distribute(axis: 'x' | 'y'): void {
  const { project, selection, time } = s()
  const positions = distributePositions(project, selection, axis, time, canvasMeasure)
  if (positions.size === 0) {
    notify('Sélectionnez au moins trois éléments à répartir.')
    return
  }
  s().updateLayers([...positions.keys()], 'Répartir', (l) => {
    const p = positions.get(l.id)!
    l.transform.x = p.x
    l.transform.y = p.y
  })
}

export function arrange(where: 'front' | 'back' | 'forward' | 'backward'): void {
  const { project, selection, reorderLayer } = s()
  if (selection.length !== 1) {
    notify('Sélectionnez un seul calque à déplacer dans la pile.')
    return
  }
  const index = project.layers.findIndex((l) => l.id === selection[0])
  const to = { front: project.layers.length - 1, back: 0, forward: index + 1, backward: index - 1 }[where]
  reorderLayer(selection[0], to)
}

const KEY_PROPS: AnimProp[] = ['x', 'y', 'scale', 'rotation', 'opacity']

/** Image clé « tout en un » : fige position, échelle, rotation et opacité à l'instant courant. */
export function addKeyframes(): void {
  const { selection, time, project } = s()
  const ids = selection.filter((id) => {
    const l = project.layers.find((x) => x.id === id)
    return l && !l.locked && l.type !== 'audio' && l.type !== 'background'
  })
  if (ids.length === 0) {
    notify('Sélectionnez un élément pour lui ajouter une image clé.')
    return
  }
  // La recette voit déjà les valeurs à l'instant courant (images clés comprises).
  s().updateLayers(ids, 'Image clé', (l) => {
    for (const prop of KEY_PROPS) upsertKeyframe(l, prop, time, l.transform[prop as 'x'])
  })
}

/** « Caler sur les temps » : chaque calque sélectionné démarre sur un temps de la musique. */
export function alignToBeats(): void {
  const { selection, project } = s()
  const beats = beatTimes(project)
  if (beats.length === 0) {
    notify('Ajoutez une musique dont le tempo est connu (onglet Audio, ou tempo réglé sur votre musique).')
    return
  }
  if (selection.length === 0) {
    notify('Sélectionnez les éléments à caler sur le rythme.')
    return
  }
  s().update('Caler sur les temps', (draft) => void snapToBeats(draft, selection, beats))
}
