import { DEFAULT_FONT, font } from './fonts'
import type {
  Asset,
  AudioLayer,
  BlurLayer,
  IconLayer,
  SubtitlesLayer,
  BackgroundLayer,
  BackgroundProps,
  Emphasis,
  EmphasisPreset,
  InOutAnim,
  InOutPreset,
  Layer,
  MediaLayer,
  Project,
  ShapeKind,
  ShapeLayer,
  ShapeProps,
  TextLayer,
  TextProps,
} from './schema'

export const ACCENT = '#7c5cff'

export const DEFAULT_PALETTE = ['#7c5cff', '#ff4d8d', '#ffd60a', '#2ec4b6', '#ffffff', '#101218']

export function newId(): string {
  return crypto.randomUUID()
}

/** « Rectangle », puis « Rectangle 2 », « Rectangle 3 »… */
export function uniqueName(base: string, layers: Layer[]): string {
  const names = new Set(layers.map((l) => l.name))
  if (!names.has(base)) return base
  const root = base.replace(/ \d+$/, '')
  let i = 2
  while (names.has(`${root} ${i}`)) i++
  return `${root} ${i}`
}

/** Dimension de référence : les tailles par défaut sont pensées pour du 1080p. */
export function unit(project: Pick<Project, 'width' | 'height'>): number {
  return Math.min(project.width, project.height) / 1080
}

type Point = { x: number; y: number }

/** Champs communs à tous les calques : présents sur toute la durée, centrés sur `at`. */
function base(project: Project, name: string, at: Point | undefined, width: number, height: number) {
  return {
    id: newId(),
    name: uniqueName(name, project.layers),
    start: 0,
    end: project.duration,
    visible: true,
    locked: false,
    transform: {
      x: at?.x ?? project.width / 2,
      y: at?.y ?? project.height / 2,
      width: Math.max(1, width),
      height: Math.max(1, height),
      rotation: 0,
      opacity: 1,
      scale: 1,
    },
    animIn: null,
    animOut: null,
    emphasis: null,
    keyframes: {},
  }
}

// --- Textes ------------------------------------------------------------------

export interface TextStyle {
  id: string
  /** Nom affiché dans la bibliothèque (et nom du calque créé). */
  label: string
  text: string
  props: Partial<TextProps>
}

