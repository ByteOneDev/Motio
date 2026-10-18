import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  Copy,
  Italic,
  Trash2,
} from 'lucide-react'
import { deleteKeyGroup, keyGroupEasing, resolveLayer, setKeyGroupEasing } from '@/engine/animate'
import { EASING_LABELS } from '@/engine/easing'
import { canvasMeasure } from '@/engine/measure'
import { isStrokeShape, layerSize } from '@/engine/geometry'
import { FORMATS, findFormat } from '@/model/formats'
import { changeDuration, changeFormat } from '@/model/operations'
import type { Easing, Layer, ShapeLayer, ShapeProps, TextLayer, TextProps } from '@/model/schema'
import { FontPicker } from './FontPicker'
import { AudioSection, BackgroundSection, BlurSection, IconSection, MediaSection, TextEffectsSection } from './StyleSections'
import { SubtitlesSection } from './SubtitlesSection'
import { snapToFrame, useEditor, useSelectedLayer } from '@/store/editor'
import { formatTime } from '../labels'
import { AnimationSection } from './AnimationSection'
import { KeyButton } from './KeyButton'
import {
  ColorField,
  IconButton,
  NumberField,
  Row,
  Section,
  Segmented,
  SelectField,
  SliderField,
  TextAreaField,
  ToggleButton,
} from './fields'

const WEIGHTS = [
  { label: 'Fin', value: 300 },
  { label: 'Normal', value: 400 },
  { label: 'Moyen', value: 500 },
  { label: 'Semi-gras', value: 600 },
  { label: 'Gras', value: 700 },
  { label: 'Extra-gras', value: 800 },
  { label: 'Noir', value: 900 },
]

const FPS = [24, 25, 30, 50, 60].map((v) => ({ label: `${v} i/s`, value: v }))

export function Inspector({ className = '' }: { className?: string }) {
  const layer = useSelectedLayer()
  const count = useEditor((s) => s.selection.length)
  return (
    <aside className={`overflow-y-auto bg-ui-panel ${className}`}>
      {layer ? <LayerInspector key={layer.id} layer={layer} /> : count > 1 ? <MultiInspector count={count} /> : <ProjectInspector />}
    </aside>
  )
}

function ProjectInspector() {
  const project = useEditor((s) => s.project)
  const update = useEditor((s) => s.update)
  const format = findFormat(project.width, project.height)

  return (
    <>
      <Section title="Projet">
        <input
          className="h-7 rounded border border-transparent bg-ui-raised px-2 text-[13px] text-ui-text outline-none hover:border-ui-line focus:border-accent"
          value={project.name}
          onChange={(e) => update('Renommer le projet', (d) => void (d.name = e.target.value), { coalesce: 'project-name' })}
        />
        <SelectField
          label="Format"
          value={format?.id ?? 'custom'}
          options={[...FORMATS.map((f) => ({ label: f.label, value: f.id })), ...(format ? [] : [{ label: `${project.width} × ${project.height}`, value: 'custom' }])]}
          onChange={(id) => {
            const f = FORMATS.find((f) => f.id === id)
            if (f) update('Changer le format', (d) => changeFormat(d, f.width, f.height))
          }}
        />
        <SelectField label="Cadence" value={project.fps} options={FPS} onChange={(fps) => update('Cadence', (d) => void (d.fps = fps))} />
        <NumberField
          label="⏱"
          title="Durée de la séquence"
          value={project.duration}
          min={0.5}
          max={600}
          step={0.1}
          precision={1}
          suffix="s"
          historyLabel="Durée"
          onChange={(v) => update('Durée', (d) => changeDuration(d, v), { coalesce: 'duration' })}
        />
        <ColorField
          label="Fond"
          value={project.background}
          onChange={(c) => update('Couleur de fond', (d) => void (d.background = c), { coalesce: 'background' })}
        />
      </Section>
      <PaletteSection />
      <div className="px-3 py-4 text-[11px] leading-relaxed text-ui-faint">
        Cliquez un élément dans la bibliothèque ou glissez-le sur le canevas. Sélectionnez un calque pour régler ses propriétés.
      </div>
    </>
  )
}

