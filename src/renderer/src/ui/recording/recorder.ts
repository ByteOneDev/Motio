import { BlobSource, BufferTarget, Conversion, Input, Output, WebMOutputFormat, ALL_FORMATS } from 'mediabunny'
import { create } from 'zustand'
import { createAudioLayer, createMedia, newId } from '@/model/factories'
import type { Asset } from '@/model/schema'
import { useEditor } from '@/store/editor'
import { mediaUrl } from '../../../../shared/api'
import { notify } from '../toast'

export type RecordMode = 'screen' | 'voice'

export interface RecordOptions {
  mode: RecordMode
  /** Micro choisi (`null` = sans micro, '' = micro par défaut). */
  micId: string | null
  countdown: boolean
  /** Réduire Motio pendant un enregistrement d'écran. */
  minimize: boolean
}

type Phase = { kind: 'idle' } | { kind: 'countdown'; n: number } | { kind: 'recording'; startedAt: number; mode: RecordMode } | { kind: 'processing' }

interface RecordingState {
  phase: Phase
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
}

export const useRecording = create<RecordingState>()((set) => ({
  phase: { kind: 'idle' },
  dialogOpen: false,
  setDialogOpen: (dialogOpen) => set({ dialogOpen }),
}))

const setPhase = (phase: Phase) => useRecording.setState({ phase })

let current: {
  recorder: MediaRecorder
  streams: MediaStream[]
  chunks: Blob[]
  mode: RecordMode
  /** Instant du projet où l'enregistrement a commencé (la capture y sera placée). */
  projectTime: number
  unsubscribe: (() => void) | null
} | null = null

