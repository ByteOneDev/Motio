import {
  Captions,
  EyeClosed,
  Grid3x3,
  Circle,
  CircleDot,
  Film,
  Frame,
  Hexagon,
  Highlighter,
  ImagePlus,
  MessageSquare,
  Music,
  Pause,
  Play,
  LayoutTemplate,
  Minus,
  MoveRight,
  RectangleHorizontal,
  Shapes,
  Square,
  Star,
  Trash2,
  Triangle,
  Wallpaper,
} from 'lucide-react'
import { createElement, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { MUSIC, SFX, type SoundDef } from '@/audio/library'
import { ICONS, type IconNode } from '@/model/icons'
import { createAudioLayer, createMedia, TEXT_STYLES, BACKGROUND_PRESETS, type TextStyle } from '@/model/factories'
import type { Asset } from '@/model/schema'
import { useEditor } from '@/store/editor'
import { previewSound, stopPreview } from '../audio'
import { isBrandEmpty, useBrand } from '../brand'
import { addBrandText, addLogo, applyBrandColors } from '../brand/brandActions'
import { ACCEPTED_MEDIA, hasFiles, importFiles } from '../media'
import { Thumb } from '../Thumb'
import { formatTime } from '../labels'
import {
  addSound,
  addSubtitles,
  applyBackground,
  ICON_ITEMS,
  MASK_ITEMS,
  ASSET_MIME,
  backgroundThumb,
  insertTemplate,
  LIBRARY_MIME,
  SHAPE_ITEMS,
  TEMPLATES,
  templateThumb,
  TEXT_ITEMS,
  type LibraryItem,
} from './items'

type Tab = 'elements' | 'templates' | 'backgrounds' | 'audio' | 'media'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'elements', label: 'Éléments', icon: <Shapes size={15} /> },
  { id: 'templates', label: 'Modèles', icon: <LayoutTemplate size={15} /> },
  { id: 'backgrounds', label: 'Fonds', icon: <Wallpaper size={15} /> },
  { id: 'audio', label: 'Audio', icon: <Music size={15} /> },
  { id: 'media', label: 'Médias', icon: <Film size={15} /> },
]

const SHAPE_ICONS: Record<string, ReactNode> = {
  'shape:rect': <Square size={20} strokeWidth={1.5} />,
  'shape:ellipse': <Circle size={20} strokeWidth={1.5} />,
  'shape:triangle': <Triangle size={20} strokeWidth={1.5} />,
  'shape:star': <Star size={20} strokeWidth={1.5} />,
  'shape:line': <Minus size={20} strokeWidth={1.5} />,
  'shape:arrow': <MoveRight size={20} strokeWidth={1.5} />,
  'shape:pill': <RectangleHorizontal size={20} strokeWidth={1.5} />,
  'shape:frame': <Frame size={20} strokeWidth={1.5} />,
  'shape:ring': <CircleDot size={20} strokeWidth={1.5} />,
  'shape:highlighter': <Highlighter size={20} strokeWidth={1.5} />,
  'shape:hexagon': <Hexagon size={20} strokeWidth={1.5} />,
  'shape:bubble': <MessageSquare size={20} strokeWidth={1.5} />,
}

function addItem(item: LibraryItem) {
  const { project, addLayer } = useEditor.getState()
  addLayer(item.create(project))
}

const tileClass =
  'rounded-md border border-ui-line bg-ui-raised text-ui-text transition-colors hover:border-accent/60 hover:bg-ui-hover active:scale-[0.98]'

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-ui-muted uppercase">{children}</h2>
}

export function Library({ className = '' }: { className?: string }) {
  const [tab, setTab] = useState<Tab>('elements')
  return (
    <aside className={`flex min-h-0 flex-col bg-ui-panel ${className}`}>
      <nav className="grid shrink-0 grid-cols-5 border-b border-ui-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-1 py-2 text-[10px] ${
              tab === t.id ? 'text-ui-text shadow-[inset_0_-2px_0_var(--color-accent)]' : 'text-ui-muted hover:text-ui-text'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'elements' && <ElementsTab />}
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'backgrounds' && <BackgroundsTab />}
        {tab === 'audio' && <AudioTab />}
        {tab === 'media' && <MediaTab />}
      </div>
    </aside>
  )
}

// --- Éléments ------------------------------------------------------------------

