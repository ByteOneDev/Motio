import { useEffect } from 'react'
import { findSound, renderSound, SAMPLE_RATE } from '@/audio/library'
import { audibleLayers, scheduleMix } from '@/audio/mix'
import type { Asset, Project } from '@/model/schema'
import { lastFrame, useEditor } from '@/store/editor'

/**
 * Sons décodés, par ressource. Les sons générés sont calculés, les fichiers (et le son des
 * vidéos) décodés une fois. Une vidéo sans piste son donne `null`.
 */
const loading = new Map<string, Promise<AudioBuffer | null>>()
const decoded = new Map<string, AudioBuffer | null>()
const listeners = new Set<() => void>()

export function onAudioDecoded(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let decoder: OfflineAudioContext | null = null

async function decode(asset: Asset): Promise<AudioBuffer | null> {
  if (asset.generated) {
    const def = findSound(asset.generated)
    return def ? renderSound(def) : null
  }
  if (!asset.src) return null
  const data = await (await fetch(asset.src)).arrayBuffer()
  decoder ??= new OfflineAudioContext(2, 1, SAMPLE_RATE)
  return decoder.decodeAudioData(data)
}

export function loadAudio(asset: Asset): Promise<AudioBuffer | null> {
  const key = `${asset.id}|${asset.src}|${asset.generated ?? ''}`
  let p = loading.get(key)
  if (!p) {
    p = decode(asset)
      .catch(() => null)
      .then((buffer) => {
        decoded.set(asset.id, buffer)
        listeners.forEach((l) => l())
        return buffer
      })
    loading.set(key, p)
  }
  return p
}

/** Son déjà décodé (sinon `null`, et le décodage est lancé). */
export function audioBuffer(asset: Asset): AudioBuffer | null {
  if (!decoded.has(asset.id)) loadAudio(asset)
  return decoded.get(asset.id) ?? null
}

export async function loadProjectAudio(project: Project): Promise<void> {
  await Promise.all(audibleLayers(project).map((a) => loadAudio(a.asset)))
}

const peakCache = new WeakMap<AudioBuffer, Float32Array>()

/** Enveloppe du son (crête par tranche), pour dessiner la forme d'onde dans la timeline. */
export function peaks(buffer: AudioBuffer, buckets = 2000): Float32Array {
  let out = peakCache.get(buffer)
  if (out) return out
  out = new Float32Array(buckets)
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c))
  const size = Math.max(1, Math.floor(buffer.length / buckets))
  for (let b = 0; b < buckets; b++) {
    let max = 0
    for (const data of channels) {
      for (let i = b * size; i < Math.min(data.length, (b + 1) * size); i += 8) max = Math.max(max, Math.abs(data[i]))
    }
    out[b] = max
  }
  peakCache.set(buffer, out)
  return out
}

// --- Lecture -------------------------------------------------------------------

let context: AudioContext | null = null
let output: GainNode | null = null
let playing: AudioScheduledSourceNode[] = []
let session: { from: number; at: number } | null = null
let token = 0

function audioContext(): { ctx: AudioContext; out: GainNode } {
  if (!context) {
    context = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' })
    output = context.createGain()
    output.connect(context.destination)
  }
  return { ctx: context, out: output! }
}

function stopAll(): void {
  token++
  for (const s of playing) {
    try {
      s.stop()
    } catch {
      // Déjà arrêté.
    }
  }
  playing = []
  session = null
}

async function startAt(): Promise<void> {
  stopAll()
  const myToken = token
  const { project, playUntil } = useEditor.getState()
  if (audibleLayers(project).length === 0) return
  const { ctx, out } = audioContext()
  await ctx.resume()
  await loadProjectAudio(project)
  if (myToken !== token || !useEditor.getState().playing) return
  // Le temps a pu avancer pendant le décodage : on repart de l'instant courant.
  const now = useEditor.getState().time
  const when = ctx.currentTime + 0.02
  playing = scheduleMix(ctx, out, project, audioBuffer, now, playUntil ?? lastFrame(project) + 1 / project.fps, when)
  session = { from: now, at: when }
}

/** Joue le son du projet pendant la lecture, et le recale après un saut de la tête de lecture. */
export function useAudioPlayback(): void {
  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        if (s.playing && !prev.playing) {
          startAt()
        } else if (!s.playing && prev.playing) {
          stopAll()
        } else if (s.playing) {
          if (s.project.layers !== prev.project.layers || s.project.assets !== prev.project.assets) {
            startAt()
          } else if (session && context && s.time !== prev.time) {
            const expected = session.from + (context.currentTime - session.at)
            if (Math.abs(s.time - expected) > 0.25) startAt()
          }
        }
      }),
    [],
  )
}

// --- Écoute dans la bibliothèque ---------------------------------------------------

let preview: AudioBufferSourceNode | null = null

/** Écoute d'un son de la bibliothèque ; renvoie une fonction pour l'arrêter. */
export async function previewSound(id: string, onEnd: () => void): Promise<() => void> {
  stopPreview()
  const def = findSound(id)
  if (!def) return () => {}
  const { ctx, out } = audioContext()
  await ctx.resume()
  const buffer = await renderSound(def)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(out)
  src.onended = () => {
    if (preview === src) preview = null
    onEnd()
  }
  src.start()
  preview = src
  return stopPreview
}

export function stopPreview(): void {
  if (preview) {
    try {
      preview.stop()
    } catch {
      // Déjà terminé.
    }
    preview = null
  }
}
