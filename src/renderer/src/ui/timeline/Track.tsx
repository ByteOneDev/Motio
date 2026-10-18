import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animWindows, emphasisWindow, keyTimes, moveKeyGroup } from '@/engine/animate'
import { setLayerStart } from '@/model/editing'
import type { AudioLayer, Keyframe, Layer } from '@/model/schema'
import { snapToFrame, useEditor } from '@/store/editor'
import { useView } from '@/store/view'
import { audioBuffer, onAudioDecoded, peaks } from '../audio'
import { EMPHASIS_LABELS, IN_OUT_LABELS } from '../labels'
import { snapTime, startDrag } from './drag'

const MIN_LENGTH = 0.1
const SNAP_PX = 6

/** Une couleur par type de calque, pour repérer d'un coup d'œil la timeline. */
const TRACK_COLORS: Record<Layer['type'], { base: string; ring: string }> = {
  text: { base: 'bg-accent/30 border-accent/50', ring: 'border-accent ring-1 ring-accent/60' },
  shape: { base: 'bg-teal-400/25 border-teal-300/40', ring: 'border-teal-300 ring-1 ring-teal-300/50' },
  icon: { base: 'bg-pink-400/25 border-pink-300/40', ring: 'border-pink-300 ring-1 ring-pink-300/50' },
  media: { base: 'bg-amber-400/25 border-amber-300/40', ring: 'border-amber-300 ring-1 ring-amber-300/50' },
  audio: { base: 'bg-emerald-500/20 border-emerald-300/40', ring: 'border-emerald-300 ring-1 ring-emerald-300/50' },
  background: { base: 'bg-slate-400/20 border-slate-300/30', ring: 'border-slate-200 ring-1 ring-slate-200/50' },
  subtitles: { base: 'bg-sky-400/15 border-sky-300/40', ring: 'border-sky-300 ring-1 ring-sky-300/50' },
  blur: { base: 'bg-zinc-300/20 border-zinc-200/40', ring: 'border-zinc-100 ring-1 ring-zinc-100/50' },
}

interface TrackProps {
  layer: Layer
  pps: number
  selected: boolean
  selectedKeyTime: number | null
  /** Instants sur lesquels s'aimantent les bords (début/fin des autres calques, 0, durée, temps). */
  snapTargets: number[]
  /** Temps forts des musiques : on s'y aimante aussi en déplaçant la sélection. */
  beats: number[]
}

function editLayer(id: string, label: string, recipe: (layer: Layer) => void) {
  useEditor.getState().update(label, (draft) => {
    const layer = draft.layers.find((l) => l.id === id)
    if (layer) recipe(layer)
  })
}

