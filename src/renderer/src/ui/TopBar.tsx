import { Download, FilePlus2, FolderOpen, Maximize, Minus, Plus, Redo2, Save, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEditor, useIsDirty } from '@/store/editor'
import { newProject, openExport, openProject, saveProject } from './fileActions'
import { useRecording } from './recording/recorder'
import { effectiveZoom, useView } from '@/store/view'

const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4, 8]

function BarButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-ui-muted [-webkit-app-region:no-drag] hover:bg-ui-hover hover:text-ui-text disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}

/** La marque : une courbe d'animation qui aboutit à une image clé. */
function Logo() {
  return (
    <svg width="18" height="18" viewBox="100 100 824 824" aria-hidden>
      <defs>
        <linearGradient id="motio-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f6bff" />
          <stop offset="0.55" stopColor="#6c4cf5" />
          <stop offset="1" stopColor="#ff4d8d" />
        </linearGradient>
      </defs>
      <rect x="100" y="100" width="824" height="824" rx="186" fill="url(#motio-logo)" />
      <path d="M 300 712 C 540 712, 484 320, 712 320" fill="none" stroke="#fff" strokeWidth="80" strokeLinecap="round" />
      <circle cx="300" cy="712" r="64" fill="#fff" />
      <rect x="652" y="260" width="120" height="120" rx="18" fill="#ffd60a" transform="rotate(45 712 320)" />
    </svg>
  )
}

export function TopBar({ className = '' }: { className?: string }) {
  const name = useEditor((s) => s.project.name)
  const filePath = useEditor((s) => s.filePath)
  const dirty = useIsDirty()
  const mod = window.motio?.platform === 'darwin' || !window.motio ? '⌘' : 'Ctrl+'
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const view = useView()
  const zoom = effectiveZoom(view)
  const isMac = window.motio?.platform === 'darwin'

  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < zoom - 0.001)
    if (next) view.zoomTo(next)
  }

  return (
    <header
      className={`flex items-center gap-3 border-b border-ui-line bg-ui-panel pr-3 [-webkit-app-region:drag] ${isMac ? 'pl-[84px]' : 'pl-3'} ${className}`}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-bold tracking-tight">
        <Logo />
        Motio
      </span>
      <div className="flex items-center gap-0.5">
        <BarButton title={`Nouveau projet (${mod}N)`} onClick={newProject}>
          <FilePlus2 size={15} />
        </BarButton>
        <BarButton title={`Ouvrir… (${mod}O)`} onClick={openProject}>
          <FolderOpen size={15} />
        </BarButton>
        <BarButton title={`Enregistrer (${mod}S)`} onClick={() => saveProject()}>
          <Save size={15} />
        </BarButton>
      </div>
      <div className="h-4 w-px bg-ui-line" />
      <div className="flex items-center gap-0.5">
        <BarButton title="Annuler (⌘Z)" disabled={!canUndo} onClick={() => useEditor.getState().undo()}>
          <Undo2 size={15} />
        </BarButton>
        <BarButton title="Rétablir (⇧⌘Z)" disabled={!canRedo} onClick={() => useEditor.getState().redo()}>
          <Redo2 size={15} />
        </BarButton>
      </div>

      <div className="min-w-0 flex-1 truncate text-center text-[12px] text-ui-muted" title={filePath ?? 'Jamais enregistré'}>
        {name}
        {dirty && <span className="ml-1.5 text-ui-faint">— modifié</span>}
      </div>

      <div className="flex items-center gap-0.5">
        <BarButton title="Zoom arrière" onClick={() => step(-1)}>
          <Minus size={14} />
        </BarButton>
        <BarButton title="Taille réelle (⇧0)" onClick={() => view.zoomTo(1)}>
          <span className="w-10 text-[11px] text-ui-text tabular-nums">{Math.round(zoom * 100)} %</span>
        </BarButton>
        <BarButton title="Zoom avant" onClick={() => step(1)}>
          <Plus size={14} />
        </BarButton>
        <BarButton title="Ajuster à la fenêtre (⇧1)" onClick={() => view.fitToScreen()}>
          <Maximize size={14} />
        </BarButton>
      </div>
      <button
        type="button"
        onClick={() => useRecording.getState().setDialogOpen(true)}
        title="Enregistrer l’écran ou une voix off"
        className="flex h-7 items-center gap-1.5 rounded-md bg-ui-raised px-2.5 text-[12px] text-ui-text [-webkit-app-region:no-drag] hover:bg-ui-hover"
      >
        <span className="h-2 w-2 rounded-full bg-red-500" /> Enregistrer
      </button>
      <button
        type="button"
        onClick={openExport}
        title={`Exporter en vidéo ou en image (${mod}E)`}
        className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-white [-webkit-app-region:no-drag] hover:brightness-110"
      >
        <Download size={14} /> Exporter
      </button>
    </header>
  )
}
