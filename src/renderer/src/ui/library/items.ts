import { findSound } from '@/audio/library'
import {
  createAudioLayer,
  createBackground,
  createBlur,
  createIcon,
  createProject,
  createShape,
  createSubtitles,
  createText,
  generatedAsset,
  newId,
  SHAPE_PRESETS,
  TEXT_STYLES,
} from '@/model/factories'
import { ICONS } from '@/model/icons'
import type { Layer, Project } from '@/model/schema'
import { instantiateTemplate, TEMPLATES, type Template } from '@/model/templates'
import { lastFrame, useEditor } from '@/store/editor'

export interface LibraryItem {
  id: string
  label: string
  create: (project: Project, at?: { x: number; y: number }) => Layer
}

export const TEXT_ITEMS: LibraryItem[] = TEXT_STYLES.map((style) => ({
  id: `text:${style.id}`,
  label: style.label,
  create: (p, at) => createText(p, style.id, at),
}))

export const SHAPE_ITEMS: LibraryItem[] = SHAPE_PRESETS.map((preset) => ({
  id: `shape:${preset.id}`,
  label: preset.label,
  create: (p, at) => createShape(p, preset.id, at),
}))

export const ICON_ITEMS: LibraryItem[] = ICONS.map((icon) => ({
  id: `icon:${icon.id}`,
  label: icon.label,
  create: (p, at) => createIcon(p, icon.id, icon.label, at),
}))

/** Outils de tutoriel : zones de masquage (la piste de sous-titres s'ajoute à part). */
export const MASK_ITEMS: LibraryItem[] = [
  { id: 'blur:blur', label: 'Flou', create: (p, at) => createBlur(p, 'blur', at) },
  { id: 'blur:pixelate', label: 'Pixellisation', create: (p, at) => createBlur(p, 'pixelate', at) },
]

export function findItem(id: string): LibraryItem | undefined {
  return [...TEXT_ITEMS, ...SHAPE_ITEMS, ...ICON_ITEMS, ...MASK_ITEMS].find((item) => item.id === id)
}

/** Une seule piste de sous-titres suffit en général : on sélectionne celle qui existe déjà. */
export function addSubtitles(): void {
  const s = useEditor.getState()
  const existing = s.project.layers.find((l) => l.type === 'subtitles')
  if (existing) {
    s.select([existing.id])
    return
  }
  s.addLayer(createSubtitles(s.project))
}

/**
 * Ajoute une musique ou un bruitage à la tête de lecture. Une musique joue en boucle
 * jusqu'à la fin du projet ; le son est réutilisé s'il est déjà dans le projet.
 */
export function addSound(soundId: string): void {
  const def = findSound(soundId)
  if (!def) return
  const s = useEditor.getState()
  const existing = s.project.assets.find((a) => a.generated === soundId)
  const asset = existing ?? generatedAsset(soundId, def.label, def.duration)
  const music = def.kind === 'music'
  const layer = createAudioLayer(s.project, asset, music && s.time < 0.5 ? 0 : s.time, { loop: def.loop, music, bpm: def.bpm ?? null })
  s.update(`Ajouter ${def.label}`, (draft) => {
    if (!existing) draft.assets.push(asset)
    draft.layers.push(layer)
  })
  s.select([layer.id])
}

/** Type MIME utilisé pour glisser un élément de la bibliothèque vers le canevas. */
export const LIBRARY_MIME = 'application/x-motio-item'
/** Type MIME utilisé pour glisser un média importé vers le canevas. */
export const ASSET_MIME = 'application/x-motio-asset'

/** Insère un modèle de scène à la tête de lecture et sélectionne ses calques. */
export function insertTemplate(template: Template): void {
  const s = useEditor.getState()
  const { layers, assets } = instantiateTemplate(template, s.project, s.time)
  s.update(`Modèle : ${template.label}`, (draft) => {
    draft.assets.push(...assets)
    draft.layers.push(...layers)
  })
  s.select(layers.map((l) => l.id))
  // Aperçu immédiat de la scène insérée.
  if (layers.length) {
    const from = Math.min(...layers.map((l) => l.start))
    const to = Math.min(Math.max(...layers.map((l) => l.end)), lastFrame(s.project))
    s.play({ from, to })
  }
}

/**
 * Applique un fond : remplace celui qui est sélectionné, sinon en ajoute un tout en bas de la pile.
 */
export function applyBackground(presetId: string): void {
  const s = useEditor.getState()
  const fresh = createBackground(s.project, presetId)
  const selected = s.project.layers.find((l) => s.selection.includes(l.id) && l.type === 'background')
  if (selected) {
    s.updateLayer(selected.id, 'Changer le fond', (l) => {
      if (l.type !== 'background') return
      l.props = fresh.props
      l.name = fresh.name
    })
    return
  }
  s.update('Ajouter un fond', (draft) => {
    draft.layers.unshift(fresh)
  })
  s.select([fresh.id])
}

// --- Projets miniatures pour les aperçus de la bibliothèque --------------------

function thumbProject(): Project {
  const p = createProject()
  p.id = newId()
  p.layers = [createBackground(p, 'night')]
  return p
}

const cache = new Map<string, Project>()

export function templateThumb(template: Template): Project {
  let p = cache.get(`tpl:${template.id}`)
  if (!p) {
    p = thumbProject()
    p.layers.push(...instantiateTemplate(template, p, 0).layers)
    cache.set(`tpl:${template.id}`, p)
  }
  return p
}

export function backgroundThumb(presetId: string): Project {
  let p = cache.get(`bg:${presetId}`)
  if (!p) {
    p = thumbProject()
    p.layers = [createBackground(p, presetId)]
    cache.set(`bg:${presetId}`, p)
  }
  return p
}

export { TEMPLATES }
