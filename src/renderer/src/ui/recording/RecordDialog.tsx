import { Mic, Monitor, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CaptureSource } from '../../../../shared/api'
import { formatTime } from '../labels'
import { startRecording, stopRecording, useRecording, type RecordMode } from './recorder'

/** Fenêtre « Enregistrer » : écran (avec ou sans micro) ou voix off sur la séquence. */
export function RecordDialog() {
  const open = useRecording((s) => s.dialogOpen)
  return open ? <Dialog /> : null
}

function Dialog() {
  const desktop = !!window.motio
  const [mode, setMode] = useState<RecordMode>('screen')
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [status, setStatus] = useState('granted')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [micId, setMicId] = useState<string | null>('')
  const [countdown, setCountdown] = useState(true)
  const [minimize, setMinimize] = useState(true)
  const close = () => useRecording.getState().setDialogOpen(false)

  useEffect(() => {
    window.motio?.captureSources().then((r) => {
      setStatus(r.status)
      setSources(r.sources)
      setSourceId((id) => id ?? r.sources.find((s) => s.kind === 'screen')?.id ?? r.sources[0]?.id ?? null)
    })
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => setMics(devices.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== '')))
      .catch(() => {})
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const blocked = desktop && mode === 'screen' && (status === 'denied' || status === 'restricted')
  const canStart = mode === 'voice' ? micId !== null : !blocked && (!desktop || !!sourceId)

  const start = async () => {
    if (mode === 'screen' && desktop && sourceId) await window.motio!.selectCaptureSource(sourceId)
    close()
    startRecording({ mode, micId, countdown, minimize: desktop && minimize })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="flex max-h-[calc(100vh-48px)] w-[620px] max-w-[calc(100vw-32px)] flex-col rounded-xl border border-ui-line bg-ui-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-ui-line px-4 py-3">
          <h2 className="text-[14px] font-semibold">Enregistrer</h2>
          <button type="button" onClick={close} className="rounded p-1 text-ui-muted hover:bg-ui-hover hover:text-ui-text" title="Fermer (Échap)">
            <X size={16} />
          </button>
        </header>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['screen', <Monitor key="m" size={18} />, 'Écran', 'Filmer un écran ou une fenêtre, avec votre voix'],
                ['voice', <Mic key="v" size={18} />, 'Voix off', 'Parler pendant que la séquence défile'],
              ] as const
            ).map(([id, icon, label, hint]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left ${mode === id ? 'border-accent bg-accent-soft' : 'border-ui-line bg-ui-raised hover:border-accent/50'}`}
              >
                <span className="text-ui-muted">{icon}</span>
                <span>
                  <span className="block text-[13px] font-medium">{label}</span>
                  <span className="block text-[11px] leading-snug text-ui-faint">{hint}</span>
                </span>
              </button>
            ))}
          </div>

          {mode === 'screen' && desktop && (
            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold tracking-wide text-ui-muted uppercase">Que filmer ?</h3>
              {blocked ? (
                <div className="rounded-md bg-ui-raised p-3 text-[12px] leading-snug">
                  <p>macOS n’autorise pas encore Motio à enregistrer l’écran.</p>
                  <p className="mt-1 text-ui-faint">Activez Motio dans Réglages Système › Confidentialité et sécurité › Enregistrement de l’écran, puis relancez Motio.</p>
                  <button type="button" onClick={() => window.motio?.openCaptureSettings()} className="mt-2 rounded bg-accent px-3 py-1.5 text-[12px] text-white">
                    Ouvrir les Réglages
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {sources.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSourceId(s.id)}
                      className={`overflow-hidden rounded-md border text-left ${sourceId === s.id ? 'border-accent ring-1 ring-accent' : 'border-ui-line hover:border-accent/50'}`}
                    >
                      <img src={s.thumbnail} alt="" className="aspect-video w-full bg-black object-contain" />
                      <span className="block truncate px-1.5 py-1 text-[10px] text-ui-muted">
                        {s.kind === 'screen' ? '🖥 ' : ''}
                        {s.name}
                      </span>
                    </button>
                  ))}
                  {sources.length === 0 && <p className="col-span-3 text-[12px] text-ui-faint">Recherche des écrans…</p>}
                </div>
              )}
            </section>
          )}
          {mode === 'screen' && !desktop && <p className="text-[12px] text-ui-faint">Le navigateur vous demandera quel écran ou quelle fenêtre partager.</p>}

          <label className="flex items-center gap-3">
            <span className="w-20 text-[12px] text-ui-muted">Micro</span>
            <select
              value={micId ?? 'none'}
              onChange={(e) => setMicId(e.target.value === 'none' ? null : e.target.value)}
              className="h-8 flex-1 rounded border border-transparent bg-ui-raised px-2 text-[12px] text-ui-text outline-none hover:border-ui-line focus:border-accent"
            >
              {mode === 'screen' && <option value="none">Pas de son</option>}
              <option value="">Micro par défaut</option>
              {mics.map((m, i) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || `Micro ${i + 1}`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex cursor-pointer items-center gap-3 text-[12px]">
            <input type="checkbox" className="accent-accent" checked={countdown} onChange={(e) => setCountdown(e.target.checked)} />
            Compte à rebours de 3 secondes
          </label>
          {mode === 'screen' && desktop && (
            <label className="flex cursor-pointer items-center gap-3 text-[12px]">
              <input type="checkbox" className="accent-accent" checked={minimize} onChange={(e) => setMinimize(e.target.checked)} />
              Réduire Motio pendant l’enregistrement (arrêt avec ⇧⌘2 depuis n’importe où)
            </label>
          )}
          {mode === 'voice' && (
            <p className="rounded-md bg-ui-raised px-3 py-2 text-[11px] leading-snug text-ui-faint">
              La séquence se lit depuis la tête de lecture pendant que vous parlez ; la voix off est posée au même endroit. Un casque évite que le son de la séquence soit enregistré.
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-ui-line px-4 py-3">
          <span className="text-[11px] text-ui-faint">{desktop ? 'Fichier enregistré dans Vidéos › Motio' : 'Enregistrement gardé pendant la session'}</span>
          <button
            type="button"
            disabled={!canStart}
            onClick={start}
            className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-[12px] font-medium text-white hover:brightness-110 disabled:opacity-40"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white" /> Démarrer l’enregistrement
          </button>
        </footer>
      </div>
    </div>
  )
}

/** Compte à rebours plein écran, puis pastille rouge avec le temps écoulé et le bouton d'arrêt. */
export function RecordingBar() {
  const phase = useRecording((s) => s.phase)
  const [, tick] = useState(0)
  useEffect(() => {
    if (phase.kind !== 'recording') return
    const id = setInterval(() => tick((v) => v + 1), 250)
    return () => clearInterval(id)
  }, [phase.kind])

  if (phase.kind === 'idle') return null
  if (phase.kind === 'countdown') {
    return (
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
        <span className="text-[160px] font-black text-white drop-shadow-2xl">{phase.n}</span>
      </div>
    )
  }
  return (
    <div className="fixed top-2 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border border-red-400/40 bg-ui-panel/95 py-1.5 pr-1.5 pl-3 shadow-2xl">
      {phase.kind === 'processing' ? (
        <span className="text-[12px] text-ui-muted">Préparation de l’enregistrement…</span>
      ) : (
        <>
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-[12px] text-ui-text tabular-nums">
            {phase.mode === 'voice' ? 'Voix off' : 'Écran'} · {formatTime((performance.now() - phase.startedAt) / 1000)}
          </span>
          <button
            type="button"
            onClick={() => stopRecording()}
            title="Arrêter l’enregistrement (⇧⌘2)"
            className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-[12px] font-medium text-white hover:brightness-110"
          >
            <Square size={10} fill="currentColor" /> Arrêter
          </button>
          <button type="button" onClick={() => stopRecording(true)} title="Abandonner cet enregistrement" className="rounded-full px-2 py-1 text-[11px] text-ui-muted hover:text-ui-text">
            Annuler
          </button>
        </>
      )}
    </div>
  )
}
