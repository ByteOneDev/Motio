import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Repeat } from 'lucide-react'
import { animWindows, emphasisWindow } from '@/engine/animate'
import { EASING_LABELS } from '@/engine/easing'
import { createEmphasis, createInOut } from '@/model/factories'
import { EMPHASIS_PRESETS, type Direction, type Easing, type EmphasisPreset, type InOutPreset, type Layer } from '@/model/schema'
import { lastFrame, useEditor } from '@/store/editor'
import { EMPHASIS_LABELS, IN_OUT_LABELS } from '../labels'
import { NumberField, PreviewButton, Row, Section, Segmented, SelectField, SliderField, ToggleButton } from './fields'

const EASING_OPTIONS = (Object.keys(EASING_LABELS) as Easing[]).map((value) => ({ label: EASING_LABELS[value], value }))

const DIRECTIONS: { value: Direction; icon: React.ReactNode; title: string }[] = [
  { value: 'left', icon: <ArrowLeft size={14} />, title: 'Vers la gauche' },
  { value: 'right', icon: <ArrowRight size={14} />, title: 'Vers la droite' },
  { value: 'up', icon: <ArrowUp size={14} />, title: 'Vers le haut' },
  { value: 'down', icon: <ArrowDown size={14} />, title: 'Vers le bas' },
]

/** Presets proposés selon le type de calque : machine à écrire pour le texte, tracé pour les formes. */
function presetsFor(layer: Layer): InOutPreset[] {
  const common: InOutPreset[] = ['fade', 'slide', 'pop', 'zoom', 'blur', 'wipe']
  if (layer.type === 'text') return [...common, 'typewriter']
  if (layer.type === 'shape') return [...common, 'draw']
  if (layer.type === 'background') return ['fade', 'slide', 'zoom', 'blur', 'wipe']
  return common
}

function currentLayer(id: string): Layer | undefined {
  return useEditor.getState().project.layers.find((l) => l.id === id)
}

/** Lit la portion de la séquence où l'animation se joue. */
function preview(layer: Layer, part: 'in' | 'out' | 'emphasis') {
  const s = useEditor.getState()
  const frame = 1 / s.project.fps
  const last = Math.min(lastFrame(s.project), layer.end - frame)
  const { inEnd, outStart } = animWindows(layer)
  if (part === 'in') s.play({ from: layer.start, to: Math.min(inEnd + 0.4, last) })
  else if (part === 'out') s.play({ from: Math.max(layer.start, outStart - 0.4), to: last })
  else {
    const w = emphasisWindow(layer)
    if (w) s.play({ from: w.start, to: Math.min(w.end + 0.2, last) })
  }
}

export function AnimationSection({ layer }: { layer: Layer }) {
  return (
    <Section title="Animation">
      <InOutSlot layer={layer} part="in" />
      <EmphasisSlot layer={layer} />
      <InOutSlot layer={layer} part="out" />
    </Section>
  )
}

