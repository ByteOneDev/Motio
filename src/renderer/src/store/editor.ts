import { create } from 'zustand'
import { applyPatches, current, enablePatches, produceWithPatches, type Patch } from 'immer'
import { editResolved } from '@/engine/animate'
import { cloneLayer, createProject } from '@/model/factories'
import type { Layer, Project } from '@/model/schema'

enablePatches()

interface HistoryEntry {
  label: string
  patches: Patch[]
  inverse: Patch[]
  /** Les modifications successives avec la même clé (frappe, nudge…) fusionnent en une seule entrée. */
  key?: string
  time: number
  /** Sélection à restaurer en annulant / en rétablissant. */
  selectionBefore: string[]
  selectionAfter?: string[]
}

const HISTORY_LIMIT = 500
const COALESCE_MS = 1000

export type Recipe = (draft: Project) => void

export interface UpdateOptions {
  coalesce?: string
}

/** Groupe d'images clés sélectionné dans la timeline : toutes celles d'un calque à un instant. */
export interface KeySelection {
  layerId: string
  time: number
}

export interface EditorState {
  project: Project
  /** Fichier .motio du projet (`null` tant qu'il n'a jamais été enregistré). */
  filePath: string | null
  /** Projet tel qu'enregistré : s'il diffère du projet courant, il y a des modifications non enregistrées. */
  savedProject: Project | null
  selection: string[]
  selectedKey: KeySelection | null
  /** Instant courant, toujours calé sur une image (1 / fps). */
  time: number
  playing: boolean
  loop: boolean
  /** Pendant un aperçu ponctuel, la lecture s'arrête à cet instant. */
  playUntil: number | null
  past: HistoryEntry[]
  future: HistoryEntry[]

  /** Modifie le projet et enregistre l'opération dans l'historique. */
  update: (label: string, recipe: Recipe, opts?: UpdateOptions) => void
  /** Entre begin/end, toutes les mises à jour (ex. un glisser) forment une seule entrée d'historique. */
  beginGesture: (label: string) => void
  endGesture: () => void
  undo: () => void
  redo: () => void

  select: (ids: string[]) => void
  selectKey: (key: KeySelection | null) => void
  setTime: (time: number) => void
  play: (range?: { from: number; to: number }) => void
  pause: () => void
  togglePlay: () => void
  setLoop: (loop: boolean) => void
  loadProject: (project: Project, filePath?: string | null, saved?: boolean) => void
  markSaved: (filePath: string | null) => void

  /**
   * Modifie un calque tel qu'il apparaît à l'instant courant : si une propriété animée change,
   * une image clé est créée ou mise à jour à cet instant.
   */
  updateLayer: (id: string, label: string, recipe: (layer: Layer) => void, opts?: UpdateOptions) => void
  updateLayers: (ids: string[], label: string, recipe: (layer: Layer) => void, opts?: UpdateOptions) => void
  addLayer: (layer: Layer) => void
  removeLayers: (ids: string[]) => void
  duplicateLayers: (ids: string[]) => void
  /** Déplace un calque à l'index `toIndex` de la pile (0 = tout en bas). */
  reorderLayer: (id: string, toIndex: number) => void
}

let gesture: { label: string; patches: Patch[]; inverse: Patch[]; selectionBefore: string[] } | null = null

function existing(ids: string[], project: Project): string[] {
  return ids.filter((id) => project.layers.some((l) => l.id === id))
}

/** Dernière image affichable (un calque est visible sur [start, end[). */
export function lastFrame(project: Project): number {
  return Math.max(0, project.duration - 1 / project.fps)
}

export function snapToFrame(time: number, fps: number): number {
  return Math.round(time * fps) / fps
}

const initialProject = createProject()