/** Aperçu CSS d'un style de texte, à taille réduite. */
function textPreviewStyle(style: TextStyle): CSSProperties {
  const p = style.props
  const k = 18 / Math.max(36, Math.min(p.fontSize ?? 64, 130))
  return {
    fontFamily: p.fontFamily ?? '"Inter Variable", system-ui, sans-serif',
    fontWeight: p.fontWeight ?? 600,
    fontStyle: p.italic ? 'italic' : undefined,
    fontSize: Math.min(18, Math.max(12, (p.fontSize ?? 64) * k)),
    color: p.color ?? '#ffffff',
    textTransform: p.uppercase ? 'uppercase' : undefined,
    letterSpacing: p.letterSpacing ? `${(p.letterSpacing * k).toFixed(1)}px` : undefined,
    background: p.highlight?.color,
    padding: p.highlight ? '2px 8px' : undefined,
    borderRadius: p.highlight ? Math.min(p.highlight.radius * k, 999) : undefined,
    WebkitTextStroke: p.outline ? `1px ${p.outline.color}` : undefined,
    textShadow: p.shadow ? `0 ${Math.max(1, p.shadow.offsetY * k)}px ${p.shadow.blur * k}px ${p.shadow.color}` : undefined,
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
    display: 'inline-block',
  }
}

/** Réduit son contenu pour qu'il tienne en largeur (les polices n'ont pas toutes la même chasse). */
function FitText({ style, children }: { style: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    const fit = () => {
      el.style.transform = ''
      const room = el.parentElement!.clientWidth - 8
      if (el.offsetWidth > room) el.style.transform = `scale(${room / el.offsetWidth})`
    }
    fit()
    // La police peut arriver après le premier affichage.
    document.fonts.ready.then(fit)
  }, [style])
  return (
    <span ref={ref} style={style} className="origin-center">
      {children}
    </span>
  )
}

function BrandSection() {
  const brand = useBrand((s) => s.brand)
  const edit = () => useBrand.getState().setEditing(true)
  if (isBrandEmpty(brand)) {
    return (
      <section>
        <SectionTitle>Ma marque</SectionTitle>
        <button type="button" onClick={edit} className="w-full rounded-md border border-dashed border-ui-line px-3 py-3 text-[12px] text-ui-muted hover:border-accent/60 hover:text-ui-text">
          Créer mon kit de marque (logo, couleurs, polices)
        </button>
      </section>
    )
  }
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>{brand.name || 'Ma marque'}</SectionTitle>
        <button type="button" onClick={edit} className="-mt-2 text-[10px] text-ui-faint hover:text-ui-text">
          Modifier
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {brand.logo && (
          <button type="button" onClick={addLogo} title="Ajouter le logo" className={`${tileClass} flex h-14 items-center justify-center bg-[#0f1115] p-1.5`}>
            <img src={brand.logo.src} alt="Logo" className="max-h-full max-w-full object-contain" />
          </button>
        )}
        <button type="button" onClick={() => addBrandText('title')} title="Titre dans la police de la marque" className={`${tileClass} h-14 bg-[#0f1115] text-[15px] font-bold`} style={{ fontFamily: brand.titleFont ?? undefined }}>
          Titre
        </button>
        <button type="button" onClick={() => addBrandText('text')} title="Texte dans la police de la marque" className={`${tileClass} h-14 bg-[#0f1115] text-[12px]`} style={{ fontFamily: brand.textFont ?? undefined }}>
          Texte
        </button>
      </div>
      {brand.colors.length > 0 && (
        <button type="button" onClick={applyBrandColors} className="mt-1.5 flex w-full items-center gap-1.5 rounded-md bg-ui-raised px-2 py-1.5 text-[11px] text-ui-muted hover:bg-ui-hover hover:text-ui-text" title="Les couleurs de la marque deviennent la charte du projet">
          <span className="flex">
            {brand.colors.slice(0, 6).map((c, i) => (
              <span key={i} className="-mr-1 h-3.5 w-3.5 rounded-full border border-ui-panel" style={{ background: c }} />
            ))}
          </span>
          <span className="ml-1">Appliquer mes couleurs au projet</span>
        </button>
      )}
    </section>
  )
}

