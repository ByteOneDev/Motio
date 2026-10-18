import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { resolveLayer } from '@/engine/animate'
import { aabbHalfExtents, corners, displaySize, hitTest, isActive, rotate, toWorld, type Point, type Size } from '@/engine/geometry'
import { canvasMeasure } from '@/engine/measure'
import { renderFrame } from '@/engine/render'
import { HANDLE_DIR, handlesFor, resizeLayer, rotationFromDrag, snapPosition, type Guide, type Handle } from '@/engine/transform'
import { createAudioLayer, createMedia } from '@/model/factories'
import type { Layer } from '@/model/schema'
import { useEditor } from '@/store/editor'
import { useView } from '@/store/view'
import { useFontsVersion } from '../fonts'
import { ASSET_MIME, findItem, LIBRARY_MIME } from '../library/items'
import { browserMedia, endMediaFrame, hasFiles, importFiles, onMediaChange } from '../media'

type Drag =
  | { kind: 'move'; from: Point; starts: Map<string, Point>; primary: string; moved: boolean }
  | { kind: 'resize'; handle: Handle; start: Layer; startSize: Size }
  | { kind: 'rotate'; start: Layer; from: Point }
  | { kind: 'pan'; fromX: number; fromY: number; panX: number; panY: number; zoom: number }

const PADDING = 48
const MIN_ZOOM = 0.05
const MAX_ZOOM = 8
/** Distance d'aimantation, en pixels écran. */
const SNAP_PX = 6
const ROTATE_HANDLE_PX = 26

const HANDLE_ANGLE: Record<Handle, number> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 }
const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']

function cursorFor(handle: Handle, rotation: number): string {
  const a = (((HANDLE_ANGLE[handle] + rotation) % 180) + 180) % 180
  return RESIZE_CURSORS[Math.round(a / 45) % 4]
}

