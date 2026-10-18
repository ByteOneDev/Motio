import { CaseUpper, Plus, Trash2, ZoomIn } from 'lucide-react'
import { useRef, useState } from 'react'
import { findIcon, ICONS } from '@/model/icons'
import { newId } from '@/model/factories'
import type {
  Asset,
  AudioLayer,
  AudioProps,
  BackgroundLayer,
  BackgroundProps,
  BlurLayer,
  BlurProps,
  IconLayer,
  IconProps,
  MediaLayer,
  MediaProps,
  TextLayer,
  TextProps,
  Zoom,
} from '@/model/schema'
import { useEditor } from '@/store/editor'
import { KeyButton } from './KeyButton'
import { ColorField, NumberField, Row, Section, Segmented, SelectField, SliderField, ToggleButton } from './fields'

function useEditProps<P>(layerId: string, type: 'text' | 'media' | 'background' | 'audio' | 'icon' | 'blur') {
  const updateLayer = useEditor((s) => s.updateLayer)
  return (key: string, label: string, recipe: (p: P) => void) =>
    updateLayer(layerId, label, (l) => void (l.type === type && recipe(l.props as P)), { coalesce: `${key}:${layerId}` })
}

/** Effets de texte : majuscules, pastille de fond, contour, ombre. */
export function TextEffectsSection({ layer }: { layer: TextLayer }) {
  const p = layer.props
  const edit = useEditProps<TextProps>(layer.id, 'text')
  const em = p.fontSize

  return (
    <Section title="Effets">
      <ToggleButton active={p.uppercase} title="Afficher le texte en majuscules" onClick={() => edit('upper', 'Majuscules', (p) => void (p.uppercase = !p.uppercase))}>
        <CaseUpper size={15} /> Majuscules
      </ToggleButton>

      <ColorField
        label="Pastille"
        value={p.highlight?.color ?? null}
        onChange={(c) =>
          edit('hl', 'Pastille', (p) => {
            if (p.highlight) p.highlight.color = c
            else p.highlight = { color: c, padding: Math.round(em * 0.4), radius: Math.round(em * 0.25) }
          })
        }
        onClear={() => edit('hl-clear', 'Retirer la pastille', (p) => void (p.highlight = null))}
      />
      {p.highlight && (
        <Row>
          <NumberField label="↔" title="Marge intérieure" value={p.highlight.padding} min={0} suffix="px" historyLabel="Marge" onChange={(v) => edit('hl-pad', 'Marge', (p) => void (p.highlight && (p.highlight.padding = v)))} />
          <NumberField label="◜" title="Arrondi" value={p.highlight.radius} min={0} suffix="px" historyLabel="Arrondi" onChange={(v) => edit('hl-r', 'Arrondi', (p) => void (p.highlight && (p.highlight.radius = v)))} />
        </Row>
      )}

      <ColorField
        label="Contour"
        value={p.outline?.color ?? null}
        onChange={(c) =>
          edit('ol', 'Contour', (p) => {
            if (p.outline) p.outline.color = c
            else p.outline = { color: c, width: Math.max(1, Math.round(em * 0.03)) }
          })
        }
        onClear={() => edit('ol-clear', 'Retirer le contour', (p) => void (p.outline = null))}
      />
      {p.outline && (
        <NumberField label="⎯" title="Épaisseur du contour" value={p.outline.width} min={0} precision={1} suffix="px" historyLabel="Contour" onChange={(v) => edit('ol-w', 'Contour', (p) => void (p.outline && (p.outline.width = v)))} />
      )}

      <ColorField
        label="Ombre"
        value={p.shadow?.color ?? null}
        onChange={(c) =>
          edit('sh', 'Ombre', (p) => {
            if (p.shadow) p.shadow.color = c
            else p.shadow = { color: c, blur: Math.round(em * 0.2), offsetY: Math.round(em * 0.06) }
          })
        }
        onClear={() => edit('sh-clear', 'Retirer l’ombre', (p) => void (p.shadow = null))}
      />
      {p.shadow && (
        <Row>
          <NumberField label="◌" title="Flou de l'ombre" value={p.shadow.blur} min={0} suffix="px" historyLabel="Ombre" onChange={(v) => edit('sh-b', 'Ombre', (p) => void (p.shadow && (p.shadow.blur = v)))} />
          <NumberField label="↓" title="Décalage vertical" value={p.shadow.offsetY} suffix="px" historyLabel="Ombre" onChange={(v) => edit('sh-y', 'Ombre', (p) => void (p.shadow && (p.shadow.offsetY = v)))} />
        </Row>
      )}
    </Section>
  )
}

