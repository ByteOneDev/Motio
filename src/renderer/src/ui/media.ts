import type { MediaResolver } from '@/engine/render'
import { createAudioLayer, createMedia, newId } from '@/model/factories'
import type { Asset } from '@/model/schema'
import { useEditor } from '@/store/editor'
import { mediaUrl } from '../../../shared/api'

/**
 * Décodage des médias pour l'aperçu. Les images sont décodées une fois ; chaque vidéo a son
 * élément <video>, calé sur la tête de lecture (lecture native pendant la lecture, recherche à l'arrêt).
 */
const images = new Map<string, HTMLImageElement>()
const videos = new Map<string, HTMLVideoElement>()
const usedThisFrame = new Set<string>()
const listeners = new Set<() => void>()

/** Prévient quand un média devient disponible ou change d'image (pour redessiner). */
export function onMediaChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const notify = () => listeners.forEach((l) => l())

function videoFor(asset: Asset): HTMLVideoElement {
  let v = videos.get(asset.id)
  if (!v) {
    v = document.createElement('video')
    // Lecture en CORS : le canvas reste exploitable pour l'export.
    v.crossOrigin = 'anonymous'
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.src = asset.src
    v.addEventListener('loadeddata', notify)
    v.addEventListener('seeked', notify)
    videos.set(asset.id, v)
  }
  return v
}

export const browserMedia: MediaResolver = (asset, time) => {
  usedThisFrame.add(asset.id)
  if (asset.kind === 'image') {
    let img = images.get(asset.id)
    if (!img) {
      img = new Image()
      img.onload = notify
      img.src = asset.src
      images.set(asset.id, img)
    }
    return img.complete && img.naturalWidth > 0 ? img : null
  }

  const v = videoFor(asset)
  if (v.readyState < 2) return null
  const target = Math.min(time, Math.max(0, asset.duration - 0.05))
  if (useEditor.getState().playing) {
    if (v.paused) v.play().catch(() => {})
    // On ne recale la vidéo que si elle a dérivé, pour garder une lecture fluide.
    if (Math.abs(v.currentTime - target) > 0.25) v.currentTime = target
  } else {
    if (!v.paused) v.pause()
    if (!v.seeking && Math.abs(v.currentTime - target) > 0.5 / 60) v.currentTime = target
  }
  return v
}

/** À appeler après chaque image : met en pause les vidéos qui ne sont plus à l'écran. */
export function endMediaFrame(): void {
  for (const [id, v] of videos) if (!usedThisFrame.has(id) && !v.paused) v.pause()
  usedThisFrame.clear()
}

// --- Import ------------------------------------------------------------------

export const ACCEPTED_MEDIA =
  'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac'

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function importFile(file: File): Promise<Asset | null> {
  const path = window.motio?.pathForFile(file) || null
  if (file.type.startsWith('image/')) {
    // Les images sont intégrées au projet (URL data) : elles voyagent avec le fichier .motio.
    const src = await readAsDataUrl(file)
    const img = new Image()
    img.src = src
    await img.decode()
    return { id: newId(), kind: 'image', name: file.name, src, path, width: img.naturalWidth || 512, height: img.naturalHeight || 512, duration: 0, generated: null }
  }
  if (file.type.startsWith('video/')) {
    // Application de bureau : la vidéo est lue depuis le disque (et retrouvée à la réouverture du projet).
    const src = path ? mediaUrl(path) : URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.src = src
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve()
      v.onerror = () => reject(new Error(`Vidéo illisible : ${file.name}`))
    })
    return { id: newId(), kind: 'video', name: file.name, src, path, width: v.videoWidth || 1280, height: v.videoHeight || 720, duration: v.duration || 0, generated: null }
  }
  if (file.type.startsWith('audio/')) {
    // Comme les vidéos : lu depuis le disque dans l'application de bureau.
    const src = path ? mediaUrl(path) : URL.createObjectURL(file)
    const a = new Audio()
    a.preload = 'metadata'
    a.src = src
    await new Promise<void>((resolve, reject) => {
      a.onloadedmetadata = () => resolve()
      a.onerror = () => reject(new Error(`Son illisible : ${file.name}`))
    })
    return { id: newId(), kind: 'audio', name: file.name, src, path, width: 1, height: 1, duration: a.duration || 0, generated: null }
  }
  return null
}

/** Importe des fichiers ; avec `at`, place aussi un calque par fichier à cet endroit. */
export async function importFiles(files: File[], at?: { x: number; y: number }, placeLayers = true): Promise<number> {
  const results = await Promise.allSettled(files.map((f) => importFile(f)))
  for (const r of results) if (r.status === 'rejected') console.warn('Import impossible :', r.reason)
  const assets = results.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
  if (assets.length === 0) return 0
  const s = useEditor.getState()
  const added: string[] = []
  s.update(assets.length > 1 ? `Importer ${assets.length} médias` : `Importer ${assets[0].name}`, (draft) => {
    draft.assets.push(...assets)
    if (!placeLayers) return
    assets.forEach((asset, i) => {
      const start = Math.min(s.time, Math.max(0, draft.duration - 0.5))
      if (asset.kind === 'audio') {
        const layer = createAudioLayer(draft, asset, start)
        draft.layers.push(layer)
        added.push(layer.id)
        return
      }
      const offset = i * 40
      const layer = createMedia(draft, asset, at ? { x: at.x + offset, y: at.y + offset } : undefined)
      layer.start = start
      layer.end = Math.min(draft.duration, layer.start + (asset.kind === 'video' ? Math.max(0.5, asset.duration) : draft.duration))
      draft.layers.push(layer)
      added.push(layer.id)
    })
  })
  if (added.length) s.select(added)
  return assets.length
}

export function hasFiles(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes('Files')
}