export function Viewport() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Drag | null>(null)

  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selection = useEditor((s) => s.selection)
  const view = useView()

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [guides, setGuides] = useState<Guide[]>([])
  const [hover, setHover] = useState<string | null>(null)
  const spaceDown = view.spaceHeld
  const [dragging, setDragging] = useState<Drag['kind'] | null>(null)
  const fontsVersion = useFontsVersion()
  const [mediaVersion, setMediaVersion] = useState(0)

  const fitZoom =
    size.w > 0 ? Math.max(MIN_ZOOM, Math.min((size.w - PADDING * 2) / project.width, (size.h - PADDING * 2) / project.height)) : 1
  const zoom = view.fit ? fitZoom : view.zoom
  const ox = size.w / 2 - (project.width / 2) * zoom + view.panX
  const oy = size.h / 2 - (project.height / 2) * zoom + view.panY

  // Valeurs courantes pour les écouteurs natifs (molette), qui ne se ré-abonnent pas à chaque rendu.
  const live = useRef({ zoom, ox, oy, size, project })
  live.current = { zoom, ox, oy, size, project }

  const toScreen = (p: Point): Point => ({ x: p.x * zoom + ox, y: p.y * zoom + oy })
  const toComp = (clientX: number, clientY: number): Point => {
    const r = wrapRef.current!.getBoundingClientRect()
    return { x: (clientX - r.left - ox) / zoom, y: (clientY - r.top - oy) / zoom }
  }

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(wrapRef.current!)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    useView.getState().setView({ fitZoom })
  }, [fitZoom])

  // Redessiner quand une image finit de se décoder ou qu'une vidéo a trouvé la bonne image.
  useEffect(() => onMediaChange(() => setMediaVersion((v) => v + 1)), [])

  // Molette : défilement = déplacer la vue ; pincement ou ⌘ + molette = zoom autour du curseur.
  useEffect(() => {
    const el = wrapRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { zoom, ox, oy, size, project } = live.current
      const { panX, panY, setView } = useView.getState()
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect()
        const sx = e.clientX - r.left
        const sy = e.clientY - r.top
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * Math.exp(-e.deltaY * 0.01)))
        const cx = (sx - ox) / zoom
        const cy = (sy - oy) / zoom
        setView({
          fit: false,
          zoom: next,
          panX: sx - cx * next - size.w / 2 + (project.width / 2) * next,
          panY: sy - cy * next - size.h / 2 + (project.height / 2) * next,
        })
      } else {
        setView({ fit: false, zoom, panX: panX - e.deltaX, panY: panY - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(size.w * dpr)
    const h = Math.round(size.h * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * ox, dpr * oy)

    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = 32 * dpr
    ctx.fillStyle = project.background
    ctx.fillRect(0, 0, project.width, project.height)
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, project.width, project.height)
    ctx.clip()
    renderFrame(ctx, project, time, canvasMeasure, { pixelScale: dpr * zoom, media: browserMedia })
    endMediaFrame()
    ctx.restore()
  }, [project, time, size, zoom, ox, oy, fontsVersion, mediaVersion])

  // --- Gestes -------------------------------------------------------------

  const capture = (e: ReactPointerEvent) => wrapRef.current!.setPointerCapture(e.pointerId)

  const startDrag = (d: Drag) => {
    drag.current = d
    setDragging(d.kind)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      if (spaceDown) useView.getState().setView({ spacePanned: true })
      capture(e)
      startDrag({ kind: 'pan', fromX: e.clientX, fromY: e.clientY, panX: view.panX, panY: view.panY, zoom })
      return
    }
    if (e.button !== 0) return
    // Rend le focus au canevas pour que les raccourcis clavier s'appliquent aux calques.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()

    const p = toComp(e.clientX, e.clientY)
    const { project, time, selection, select, playing, pause } = useEditor.getState()
    // On édite une image fixe : toucher le canevas met la lecture en pause.
    if (playing) pause()
    const hit = hitTest(project, time, p, canvasMeasure, 4 / zoom)
    if (!hit) {
      select([])
      return
    }
    let next = selection
    if (e.shiftKey) {
      next = selection.includes(hit) ? selection.filter((id) => id !== hit) : [...selection, hit]
      select(next)
      if (!next.includes(hit)) return
    } else if (!selection.includes(hit)) {
      next = [hit]
      select(next)
    }
    const starts = new Map<string, Point>()
    for (const layer of project.layers) {
      if (!next.includes(layer.id) || layer.locked) continue
      const r = resolveLayer(layer, time)
      starts.set(layer.id, { x: r.transform.x, y: r.transform.y })
    }
    capture(e)
    startDrag({ kind: 'move', from: p, starts, primary: hit, moved: false })
  }

  const onHandleDown = (e: ReactPointerEvent, layer: Layer, handle: Handle | 'rotate') => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    const p = toComp(e.clientX, e.clientY)
    const { beginGesture, pause, time } = useEditor.getState()
    pause()
    // On part de l'état affiché à l'instant courant (images clés comprises).
    const start = resolveLayer(layer, time)
    if (handle === 'rotate') {
      beginGesture('Pivoter')
      startDrag({ kind: 'rotate', start, from: p })
    } else {
      beginGesture('Redimensionner')
      startDrag({ kind: 'resize', handle, start, startSize: displaySize(start, canvasMeasure) })
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    const store = useEditor.getState()
    if (!d) {
      const hit = hitTest(store.project, store.time, toComp(e.clientX, e.clientY), canvasMeasure, 4 / zoom)
      if (hit !== hover) setHover(hit)
      return
    }

    if (d.kind === 'pan') {
      useView.getState().setView({ fit: false, zoom: d.zoom, panX: d.panX + e.clientX - d.fromX, panY: d.panY + e.clientY - d.fromY })
      return
    }

    const p = toComp(e.clientX, e.clientY)
    const mods = { shift: e.shiftKey, alt: e.altKey }

    if (d.kind === 'move') {
      let dx = p.x - d.from.x
      let dy = p.y - d.from.y
      if (!d.moved) {
        if (Math.hypot(dx, dy) * zoom < 3) return
        d.moved = true
        store.beginGesture('Déplacer')
      }
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0
        else dx = 0
      }
      // Aimantation (désactivable dans la barre d'outils, ou temporairement avec ⌘ / Ctrl).
      const primaryLayer = store.project.layers.find((l) => l.id === d.primary)
      const primary = primaryLayer && resolveLayer(primaryLayer, store.time)
      const primaryStart = d.starts.get(d.primary)
      let nextGuides: Guide[] = []
      if (primary && primaryStart && useView.getState().snapping && !e.metaKey && !e.ctrlKey) {
        const others = store.project.layers
          .filter((l) => !d.starts.has(l.id) && isActive(l, store.time))
          .map((l) => resolveLayer(l, store.time))
        const snapped = snapPosition(
          { x: primaryStart.x + dx, y: primaryStart.y + dy },
          aabbHalfExtents(displaySize(primary, canvasMeasure), primary.transform.rotation),
          store.project,
          { xs: others.map((l) => l.transform.x), ys: others.map((l) => l.transform.y) },
          SNAP_PX / zoom,
        )
        dx = snapped.x - primaryStart.x
        dy = snapped.y - primaryStart.y
        nextGuides = snapped.guides
      }
      setGuides(nextGuides)
      store.updateLayers([...d.starts.keys()], 'Déplacer', (layer) => {
        const s = d.starts.get(layer.id)!
        layer.transform.x = s.x + dx
        layer.transform.y = s.y + dy
      })
      return
    }

    if (d.kind === 'resize') {
      store.updateLayer(d.start.id, 'Redimensionner', (draft) => resizeLayer(draft, d.start, d.startSize, d.handle, p, mods))
      return
    }

    if (d.kind === 'rotate') {
      const t = d.start.transform
      store.updateLayer(d.start.id, 'Pivoter', (draft) => {
        draft.transform.rotation = rotationFromDrag(t.rotation, t, d.from, p, e.shiftKey)
      })
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    // Applique la position finale : le dernier `pointermove` peut précéder le relâchement.
    if (drag.current) onPointerMove(e)
    if (drag.current && drag.current.kind !== 'pan') useEditor.getState().endGesture()
    drag.current = null
    setDragging(null)
    setGuides([])
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const { project, time } = useEditor.getState()
    const hit = hitTest(project, time, toComp(e.clientX, e.clientY), canvasMeasure, 4 / zoom)
    const layer = project.layers.find((l) => l.id === hit)
    if (layer?.type === 'text') window.dispatchEvent(new CustomEvent('motio:edit-text'))
  }

  const onDrop = (e: React.DragEvent) => {
    const at = toComp(e.clientX, e.clientY)
    // Fichiers glissés depuis le Finder : import + calque à l'endroit du dépôt.
    if (hasFiles(e)) {
      e.preventDefault()
      importFiles([...e.dataTransfer.files], at)
      return
    }
    const s = useEditor.getState()
    const asset = s.project.assets.find((a) => a.id === e.dataTransfer.getData(ASSET_MIME))
    if (asset) {
      e.preventDefault()
      if (asset.kind === 'audio') {
        s.addLayer(createAudioLayer(s.project, asset, s.time))
        return
      }
      const layer = createMedia(s.project, asset, at)
      layer.start = Math.min(s.time, Math.max(0, s.project.duration - 0.5))
      if (asset.kind === 'video') layer.end = Math.min(s.project.duration, layer.start + Math.max(0.5, asset.duration))
      s.addLayer(layer)
      return
    }
    const item = findItem(e.dataTransfer.getData(LIBRARY_MIME))
    if (!item) return
    e.preventDefault()
    s.addLayer(item.create(s.project, at))
  }

  // --- Overlay de sélection ------------------------------------------------

  const layersById = new Map(project.layers.map((l) => [l.id, l]))
  const selected = selection
    .map((id) => layersById.get(id))
    .filter((l): l is Layer => !!l && isActive(l, time))
    .map((l) => resolveLayer(l, time))
  const single = selected.length === 1 && !selected[0].locked ? selected[0] : null
  const hoveredLayer = hover && !selection.includes(hover) && !dragging ? layersById.get(hover) : undefined
  const hovered = hoveredLayer && resolveLayer(hoveredLayer, time)

  const outline = (layer: Layer) =>
    corners(layer.transform, displaySize(layer, canvasMeasure))
      .map(toScreen)
      .map((p) => `${p.x},${p.y}`)
      .join(' ')

  let cursor = 'default'
  if (dragging === 'pan' || spaceDown) cursor = dragging === 'pan' ? 'grabbing' : 'grab'
  else if (dragging === 'move' || (hover && selection.includes(hover))) cursor = 'move'

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden bg-ui-bg"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => !drag.current && setHover(null)}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => {
        if (hasFiles(e) || e.dataTransfer.types.includes(LIBRARY_MIME) || e.dataTransfer.types.includes(ASSET_MIME)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={onDrop}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h}>
        {guides.map((g, i) =>
          g.axis === 'x' ? (
            <line key={i} x1={g.value * zoom + ox} x2={g.value * zoom + ox} y1={oy} y2={oy + project.height * zoom} stroke="var(--color-guide)" />
          ) : (
            <line key={i} y1={g.value * zoom + oy} y2={g.value * zoom + oy} x1={ox} x2={ox + project.width * zoom} stroke="var(--color-guide)" />
          ),
        )}
        {hovered && <polygon points={outline(hovered)} fill="none" stroke="var(--color-accent)" strokeOpacity={0.6} />}
        {selected.map((layer) => (
          <polygon key={layer.id} points={outline(layer)} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} />
        ))}
        {single && single.type !== 'background' && dragging !== 'move' && <Handles layer={single} toScreen={toScreen} onHandleDown={onHandleDown} />}
      </svg>
    </div>
  )
}

