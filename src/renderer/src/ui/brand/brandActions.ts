import { createMedia, createText, newId, unit } from '@/model/factories'
import type { Asset } from '@/model/schema'
import { useEditor } from '@/store/editor'
import { notify } from '../toast'
import { useBrand } from '../brand'

/** Ajoute le logo de la marque en haut à droite (réutilise l'image si elle est déjà dans le projet). */
export function addLogo(): void {
  const { logo } = useBrand.getState().brand
  if (!logo) return
  const s = useEditor.getState()
  const existing = s.project.assets.find((a) => a.kind === 'image' && a.src === logo.src)
  const asset: Asset = existing ?? { id: newId(), kind: 'image', name: logo.name, src: logo.src, path: null, width: logo.width, height: logo.height, duration: 0, generated: null }
  const layer = createMedia(s.project, asset)
  const u = unit(s.project)
  const h = 120 * u
  const w = (h * logo.width) / logo.height
  const margin = 60 * u
  Object.assign(layer.transform, { width: w, height: h, x: s.project.width - margin - w / 2, y: margin + h / 2 })
  Object.assign(layer.props, { fit: 'contain', radius: 0, shadow: false })
  layer.name = 'Logo'
  s.update('Ajouter le logo', (draft) => {
    if (!existing) draft.assets.push(asset)
    draft.layers.push(layer)
  })
  s.select([layer.id])
}

/** Titre ou texte dans les polices de la marque. */
export function addBrandText(kind: 'title' | 'text'): void {
  const { brand } = useBrand.getState()
  const s = useEditor.getState()
  const layer = createText(s.project, kind === 'title' ? 'title' : 'body')
  const font = kind === 'title' ? brand.titleFont : brand.textFont
  if (font) layer.props.fontFamily = font
  s.addLayer(layer)
}

/** Les couleurs de la marque deviennent la charte du projet (proposées sous chaque couleur). */
export function applyBrandColors(): void {
  const { colors } = useBrand.getState().brand
  if (colors.length === 0) return
  useEditor.getState().update('Appliquer les couleurs de la marque', (d) => void (d.palette = [...colors]))
  notify('Couleurs de la marque appliquées à la charte du projet.')
}