function pickMime(mode: RecordMode): string {
  const candidates = mode === 'voice' ? ['audio/webm;codecs=opus', 'audio/webm'] : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

async function micStream(micId: string | null): Promise<MediaStream | null> {
  if (micId === null) return null
  await window.motio?.requestMicAccess()
  return navigator.mediaDevices.getUserMedia({
    audio: { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Démarre l'enregistrement (après l'éventuel compte à rebours). La source d'écran a été choisie avant. */
export async function startRecording(opts: RecordOptions): Promise<void> {
  const streams: MediaStream[] = []
  try {
    if (opts.mode === 'screen') {
      streams.push(await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false }))
    }
    const mic = await micStream(opts.micId)
    if (mic) streams.push(mic)
    if (opts.mode === 'voice' && !mic) throw new Error('Choisissez un micro pour enregistrer une voix off.')
  } catch (e) {
    streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    setPhase({ kind: 'idle' })
    notify(e instanceof Error && e.name !== 'NotAllowedError' ? e.message : 'Accès refusé : vérifiez les autorisations d’enregistrement dans les Réglages Système.', 'error')
    return
  }

  if (opts.countdown) {
    for (const n of [3, 2, 1]) {
      setPhase({ kind: 'countdown', n })
      await wait(1000)
    }
  }
  if (opts.mode === 'screen' && opts.minimize) window.motio?.minimizeWindow()

  const stream = new MediaStream(streams.flatMap((s) => s.getTracks()))
  const recorder = new MediaRecorder(stream, { mimeType: pickMime(opts.mode), videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 160_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  // Arrêt depuis le système (« Arrêter le partage ») ou depuis le raccourci global.
  stream.getVideoTracks()[0]?.addEventListener('ended', () => stopRecording())
  const s = useEditor.getState()
  current = { recorder, streams, chunks, mode: opts.mode, projectTime: s.time, unsubscribe: window.motio?.onStopShortcut(() => stopRecording()) ?? null }
  window.motio?.setStopShortcut(true)
  recorder.start(1000)
  // Voix off : on joue la séquence pour parler par-dessus les images.
  if (opts.mode === 'voice') s.play()
  setPhase({ kind: 'recording', startedAt: performance.now(), mode: opts.mode })
}

/** Rend le fichier de MediaRecorder navigable (durée et index), sans réencoder. */
async function remux(blob: Blob): Promise<ArrayBuffer> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
  const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() })
  const conversion = await Conversion.init({ input, output })
  await conversion.execute()
  return (output.target as BufferTarget).buffer!
}

async function probe(src: string, kind: 'video' | 'audio'): Promise<{ width: number; height: number; duration: number }> {
  const el = document.createElement(kind)
  el.preload = 'metadata'
  el.src = src
  await new Promise<void>((resolve, reject) => {
    el.onloadedmetadata = () => resolve()
    el.onerror = () => reject(new Error('Enregistrement illisible'))
  })
  const v = el as HTMLVideoElement
  return { width: v.videoWidth || 1, height: v.videoHeight || 1, duration: Number.isFinite(el.duration) ? el.duration : 0 }
}

export async function stopRecording(cancel = false): Promise<void> {
  const rec = current
  if (!rec) return
  current = null
  rec.unsubscribe?.()
  window.motio?.setStopShortcut(false)
  const stopped = new Promise<void>((resolve) => (rec.recorder.onstop = () => resolve()))
  if (rec.recorder.state !== 'inactive') rec.recorder.stop()
  await stopped
  rec.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
  if (rec.mode === 'voice') useEditor.getState().pause()
  if (cancel) {
    setPhase({ kind: 'idle' })
    return
  }

  setPhase({ kind: 'processing' })
  try {
    const raw = new Blob(rec.chunks, { type: rec.chunks[0]?.type || 'video/webm' })
    const data = await remux(raw).catch(() => raw.arrayBuffer())
    const kind = rec.mode === 'voice' ? 'audio' : 'video'
    const motio = window.motio
    const path = motio ? await motio.saveRecording(data, 'webm', rec.mode) : null
    const src = path ? mediaUrl(path) : URL.createObjectURL(new Blob([data], { type: `${kind}/webm` }))
    const meta = await probe(src, kind)
    const name = rec.mode === 'voice' ? 'Voix off' : 'Enregistrement d’écran'
    const asset: Asset = { id: newId(), kind, name: `${name}.webm`, src, path, width: meta.width, height: meta.height, duration: meta.duration, generated: null }
    placeRecording(asset, rec.projectTime)
    notify(path ? `${name} ajouté à la timeline (fichier dans Vidéos › Motio).` : `${name} ajouté à la timeline.`)
  } catch (e) {
    notify(`Impossible de récupérer l’enregistrement : ${String(e)}`, 'error')
  } finally {
    setPhase({ kind: 'idle' })
  }
}

/** Place la capture là où l'enregistrement a commencé : plein cadre pour l'écran, piste son pour la voix. */
function placeRecording(asset: Asset, start: number): void {
  const s = useEditor.getState()
  const at = Math.min(start, Math.max(0, s.project.duration - 0.5))
  let layerId = ''
  s.update(`Ajouter ${asset.kind === 'audio' ? 'la voix off' : 'l’enregistrement'}`, (draft) => {
    // La séquence s'allonge si l'enregistrement dépasse sa fin.
    if (at + asset.duration > draft.duration) draft.duration = Math.ceil(at + asset.duration)
    draft.assets.push(asset)
    if (asset.kind === 'audio') {
      const layer = createAudioLayer(draft, asset, at)
      layer.name = 'Voix off'
      layer.props.volume = 1
      layer.props.fadeOut = 0
      draft.layers.push(layer)
      layerId = layer.id
      return
    }
    const layer = createMedia(draft, asset)
    // Une capture d'écran remplit le cadre sans être recadrée.
    Object.assign(layer.transform, { x: draft.width / 2, y: draft.height / 2, width: draft.width, height: draft.height })
    Object.assign(layer.props, { fit: 'contain', radius: 0, shadow: false })
    layer.start = at
    layer.end = Math.min(draft.duration, at + Math.max(0.5, asset.duration))
    layer.name = 'Enregistrement d’écran'
    draft.layers.push(layer)
    layerId = layer.id
  })
  s.select([layerId])
}
