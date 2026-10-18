import { useEffect, useSyncExternalStore } from 'react'
import { clearMeasureCache } from '@/engine/measure'
import { fontString } from '@/engine/text'
import type { Layer } from '@/model/schema'
import { useEditor } from '@/store/editor'

let version = 0
const subscribers = new Set<() => void>()

// Une police vient de finir de charger : les mesures de texte en cache sont fausses.
document.fonts.addEventListener('loadingdone', () => {
  clearMeasureCache()
  version++
  subscribers.forEach((s) => s())
})

/** Change à chaque chargement de police : à mettre dans les dépendances d'un rendu canvas. */
export function useFontsVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      subscribers.add(cb)
      return () => subscribers.delete(cb)
    },
    () => version,
  )
}

/** Polices (au format CSS `font`) utilisées par les textes et les sous-titres. */
export function layerFonts(layers: Layer[]): string[] {
  return layers.flatMap((l) => {
    if (l.type === 'text') return [fontString({ ...l.props, fontSize: 32 })]
    if (l.type === 'subtitles') return [`${l.props.style.fontWeight} 32px ${l.props.style.fontFamily}`]
    return []
  })
}

/** Le canvas ne déclenche pas le chargement des polices : on le demande explicitement. */
export function ensureFonts(layers: Layer[]): void {
  for (const font of layerFonts(layers)) {
    if (!document.fonts.check(font)) document.fonts.load(font).catch(() => {})
  }
}

export function useProjectFonts(): void {
  const layers = useEditor((s) => s.project.layers)
  useEffect(() => ensureFonts(layers), [layers])
}