function Handles({
  layer,
  toScreen,
  onHandleDown,
}: {
  layer: Layer
  toScreen: (p: Point) => Point
  onHandleDown: (e: ReactPointerEvent, layer: Layer, handle: Handle | 'rotate') => void
}) {
  const t = layer.transform
  const size = displaySize(layer, canvasMeasure)
  const top = toScreen(toWorld(t, { x: 0, y: -size.h / 2 }))
  const up = rotate({ x: 0, y: -1 }, t.rotation)
  const knob = { x: top.x + up.x * ROTATE_HANDLE_PX, y: top.y + up.y * ROTATE_HANDLE_PX }

  return (
    <g className="pointer-events-auto">
      <line x1={top.x} y1={top.y} x2={knob.x} y2={knob.y} stroke="var(--color-accent)" />
      <circle
        cx={knob.x}
        cy={knob.y}
        r={5}
        fill="white"
        stroke="var(--color-accent)"
        strokeWidth={1.5}
        style={{ cursor: 'grab' }}
        onPointerDown={(e) => onHandleDown(e, layer, 'rotate')}
      >
        <title>Pivoter (Maj : par pas de 15°)</title>
      </circle>
      {handlesFor(layer).map((handle) => {
        const [hx, hy] = HANDLE_DIR[handle]
        const p = toScreen(toWorld(t, { x: (hx * size.w) / 2, y: (hy * size.h) / 2 }))
        return (
          <rect
            key={handle}
            x={p.x - 4}
            y={p.y - 4}
            width={8}
            height={8}
            rx={1.5}
            fill="white"
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            transform={`rotate(${t.rotation} ${p.x} ${p.y})`}
            style={{ cursor: cursorFor(handle, t.rotation) }}
            onPointerDown={(e) => onHandleDown(e, layer, handle)}
          />
        )
      })}
    </g>
  )
}