/** Styles de texte prêts à l'emploi. Les tailles sont pensées pour du 1080p. */
export const TEXT_STYLES: TextStyle[] = [
  { id: 'title', label: 'Titre', text: 'Votre titre', props: { fontSize: 120, fontWeight: 800, letterSpacing: -2 } },
  { id: 'subtitle', label: 'Sous-titre', text: 'Un sous-titre', props: { fontSize: 56, fontWeight: 500, color: '#c9cbe0' } },
  {
    id: 'body',
    label: 'Paragraphe',
    text: 'Un paragraphe de texte',
    props: { fontSize: 36, fontWeight: 400, lineHeight: 1.35, color: '#d8dae6' },
  },
  {
    id: 'impact',
    label: 'Grand titre',
    text: 'Grand titre',
    props: { fontFamily: font('Bebas Neue'), fontSize: 200, fontWeight: 400, uppercase: true, letterSpacing: 4, lineHeight: 0.95 },
  },
  {
    id: 'elegant',
    label: 'Titre élégant',
    text: 'Élégance',
    props: { fontFamily: font('Playfair Display'), fontSize: 120, fontWeight: 700, italic: true },
  },
  {
    id: 'neon',
    label: 'Néon',
    text: 'Néon',
    props: {
      fontFamily: font('Montserrat'),
      fontSize: 120,
      fontWeight: 800,
      uppercase: true,
      color: '#fff1f8',
      shadow: { color: '#ff4d8d', blur: 36, offsetY: 0 },
    },
  },
  {
    id: 'outlined',
    label: 'Contour',
    text: 'Contour',
    props: {
      fontFamily: font('Archivo Black'),
      fontSize: 130,
      fontWeight: 400,
      uppercase: true,
      color: '#ffffff00',
      outline: { color: '#ffffff', width: 3 },
    },
  },
  {
    id: 'retro',
    label: 'Rétro',
    text: 'Niveau 1',
    props: {
      fontFamily: font('Press Start 2P'),
      fontSize: 64,
      fontWeight: 400,
      uppercase: true,
      color: '#ffd60a',
      lineHeight: 1.4,
      shadow: { color: '#ff4d8d', blur: 0, offsetY: 8 },
    },
  },
  {
    id: 'handwritten',
    label: 'Manuscrit',
    text: 'Super astuce !',
    props: { fontFamily: font('Caveat'), fontSize: 96, fontWeight: 700, color: '#ffd60a' },
  },
  {
    id: 'quote',
    label: 'Citation',
    text: '« Simple et efficace. »',
    props: { fontFamily: font('Fraunces'), fontSize: 64, fontWeight: 400, italic: true, lineHeight: 1.3, color: '#ece9ff' },
  },
  {
    id: 'code',
    label: 'Code',
    text: 'npm run dev',
    props: {
      fontFamily: font('JetBrains Mono'),
      fontSize: 40,
      fontWeight: 500,
      color: '#9fe870',
      align: 'left',
      lineHeight: 1.4,
      highlight: { color: '#0d1117', padding: 28, radius: 14 },
    },
  },
  {
    id: 'label',
    label: 'Étiquette',
    text: 'Nouveau',
    props: {
      fontSize: 36,
      fontWeight: 700,
      uppercase: true,
      letterSpacing: 2,
      highlight: { color: ACCENT, padding: 20, radius: 999 },
    },
  },
  {
    id: 'key',
    label: 'Touche clavier',
    text: '⌘ K',
    props: { fontSize: 44, fontWeight: 600, color: '#1b1d23', highlight: { color: '#f2f3f7', padding: 18, radius: 12 } },
  },
  {
    id: 'caption',
    label: 'Sous-titrage',
    text: 'Voici comment faire…',
    props: { fontSize: 44, fontWeight: 600, highlight: { color: '#000000b3', padding: 16, radius: 10 } },
  },
]

export function textStyle(id: string): TextStyle {
  return TEXT_STYLES.find((s) => s.id === id) ?? TEXT_STYLES[0]
}

export function createText(project: Project, styleId: string, at?: Point, text?: string): TextLayer {
  const style = textStyle(styleId)
  const u = unit(project)
  const props: TextProps = {
    text: text ?? style.text,
    fontFamily: DEFAULT_FONT,
    fontSize: 64,
    fontWeight: 600,
    italic: false,
    color: '#ffffff',
    align: 'center',
    lineHeight: 1.15,
    letterSpacing: 0,
    autoWidth: true,
    uppercase: false,
    highlight: null,
    outline: null,
    shadow: null,
    ...structuredClone(style.props),
  }
  // Tout ce qui est en pixels suit la taille de la composition.
  props.fontSize = Math.round(props.fontSize * u)
  props.letterSpacing *= u
  if (props.highlight) props.highlight.padding = Math.round(props.highlight.padding * u)
  if (props.outline) props.outline.width *= u
  if (props.shadow) {
    props.shadow.blur *= u
    props.shadow.offsetY *= u
  }
  return { ...base(project, style.label, at, Math.round(800 * u), props.fontSize), type: 'text', props }
}

// --- Formes ------------------------------------------------------------------

export interface ShapePreset {
  id: string
  label: string
  kind: ShapeKind
  /** Taille en 1080p. */
  size: [number, number]
  props: Partial<ShapeProps>
}

