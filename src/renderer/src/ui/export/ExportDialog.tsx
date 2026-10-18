import { Film, FolderOpen, Image as ImageIcon, Images, Layers, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  exportPngFrame,
  exportPngSequence,
  exportSize,
  exportVideo,
  frameCount,
  supportsTransparency,
  type ExportFormat,
  type ExportProgress,
  type ExportQuality,
  type ExportSettings,
} from '@/export/exporter'
import { useEditor } from '@/store/editor'
import type { ExportKind } from '../../../../shared/api'
import { useView } from '@/store/view'
import { download } from '../fileActions'
import { formatTime } from '../labels'
import { NumberField, Row, Segmented } from '../inspector/fields'

interface FormatOption {
  id: ExportFormat
  label: string
  hint: string
  icon: ReactNode
  /** Une séquence d'images s'écrit dans un dossier : application de bureau uniquement. */
  desktopOnly?: boolean
}

const FORMATS: FormatOption[] = [
  { id: 'mp4', label: 'Vidéo MP4', hint: 'Pour le montage, YouTube, les réseaux', icon: <Film size={18} /> },
  { id: 'webm', label: 'WebM transparent', hint: 'À incruster par-dessus une autre vidéo', icon: <Layers size={18} /> },
  { id: 'png-sequence', label: 'Séquence PNG', hint: 'Transparente, lue par tous les logiciels', icon: <Images size={18} />, desktopOnly: true },
  { id: 'png-frame', label: 'Image PNG', hint: 'L’image courante (miniature…)', icon: <ImageIcon size={18} /> },
]

const QUALITIES: { value: ExportQuality; icon: ReactNode; title: string }[] = [
  { value: 'medium', icon: <span className="text-[11px]">Standard</span>, title: 'Fichier léger' },
  { value: 'high', icon: <span className="text-[11px]">Haute</span>, title: 'Recommandé' },
  { value: 'very-high', icon: <span className="text-[11px]">Maximale</span>, title: 'Pour retravailler la vidéo' },
]

const SCALES = [0.5, 1, 2]

type Phase =
  | { kind: 'settings' }
  | { kind: 'running'; progress: ExportProgress; startedAt: number }
  | { kind: 'done'; path: string | null; seconds: number }
  | { kind: 'error'; message: string }

const EXTENSIONS: Record<ExportFormat, ExportKind> = {
  mp4: 'mp4',
  webm: 'webm',
  'png-sequence': 'folder',
  'png-frame': 'png',
}

export function ExportDialog() {
  const open = useView((s) => s.exportOpen)
  return open ? <Dialog /> : null
}