export function MediaSection({ layer }: { layer: MediaLayer }) {
  const asset = useEditor((s) => s.project.assets.find((a) => a.id === layer.props.assetId))
  return (
    <>
      <MediaLook layer={layer} />
      <ZoomSection layer={layer} asset={asset} />
    </>
  )
}

function MediaLook({ layer }: { layer: MediaLayer }) {
  const p = layer.props
  const edit = useEditProps<MediaProps>(layer.id, 'media')
  const asset = useEditor((s) => s.project.assets.find((a) => a.id === p.assetId))

  return (
    <Section title={asset?.kind === 'video' ? 'Vidéo' : 'Image'}>
      <div className="truncate text-[11px] text-ui-faint" title={asset?.path ?? asset?.name}>
        {asset ? asset.name : 'Média introuvable'}
        {asset && ` · ${asset.width} × ${asset.height}`}
      </div>
      <Segmented
        value={p.fit}
        onChange={(v) => edit('fit', 'Ajustement', (p) => void (p.fit = v))}
        options={[
          { value: 'cover', icon: <span className="text-[11px]">Remplir</span>, title: 'Remplir la boîte (recadre si besoin)' },
          { value: 'contain', icon: <span className="text-[11px]">Entière</span>, title: 'Image entière dans la boîte' },
          { value: 'fill', icon: <span className="text-[11px]">Étirer</span>, title: 'Étirer à la taille de la boîte' },
        ]}
      />
      <Row>
        <NumberField label="◜" title="Arrondi des coins" value={p.radius} min={0} suffix="px" historyLabel="Arrondi" onChange={(v) => edit('radius', 'Arrondi', (p) => void (p.radius = v))} />
        <ToggleButton active={p.shadow} title="Ombre portée" onClick={() => edit('shadow', 'Ombre', (p) => void (p.shadow = !p.shadow))}>
          Ombre
        </ToggleButton>
      </Row>
      <ColorField
        label="Bordure"
        value={p.stroke}
        onChange={(c) => edit('stroke', 'Bordure', (p) => void (p.stroke = c))}
        onClear={() => edit('stroke-clear', 'Retirer la bordure', (p) => void (p.stroke = null))}
        extra={p.stroke ? <KeyButton layer={layer} prop="color" /> : undefined}
      />
      {p.stroke && (
        <NumberField label="⎯" title="Épaisseur de la bordure" value={p.strokeWidth} min={0} suffix="px" historyLabel="Bordure" onChange={(v) => edit('sw', 'Bordure', (p) => void (p.strokeWidth = v))} />
      )}
      {asset?.kind === 'video' && (
        <SliderField label="Son" value={p.volume * 100} max={200} historyLabel="Volume" onChange={(v) => edit('vol', 'Volume', (p) => void (p.volume = v / 100))} />
      )}
      {asset?.kind === 'video' && (
        <NumberField
          label="▶︎"
          title="Instant de la vidéo source montré au début du calque"
          value={p.videoStart}
          min={0}
          max={asset.duration}
          step={0.1}
          precision={2}
          suffix="s"
          historyLabel="Début de la vidéo"
          onChange={(v) => edit('vs', 'Début de la vidéo', (p) => void (p.videoStart = v))}
        />
      )}
    </Section>
  )
}

const PATTERNS: { label: string; value: BackgroundProps['pattern'] }[] = [
  { label: 'Aucun', value: 'none' },
  { label: 'Grille', value: 'grid' },
  { label: 'Points', value: 'dots' },
  { label: 'Rayures', value: 'lines' },
]

