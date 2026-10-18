import { Download, Keyboard, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { parseSrt, scriptToCues, toSrt } from '@/engine/subtitles'
import { newId } from '@/model/factories'
import type { Cue, SubtitleStyle, SubtitlesLayer } from '@/model/schema'
import { useEditor } from '@/store/editor'
import { download } from '../fileActions'
import { formatTime } from '../labels'
import { notify } from '../toast'
import { ColorField, NumberField, Section, SelectField, SliderField } from './fields'
import { FontPicker } from './FontPicker'

const ANIMATIONS: { label: string; value: SubtitleStyle['animation'] }[] = [
  { label: 'Aucune', value: 'none' },
  { label: 'Fondu', value: 'fade' },
  { label: 'Pop', value: 'pop' },
  { label: 'Karaoké (mot par mot)', value: 'karaoke' },
]

const WEIGHTS = [400, 500, 600, 700, 800].map((value) => ({ label: String(value), value }))

function editLayer(id: string, label: string, recipe: (l: SubtitlesLayer) => void, coalesce?: string) {
  useEditor.getState().update(
    label,
    (draft) => {
      const l = draft.layers.find((x) => x.id === id)
      if (l?.type === 'subtitles') recipe(l)
    },
    coalesce ? { coalesce } : undefined,
  )
}

const sortCues = (cues: Cue[]) => cues.sort((a, b) => a.start - b.start)

/**
 * Sous-titres écrits à la main : coller son script pour le découper, ajuster chaque ligne,
 * ou caler le rythme au clavier pendant la lecture. Import et export au format .srt.
 */
export function SubtitlesSection({ layer }: { layer: SubtitlesLayer }) {
  const time = useEditor((s) => s.time)
  const [script, setScript] = useState('')
  const rel = time - layer.start
  const cues = layer.props.cues
  const current = cues.findIndex((c) => rel >= c.start && rel < c.end)
  const st = layer.props.style
  const editStyle = (key: string, label: string, recipe: (s: SubtitleStyle) => void) =>
    editLayer(layer.id, label, (l) => recipe(l.props.style), `sub-style.${key}:${layer.id}`)

  const createFromScript = () => {
    const created = scriptToCues(script, Math.max(0, rel)).map((c) => ({ ...c, id: newId() }))
    if (created.length === 0) return
    editLayer(layer.id, 'Créer les sous-titres', (l) => {
      // On remplace ce qui se trouve après la tête de lecture.
      l.props.cues = sortCues([...l.props.cues.filter((c) => c.end <= Math.max(0, rel)), ...created])
      const end = created[created.length - 1].end
      if (l.start + end > l.end) l.end = Math.min(useEditor.getState().project.duration, l.start + end)
    })
    setScript('')
    notify(`${created.length} sous-titre${created.length > 1 ? 's' : ''} créé${created.length > 1 ? 's' : ''} — ajustez-les ou calez-les au clavier.`)
  }

  const addHere = () => {
    const start = Math.max(0, rel)
    editLayer(layer.id, 'Ajouter un sous-titre', (l) => {
      l.props.cues = sortCues([...l.props.cues, { id: newId(), start, end: start + 2, text: '' }])
    })
  }

  const importSrt = (file: File) =>
    file.text().then((text) => {
      const parsed = parseSrt(text)
      if (parsed.length === 0) {
        notify('Aucun sous-titre lisible dans ce fichier.', 'error')
        return
      }
      editLayer(layer.id, 'Importer des sous-titres', (l) => {
        l.props.cues = parsed.map((c) => ({ ...c, start: Math.max(0, c.start - l.start), end: Math.max(0, c.end - l.start), id: newId() }))
        const end = parsed[parsed.length - 1].end
        if (end > l.end) l.end = Math.min(useEditor.getState().project.duration, end)
      })
      notify(`${parsed.length} sous-titres importés.`)
    })

  const exportSrt = async () => {
    const name = useEditor.getState().project.name
    const data = toSrt(cues, layer.start)
    const motio = window.motio
    if (!motio) {
      download(new Blob([data], { type: 'application/x-subrip' }), `${name}.srt`)
      return
    }
    const path = await motio.chooseExportPath(name, 'srt')
    if (!path) return
    await motio.writeExport(path, new TextEncoder().encode(data).buffer as ArrayBuffer)
    notify('Sous-titres exportés.')
  }

  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <>
      <Section title="Sous-titres">
        <CalibrateButton layer={layer} />
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {cues.map((cue, i) => (
            <CueRow key={cue.id} layer={layer} cue={cue} active={i === current} />
          ))}
          {cues.length === 0 && <p className="text-[11px] leading-snug text-ui-faint">Aucun sous-titre. Collez votre script ci-dessous, importez un .srt, ou ajoutez-les un par un.</p>}
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={addHere} className="flex h-7 flex-1 items-center justify-center gap-1 rounded bg-ui-raised text-[11px] text-ui-muted hover:bg-ui-hover hover:text-ui-text">
            <Plus size={13} /> Ajouter ici
          </button>
          <button
            type="button"
            title="Importer un fichier .srt"
            onClick={() => fileInput.current?.click()}
            className="flex h-7 items-center gap-1 rounded bg-ui-raised px-2 text-[11px] text-ui-muted hover:bg-ui-hover hover:text-ui-text"
          >
            <Upload size={13} /> .srt
          </button>
          <button
            type="button"
            title="Exporter les sous-titres en .srt (YouTube, logiciels de montage)"
            onClick={exportSrt}
            disabled={cues.length === 0}
            className="flex h-7 items-center gap-1 rounded bg-ui-raised px-2 text-[11px] text-ui-muted hover:bg-ui-hover hover:text-ui-text disabled:opacity-40"
          >
            <Download size={13} /> .srt
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".srt,application/x-subrip,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importSrt(f)
              e.target.value = ''
            }}
          />
        </div>
      </Section>

      <Section title="Depuis votre script">
        <textarea
          rows={4}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Collez le texte de votre voix off : une phrase devient un sous-titre."
          className="w-full resize-y rounded border border-transparent bg-ui-raised px-2 py-1.5 text-[12px] leading-snug text-ui-text outline-none placeholder:text-ui-faint hover:border-ui-line focus:border-accent"
        />
        <button
          type="button"
          disabled={!script.trim()}
          onClick={createFromScript}
          className="h-7 rounded bg-accent text-[12px] font-medium text-white hover:brightness-110 disabled:opacity-40"
        >
          Découper à partir de {formatTime(Math.max(0, time))}
        </button>
      </Section>

      <Section title="Style des sous-titres">
        <FontPicker value={st.fontFamily} onChange={(v) => editStyle('font', 'Police', (s) => void (s.fontFamily = v))} />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="T" title="Taille" value={st.fontSize} min={8} suffix="px" historyLabel="Taille" onChange={(v) => editStyle('size', 'Taille', (s) => void (s.fontSize = v))} />
          <SelectField label="Graisse" value={st.fontWeight} options={WEIGHTS} onChange={(v) => editStyle('weight', 'Graisse', (s) => void (s.fontWeight = v))} />
        </div>
        <ColorField label="Texte" value={st.color} onChange={(c) => editStyle('color', 'Couleur', (s) => void (s.color = c))} />
        <ColorField
          label="Fond"
          value={st.background}
          onChange={(c) => editStyle('bg', 'Fond', (s) => void (s.background = c))}
          onClear={() => editStyle('bg-clear', 'Sans fond', (s) => void (s.background = null))}
        />
        <SelectField label="Animation" value={st.animation} options={ANIMATIONS} onChange={(v) => editStyle('anim', 'Animation', (s) => void (s.animation = v))} />
        {st.animation === 'karaoke' && <ColorField label="Mot dit" value={st.accent} onChange={(c) => editStyle('accent', 'Couleur karaoké', (s) => void (s.accent = c))} />}
        <SliderField label="Hauteur" value={st.y * 100} min={5} max={95} historyLabel="Position" onChange={(v) => editStyle('y', 'Position', (s) => void (s.y = v / 100))} />
        <SliderField label="Largeur" value={st.maxWidth * 100} min={20} max={100} historyLabel="Largeur" onChange={(v) => editStyle('w', 'Largeur', (s) => void (s.maxWidth = v / 100))} />
      </Section>
    </>
  )
}