function ElementsTab() {
  return (
    <div className="flex flex-col gap-5">
      <BrandSection />
      <section>
        <SectionTitle>Texte</SectionTitle>
        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_ITEMS.map((item, i) => (
            <DraggableTile key={item.id} item={item} className="flex h-14 flex-col items-center justify-center gap-1 overflow-hidden px-1">
              <FitText style={textPreviewStyle(TEXT_STYLES[i])}>{TEXT_STYLES[i].id === 'key' ? '⌘K' : item.label}</FitText>
              {['key', 'code', 'label', 'caption'].includes(TEXT_STYLES[i].id) && <span className="text-[9px] text-ui-faint">{item.label}</span>}
            </DraggableTile>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>Tutoriel</SectionTitle>
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" onClick={addSubtitles} title="Ajouter une piste de sous-titres (écrits à la main)" className={`${tileClass} flex flex-col items-center gap-1 bg-[#0f1115] py-2.5`}>
            <Captions size={20} strokeWidth={1.5} />
            <span className="text-[10px] text-ui-muted">Sous-titres</span>
          </button>
          {MASK_ITEMS.map((item) => (
            <DraggableTile key={item.id} item={item} className="flex flex-col items-center gap-1 py-2.5">
              {item.id === 'blur:blur' ? <EyeClosed size={20} strokeWidth={1.5} /> : <Grid3x3 size={20} strokeWidth={1.5} />}
              <span className="text-[10px] text-ui-muted">{item.label}</span>
            </DraggableTile>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>Formes</SectionTitle>
        <div className="grid grid-cols-3 gap-1.5">
          {SHAPE_ITEMS.map((item) => (
            <DraggableTile key={item.id} item={item} className="flex flex-col items-center gap-1 py-2.5">
              {SHAPE_ICONS[item.id]}
              <span className="text-[10px] text-ui-muted">{item.label}</span>
            </DraggableTile>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>Icônes</SectionTitle>
        <div className="grid grid-cols-5 gap-1">
          {ICON_ITEMS.map((item, i) => (
            <DraggableTile key={item.id} item={item} className="flex aspect-square items-center justify-center">
              <IconPreview node={ICONS[i].node} />
            </DraggableTile>
          ))}
        </div>
      </section>
    </div>
  )
}

/** Aperçu SVG d'une icône à partir de ses tracés. */
function IconPreview({ node }: { node: IconNode }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {node.map(([tag, attrs], i) => {
        const { key: _key, ...rest } = attrs
        return createElement(tag, { ...rest, key: i })
      })}
    </svg>
  )
}

// --- Audio ---------------------------------------------------------------------

function AudioTab() {
  const [playing, setPlaying] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const toggle = async (def: SoundDef) => {
    if (playing === def.id) {
      stopPreview()
      setPlaying(null)
      return
    }
    setPlaying(def.id)
    await previewSound(def.id, () => setPlaying((p) => (p === def.id ? null : p)))
  }

  const row = (def: SoundDef) => (
    <div key={def.id} className="group flex items-center gap-2 rounded-md border border-ui-line bg-ui-raised px-1.5 py-1.5 hover:border-accent/50">
      <button
        type="button"
        onClick={() => toggle(def)}
        title={playing === def.id ? 'Arrêter' : 'Écouter'}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${playing === def.id ? 'bg-accent text-white' : 'bg-ui-hover text-ui-text hover:bg-accent/70'}`}
      >
        {playing === def.id ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
      </button>
      <button type="button" onClick={() => addSound(def.id)} className="min-w-0 flex-1 text-left" title={`Ajouter « ${def.label} » à la tête de lecture`}>
        <span className="flex items-baseline justify-between gap-1">
          <span className="truncate text-[12px] text-ui-text">{def.label}</span>
          <span className="shrink-0 text-[10px] text-ui-faint">{def.loop ? 'boucle' : `${def.duration.toFixed(1).replace('.', ',')} s`}</span>
        </span>
        <span className="block truncate text-[10px] text-ui-faint">{def.mood}</span>
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] leading-snug text-ui-faint">
        Sons créés par Motio : libres de droits, utilisables partout, y compris commercialement. ▶ pour écouter, clic sur le nom pour ajouter.
      </p>
      <section className="flex flex-col gap-1.5">
        <SectionTitle>Musiques</SectionTitle>
        {MUSIC.map(row)}
      </section>
      <section className="flex flex-col gap-1.5">
        <SectionTitle>Bruitages</SectionTitle>
        {SFX.map(row)}
      </section>
      <section className="flex flex-col gap-1.5">
        <SectionTitle>Vos sons</SectionTitle>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="rounded-md border border-dashed border-ui-line px-3 py-3 text-[12px] text-ui-muted hover:border-accent/60 hover:text-ui-text"
        >
          Importer une musique ou une voix off (MP3, WAV, M4A…)
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            importFiles([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </section>
    </div>
  )
}

function DraggableTile({ item, className, children }: { item: LibraryItem; className: string; children: ReactNode }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(LIBRARY_MIME, item.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => addItem(item)}
      title={`Ajouter : ${item.label} (cliquer ou glisser sur le canevas)`}
      className={`${tileClass} ${className} bg-[#0f1115]`}
    >
      {children}
    </button>
  )
}

// --- Modèles -------------------------------------------------------------------

function TemplatesTab() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] leading-snug text-ui-faint">Une scène déjà animée, insérée à la tête de lecture.</p>
      {TEMPLATES.map((t) => (
        <button key={t.id} type="button" onClick={() => insertTemplate(t)} className={`${tileClass} overflow-hidden text-left`} title={t.description}>
          <Thumb project={templateThumb(t)} time={t.thumbTime} />
          <div className="px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium">{t.label}</span>
              <span className="text-[10px] text-ui-faint">{t.length} s</span>
            </div>
            <div className="truncate text-[10px] text-ui-faint">{t.description}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

// --- Fonds ---------------------------------------------------------------------

function BackgroundsTab() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] leading-snug text-ui-faint">Ajoute un fond sous tous les calques, ou remplace le fond sélectionné.</p>
      <div className="grid grid-cols-2 gap-1.5">
        {BACKGROUND_PRESETS.map((bg) => (
          <button key={bg.id} type="button" onClick={() => applyBackground(bg.id)} className={`${tileClass} overflow-hidden`} title={bg.label}>
            <Thumb project={backgroundThumb(bg.id)} time={0} />
            <div className="truncate px-1.5 py-1 text-left text-[10px] text-ui-muted">{bg.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Médias --------------------------------------------------------------------

function MediaTab() {
  const assets = useEditor((s) => s.project.assets)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (files: File[]) => {
    setBusy(true)
    try {
      await importFiles(files, undefined, false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex min-h-full flex-col gap-3"
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setOver(false)
        run([...e.dataTransfer.files])
      }}
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`flex flex-col items-center gap-1.5 rounded-md border border-dashed px-3 py-4 text-center ${
          over ? 'border-accent bg-accent-soft' : 'border-ui-line hover:border-accent/60 hover:bg-ui-hover'
        }`}
      >
        <ImagePlus size={20} className="text-ui-muted" />
        <span className="text-[12px] text-ui-text">{busy ? 'Import…' : 'Importer des images ou vidéos'}</span>
        <span className="text-[10px] text-ui-faint">ou glissez-les ici ou sur le canevas</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPTED_MEDIA}
        className="hidden"
        onChange={(e) => {
          run([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      <div className="grid grid-cols-2 gap-1.5">
        {assets.filter((a) => !a.generated).map((asset) => (
          <AssetTile key={asset.id} asset={asset} />
        ))}
      </div>
      {assets.every((a) => a.generated) && <p className="text-center text-[11px] text-ui-faint">Aucun média pour l’instant.</p>}
    </div>
  )
}

function AssetTile({ asset }: { asset: Asset }) {
  const add = () => {
    const s = useEditor.getState()
    if (asset.kind === 'audio') {
      s.addLayer(createAudioLayer(s.project, asset, s.time))
      return
    }
    const layer = createMedia(s.project, asset)
    layer.start = Math.min(s.time, Math.max(0, s.project.duration - 0.5))
    if (asset.kind === 'video') layer.end = Math.min(s.project.duration, layer.start + Math.max(0.5, asset.duration))
    s.addLayer(layer)
  }
  const remove = () => {
    const s = useEditor.getState()
    s.update(`Supprimer ${asset.name}`, (draft) => {
      draft.assets = draft.assets.filter((a) => a.id !== asset.id)
      draft.layers = draft.layers.filter((l) => (l.type !== 'media' && l.type !== 'audio') || l.props.assetId !== asset.id)
    })
    s.select(s.selection.filter((id) => s.project.layers.some((l) => l.id === id)))
  }

  return (
    <div
      className={`${tileClass} group relative cursor-pointer overflow-hidden`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ASSET_MIME, asset.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={add}
      title={`${asset.name} — cliquer pour ajouter, ou glisser sur le canevas`}
    >
      <div className="aspect-video bg-black">
        {asset.kind === 'audio' ? (
          <div className="flex h-full items-center justify-center text-emerald-300">
            <Music size={22} />
          </div>
        ) : asset.kind === 'image' ? (
          <img src={asset.src} alt="" className="h-full w-full object-contain" draggable={false} />
        ) : (
          <video src={`${asset.src}#t=0.1`} muted preload="metadata" className="h-full w-full object-contain" />
        )}
      </div>
      <div className="flex items-center gap-1 px-1.5 py-1">
        <span className="min-w-0 flex-1 truncate text-[10px] text-ui-muted">{asset.name}</span>
        {asset.kind !== 'image' && <span className="text-[9px] text-ui-faint">{formatTime(asset.duration)}</span>}
      </div>
      <button
        type="button"
        title="Supprimer ce média (et ses calques)"
        onClick={(e) => {
          e.stopPropagation()
          remove()
        }}
        className="absolute top-1 right-1 hidden rounded bg-black/70 p-1 text-ui-muted group-hover:block hover:text-white"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
