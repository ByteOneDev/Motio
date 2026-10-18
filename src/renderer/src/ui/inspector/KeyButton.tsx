import { clearKeyframes, keyState, toggleKeyframe } from '@/engine/animate'
import type { AnimProp, Layer } from '@/model/schema'
import { useEditor } from '@/store/editor'
import { PROP_LABELS } from '../labels'

/**
 * Losange d'image clé à côté d'une propriété :
 * vide = non animée, contour = animée, plein = image clé à l'instant courant.
 */
export function KeyButton({ layer, prop }: { layer: Layer; prop: AnimProp }) {
  const time = useEditor((s) => s.time)
  const state = keyState(layer, prop, time)
  const label = PROP_LABELS[prop]
  const title =
    state === 'none'
      ? `Animer ${label.toLowerCase()} (ajoute une image clé ici)`
      : state === 'key'
        ? `Retirer l'image clé · Alt+clic : supprimer l'animation`
        : `Ajouter une image clé ici · Alt+clic : supprimer l'animation`

  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const { updateLayer } = useEditor.getState()
        if (e.altKey) updateLayer(layer.id, `Supprimer l'animation (${label})`, (l) => clearKeyframes(l, prop, time))
        else updateLayer(layer.id, `Image clé (${label})`, (l) => toggleKeyframe(l, prop, time))
        e.currentTarget.blur()
      }}
      className="flex h-7 w-6 shrink-0 items-center justify-center"
    >
      <span
        className={`block h-2 w-2 rotate-45 border ${
          state === 'key' ? 'border-accent bg-accent' : state === 'animated' ? 'border-accent' : 'border-ui-faint hover:border-ui-text'
        }`}
      />
    </button>
  )
}