export const SHAPE_PRESETS: ShapePreset[] = [
  { id: 'rect', label: 'Rectangle', kind: 'rect', size: [360, 220], props: { radius: 24 } },
  { id: 'ellipse', label: 'Cercle', kind: 'ellipse', size: [280, 280], props: {} },
  { id: 'triangle', label: 'Triangle', kind: 'triangle', size: [280, 250], props: {} },
  { id: 'star', label: 'Étoile', kind: 'star', size: [300, 300], props: { fill: '#ffd60a' } },
  { id: 'hexagon', label: 'Hexagone', kind: 'hexagon', size: [280, 250], props: { fill: '#2ec4b6' } },
  { id: 'bubble', label: 'Bulle', kind: 'bubble', size: [420, 240], props: { fill: '#ffffff', radius: 36 } },
  { id: 'line', label: 'Ligne', kind: 'line', size: [320, 12], props: {} },
  { id: 'arrow', label: 'Flèche', kind: 'arrow', size: [320, 12], props: {} },
  { id: 'pill', label: 'Pilule', kind: 'rect', size: [360, 90], props: { radius: 999 } },
  { id: 'frame', label: 'Cadre', kind: 'rect', size: [480, 300], props: { fill: null, stroke: '#ff4d8d', strokeWidth: 8, radius: 16 } },
  { id: 'ring', label: 'Anneau', kind: 'ellipse', size: [220, 220], props: { fill: null, stroke: '#ffd60a', strokeWidth: 10 } },
  { id: 'highlighter', label: 'Surligneur', kind: 'rect', size: [420, 70], props: { fill: '#ffd60a59', radius: 8 } },
]

export function createShape(project: Project, presetId: string, at?: Point): ShapeLayer {
  const preset = SHAPE_PRESETS.find((p) => p.id === presetId) ?? SHAPE_PRESETS[0]
  const u = unit(project)
  const isStroke = preset.kind === 'line' || preset.kind === 'arrow'
  const props: ShapeProps = {
    kind: preset.kind,
    fill: isStroke ? null : ACCENT,
    stroke: isStroke ? '#ffffff' : null,
    strokeWidth: isStroke ? 8 : 6,
    radius: 0,
    ...preset.props,
  }
  props.strokeWidth = Math.max(1, Math.round(props.strokeWidth * u))
  props.radius = Math.round(props.radius * u)
  return {
    ...base(project, preset.label, at, Math.round(preset.size[0] * u), Math.round(preset.size[1] * u)),
    type: 'shape',
    props,
  }
}

// --- Médias ------------------------------------------------------------------

/** Calque image ou vidéo : la boîte reprend les proportions du fichier et tient dans 70 % du cadre. */
export function createMedia(project: Project, asset: Asset, at?: Point): MediaLayer {
  const fit = Math.min(1, (project.width * 0.7) / asset.width, (project.height * 0.7) / asset.height)
  const layer: MediaLayer = {
    ...base(project, asset.name.replace(/\.[^.]+$/, ''), at, Math.round(asset.width * fit), Math.round(asset.height * fit)),
    type: 'media',
    props: {
      assetId: asset.id,
      fit: 'cover',
      radius: Math.round(16 * unit(project)),
      stroke: null,
      strokeWidth: Math.round(4 * unit(project)),
      shadow: true,
      videoStart: 0,
      volume: 1,
      zooms: [],
    },
  }
  if (asset.kind === 'video') layer.end = Math.min(project.duration, Math.max(0.5, asset.duration))
  return layer
}

// --- Icônes ------------------------------------------------------------------

export function createIcon(project: Project, icon: string, label: string, at?: Point): IconLayer {
  const size = Math.round(180 * unit(project))
  return { ...base(project, label, at, size, size), type: 'icon', props: { icon, color: '#ffffff', strokeWidth: 2 } }
}

// --- Audio -------------------------------------------------------------------

/** Ressource pour un son généré par Motio : seul son identifiant sera enregistré dans le fichier. */
export function generatedAsset(id: string, label: string, duration: number): Asset {
  return { id: newId(), kind: 'audio', name: label, src: '', path: null, width: 1, height: 1, duration, generated: id }
}

/**
 * Calque audio placé à `start`. Une musique en boucle couvre la suite du projet, avec un fondu
 * de sortie ; un bruitage dure le temps du son.
 */