export const useEditor = create<EditorState>()((set, get) => ({
  project: initialProject,
  filePath: null,
  savedProject: initialProject,
  selection: [],
  selectedKey: null,
  time: 0,
  playing: false,
  loop: true,
  playUntil: null,
  past: [],
  future: [],

  update(label, recipe, opts) {
    const { project, past, selection } = get()
    const [next, patches, inverse] = produceWithPatches(project, recipe)
    if (patches.length === 0) return

    if (gesture) {
      gesture.patches.push(...patches)
      gesture.inverse.unshift(...inverse)
      set({ project: next })
      return
    }

    const now = Date.now()
    const last = past.at(-1)
    if (opts?.coalesce && last?.key === opts.coalesce && now - last.time < COALESCE_MS) {
      const merged: HistoryEntry = {
        ...last,
        patches: [...last.patches, ...patches],
        inverse: [...inverse, ...last.inverse],
        time: now,
      }
      set({ project: next, past: [...past.slice(0, -1), merged], future: [] })
      return
    }

    const entry: HistoryEntry = { label, patches, inverse, key: opts?.coalesce, time: now, selectionBefore: selection }
    set({ project: next, past: [...past, entry].slice(-HISTORY_LIMIT), future: [] })
  },

  beginGesture(label) {
    if (gesture) get().endGesture()
    gesture = { label, patches: [], inverse: [], selectionBefore: get().selection }
  },

  endGesture() {
    const g = gesture
    gesture = null
    if (!g || g.patches.length === 0) return
    const entry: HistoryEntry = {
      label: g.label,
      patches: g.patches,
      inverse: g.inverse,
      time: Date.now(),
      selectionBefore: g.selectionBefore,
    }
    set({ past: [...get().past, entry].slice(-HISTORY_LIMIT), future: [] })
  },

  undo() {
    get().endGesture()
    const { past, future, project, selection } = get()
    const entry = past.at(-1)
    if (!entry) return
    const next = applyPatches(project, entry.inverse)
    const undone = { ...entry, selectionAfter: selection }
    set({
      project: next,
      past: past.slice(0, -1),
      future: [...future, undone],
      selection: existing(entry.selectionBefore, next),
      selectedKey: null,
    })
  },

  redo() {
    get().endGesture()
    const { past, future, project, selection } = get()
    const entry = future.at(-1)
    if (!entry) return
    const next = applyPatches(project, entry.patches)
    const restored = existing(entry.selectionAfter ?? selection, next)
    set({ project: next, past: [...past, entry], future: future.slice(0, -1), selection: restored, selectedKey: null })
  },

  select(ids) {
    const key = get().selectedKey
    set({ selection: ids, selectedKey: key && ids.includes(key.layerId) ? key : null })
  },

  selectKey(key) {
    set(key ? { selectedKey: key, selection: [key.layerId] } : { selectedKey: null })
  },

  setTime(time) {
    const { project } = get()
    set({ time: Math.max(0, Math.min(snapToFrame(time, project.fps), lastFrame(project))) })
  },

  play(range) {
    if (range) get().setTime(range.from)
    else if (get().time >= lastFrame(get().project)) get().setTime(0)
    set({ playing: true, playUntil: range ? range.to : null })
  },

  pause() {
    set({ playing: false, playUntil: null })
  },

  togglePlay() {
    if (get().playing) get().pause()
    else get().play()
  },

  setLoop(loop) {
    set({ loop })
  },

  loadProject(project, filePath = null, saved = true) {
    gesture = null
    set({
      project,
      filePath,
      savedProject: saved ? project : null,
      selection: [],
      selectedKey: null,
      time: 0,
      playing: false,
      past: [],
      future: [],
    })
  },

  markSaved(filePath) {
    set({ filePath, savedProject: get().project })
  },

  updateLayer(id, label, recipe, opts) {
    get().updateLayers([id], label, recipe, opts)
  },

  updateLayers(ids, label, recipe, opts) {
    const time = get().time
    get().update(
      label,
      (draft) => {
        for (const layer of draft.layers) if (ids.includes(layer.id)) editResolved(layer, time, recipe)
      },
      opts,
    )
  },

  addLayer(layer) {
    get().update(`Ajouter ${layer.name}`, (draft) => {
      draft.layers.push(layer)
    })
    set({ selection: [layer.id] })
  },

  removeLayers(ids) {
    if (ids.length === 0) return
    get().update('Supprimer', (draft) => {
      draft.layers = draft.layers.filter((l) => !ids.includes(l.id))
    })
    get().select(get().selection.filter((id) => !ids.includes(id)))
  },

  duplicateLayers(ids) {
    const copies: string[] = []
    get().update('Dupliquer', (draft) => {
      // On parcourt de haut en bas pour insérer chaque copie juste au-dessus de son original.
      for (let i = draft.layers.length - 1; i >= 0; i--) {
        const layer = draft.layers[i]
        if (!ids.includes(layer.id)) continue
        const copy = cloneLayer(current(layer), draft.layers)
        draft.layers.splice(i + 1, 0, copy)
        copies.push(copy.id)
      }
    })
    if (copies.length) set({ selection: copies })
  },

  reorderLayer(id, toIndex) {
    get().update('Réordonner', (draft) => {
      const from = draft.layers.findIndex((l) => l.id === id)
      if (from < 0) return
      const to = Math.max(0, Math.min(toIndex, draft.layers.length - 1))
      if (to === from) return
      const [layer] = draft.layers.splice(from, 1)
      draft.layers.splice(to, 0, layer)
    })
  },
}))

/** Calque sélectionné quand la sélection est unique. */
export function useSelectedLayer(): Layer | null {
  return useEditor((s) => (s.selection.length === 1 ? (s.project.layers.find((l) => l.id === s.selection[0]) ?? null) : null))
}

/** Vrai si le projet a changé depuis le dernier enregistrement (ou n'a jamais été enregistré). */
export function useIsDirty(): boolean {
  return useEditor((s) => s.project !== s.savedProject)
}