/** Piste d'un calque : barre de présence, zones d'entrée / sortie / mise en avant, images clés. */
export function Track({ layer, pps, selected, selectedKeyTime, snapTargets, beats }: TrackProps) {
  const { start, end, locked } = layer
  const { inEnd, outStart } = animWindows(layer)
  const emphasis = emphasisWindow(layer)
  const keys = keyTimes(layer)

  const ctx = () => {
    const s = useEditor.getState()
    return { fps: s.project.fps, duration: s.project.duration, targets: [...snapTargets, s.time] }
  }
  /** Aimantation (désactivable dans la barre d'outils, ou temporairement avec Maj). */
  const snap = (t: number, ev: PointerEvent, targets: number[]) =>
    ev.shiftKey || !useView.getState().snapping ? t : snapTime(t, targets, SNAP_PX / pps)

  const selectThis = (additive: boolean) => {
    const { selection, select } = useEditor.getState()
    if (additive) select(selection.includes(layer.id) ? selection.filter((id) => id !== layer.id) : [...selection, layer.id])
    else select([layer.id])
  }

  // Déplacer une barre déplace toute la sélection, images clés comprises.
  const onBarDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const additive = e.shiftKey || e.metaKey
    if (locked) {
      e.stopPropagation()
      selectThis(additive)
      return
    }
    const before = useEditor.getState()
    if (!additive && !before.selection.includes(layer.id)) selectThis(false)
    const { selection, project } = useEditor.getState()
    const ids = selection.includes(layer.id) ? selection : [layer.id]
    const group = project.layers
      .filter((l) => ids.includes(l.id) && !l.locked)
      .map((l) => ({ id: l.id, start: l.start, end: l.end, keyframes: structuredClone(l.keyframes) }))
    const groupIds = new Set(group.map((g) => g.id))
    const minStart = Math.min(...group.map((g) => g.start))
    const maxEnd = Math.max(...group.map((g) => g.end))
    // On ne s'aimante pas sur les calques qu'on est en train de déplacer.
    const targets = [0, project.duration, ...beats, ...project.layers.filter((l) => !groupIds.has(l.id)).flatMap((l) => [l.start, l.end])]
    const len = end - start

    startDrag(
      e,
      'Déplacer dans le temps',
      (dx, ev) => {
        const { fps, duration } = ctx()
        const clamp = (v: number) => Math.min(Math.max(v, -minStart), duration - maxEnd)
        let shift = clamp(dx / pps)
        const next = start + shift
        const all = [...targets, useEditor.getState().time]
        // On aimante le bord (début ou fin) le plus proche d'une cible.
        const deltas = [snap(next, ev, all) - next, snap(next + len, ev, all) - (next + len)].filter((d) => d !== 0)
        if (deltas.length) shift += deltas.reduce((a, b) => (Math.abs(a) <= Math.abs(b) ? a : b))
        shift = clamp(snapToFrame(start + clamp(shift), fps) - start)
        useEditor.getState().update('Déplacer dans le temps', (draft) => {
          for (const g of group) {
            const l = draft.layers.find((x) => x.id === g.id)
            // Déjà à cette position : ne rien réécrire, pour ne pas créer d'entrée d'historique vide.
            if (!l || l.start === g.start + shift) continue
            l.start = g.start + shift
            l.end = g.end + shift
            for (const [prop, kfs] of Object.entries(g.keyframes) as [keyof Layer['keyframes'], Keyframe[]][]) {
              l.keyframes[prop] = kfs.map((k) => ({ ...k, time: k.time + shift }))
            }
          }
        })
      },
      () => selectThis(additive),
    )
  }

  const onTrimStart = (e: React.PointerEvent) =>
    startDrag(e, 'Ajuster le début', (dx, ev) => {
      const { fps, targets } = ctx()
      const t = snapToFrame(Math.min(Math.max(0, snap(start + dx / pps, ev, targets)), end - MIN_LENGTH), fps)
      // Le contenu d'une vidéo ou d'un son reste à sa place : seul le début est rogné.
      editLayer(layer.id, 'Ajuster le début', (l) => l.start !== t && setLayerStart(l, t))
    })

  const onTrimEnd = (e: React.PointerEvent) =>
    startDrag(e, 'Ajuster la fin', (dx, ev) => {
      const { fps, duration, targets } = ctx()
      const t = snapToFrame(Math.min(Math.max(start + MIN_LENGTH, snap(end + dx / pps, ev, targets)), duration), fps)
      editLayer(layer.id, 'Ajuster la fin', (l) => void (l.end = t))
    })

  const onInEdge = (e: React.PointerEvent) => {
    const d0 = layer.animIn!.duration
    startDrag(e, 'Durée de l’entrée', (dx) => {
      const { fps } = ctx()
      const d = Math.min(Math.max(1 / fps, snapToFrame(d0 + dx / pps, fps)), end - start)
      editLayer(layer.id, 'Durée de l’entrée', (l) => void (l.animIn && (l.animIn.duration = d)))
    })
  }

  const onOutEdge = (e: React.PointerEvent) => {
    const d0 = layer.animOut!.duration
    startDrag(e, 'Durée de la sortie', (dx) => {
      const { fps } = ctx()
      const d = Math.min(Math.max(1 / fps, snapToFrame(d0 - dx / pps, fps)), end - start)
      editLayer(layer.id, 'Durée de la sortie', (l) => void (l.animOut && (l.animOut.duration = d)))
    })
  }

  const onKeyDown = (e: React.PointerEvent, t0: number) => {
    const s = useEditor.getState()
    s.selectKey({ layerId: layer.id, time: t0 })
    s.setTime(t0)
    if (locked) {
      e.stopPropagation()
      return
    }
    let current = t0
    startDrag(e, 'Déplacer l’image clé', (dx, ev) => {
      const { fps, duration } = ctx()
      const t = snapToFrame(Math.min(Math.max(0, snap(t0 + dx / pps, ev, [useEditor.getState().time])), duration), fps)
      if (t === current) return
      const from = current
      editLayer(layer.id, 'Déplacer l’image clé', (l) => moveKeyGroup(l, from, t))
      current = t
      useEditor.getState().selectKey({ layerId: layer.id, time: t })
    })
  }

  const { base, ring } = TRACK_COLORS[layer.type]
  const barWidth = Math.max(2, (end - start) * pps)

  return (
    <div className={`relative h-full flex-1 ${selected ? 'bg-ui-hover/40' : ''}`}>
      <div
        className={`absolute top-1 bottom-1 overflow-hidden rounded border ${base} ${selected ? ring : ''} ${layer.visible ? '' : 'opacity-40'} ${
          locked ? 'cursor-not-allowed bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgb(0_0_0/0.18)_6px_8px)]' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{ left: start * pps, width: barWidth }}
        onPointerDown={onBarDown}
        title={locked ? `${layer.name} — verrouillé` : `${layer.name} — glisser pour déplacer dans le temps (toute la sélection suit)`}
      >
        {layer.type === 'audio' && <AudioWave layer={layer} pps={pps} width={barWidth} />}
        {layer.type === 'subtitles' &&
          layer.props.cues.map((c) => (
            <div
              key={c.id}
              className="absolute inset-y-0.5 overflow-hidden rounded-sm bg-sky-300/25 px-1 text-[10px] leading-[18px] whitespace-nowrap text-sky-50"
              style={{ left: c.start * pps, width: Math.max(2, (c.end - c.start) * pps - 1) }}
              title={c.text}
            >
              {c.text}
            </div>
          ))}
        {layer.type === 'media' &&
          layer.props.zooms.map((z) => (
            <div
              key={z.id}
              className="absolute top-0 h-1 rounded-full bg-sky-300"
              style={{ left: z.at * pps, width: Math.max(2, z.duration * pps) }}
              title={`Zoom caméra × ${z.scale.toFixed(1).replace('.', ',')}`}
            />
          ))}
        {layer.animIn && (
          <div
            className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(255_255_255/0.12)_4px_6px)]"
            style={{ width: (inEnd - start) * pps }}
            title={`Entrée : ${IN_OUT_LABELS[layer.animIn.preset]}`}
          />
        )}
        {layer.animOut && (
          <div
            className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(45deg,transparent_0_4px,rgb(255_255_255/0.12)_4px_6px)]"
            style={{ width: (end - outStart) * pps }}
            title={`Sortie : ${IN_OUT_LABELS[layer.animOut.preset]}`}
          />
        )}
        {emphasis && layer.emphasis && (
          <div
            className="absolute bottom-0 h-1 rounded-full bg-amber-300/80"
            style={{ left: (emphasis.start - start) * pps, width: (emphasis.end - emphasis.start) * pps }}
            title={`Mise en avant : ${EMPHASIS_LABELS[layer.emphasis.preset]}${layer.emphasis.repeat ? ' (répétée)' : ''}`}
          />
        )}
        {layer.type !== 'subtitles' && (
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center truncate text-[11px] text-ui-text/85 drop-shadow">
            {layer.name}
          </span>
        )}
      </div>

      {!locked && (
        <>
          {/* Poignées : bords de la barre, puis fin de l'entrée et début de la sortie. */}
          <div className="absolute top-1 bottom-1 w-1.5 cursor-ew-resize" style={{ left: start * pps - 2 }} onPointerDown={onTrimStart} title="Ajuster le début" />
          <div className="absolute top-1 bottom-1 w-1.5 cursor-ew-resize" style={{ left: end * pps - 4 }} onPointerDown={onTrimEnd} title="Ajuster la fin" />
          {layer.animIn && (
            <div className="group absolute top-1 bottom-1 w-2 cursor-col-resize" style={{ left: inEnd * pps - 4 }} onPointerDown={onInEdge} title="Durée de l'entrée">
              <div className="mx-auto h-full w-px bg-white/30 group-hover:bg-white" />
            </div>
          )}
          {layer.animOut && (
            <div className="group absolute top-1 bottom-1 w-2 cursor-col-resize" style={{ left: outStart * pps - 4 }} onPointerDown={onOutEdge} title="Durée de la sortie">
              <div className="mx-auto h-full w-px bg-white/30 group-hover:bg-white" />
            </div>
          )}
        </>
      )}

      {keys.map((t) => {
        const active = selectedKeyTime !== null && Math.abs(selectedKeyTime - t) < 1e-4
        return (
          <div
            key={t}
            className="absolute top-1/2 z-[1] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center"
            style={{ left: t * pps }}
            onPointerDown={(e) => onKeyDown(e, t)}
            title="Image clé — glisser pour déplacer, ⌫ pour supprimer"
          >
            <div className={`h-2 w-2 rotate-45 border ${active ? 'border-white bg-white' : 'border-white/90 bg-ui-panel hover:bg-white/60'}`} />
          </div>
        )
      })}
    </div>
  )
}

/** Largeur maximale du canvas de forme d'onde (au-delà, le navigateur refuse de l'allouer). */
const MAX_WAVE_PX = 16000

/** Forme d'onde d'une piste audio, avec ses fondus, recalée sur le point de départ dans la source. */
function AudioWave({ layer, pps, width }: { layer: AudioLayer; pps: number; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const asset = useEditor((s) => s.project.assets.find((a) => a.id === layer.props.assetId))
  const [version, setVersion] = useState(0)
  useEffect(() => onAudioDecoded(() => setVersion((v) => v + 1)), [])
  const buffer = asset ? audioBuffer(asset) : null

  useLayoutEffect(() => {
    const canvas = ref.current!
    const dpr = window.devicePixelRatio || 1
    const w = Math.min(MAX_WAVE_PX, Math.max(1, Math.round(width * dpr)))
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d')!
    g.clearRect(0, 0, w, h)
    if (!buffer) return
    const pk = peaks(buffer)
    const { sourceStart, loop, fadeIn, fadeOut } = layer.props
    const length = layer.end - layer.start
    g.fillStyle = 'rgba(167, 243, 208, 0.75)'
    for (let x = 0; x < w; x++) {
      const t = ((x / w) * width) / pps
      let src = sourceStart + t
      if (loop) src %= buffer.duration
      else if (src >= buffer.duration) break
      const fade = Math.min(1, fadeIn > 0 ? t / fadeIn : 1, fadeOut > 0 ? (length - t) / fadeOut : 1)
      const v = pk[Math.min(pk.length - 1, Math.floor((src / buffer.duration) * pk.length))] * Math.max(0, fade)
      const bar = Math.max(1, v * h * 0.9)
      g.fillRect(x, (h - bar) / 2, 1, bar)
    }
  }, [buffer, width, pps, layer.props, layer.start, layer.end, version])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full" style={{ width }} />
}