function Dialog() {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const desktop = !!window.motio
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'mp4',
    scale: 1,
    quality: 'high',
    transparent: true,
    from: 0,
    to: project.duration,
  })
  const [phase, setPhase] = useState<Phase>({ kind: 'settings' })
  const abort = useRef<AbortController | null>(null)
  const close = () => {
    abort.current?.abort()
    useView.getState().setExportOpen(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase.kind !== 'running') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const set = (patch: Partial<ExportSettings>) => setSettings((s) => ({ ...s, ...patch }))
  const size = exportSize(project, settings.scale)
  const isFrame = settings.format === 'png-frame'
  const transparent = settings.transparent && supportsTransparency(settings.format)
  const total = frameCount(project, settings)

  const run = async () => {
    const motio = window.motio
    const name = project.name
    let path: string | null = null
    if (motio) {
      path = await motio.chooseExportPath(name, EXTENSIONS[settings.format])
      if (!path) return
    }
    const controller = new AbortController()
    abort.current = controller
    const startedAt = performance.now()
    const finalSettings = { ...settings, transparent }
    const onProgress = (progress: ExportProgress) => setPhase({ kind: 'running', progress, startedAt })
    setPhase({ kind: 'running', progress: { frame: 0, total: isFrame ? 1 : total }, startedAt })

    try {
      if (settings.format === 'png-frame') {
        const data = await exportPngFrame(project, time, finalSettings)
        if (motio && path) await motio.writeExport(path, data)
        else download(new Blob([data], { type: 'image/png' }), `${name}.png`)
      } else if (settings.format === 'png-sequence') {
        if (!motio || !path) throw new Error('La séquence PNG n’est disponible que dans l’application de bureau.')
        const folder = path
        await exportPngSequence(project, finalSettings, (file, data) => motio.writeExport(folder, data, file), onProgress, controller.signal)
      } else {
        const data = await exportVideo(project, finalSettings, onProgress, controller.signal)
        const type = settings.format === 'mp4' ? 'video/mp4' : 'video/webm'
        if (motio && path) await motio.writeExport(path, data)
        else download(new Blob([data], { type }), `${name}.${settings.format}`)
      }
      setPhase({ kind: 'done', path, seconds: (performance.now() - startedAt) / 1000 })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setPhase({ kind: 'settings' })
      else setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      abort.current = null
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]" onPointerDown={(e) => e.target === e.currentTarget && phase.kind !== 'running' && close()}>
      <div className="w-[520px] max-w-[calc(100vw-32px)] rounded-xl border border-ui-line bg-ui-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-ui-line px-4 py-3">
          <h2 className="text-[14px] font-semibold">Exporter « {project.name} »</h2>
          {phase.kind !== 'running' && (
            <button type="button" onClick={close} className="rounded p-1 text-ui-muted hover:bg-ui-hover hover:text-ui-text" title="Fermer (Échap)">
              <X size={16} />
            </button>
          )}
        </header>

        {phase.kind === 'settings' && (
          <div className="flex flex-col gap-4 p-4">
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.filter((f) => desktop || !f.desktopOnly).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => set({ format: f.id })}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left ${
                    settings.format === f.id ? 'border-accent bg-accent-soft' : 'border-ui-line bg-ui-raised hover:border-accent/50'
                  }`}
                >
                  <span className={settings.format === f.id ? 'text-ui-text' : 'text-ui-muted'}>{f.icon}</span>
                  <span>
                    <span className="block text-[13px] font-medium">{f.label}</span>
                    <span className="block text-[11px] leading-snug text-ui-faint">{f.hint}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <span className="w-20 text-[12px] text-ui-muted">Résolution</span>
                <div className="flex-1">
                  <Segmented
                    value={String(settings.scale)}
                    onChange={(v) => set({ scale: Number(v) })}
                    options={SCALES.map((s) => {
                      const d = exportSize(project, s)
                      return { value: String(s), icon: <span className="text-[11px]">{`${d.width} × ${d.height}`}</span>, title: `${s * 100} %` }
                    })}
                  />
                </div>
              </div>

              {!isFrame && settings.format !== 'png-sequence' && (
                <div className="flex items-center gap-3">
                  <span className="w-20 text-[12px] text-ui-muted">Qualité</span>
                  <div className="flex-1">
                    <Segmented value={settings.quality} onChange={(quality) => set({ quality })} options={QUALITIES} />
                  </div>
                </div>
              )}

              {supportsTransparency(settings.format) && (
                <label className="flex cursor-pointer items-center gap-3">
                  <span className="w-20 text-[12px] text-ui-muted">Fond</span>
                  <input type="checkbox" className="accent-accent" checked={settings.transparent} onChange={(e) => set({ transparent: e.target.checked })} />
                  <span className="text-[12px]">Transparent (sans les fonds : seuls les éléments sont exportés)</span>
                </label>
              )}

              {!isFrame ? (
                <div className="flex items-center gap-3">
                  <span className="w-20 text-[12px] text-ui-muted">Plage</span>
                  <div className="flex-1">
                    <Row>
                      <NumberField label="De" value={settings.from} min={0} max={settings.to - 1 / project.fps} step={0.1} precision={2} suffix="s" onChange={(from) => set({ from })} />
                      <NumberField label="À" value={settings.to} min={settings.from + 1 / project.fps} max={project.duration} step={0.1} precision={2} suffix="s" onChange={(to) => set({ to })} />
                    </Row>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-ui-faint">Image à {formatTime(time)} (tête de lecture).</p>
              )}
            </div>

            {transparent && settings.format === 'webm' && (
              <p className="rounded-md bg-ui-raised px-3 py-2 text-[11px] leading-snug text-ui-faint">
                Le WebM transparent se lit dans les navigateurs, OBS et DaVinci Resolve. Pour Premiere ou Final Cut, préférez la séquence PNG.
              </p>
            )}

            <footer className="flex items-center justify-between border-t border-ui-line pt-3">
              <span className="text-[11px] text-ui-faint">
                {size.width} × {size.height}
                {!isFrame && ` · ${total} images · ${formatTime(settings.to - settings.from)} · ${project.fps} i/s`}
              </span>
              <button type="button" onClick={run} className="rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-white hover:brightness-110">
                Exporter
              </button>
            </footer>
          </div>
        )}

        {phase.kind === 'running' && <Running phase={phase} onCancel={() => abort.current?.abort()} />}

        {phase.kind === 'done' && (
          <div className="flex flex-col gap-4 p-4">
            <p className="text-[13px]">
              ✓ Export terminé en {phase.seconds.toFixed(1).replace('.', ',')} s.
            </p>
            {phase.path && <p className="truncate text-[11px] text-ui-faint" title={phase.path}>{phase.path}</p>}
            <footer className="flex justify-end gap-2">
              {phase.path && (
                <button
                  type="button"
                  onClick={() => window.motio?.revealInFinder(phase.path!)}
                  className="flex items-center gap-1.5 rounded-md bg-ui-raised px-3 py-2 text-[12px] hover:bg-ui-hover"
                >
                  <FolderOpen size={14} /> Afficher dans le Finder
                </button>
              )}
              <button type="button" onClick={close} className="rounded-md bg-accent px-4 py-2 text-[12px] font-medium text-white hover:brightness-110">
                Fermer
              </button>
            </footer>
          </div>
        )}

        {phase.kind === 'error' && (
          <div className="flex flex-col gap-4 p-4">
            <p className="text-[13px] text-red-300">L’export a échoué : {phase.message}</p>
            <footer className="flex justify-end gap-2">
              <button type="button" onClick={() => setPhase({ kind: 'settings' })} className="rounded-md bg-ui-raised px-3 py-2 text-[12px] hover:bg-ui-hover">
                Modifier les réglages
              </button>
              <button type="button" onClick={close} className="rounded-md bg-accent px-4 py-2 text-[12px] font-medium text-white">
                Fermer
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}

function Running({ phase, onCancel }: { phase: Extract<Phase, { kind: 'running' }>; onCancel: () => void }) {
  const { frame, total } = phase.progress
  const ratio = total ? frame / total : 0
  const elapsed = (performance.now() - phase.startedAt) / 1000
  const remaining = ratio > 0.02 ? (elapsed / ratio) * (1 - ratio) : null
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="h-2 overflow-hidden rounded-full bg-ui-raised">
        <div className="h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="flex items-center justify-between text-[12px] text-ui-muted">
        <span>
          Image {frame} / {total}
        </span>
        <span>{remaining !== null ? `Encore ≈ ${Math.ceil(remaining)} s` : 'Préparation…'}</span>
      </div>
      <footer className="flex justify-end">
        <button type="button" onClick={onCancel} className="rounded-md bg-ui-raised px-3 py-2 text-[12px] hover:bg-ui-hover">
          Annuler
        </button>
      </footer>
    </div>
  )
}