export function createAudioLayer(project: Project, asset: Asset, start: number, opts: { loop?: boolean; music?: boolean; bpm?: number | null } = {}): AudioLayer {
  const loop = opts.loop ?? false
  const music = opts.music ?? asset.duration > 6
  const end = loop ? project.duration : Math.min(project.duration, start + Math.max(0.1, asset.duration))
  return {
    ...base(project, asset.name.replace(/\.[^.]+$/, ''), undefined, 1, 1),
    type: 'audio',
    start,
    end: Math.max(end, Math.min(project.duration, start + 0.1)),
    props: {
      assetId: asset.id,
      // Une musique reste en retrait pour laisser la place à la voix.
      volume: music ? 0.6 : 1,
      fadeIn: 0,
      fadeOut: music ? 1.5 : 0,
      sourceStart: 0,
      loop,
      bpm: opts.bpm ?? null,
    },
  }
}

// --- Sous-titres et flou ----------------------------------------------------------

/** Piste de sous-titres vide couvrant tout le projet, au style lisible par défaut. */
export function createSubtitles(project: Project): SubtitlesLayer {
  const u = unit(project)
  return {
    ...base(project, 'Sous-titres', { x: project.width / 2, y: project.height / 2 }, project.width, project.height),
    type: 'subtitles',
    props: {
      cues: [],
      style: {
        fontFamily: DEFAULT_FONT,
        fontSize: Math.round(46 * u),
        fontWeight: 600,
        color: '#ffffff',
        background: '#000000b3',
        y: 0.86,
        maxWidth: 0.8,
        animation: 'fade',
        accent: '#ffd60a',
      },
    },
  }
}

export function createBlur(project: Project, mode: 'blur' | 'pixelate', at?: Point): BlurLayer {
  const u = unit(project)
  return {
    ...base(project, mode === 'blur' ? 'Flou' : 'Pixellisation', at, Math.round(420 * u), Math.round(120 * u)),
    type: 'blur',
    props: { mode, amount: Math.round((mode === 'blur' ? 18 : 24) * u), radius: Math.round(12 * u) },
  }
}

// --- Fonds -------------------------------------------------------------------

export interface BackgroundPreset {
  id: string
  label: string
  props: BackgroundProps
}

const solid = (color: string): BackgroundProps => ({
  fill: 'solid',
  color1: color,
  color2: color,
  angle: 0,
  pattern: 'none',
  patternColor: '#ffffff1a',
  patternSize: 48,
})

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'night', label: 'Nuit', props: solid('#101218') },
  { id: 'white', label: 'Blanc', props: solid('#f7f7fb') },
  { id: 'violet-pink', label: 'Violet rose', props: { ...solid('#7c5cff'), fill: 'linear', color2: '#ff4d8d', angle: 135 } },
  { id: 'ocean', label: 'Océan', props: { ...solid('#0f4c81'), fill: 'linear', color2: '#2ec4b6', angle: 160 } },
  { id: 'sunset', label: 'Coucher de soleil', props: { ...solid('#ff7e5f'), fill: 'linear', color2: '#feb47b', angle: 90 } },
  { id: 'forest', label: 'Forêt', props: { ...solid('#134e5e'), fill: 'linear', color2: '#71b280', angle: 120 } },
  { id: 'aurora', label: 'Aurore', props: { ...solid('#3a1c71'), fill: 'radial', color2: '#0b0c10' } },
  { id: 'spotlight', label: 'Projecteur', props: { ...solid('#2a2f3d'), fill: 'radial', color2: '#08090c' } },
  { id: 'grid', label: 'Grille', props: { ...solid('#0f1115'), pattern: 'grid', patternColor: '#ffffff14', patternSize: 60 } },
  { id: 'dots', label: 'Points', props: { ...solid('#111318'), pattern: 'dots', patternColor: '#ffffff2e', patternSize: 40 } },
  { id: 'blueprint', label: 'Plan', props: { ...solid('#0b3d91'), pattern: 'grid', patternColor: '#ffffff30', patternSize: 48 } },
  { id: 'paper', label: 'Papier', props: { ...solid('#f4f1ea'), pattern: 'dots', patternColor: '#0000001f', patternSize: 32 } },
  {
    id: 'stripes',
    label: 'Rayures',
    props: { ...solid('#1d1f27'), fill: 'linear', color2: '#0b0c10', angle: 90, pattern: 'lines', patternColor: '#ffffff0f', patternSize: 28 },
  },
  {
    id: 'neon-grid',
    label: 'Néon',
    props: { ...solid('#2a0f3d'), fill: 'radial', color2: '#07060b', pattern: 'grid', patternColor: '#ff4d8d26', patternSize: 72 },
  },
]

