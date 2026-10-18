import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowLeftToLine,
  ArrowRightToLine,
  AudioLines,
  Blend,
  BringToFront,
  ChevronLeft,
  ChevronRight,
  Copy,
  DiamondPlus,
  Layers2,
  Magnet,
  Pause,
  Play,
  Repeat,
  Scissors,
  SendToBack,
  SkipBack,
  SkipForward,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { OVERLAY_TRANSITIONS } from '@/model/editing'
import { lastFrame, useEditor } from '@/store/editor'
import { useView } from '@/store/view'
import { addKeyframes, addTransition, align, alignToBeats, arrange, crossfadeSelection, distribute, splitAtPlayhead, trimSelection } from '../editActions'
import { formatTime } from '../labels'
import { Menu, type MenuEntry } from '../Menu'

function Tool({ title, onClick, active, disabled, children }: { title: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => {
        onClick()
        // Le focus resterait sur le bouton et capterait la barre d'espace.
        e.currentTarget.blur()
      }}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1 ${
        active ? 'bg-accent-soft text-ui-text' : 'text-ui-muted hover:bg-ui-hover hover:text-ui-text'
      } disabled:pointer-events-none disabled:opacity-30`}
    >
      {children}
    </button>
  )
}

const Separator = () => <div className="mx-1 h-4 w-px bg-ui-line" />

const TRANSITION_ITEMS: MenuEntry[] = [
  {
    label: 'Fondu enchaîné',
    hint: 'Entre deux calques sélectionnés qui se suivent',
    icon: <Blend size={14} />,
    onClick: crossfadeSelection,
  },
  'separator',
  ...OVERLAY_TRANSITIONS.map((t) => ({ label: t.label, hint: `${t.hint} — à la tête de lecture`, onClick: () => addTransition(t.id) })),
]

const ALIGN_ITEMS: MenuEntry[] = [
  { label: 'Aligner à gauche', icon: <AlignStartVertical size={14} />, onClick: () => align('left') },
  { label: 'Centrer horizontalement', icon: <AlignCenterVertical size={14} />, onClick: () => align('hcenter') },
  { label: 'Aligner à droite', icon: <AlignEndVertical size={14} />, onClick: () => align('right') },
  'separator',
  { label: 'Aligner en haut', icon: <AlignStartHorizontal size={14} />, onClick: () => align('top') },
  { label: 'Centrer verticalement', icon: <AlignCenterHorizontal size={14} />, onClick: () => align('vcenter') },
  { label: 'Aligner en bas', icon: <AlignEndHorizontal size={14} />, onClick: () => align('bottom') },
  'separator',
  { label: 'Répartir horizontalement', hint: 'Trois éléments ou plus', icon: <AlignHorizontalDistributeCenter size={14} />, onClick: () => distribute('x') },
  { label: 'Répartir verticalement', hint: 'Trois éléments ou plus', icon: <AlignVerticalDistributeCenter size={14} />, onClick: () => distribute('y') },
]

const ORDER_ITEMS: MenuEntry[] = [
  { label: 'Premier plan', icon: <BringToFront size={14} />, shortcut: '⇧⌘]', onClick: () => arrange('front') },
  { label: 'Avancer', shortcut: '⌘]', onClick: () => arrange('forward') },
  { label: 'Reculer', shortcut: '⌘[', onClick: () => arrange('backward') },
  { label: 'Arrière-plan', icon: <SendToBack size={14} />, shortcut: '⇧⌘[', onClick: () => arrange('back') },
]

/**
 * Barre entre l'aperçu et la timeline : outils de montage à gauche, lecture au centre,
 * aimantation et zoom de la timeline à droite.
 */
export function EditBar() {
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const loop = useEditor((s) => s.loop)
  const duration = useEditor((s) => s.project.duration)
  const fps = useEditor((s) => s.project.fps)
  const hasSelection = useEditor((s) => s.selection.length > 0)
  const snapping = useView((s) => s.snapping)
  const zoom = useView((s) => s.timelineZoom)
  const setView = useView((s) => s.setView)
  const s = useEditor.getState

  return (
    <div className="grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-ui-line px-2">
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
        <Tool title="Couper à la tête de lecture (⌘B) — la sélection, ou tout ce qui est sous la tête de lecture" onClick={splitAtPlayhead}>
          <Scissors size={15} />
        </Tool>
        <Menu label="Transition" icon={<Blend size={15} />} title="Ajouter une transition" items={TRANSITION_ITEMS} />
        <Tool title="Début ici : recadrer le début des calques sélectionnés sur la tête de lecture" onClick={() => trimSelection('start')} disabled={!hasSelection}>
          <ArrowRightToLine size={15} />
        </Tool>
        <Tool title="Fin ici : recadrer la fin des calques sélectionnés sur la tête de lecture" onClick={() => trimSelection('end')} disabled={!hasSelection}>
          <ArrowLeftToLine size={15} />
        </Tool>
        <Separator />
        <Tool title="Dupliquer (⌘D)" onClick={() => s().duplicateLayers(s().selection)} disabled={!hasSelection}>
          <Copy size={15} />
        </Tool>
        <Tool title="Supprimer (⌫)" onClick={() => s().removeLayers(s().selection)} disabled={!hasSelection}>
          <Trash2 size={15} />
        </Tool>
        <Separator />
        <Menu label="Aligner" icon={<AlignCenterVertical size={15} />} title="Aligner et répartir" items={ALIGN_ITEMS} />
        <Menu label="Ordre" icon={<Layers2 size={15} />} title="Ordre dans la pile" items={ORDER_ITEMS} />
        <Tool title="Image clé : fige position, échelle, rotation et opacité ici (K)" onClick={addKeyframes} disabled={!hasSelection}>
          <DiamondPlus size={15} />
        </Tool>
        <Tool title="Caler sur les temps : chaque élément sélectionné démarre sur un temps de la musique" onClick={alignToBeats} disabled={!hasSelection}>
          <AudioLines size={15} />
        </Tool>
      </div>

      <div className="flex items-center gap-1">
        <Tool title="Début (↖)" onClick={() => s().setTime(0)}>
          <SkipBack size={14} />
        </Tool>
        <Tool title="Image précédente (,)" onClick={() => s().setTime(s().time - 1 / fps)}>
          <ChevronLeft size={15} />
        </Tool>
        <button
          type="button"
          title={playing ? 'Pause (espace)' : 'Lecture (espace)'}
          onClick={(e) => {
            s().togglePlay()
            e.currentTarget.blur()
          }}
          className="flex h-7 w-9 items-center justify-center rounded bg-accent text-white hover:brightness-110"
        >
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
        <Tool title="Image suivante (.)" onClick={() => s().setTime(s().time + 1 / fps)}>
          <ChevronRight size={15} />
        </Tool>
        <Tool title="Fin (↘)" onClick={() => s().setTime(lastFrame(s().project))}>
          <SkipForward size={14} />
        </Tool>
        <Tool title={loop ? 'Lecture en boucle : activée' : 'Lecture en boucle : désactivée'} active={loop} onClick={() => s().setLoop(!loop)}>
          <Repeat size={14} />
        </Tool>
        <div className="ml-2 w-32 text-[12px] whitespace-nowrap text-ui-text tabular-nums">
          {formatTime(time)}
          <span className="text-ui-faint"> / {formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-0.5 overflow-hidden">
        <Tool title={snapping ? 'Aimantation activée (canevas et timeline)' : 'Aimantation désactivée'} active={snapping} onClick={() => setView({ snapping: !snapping })}>
          <Magnet size={15} />
        </Tool>
        <Separator />
        <Tool title="Dézoomer la timeline" onClick={() => setView({ timelineZoom: Math.max(1, zoom / 1.5) })}>
          <ZoomOut size={14} />
        </Tool>
        <input
          type="range"
          min={1}
          max={12}
          step={0.1}
          value={zoom}
          onChange={(e) => setView({ timelineZoom: Number(e.target.value) })}
          className="h-1 w-20 min-w-8 shrink accent-accent"
          title="Zoom de la timeline"
        />
        <Tool title="Zoomer la timeline" onClick={() => setView({ timelineZoom: Math.min(12, zoom * 1.5) })}>
          <ZoomIn size={14} />
        </Tool>
      </div>
    </div>
  )
}