function CueRow({ layer, cue, active }: { layer: SubtitlesLayer; cue: Cue; active: boolean }) {
  const edit = (label: string, recipe: (c: Cue) => void, key: string) =>
    editLayer(
      layer.id,
      label,
      (l) => {
        const c = l.props.cues.find((x) => x.id === cue.id)
        if (c) recipe(c)
        sortCues(l.props.cues)
      },
      `cue.${key}:${cue.id}`,
    )

  return (
    <div className={`flex flex-col gap-1 rounded-md p-1.5 ${active ? 'bg-accent-soft' : 'bg-ui-bg/40'}`}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          title="Aller à ce sous-titre"
          onClick={() => useEditor.getState().setTime(layer.start + cue.start)}
          className="text-[10px] text-ui-faint tabular-nums hover:text-ui-text"
        >
          {formatTime(layer.start + cue.start)}
        </button>
        <div className="grid flex-1 grid-cols-2 gap-1">
          <NumberField label="De" value={layer.start + cue.start} min={layer.start} step={0.05} precision={2} suffix="s" onChange={(v) => edit('Début du sous-titre', (c) => void (c.start = Math.min(v - layer.start, c.end - 0.1)), 's')} />
          <NumberField label="À" value={layer.start + cue.end} min={layer.start} step={0.05} precision={2} suffix="s" onChange={(v) => edit('Fin du sous-titre', (c) => void (c.end = Math.max(v - layer.start, c.start + 0.1)), 'e')} />
        </div>
        <button
          type="button"
          title="Supprimer ce sous-titre"
          onClick={() => editLayer(layer.id, 'Supprimer le sous-titre', (l) => void (l.props.cues = l.props.cues.filter((c) => c.id !== cue.id)))}
          className="rounded p-1 text-ui-faint hover:bg-ui-hover hover:text-ui-text"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <textarea
        rows={1}
        value={cue.text}
        onChange={(e) => edit('Texte du sous-titre', (c) => void (c.text = e.target.value), 't')}
        className="w-full resize-y rounded border border-transparent bg-ui-raised px-2 py-1 text-[12px] leading-snug text-ui-text outline-none hover:border-ui-line focus:border-accent"
      />
    </div>
  )
}