export function BackgroundSection({ layer }: { layer: BackgroundLayer }) {
  const p = layer.props
  const edit = useEditProps<BackgroundProps>(layer.id, 'background')

  return (
    <Section title="Fond">
      <Segmented
        value={p.fill}
        onChange={(v) => edit('fill', 'Type de fond', (p) => void (p.fill = v))}
        options={[
          { value: 'solid', icon: <span className="text-[11px]">Uni</span>, title: 'Couleur unie' },
          { value: 'linear', icon: <span className="text-[11px]">Linéaire</span>, title: 'Dégradé linéaire' },
          { value: 'radial', icon: <span className="text-[11px]">Radial</span>, title: 'Dégradé radial' },
        ]}
      />
      <ColorField
        label={p.fill === 'solid' ? 'Couleur' : p.fill === 'radial' ? 'Centre' : 'Début'}
        value={p.color1}
        onChange={(c) => edit('c1', 'Couleur du fond', (p) => void (p.color1 = c))}
        extra={<KeyButton layer={layer} prop="color" />}
      />
      {p.fill !== 'solid' && (
        <ColorField label={p.fill === 'radial' ? 'Bords' : 'Fin'} value={p.color2} onChange={(c) => edit('c2', 'Couleur du fond', (p) => void (p.color2 = c))} />
      )}
      {p.fill === 'linear' && (
        <NumberField label="∠" title="Angle du dégradé" value={p.angle} suffix="°" historyLabel="Angle" onChange={(v) => edit('angle', 'Angle', (p) => void (p.angle = v))} />
      )}
      <SelectField label="Motif" value={p.pattern} options={PATTERNS} onChange={(v) => edit('pattern', 'Motif', (p) => void (p.pattern = v))} />
      {p.pattern !== 'none' && (
        <>
          <ColorField label="Couleur" value={p.patternColor} onChange={(c) => edit('pc', 'Couleur du motif', (p) => void (p.patternColor = c))} />
          <NumberField label="▦" title="Taille du motif" value={p.patternSize} min={4} suffix="px" historyLabel="Taille du motif" onChange={(v) => edit('ps', 'Taille du motif', (p) => void (p.patternSize = v))} />
        </>
      )}
    </Section>
  )
}

export function AudioSection({ layer }: { layer: AudioLayer }) {
  const p = layer.props
  const edit = useEditProps<AudioProps>(layer.id, 'audio')
  const asset = useEditor((s) => s.project.assets.find((a) => a.id === p.assetId))
  const length = layer.end - layer.start

  return (
    <Section title="Son">
      <div className="truncate text-[11px] text-ui-faint" title={asset?.path ?? asset?.name}>
        {asset ? `${asset.generated ? 'Généré par Motio · libre de droits' : asset.name} · ${asset.duration.toFixed(1).replace('.', ',')} s` : 'Son introuvable'}
      </div>
      <SliderField label="Volume" value={p.volume * 100} max={200} historyLabel="Volume" onChange={(v) => edit('vol', 'Volume', (p) => void (p.volume = v / 100))} />
      <Row>
        <NumberField
          label="↗"
          title="Fondu d'entrée du son"
          value={p.fadeIn}
          min={0}
          max={length}
          step={0.1}
          precision={1}
          suffix="s"
          historyLabel="Fondu d'entrée"
          onChange={(v) => edit('fin', 'Fondu d’entrée', (p) => void (p.fadeIn = v))}
        />
        <NumberField
          label="↘"
          title="Fondu de sortie du son"
          value={p.fadeOut}
          min={0}
          max={length}
          step={0.1}
          precision={1}
          suffix="s"
          historyLabel="Fondu de sortie"
          onChange={(v) => edit('fout', 'Fondu de sortie', (p) => void (p.fadeOut = v))}
        />
      </Row>
      <NumberField
        label="▶︎"
        title="Instant de la source joué au début du calque"
        value={p.sourceStart}
        min={0}
        max={asset?.duration}
        step={0.1}
        precision={2}
        suffix="s"
        historyLabel="Début dans la source"
        onChange={(v) => edit('ss', 'Début dans la source', (p) => void (p.sourceStart = v))}
      />
      <ToggleButton active={p.loop} title="Rejouer le son en boucle jusqu'à la fin du calque" onClick={() => edit('loop', 'Boucle', (p) => void (p.loop = !p.loop))}>
        Lecture en boucle
      </ToggleButton>
      <TempoField value={p.bpm} onChange={(bpm) => edit('bpm', 'Tempo', (p) => void (p.bpm = bpm))} />
    </Section>
  )
}

export function IconSection({ layer }: { layer: IconLayer }) {
  const p = layer.props
  const edit = useEditProps<IconProps>(layer.id, 'icon')
  return (
    <Section title="Icône">
      <SelectField
        label="Icône"
        value={p.icon}
        options={ICONS.map((i) => ({ label: i.label, value: i.id }))}
        onChange={(v) => edit('icon', 'Icône', (p) => void (p.icon = v))}
      />
      <ColorField label="Couleur" value={p.color} onChange={(c) => edit('color', 'Couleur', (p) => void (p.color = c))} extra={<KeyButton layer={layer} prop="color" />} />
      <NumberField
        label="⎯"
        title="Épaisseur du trait"
        value={p.strokeWidth}
        min={0.5}
        max={4}
        step={0.05}
        precision={2}
        historyLabel="Épaisseur"
        onChange={(v) => edit('sw', 'Épaisseur', (p) => void (p.strokeWidth = v))}
      />
      {!findIcon(p.icon) && <p className="text-[11px] text-red-300">Icône inconnue</p>}
    </Section>
  )
}