export function createBackground(project: Project, presetId: string): BackgroundLayer {
  const preset = BACKGROUND_PRESETS.find((p) => p.id === presetId) ?? BACKGROUND_PRESETS[0]
  const props = structuredClone(preset.props)
  props.patternSize *= unit(project)
  return {
    ...base(project, `Fond ${preset.label.toLowerCase()}`, { x: project.width / 2, y: project.height / 2 }, project.width, project.height),
    type: 'background',
    props,
  }
}

/** Réglages par défaut d'une entrée (`entering`) ou d'une sortie : choisis pour bien rendre sans retouche. */
export function createInOut(preset: InOutPreset, layer: Layer, project: Project, entering: boolean): InOutAnim {
  const chars = layer.type === 'text' ? Array.from(layer.props.text).length : 0
  const duration =
    preset === 'typewriter' ? Math.min(4, Math.max(0.5, chars * 0.05)) : preset === 'draw' ? 0.8 : preset === 'pop' ? 0.5 : 0.6
  return {
    preset,
    duration: Math.round(duration * 100) / 100,
    easing: preset === 'typewriter' ? 'linear' : preset === 'pop' && entering ? 'back' : entering ? 'easeOut' : 'easeIn',
    direction: preset === 'wipe' ? 'right' : entering ? 'up' : 'down',
    distance: Math.round(140 * unit(project)),
  }
}

export function createEmphasis(preset: EmphasisPreset, layer: Layer): Emphasis {
  return {
    preset,
    at: Math.round((layer.animIn?.duration ?? 0) * 100) / 100,
    duration: preset === 'pulse' ? 0.6 : 0.8,
    repeat: false,
    intensity: 1,
  }
}

/** Projet vide (Fichier › Nouveau) : un cadre 1080p et un fond sombre. */
export function createEmptyProject(): Project {
  const project: Project = {
    version: 1,
    id: newId(),
    name: 'Sans titre',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 10,
    background: '#101218',
    palette: [...DEFAULT_PALETTE],
    assets: [],
    layers: [],
  }
  return project
}

/** Projet de départ : une petite scène d'exemple, pour ne pas commencer devant une page blanche. */
export function createProject(): Project {
  const project: Project = {
    version: 1,
    id: newId(),
    name: 'Sans titre',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 10,
    background: '#101218',
    palette: [...DEFAULT_PALETTE],
    assets: [],
    layers: [],
  }
  project.layers.push(createBackground(project, 'aurora'))
  const title = createText(project, 'title', { x: 960, y: 500 })
  title.props.text = 'Motio'
  title.animIn = createInOut('pop', title, project, true)
  project.layers.push(title)
  const bar = createShape(project, 'rect', { x: 960, y: 610 })
  bar.name = 'Soulignement'
  bar.transform.width = 220
  bar.transform.height = 14
  bar.props.radius = 7
  bar.start = 0.4
  bar.animIn = createInOut('wipe', bar, project, true)
  project.layers.push(bar)
  const subtitle = createText(project, 'subtitle', { x: 960, y: 680 })
  subtitle.props.text = 'Motion design, simplement.'
  subtitle.start = 0.7
  subtitle.animIn = createInOut('slide', subtitle, project, true)
  project.layers.push(subtitle)
  for (const layer of project.layers) {
    if (layer.type !== 'background') layer.animOut = createInOut('fade', layer, project, false)
  }
  return project
}

/** Duplique un calque avec un nouvel id, légèrement décalé. */
export function cloneLayer(layer: Layer, layers: Layer[], offset = 24): Layer {
  const copy = structuredClone(layer)
  copy.id = newId()
  copy.name = uniqueName(layer.name, layers)
  copy.transform.x += offset
  copy.transform.y += offset
  return copy
}
