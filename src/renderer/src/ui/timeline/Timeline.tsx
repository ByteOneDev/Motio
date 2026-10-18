import { useEffect, useMemo, useRef, useState } from 'react'
import { beatTimes } from '@/engine/beats'
import { useEditor } from '@/store/editor'
import { useView } from '@/store/view'
import { EditBar } from './EditBar'
import { LayerHeader } from './LayerHeader'
import { Ruler } from './Ruler'
import { Track } from './Track'

export const HEADER_W = 232
export const ROW_H = 30
const RULER_H = 24
const RIGHT_PAD = 24

interface Marquee {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Timeline : une ligne par calque (en-tête à gauche, piste à droite), règle et tête de lecture.
 * Règle : clic ou glisser pour déplacer la tête de lecture. Zone vide : glisser pour sélectionner
 * au lasso (Maj pour ajouter), clic pour tout désélectionner et placer la tête de lecture.
 */
export function Timeline({ className = '' }: { className?: string }) {
  const layers = useEditor((s) => s.project.layers)
  const duration = useEditor((s) => s.project.duration)
  const selection = useEditor((s) => s.selection)
  const selectedKey = useEditor((s) => s.selectedKey)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const zoom = useView((s) => s.timelineZoom)

  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [marquee, setMarquee] = useState<Marquee | null>(null)

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(scrollRef.current!)
    return () => ro.disconnect()
  }, [])

  const pps = (Math.max(100, width - HEADER_W - RIGHT_PAD) / duration) * zoom
  const rows = [...layers].reverse()
  // Temps forts des musiques : repères sur la règle et points d'aimantation.
  const beats = useMemo(() => beatTimes({ layers }), [layers])

  // Pendant la lecture, la tête de lecture reste visible quand la timeline est zoomée.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !playing) return
    const x = time * pps
    const visible = el.clientWidth - HEADER_W
    if (x < el.scrollLeft || x > el.scrollLeft + visible - 40) el.scrollLeft = Math.max(0, x - 40)
  }, [time, pps, playing])

  const timeAt = (clientX: number) => {
    const el = scrollRef.current!
    return (clientX - el.getBoundingClientRect().left - HEADER_W + el.scrollLeft) / pps
  }

  /** Coordonnées dans le contenu défilant de la timeline. */
  const contentPoint = (e: { clientX: number; clientY: number }) => {
    const r = contentRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onScrub = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const s = useEditor.getState()
    s.pause()
    s.selectKey(null)
    s.setTime(timeAt(e.clientX))
    const move = (ev: PointerEvent) => useEditor.getState().setTime(timeAt(ev.clientX))
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  /** Calques dont la barre croise le rectangle de sélection. */
  const hits = (m: Marquee) => {
    const left = Math.min(m.x0, m.x1)
    const right = Math.max(m.x0, m.x1)
    const top = Math.min(m.y0, m.y1)
    const bottom = Math.max(m.y0, m.y1)
    return rows
      .filter((layer, row) => {
        const y0 = RULER_H + row * ROW_H
        const x0 = HEADER_W + layer.start * pps
        const x1 = HEADER_W + layer.end * pps
        return y0 + ROW_H > top && y0 < bottom && x1 > left && x0 < right
      })
      .map((l) => l.id)
  }

  const onEmptyDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const start = contentPoint(e)
    const additive = e.shiftKey || e.metaKey
    const before = useEditor.getState().selection
    let dragging = false

    const move = (ev: PointerEvent) => {
      const p = contentPoint(ev)
      if (!dragging && Math.hypot(p.x - start.x, p.y - start.y) < 4) return
      dragging = true
      const m = { x0: start.x, y0: start.y, x1: p.x, y1: p.y }
      setMarquee(m)
      const ids = hits(m)
      useEditor.getState().select(additive ? [...new Set([...before, ...ids])] : ids)
    }
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      setMarquee(null)
      if (dragging) return
      // Simple clic : on désélectionne et on place la tête de lecture.
      const s = useEditor.getState()
      s.pause()
      if (!additive) s.select([])
      s.setTime(timeAt(ev.clientX))
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  const reorder = (id: string, target: number) => {
    // `target` est une position dans la liste affichée (de haut en bas, donc inversée).
    const from = layers.findIndex((l) => l.id === id)
    let to = layers.length - target
    if (from < to) to -= 1
    useEditor.getState().reorderLayer(id, to)
  }

  return (
    <section className={`flex min-h-0 min-w-0 flex-col bg-ui-panel ${className}`}>
      <EditBar />
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto" onDragLeave={() => setDropIndex(null)}>
        <div ref={contentRef} className="relative min-h-full" style={{ width: HEADER_W + duration * pps + RIGHT_PAD }}>
          <div className="sticky top-0 z-20 flex border-b border-ui-line bg-ui-panel" style={{ height: RULER_H }}>
            <div
              className="sticky left-0 z-30 flex shrink-0 items-center justify-between border-r border-ui-line bg-ui-panel px-3"
              style={{ width: HEADER_W }}
            >
              <span className="text-[11px] font-semibold tracking-wide text-ui-muted uppercase">Pistes</span>
              <span className="text-[11px] text-ui-faint">{layers.length}</span>
            </div>
            <div className="relative flex flex-1 cursor-pointer" onPointerDown={onScrub} title="Cliquer ou glisser pour déplacer la tête de lecture">
              <Ruler pps={pps} duration={duration} beats={beats} />
              <div className="pointer-events-none absolute bottom-0 -translate-x-1/2" style={{ left: time * pps }}>
                <div className="h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-guide" />
              </div>
            </div>
          </div>

          {rows.map((layer, row) => {
            const others = layers.filter((l) => l.id !== layer.id).flatMap((l) => [l.start, l.end])
            return (
              <div key={layer.id} className="flex border-b border-ui-line/40" style={{ height: ROW_H }}>
                <div className="sticky left-0 z-10 shrink-0 border-r border-ui-line bg-ui-panel" style={{ width: HEADER_W }}>
                  <LayerHeader
                    layer={layer}
                    selected={selection.includes(layer.id)}
                    dropBefore={dropIndex === row}
                    onDragOverRow={(before) => setDropIndex(before ? row : row + 1)}
                    onDropRow={(id) => {
                      reorder(id, dropIndex ?? row)
                      setDropIndex(null)
                    }}
                  />
                </div>
                <div className="relative flex flex-1" onPointerDown={onEmptyDown}>
                  <Track
                    layer={layer}
                    pps={pps}
                    selected={selection.includes(layer.id)}
                    selectedKeyTime={selectedKey?.layerId === layer.id ? selectedKey.time : null}
                    snapTargets={[0, duration, ...others, ...beats]}
                    beats={beats}
                  />
                </div>
              </div>
            )
          })}
          {/* Zone vide sous les pistes : lasso et clic de désélection. */}
          <div className="flex" style={{ minHeight: ROW_H * 2 }}>
            <div className="sticky left-0 z-10 shrink-0 border-r border-ui-line bg-ui-panel" style={{ width: HEADER_W }}>
              {dropIndex === rows.length && <div className="mx-2 h-0.5 rounded bg-accent" />}
              {layers.length === 0 && <p className="px-3 py-3 text-ui-faint">Aucun calque. Ajoutez un élément depuis la bibliothèque.</p>}
            </div>
            <div className="flex-1" onPointerDown={onEmptyDown} />
          </div>

          <div className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-guide" style={{ left: HEADER_W + time * pps }} />
          {marquee && (
            <div
              className="pointer-events-none absolute z-[6] rounded-sm border border-accent bg-accent/15"
              style={{
                left: Math.max(HEADER_W, Math.min(marquee.x0, marquee.x1)),
                top: Math.min(marquee.y0, marquee.y1),
                width: Math.abs(marquee.x1 - marquee.x0),
                height: Math.abs(marquee.y1 - marquee.y0),
              }}
            />
          )}
        </div>
      </div>
    </section>
  )
}