export function BlurSection({ layer }: { layer: BlurLayer }) {
  const p = layer.props
  const edit = useEditProps<BlurProps>(layer.id, 'blur')
  return (
    <Section title="Masquage">
      <p className="text-[11px] leading-snug text-ui-faint">Ce qui se trouve sous la zone est flouté ou pixellisé (e-mail, mot de passe, visage…).</p>
      <Segmented
        value={p.mode}
        onChange={(v) => edit('mode', 'Type de masquage', (p) => void (p.mode = v))}
        options={[
          { value: 'blur', icon: <span className="text-[11px]">Flou</span>, title: 'Flou' },
          { value: 'pixelate', icon: <span className="text-[11px]">Pixels</span>, title: 'Pixellisation' },
        ]}
      />
      <Row>
        <NumberField
          label={p.mode === 'blur' ? '◌' : '▦'}
          title={p.mode === 'blur' ? 'Intensité du flou' : 'Taille des pixels'}
          value={p.amount}
          min={1}
          max={200}
          suffix="px"
          historyLabel="Intensité"
          onChange={(v) => edit('amount', 'Intensité', (p) => void (p.amount = v))}
        />
        <NumberField label="◜" title="Arrondi des coins" value={p.radius} min={0} suffix="px" historyLabel="Arrondi" onChange={(v) => edit('radius', 'Arrondi', (p) => void (p.radius = v))} />
      </Row>
    </Section>
  )
}

/**
 * Zooms caméra d'un média : chaque zoom resserre l'image sur un point de la source pendant
 * un moment (idéal pour montrer un bouton dans une capture d'écran), avec aller et retour en douceur.
 */