/** Couleurs de la charte : proposées sous chaque sélecteur de couleur. */
function PaletteSection() {
  const palette = useEditor((s) => s.project.palette)
  const update = useEditor((s) => s.update)
  return (
    <Section title="Charte">
      <div className="flex flex-wrap items-center gap-1.5">
        {palette.map((color, i) => (
          <div key={i} className="group relative">
            <label className="block h-7 w-7 cursor-pointer rounded border border-white/15" style={{ background: color }} title={`${color} — cliquer pour modifier`}>
              <input
                type="color"
                className="h-0 w-0 opacity-0"
                value={color.slice(0, 7)}
                onChange={(e) => update('Couleur de la charte', (d) => void (d.palette[i] = e.target.value), { coalesce: `palette:${i}` })}
              />
            </label>
            <button
              type="button"
              title="Retirer de la charte"
              onClick={() => update('Retirer une couleur', (d) => void d.palette.splice(i, 1))}
              className="absolute -top-1.5 -right-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-ui-bg text-[9px] text-ui-muted group-hover:flex hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          title="Ajouter une couleur"
          onClick={() => update('Ajouter une couleur', (d) => void d.palette.push('#ffffff'))}
          className="flex h-7 w-7 items-center justify-center rounded border border-dashed border-ui-line text-ui-muted hover:border-accent/60 hover:text-ui-text"
        >
          +
        </button>
      </div>
    </Section>
  )
}

function MultiInspector({ count }: { count: number }) {
  const { selection, removeLayers, duplicateLayers } = useEditor.getState()
  return (
    <Section title={`${count} calques sélectionnés`}>
      <Row>
        <IconButton title="Dupliquer (⌘D)" onClick={() => duplicateLayers(selection)}>
          <Copy size={14} /> <span className="ml-1.5">Dupliquer</span>
        </IconButton>
        <IconButton title="Supprimer (⌫)" onClick={() => removeLayers(selection)}>
          <Trash2 size={14} /> <span className="ml-1.5">Supprimer</span>
        </IconButton>
      </Row>
    </Section>
  )
}

const LAYER_TITLES: Record<Layer['type'], string> = {
  text: 'Texte',
  shape: 'Forme',
  media: 'Média',
  background: 'Fond',
  audio: 'Audio',
  icon: 'Icône',
  subtitles: 'Sous-titres',
  blur: 'Masquage',
}

function LayerInspector({ layer: source }: { layer: Layer }) {
  const updateLayer = useEditor((s) => s.updateLayer)
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selectedKey = useEditor((s) => s.selectedKey)
  // Les valeurs affichées sont celles de l'instant courant ; les modifier crée une image clé si la propriété est animée.
  const layer = resolveLayer(source, time)
  const edit = (key: string, label: string, recipe: (l: Layer) => void) =>
    updateLayer(layer.id, label, recipe, { coalesce: `${key}:${layer.id}` })
  const t = layer.transform
  const size = layerSize(layer, canvasMeasure)
  const stroke = isStrokeShape(layer)
  const fps = project.fps

  return (
    <>
      {selectedKey?.layerId === layer.id && <KeyPanel layer={source} time={selectedKey.time} />}
      <Section
        title={LAYER_TITLES[layer.type]}
        actions={
          <div className="flex gap-1">
            <IconButton title="Dupliquer (⌘D)" onClick={() => useEditor.getState().duplicateLayers([layer.id])}>
              <Copy size={13} />
            </IconButton>
            <IconButton title="Supprimer (⌫)" onClick={() => useEditor.getState().removeLayers([layer.id])}>
              <Trash2 size={13} />
            </IconButton>
          </div>
        }
      >
        <input
          className="h-7 rounded border border-transparent bg-ui-raised px-2 text-[13px] text-ui-text outline-none hover:border-ui-line focus:border-accent"
          value={layer.name}
          onChange={(e) => edit('name', 'Renommer', (l) => void (l.name = e.target.value))}
        />
      </Section>

      {layer.type === 'background' && (
        <>
          <BackgroundSection layer={layer} />
          <Section title="Opacité">
            <SliderField
              label="Opacité"
              value={t.opacity * 100}
              onChange={(v) => edit('opacity', 'Opacité', (l) => void (l.transform.opacity = v / 100))}
              extra={<KeyButton layer={layer} prop="opacity" />}
            />
          </Section>
        </>
      )}

      {layer.type === 'audio' && <AudioSection layer={layer} />}
      {layer.type === 'subtitles' && <SubtitlesSection layer={layer} />}

      {layer.type !== 'background' && layer.type !== 'audio' && layer.type !== 'subtitles' && (
        <Section
          title="Disposition"
          actions={
            <div className="flex gap-1">
              <IconButton title="Centrer horizontalement" onClick={() => edit('center-x', 'Centrer', (l) => void (l.transform.x = project.width / 2))}>
                <AlignCenterVertical size={13} />
              </IconButton>
              <IconButton title="Centrer verticalement" onClick={() => edit('center-y', 'Centrer', (l) => void (l.transform.y = project.height / 2))}>
                <AlignCenterHorizontal size={13} />
              </IconButton>
            </div>
          }
        >
          <Row>
            <NumberField
              label="X"
              value={t.x}
              historyLabel="Position"
              onChange={(v) => edit('x', 'Position', (l) => void (l.transform.x = v))}
              extra={<KeyButton layer={layer} prop="x" />}
            />
            <NumberField
              label="Y"
              value={t.y}
              historyLabel="Position"
              onChange={(v) => edit('y', 'Position', (l) => void (l.transform.y = v))}
              extra={<KeyButton layer={layer} prop="y" />}
            />
          </Row>
          <Row>
            <NumberField
              label="L"
              title="Largeur"
              value={size.w}
              min={1}
              historyLabel="Taille"
              onChange={(v) =>
                edit('w', 'Taille', (l) => {
                  if (l.type === 'text') {
                    // Changer la largeur d'un texte fixe sa zone de retour à la ligne.
                    l.props.autoWidth = false
                  }
                  l.transform.width = v
                })
              }
            />
            {layer.type === 'shape' && !stroke ? (
              <NumberField label="H" title="Hauteur" value={t.height} min={1} historyLabel="Taille" onChange={(v) => edit('h', 'Taille', (l) => void (l.transform.height = v))} />
            ) : (
              <div className="flex h-7 items-center rounded bg-ui-raised text-ui-faint" title="Hauteur automatique">
                <span className="w-6 pl-2 text-[11px]">H</span>
                <span className="pl-1">{Math.round(size.h)}</span>
              </div>
            )}
          </Row>
          <Row>
            <NumberField
              label="↻"
              title="Rotation"
              value={t.rotation}
              suffix="°"
              precision={1}
              historyLabel="Rotation"
              onChange={(v) => edit('rotation', 'Rotation', (l) => void (l.transform.rotation = v))}
              extra={<KeyButton layer={layer} prop="rotation" />}
            />
            <NumberField
              label="⤢"
              title="Échelle"
              value={t.scale * 100}
              min={1}
              max={2000}
              suffix="%"
              historyLabel="Échelle"
              onChange={(v) => edit('scale', 'Échelle', (l) => void (l.transform.scale = v / 100))}
              extra={<KeyButton layer={layer} prop="scale" />}
            />
          </Row>
          <SliderField
            label="Opacité"
            value={t.opacity * 100}
            onChange={(v) => edit('opacity', 'Opacité', (l) => void (l.transform.opacity = v / 100))}
            extra={<KeyButton layer={layer} prop="opacity" />}
          />
        </Section>
      )}

      <Section title="Temps">
        <Row>
          <NumberField
            label="De"
            title="Apparition (début du calque)"
            value={layer.start}
            min={0}
            max={layer.end - 1 / fps}
            step={1 / fps}
            precision={2}
            suffix="s"
            historyLabel="Début"
            onChange={(v) => edit('start', 'Début', (l) => void (l.start = snapToFrame(v, fps)))}
          />
          <NumberField
            label="À"
            title="Disparition (fin du calque)"
            value={layer.end}
            min={layer.start + 1 / fps}
            max={project.duration}
            step={1 / fps}
            precision={2}
            suffix="s"
            historyLabel="Fin"
            onChange={(v) => edit('end', 'Fin', (l) => void (l.end = snapToFrame(v, fps)))}
          />
        </Row>
      </Section>

      {layer.type !== 'audio' && layer.type !== 'subtitles' && <AnimationSection layer={source} />}

      {layer.type === 'text' && (
        <>
          <TextSection layer={layer} />
          <TextEffectsSection layer={layer} />
        </>
      )}
      {layer.type === 'shape' && <ShapeSection layer={layer} />}
      {layer.type === 'media' && <MediaSection layer={layer} />}
      {layer.type === 'icon' && <IconSection layer={layer} />}
      {layer.type === 'blur' && <BlurSection layer={layer} />}
    </>
  )
}

function TextSection({ layer }: { layer: TextLayer }) {
  const updateLayer = useEditor((s) => s.updateLayer)
  const p = layer.props
  const edit = (key: string, label: string, recipe: (p: TextProps) => void) =>
    updateLayer(layer.id, label, (l) => l.type === 'text' && recipe(l.props), { coalesce: `${key}:${layer.id}` })

  return (
    <Section title="Typographie">
      <TextAreaField value={p.text} onChange={(v) => edit('text', 'Modifier le texte', (p) => void (p.text = v))} />
      <FontPicker value={p.fontFamily} onChange={(v) => edit('font', 'Police', (p) => void (p.fontFamily = v))} />
      <SelectField label="Graisse" value={p.fontWeight} options={WEIGHTS} onChange={(v) => edit('weight', 'Graisse', (p) => void (p.fontWeight = v))} />
      <Row>
        <NumberField label="T" title="Taille" value={p.fontSize} min={1} precision={1} suffix="px" historyLabel="Taille du texte" onChange={(v) => edit('size', 'Taille du texte', (p) => void (p.fontSize = v))} />
        <ToggleButton active={p.italic} title="Italique" onClick={() => edit('italic', 'Italique', (p) => void (p.italic = !p.italic))}>
          <Italic size={14} />
        </ToggleButton>
      </Row>
      <ColorField
        label="Couleur"
        value={p.color}
        onChange={(c) => edit('color', 'Couleur du texte', (p) => void (p.color = c))}
        extra={<KeyButton layer={layer} prop="color" />}
      />
      <Segmented
        value={p.align}
        onChange={(v) => edit('align', 'Alignement', (p) => void (p.align = v))}
        options={[
          { value: 'left', icon: <AlignLeft size={14} />, title: 'Aligner à gauche' },
          { value: 'center', icon: <AlignCenter size={14} />, title: 'Centrer' },
          { value: 'right', icon: <AlignRight size={14} />, title: 'Aligner à droite' },
        ]}
      />
      <Row>
        <NumberField label="↕" title="Interligne" value={p.lineHeight} min={0.5} max={4} step={0.01} precision={2} historyLabel="Interligne" onChange={(v) => edit('lh', 'Interligne', (p) => void (p.lineHeight = v))} />
        <NumberField label="↔" title="Espacement des lettres" value={p.letterSpacing} step={0.5} precision={1} suffix="px" historyLabel="Espacement" onChange={(v) => edit('ls', 'Espacement', (p) => void (p.letterSpacing = v))} />
      </Row>
      <ToggleButton
        active={p.autoWidth}
        title="La zone s'adapte au texte ; sinon le texte passe à la ligne dans la largeur choisie"
        onClick={() => edit('auto', 'Largeur auto', (p) => void (p.autoWidth = !p.autoWidth))}
      >
        Largeur automatique
      </ToggleButton>
    </Section>
  )
}

function ShapeSection({ layer }: { layer: ShapeLayer }) {
  const updateLayer = useEditor((s) => s.updateLayer)
  const p = layer.props
  const edit = (key: string, label: string, recipe: (p: ShapeProps) => void) =>
    updateLayer(layer.id, label, (l) => l.type === 'shape' && recipe(l.props), { coalesce: `${key}:${layer.id}` })

  if (p.kind === 'line' || p.kind === 'arrow') {
    return (
      <Section title="Trait">
        <ColorField
          label="Couleur"
          value={p.stroke ?? '#ffffff'}
          onChange={(c) => edit('stroke', 'Couleur', (p) => void (p.stroke = c))}
          extra={<KeyButton layer={layer} prop="color" />}
        />
        <NumberField label="⎯" title="Épaisseur" value={p.strokeWidth} min={1} max={200} suffix="px" historyLabel="Épaisseur" onChange={(v) => edit('sw', 'Épaisseur', (p) => void (p.strokeWidth = v))} />
      </Section>
    )
  }

  return (
    <Section title="Apparence">
      <ColorField
        label="Remplissage"
        value={p.fill}
        onChange={(c) => edit('fill', 'Remplissage', (p) => void (p.fill = c))}
        onClear={() => edit('fill-clear', 'Retirer le remplissage', (p) => void (p.fill = null))}
        extra={p.fill ? <KeyButton layer={layer} prop="color" /> : undefined}
      />
      <ColorField
        label="Contour"
        value={p.stroke}
        onChange={(c) => edit('stroke', 'Contour', (p) => void (p.stroke = c))}
        onClear={() => edit('stroke-clear', 'Retirer le contour', (p) => void (p.stroke = null))}
      />
      <Row>
        {p.stroke ? (
          <NumberField label="⎯" title="Épaisseur du contour" value={p.strokeWidth} min={0} max={200} suffix="px" historyLabel="Épaisseur" onChange={(v) => edit('sw', 'Épaisseur', (p) => void (p.strokeWidth = v))} />
        ) : (
          <div />
        )}
        {p.kind === 'rect' ? (
          <NumberField label="◜" title="Arrondi des coins" value={p.radius} min={0} suffix="px" historyLabel="Arrondi" onChange={(v) => edit('radius', 'Arrondi', (p) => void (p.radius = v))} />
        ) : (
          <div />
        )}
      </Row>
    </Section>
  )
}

const EASING_OPTIONS = (Object.keys(EASING_LABELS) as Easing[]).map((value) => ({ label: EASING_LABELS[value], value }))

/** Réglages de l'image clé sélectionnée dans la timeline (toutes les propriétés à cet instant). */
function KeyPanel({ layer, time }: { layer: Layer; time: number }) {
  const update = useEditor((s) => s.update)
  const easing = keyGroupEasing(layer, time)
  const edit = (label: string, recipe: (l: Layer) => void) =>
    update(label, (draft) => {
      const l = draft.layers.find((x) => x.id === layer.id)
      if (l) recipe(l)
    })

  return (
    <Section
      title={`Image clé · ${formatTime(time)}`}
      actions={
        <IconButton
          title="Supprimer l'image clé (⌫)"
          onClick={() => {
            edit('Supprimer l’image clé', (l) => deleteKeyGroup(l, time))
            useEditor.getState().selectKey(null)
          }}
        >
          <Trash2 size={13} />
        </IconButton>
      }
    >
      <SelectField<Easing | 'mixed'>
        label="Courbe"
        value={easing ?? 'mixed'}
        options={[...(easing ? [] : [{ label: 'Mixte', value: 'mixed' as const }]), ...EASING_OPTIONS]}
        onChange={(v) => v !== 'mixed' && edit('Courbe de l’image clé', (l) => setKeyGroupEasing(l, time, v))}
      />
      <p className="text-[11px] leading-snug text-ui-faint">La courbe règle la transition jusqu’à l’image clé suivante.</p>
    </Section>
  )
}