function InOutSlot({ layer, part }: { layer: Layer; part: 'in' | 'out' }) {
  const updateLayer = useEditor((s) => s.updateLayer)
  const project = useEditor((s) => s.project)
  const entering = part === 'in'
  const anim = entering ? layer.animIn : layer.animOut
  const key = entering ? 'animIn' : 'animOut'
  const label = entering ? 'Entrée' : 'Sortie'
  const edit = (field: string, recipe: (a: NonNullable<Layer['animIn']>) => void) =>
    updateLayer(layer.id, label, (l) => void (l[key] && recipe(l[key])), { coalesce: `${key}.${field}:${layer.id}` })

  return (
    <div className="flex flex-col gap-2 rounded-md bg-ui-bg/40 p-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SelectField<InOutPreset | 'none'>
            label={label}
            value={anim?.preset ?? 'none'}
            options={[{ label: 'Aucune', value: 'none' }, ...presetsFor(layer).map((p) => ({ label: IN_OUT_LABELS[p], value: p }))]}
            onChange={(preset) => {
              updateLayer(layer.id, label, (l) => void (l[key] = preset === 'none' ? null : createInOut(preset, l, project, entering)))
              const next = currentLayer(layer.id)
              if (next && preset !== 'none') preview(next, part)
            }}
          />
        </div>
        {anim && <PreviewButton onClick={() => preview(layer, part)} />}
      </div>
      {anim && (
        <>
          <Row>
            <NumberField
              label="⏱"
              title="Durée"
              value={anim.duration}
              min={0.05}
              max={20}
              step={0.05}
              precision={2}
              suffix="s"
              historyLabel={`Durée (${label.toLowerCase()})`}
              onChange={(v) => edit('duration', (a) => void (a.duration = v))}
            />
            {anim.preset === 'slide' ? (
              <NumberField
                label="↦"
                title="Distance"
                value={anim.distance}
                min={0}
                suffix="px"
                historyLabel="Distance"
                onChange={(v) => edit('distance', (a) => void (a.distance = v))}
              />
            ) : (
              <div />
            )}
          </Row>
          <SelectField label="Courbe" value={anim.easing} options={EASING_OPTIONS} onChange={(v) => edit('easing', (a) => void (a.easing = v))} />
          {(anim.preset === 'slide' || anim.preset === 'wipe') && (
            <Segmented value={anim.direction} options={DIRECTIONS} onChange={(v) => edit('direction', (a) => void (a.direction = v))} />
          )}
        </>
      )}
    </div>
  )
}

function EmphasisSlot({ layer }: { layer: Layer }) {
  const updateLayer = useEditor((s) => s.updateLayer)
  const e = layer.emphasis
  const edit = (field: string, recipe: (em: NonNullable<Layer['emphasis']>) => void) =>
    updateLayer(layer.id, 'Mise en avant', (l) => void (l.emphasis && recipe(l.emphasis)), { coalesce: `emphasis.${field}:${layer.id}` })

  return (
    <div className="flex flex-col gap-2 rounded-md bg-ui-bg/40 p-2" title="Mise en avant : un effet joué pendant que l'élément est à l'écran">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SelectField<EmphasisPreset | 'none'>
            label="Accent"
            value={e?.preset ?? 'none'}
            options={[{ label: 'Aucun', value: 'none' }, ...EMPHASIS_PRESETS.map((p) => ({ label: EMPHASIS_LABELS[p], value: p }))]}
            onChange={(preset) => {
              updateLayer(layer.id, 'Mise en avant', (l) => void (l.emphasis = preset === 'none' ? null : createEmphasis(preset, l)))
              const next = currentLayer(layer.id)
              if (next && preset !== 'none') preview(next, 'emphasis')
            }}
          />
        </div>
        {e && <PreviewButton onClick={() => preview(layer, 'emphasis')} />}
      </div>
      {e && (
        <>
          <Row>
            <NumberField
              label="À"
              title="Début, en secondes après l'apparition du calque"
              value={e.at}
              min={0}
              step={0.05}
              precision={2}
              suffix="s"
              historyLabel="Début de la mise en avant"
              onChange={(v) => edit('at', (em) => void (em.at = v))}
            />
            <NumberField
              label="⏱"
              title="Durée d'un cycle"
              value={e.duration}
              min={0.1}
              max={20}
              step={0.05}
              precision={2}
              suffix="s"
              historyLabel="Durée de la mise en avant"
              onChange={(v) => edit('duration', (em) => void (em.duration = v))}
            />
          </Row>
          <SliderField
            label="Intensité"
            value={e.intensity * 100}
            min={10}
            max={300}
            historyLabel="Intensité"
            onChange={(v) => edit('intensity', (em) => void (em.intensity = v / 100))}
          />
          <ToggleButton active={e.repeat} title="Répéter l'effet jusqu'à la sortie" onClick={() => edit('repeat', (em) => void (em.repeat = !em.repeat))}>
            <Repeat size={13} /> Répéter
          </ToggleButton>
        </>
      )}
    </div>
  )
}