export function ZoomSection({ layer, asset }: { layer: MediaLayer; asset: Asset | undefined }) {
  const time = useEditor((s) => s.time)
  const [selected, setSelected] = useState<string | null>(layer.props.zooms[0]?.id ?? null)
  const zooms = layer.props.zooms
  const zoom = zooms.find((z) => z.id === selected) ?? null
  const editZoom = (key: string, label: string, recipe: (z: Zoom) => void) =>
    useEditor.getState().updateLayer(
      layer.id,
      label,
      (l) => {
        if (l.type !== 'media') return
        const z = l.props.zooms.find((x) => x.id === selected)
        if (z) recipe(z)
      },
      { coalesce: `zoom.${key}:${selected}` },
    )

  const add = () => {
    const id = newId()
    const at = Math.max(0, Math.min(time - layer.start, layer.end - layer.start - 1))
    const last = zooms[zooms.length - 1]
    useEditor.getState().updateLayer(layer.id, 'Ajouter un zoom', (l) => {
      if (l.type !== 'media') return
      l.props.zooms.push({ id, at, duration: Math.min(2.5, layer.end - layer.start - at), scale: 2, cx: last?.cx ?? 0.5, cy: last?.cy ?? 0.5, ramp: 0.5 })
      l.props.zooms.sort((a, b) => a.at - b.at)
    })
    setSelected(id)
  }

  return (
    <Section
      title="Zooms caméra"
      actions={
        <button type="button" onClick={add} title="Ajouter un zoom à la tête de lecture" className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ui-muted hover:bg-ui-hover hover:text-ui-text">
          <Plus size={12} /> Zoom ici
        </button>
      }
    >
      {zooms.length === 0 && (
        <p className="text-[11px] leading-snug text-ui-faint">
          Placez la tête de lecture, cliquez « Zoom ici », puis choisissez le point à montrer sur l’aperçu ci-dessous.
        </p>
      )}
      {zooms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {zooms.map((z, i) => (
            <button
              key={z.id}
              type="button"
              onClick={() => {
                setSelected(z.id)
                useEditor.getState().setTime(layer.start + z.at + z.ramp)
              }}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${z.id === selected ? 'bg-accent-soft text-ui-text' : 'bg-ui-raised text-ui-muted hover:text-ui-text'}`}
            >
              <ZoomIn size={11} /> {i + 1} · {formatSeconds(layer.start + z.at)}
            </button>
          ))}
        </div>
      )}
      {zoom && asset && (
        <>
          <ZoomPicker asset={asset} zoom={zoom} sourceTime={zoom.at + layer.props.videoStart} onPick={(cx, cy) => editZoom('center', 'Point du zoom', (z) => Object.assign(z, { cx, cy }))} />
          <Row>
            <NumberField label="×" title="Grossissement" value={zoom.scale * 100} min={100} max={800} step={5} suffix="%" historyLabel="Grossissement" onChange={(v) => editZoom('scale', 'Grossissement', (z) => void (z.scale = v / 100))} />
            <NumberField label="⏱" title="Durée du zoom" value={zoom.duration} min={0.3} step={0.1} precision={1} suffix="s" historyLabel="Durée du zoom" onChange={(v) => editZoom('dur', 'Durée du zoom', (z) => void (z.duration = v))} />
          </Row>
          <Row>
            <NumberField label="À" title="Début du zoom" value={layer.start + zoom.at} min={layer.start} step={0.1} precision={2} suffix="s" historyLabel="Début du zoom" onChange={(v) => editZoom('at', 'Début du zoom', (z) => void (z.at = Math.max(0, v - layer.start)))} />
            <NumberField label="↗" title="Durée de l'aller et du retour" value={zoom.ramp} min={0} max={3} step={0.05} precision={2} suffix="s" historyLabel="Transition du zoom" onChange={(v) => editZoom('ramp', 'Transition du zoom', (z) => void (z.ramp = v))} />
          </Row>
          <button
            type="button"
            onClick={() => {
              useEditor.getState().updateLayer(layer.id, 'Supprimer le zoom', (l) => {
                if (l.type === 'media') l.props.zooms = l.props.zooms.filter((z) => z.id !== selected)
              })
              setSelected(null)
            }}
            className="flex h-7 items-center justify-center gap-1 rounded bg-ui-raised text-[11px] text-ui-muted hover:bg-ui-hover hover:text-ui-text"
          >
            <Trash2 size={12} /> Supprimer ce zoom
          </button>
        </>
      )}
    </Section>
  )
}

function formatSeconds(t: number): string {
  return `${t.toFixed(1).replace('.', ',')} s`
}

/** Aperçu de la source : cliquer ou glisser place le centre du zoom ; le cadre montre ce qui sera visible. */
function ZoomPicker({ asset, zoom, sourceTime, onPick }: { asset: Asset; zoom: Zoom; sourceTime: number; onPick: (cx: number, cy: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    onPick(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)))
  }
  const fw = 100 / zoom.scale
  const left = Math.min(100 - fw, Math.max(0, zoom.cx * 100 - fw / 2))
  const top = Math.min(100 - fw, Math.max(0, zoom.cy * 100 - fw / 2))
  return (
    <div
      ref={ref}
      className="relative w-full cursor-crosshair overflow-hidden rounded bg-black"
      style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pick(e)
      }}
      onPointerMove={(e) => e.buttons === 1 && pick(e)}
      title="Cliquez sur la zone à montrer"
    >
      {asset.kind === 'image' ? (
        <img src={asset.src} alt="" className="pointer-events-none h-full w-full object-fill" draggable={false} />
      ) : (
        <video
          src={asset.src}
          muted
          preload="auto"
          className="pointer-events-none h-full w-full object-fill"
          // On montre l'image de la vidéo au moment du zoom.
          ref={(v) => {
            if (v && Math.abs(v.currentTime - sourceTime) > 0.05) v.currentTime = sourceTime
          }}
        />
      )}
      <div className="pointer-events-none absolute border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" style={{ left: `${left}%`, top: `${top}%`, width: `${fw}%`, height: `${fw}%` }} />
    </div>
  )
}

/**
 * Tempo d'une musique (BPM) : saisi, ou « tapé » en rythme sur le bouton. Il sert à afficher
 * les temps dans la timeline et à y caler les animations.
 */
function TempoField({ value, onChange }: { value: number | null; onChange: (bpm: number | null) => void }) {
  const taps = useRef<number[]>([])
  const tap = () => {
    const now = performance.now()
    // Une pause de plus de 2 s recommence la mesure.
    taps.current = [...taps.current.filter((t) => now - t < 2000), now].slice(-8)
    if (taps.current.length >= 3) {
      const intervals = taps.current.slice(1).map((t, i) => t - taps.current[i])
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      onChange(Math.round(60000 / avg))
    }
  }
  return (
    <Row>
      <NumberField
        label="♩"
        title="Tempo (battements par minute) — pour caler les animations sur la musique"
        value={value ?? 0}
        min={0}
        max={300}
        suffix="BPM"
        historyLabel="Tempo"
        onChange={(v) => onChange(v > 0 ? v : null)}
      />
      <button
        type="button"
        onClick={tap}
        title="Tapez en rythme (au moins 3 fois) pour mesurer le tempo"
        className="h-7 rounded bg-ui-raised text-[11px] text-ui-muted hover:bg-ui-hover hover:text-ui-text active:bg-accent-soft"
      >
        Taper le tempo
      </button>
    </Row>
  )
}