/**
 * Mode calage : la lecture démarre au premier sous-titre ; chaque appui sur Entrée termine
 * le sous-titre en cours et lance le suivant. Échap arrête. Une seule étape d'historique.
 */
function CalibrateButton({ layer }: { layer: SubtitlesLayer }) {
  const [index, setIndex] = useState<number | null>(null)
  const count = layer.props.cues.length

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      const s = useEditor.getState()
      if (e.key === 'Escape') {
        s.pause()
        s.endGesture()
        setIndex(null)
        return
      }
      const t = s.time - layer.start
      editLayer(layer.id, 'Caler les sous-titres', (l) => {
        const cues = l.props.cues
        const cur = cues[index]
        if (!cur) return
        cur.end = Math.max(cur.start + 0.2, t)
        const next = cues[index + 1]
        if (next) {
          const length = next.end - next.start
          next.start = cur.end
          next.end = Math.max(next.end, next.start + Math.max(0.5, length))
        }
      })
      if (index + 1 >= count) {
        s.pause()
        s.endGesture()
        setIndex(null)
        notify('Sous-titres calés.')
      } else setIndex(index + 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, count, layer.id, layer.start])

  const start = () => {
    if (count === 0) {
      notify('Créez d’abord les sous-titres (par exemple depuis votre script).')
      return
    }
    const s = useEditor.getState()
    // Le premier sous-titre commence là où se trouve la tête de lecture.
    const t = Math.max(0, s.time - layer.start)
    s.beginGesture('Caler les sous-titres')
    editLayer(layer.id, 'Caler les sous-titres', (l) => {
      const first = l.props.cues[0]
      const shift = t - first.start
      for (const c of l.props.cues) {
        c.start += shift
        c.end += shift
      }
    })
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setIndex(0)
    s.play()
  }

  if (index !== null) {
    return (
      <div className="rounded-md border border-accent bg-accent-soft p-2 text-[11px] leading-snug">
        <p className="font-medium text-ui-text">Calage en cours — sous-titre {index + 1} / {count}</p>
        <p className="text-ui-muted">Appuyez sur <kbd className="rounded bg-ui-raised px-1">Entrée</kbd> dès que la phrase suivante commence. Échap pour arrêter.</p>
        <p className="mt-1 truncate text-ui-text">« {layer.props.cues[index]?.text} »</p>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={start}
      title="Lancez la lecture depuis le début de la voix off, puis appuyez sur Entrée à chaque nouvelle phrase"
      className="flex h-8 items-center justify-center gap-1.5 rounded bg-ui-raised text-[12px] text-ui-text hover:bg-ui-hover"
    >
      <Keyboard size={14} /> Caler au clavier pendant la lecture
    </button>
  )
}
