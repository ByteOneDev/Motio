import {
  ArrowRight,
  AudioWaveform,
  Captions,
  Circle,
  Eye,
  EyeOff,
  EyeClosed,
  Film,
  Hexagon,
  Image,
  Lock,
  LockOpen,
  MessageSquare,
  Minus,
  Smile,
  Square,
  Star,
  Triangle,
  Type,
  Volume2,
  VolumeX,
  Wallpaper,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Layer } from '@/model/schema'
import { useEditor } from '@/store/editor'

export const LAYER_MIME = 'application/x-motio-layer'

function iconFor(layer: Layer, isVideo: boolean): ReactNode {
  if (layer.type === 'text') return <Type size={13} />
  if (layer.type === 'background') return <Wallpaper size={13} />
  if (layer.type === 'media') return isVideo ? <Film size={13} /> : <Image size={13} />
  if (layer.type === 'audio') return <AudioWaveform size={13} />
  if (layer.type === 'icon') return <Smile size={13} />
  if (layer.type === 'subtitles') return <Captions size={13} />
  if (layer.type === 'blur') return <EyeClosed size={13} />
  switch (layer.props.kind) {
    case 'hexagon':
      return <Hexagon size={13} />
    case 'bubble':
      return <MessageSquare size={13} />
    case 'triangle':
      return <Triangle size={13} />
    case 'star':
      return <Star size={13} />
    case 'ellipse':
      return <Circle size={13} />
    case 'line':
      return <Minus size={13} />
    case 'arrow':
      return <ArrowRight size={13} />
    default:
      return <Square size={13} />
  }
}

/**
 * En-tête de piste : nom du calque, boutons visibilité (ou son, pour l'audio) et verrou,
 * toujours affichés ; se glisse pour réordonner la pile.
 */
export function LayerHeader({
  layer,
  selected,
  dropBefore,
  onDragOverRow,
  onDropRow,
}: {
  layer: Layer
  selected: boolean
  dropBefore: boolean
  onDragOverRow: (before: boolean) => void
  onDropRow: (id: string) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const isVideo = useEditor(
    (s) => layer.type === 'media' && s.project.assets.find((a) => a.id === layer.props.assetId)?.kind === 'video',
  )
  const { updateLayer, select } = useEditor.getState()

  return (
    <div
      draggable={!renaming}
      onDragStart={(e) => {
        e.dataTransfer.setData(LAYER_MIME, layer.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(LAYER_MIME)) return
        e.preventDefault()
        const r = e.currentTarget.getBoundingClientRect()
        onDragOverRow(e.clientY < r.top + r.height / 2)
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(LAYER_MIME)
        if (id) onDropRow(id)
      }}
      onClick={(e) => {
        const { selection } = useEditor.getState()
        if (e.shiftKey || e.metaKey) {
          select(selection.includes(layer.id) ? selection.filter((id) => id !== layer.id) : [...selection, layer.id])
        } else {
          select([layer.id])
        }
      }}
      className={`group relative flex h-full cursor-default items-center gap-2 px-3 ${
        selected ? 'bg-accent-soft text-ui-text' : 'text-ui-text/85 hover:bg-ui-hover'
      }`}
    >
      {dropBefore && <span className="absolute -top-px right-1 left-1 h-0.5 rounded bg-accent" />}
      <span className="text-ui-muted">{iconFor(layer, isVideo)}</span>
      {renaming ? (
        <input
          autoFocus
          className="h-5 min-w-0 flex-1 rounded bg-ui-raised px-1 outline-none focus:ring-1 focus:ring-accent"
          defaultValue={layer.name}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => {
            const name = e.target.value.trim()
            if (name && name !== layer.name) updateLayer(layer.id, 'Renommer', (l) => void (l.name = name))
            setRenaming(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setRenaming(false)
          }}
        />
      ) : (
        <span className={`min-w-0 flex-1 truncate ${layer.visible ? '' : 'opacity-50'}`} onDoubleClick={() => setRenaming(true)} title="Double-cliquer pour renommer">
          {layer.name}
        </span>
      )}
      <RowToggle
        on={!layer.visible}
        title={layer.type === 'audio' ? (layer.visible ? 'Couper le son' : 'Rétablir le son') : layer.visible ? 'Masquer' : 'Afficher'}
        onClick={() => updateLayer(layer.id, layer.visible ? 'Masquer' : 'Afficher', (l) => void (l.visible = !l.visible))}
      >
        {layer.type === 'audio' ? (
          layer.visible ? <Volume2 size={13} /> : <VolumeX size={13} />
        ) : layer.visible ? (
          <Eye size={13} />
        ) : (
          <EyeOff size={13} />
        )}
      </RowToggle>
      <RowToggle
        on={layer.locked}
        title={layer.locked ? 'Déverrouiller' : 'Verrouiller (plus de modification ni de sélection sur le canevas)'}
        onClick={() => updateLayer(layer.id, layer.locked ? 'Déverrouiller' : 'Verrouiller', (l) => void (l.locked = !l.locked))}
      >
        {layer.locked ? <Lock size={13} /> : <LockOpen size={13} />}
      </RowToggle>
    </div>
  )
}

/** Bouton d'état : discret au repos, mis en évidence quand l'état est actif (masqué, verrouillé). */
function RowToggle({ on, title, onClick, children }: { on: boolean; title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`rounded p-1 hover:bg-ui-hover ${on ? 'text-amber-300' : 'text-ui-faint hover:text-ui-text'}`}
    >
      {children}
    </button>
  )
}
