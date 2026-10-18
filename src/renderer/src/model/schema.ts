import { z } from 'zod'

/** Couleur hexadécimale : #rgb, #rrggbb ou #rrggbbaa. */
export const ColorSchema = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)

/**
 * Transform d'un calque, en pixels de composition. (x, y) est le centre du calque.
 * Pour un texte, `height` est ignoré (calculé à partir du contenu) et `width` n'est
 * utilisé que si `autoWidth` est faux. Pour une ligne / flèche, `width` est la longueur.
 */
export const TransformSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  /** Échelle uniforme appliquée autour du centre (1 = 100 %). */
  scale: z.number().positive().default(1),
})

export const TextPropsSchema = z.object({
  text: z.string(),
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(900),
  italic: z.boolean(),
  color: ColorSchema,
  align: z.enum(['left', 'center', 'right']),
  lineHeight: z.number().positive(),
  letterSpacing: z.number(),
  autoWidth: z.boolean(),
  uppercase: z.boolean().default(false),
  /** Pastille de fond derrière le texte (étiquettes, touches clavier, code). */
  highlight: z.object({ color: ColorSchema, padding: z.number().min(0), radius: z.number().min(0) }).nullable().default(null),
  outline: z.object({ color: ColorSchema, width: z.number().min(0) }).nullable().default(null),
  shadow: z.object({ color: ColorSchema, blur: z.number().min(0), offsetY: z.number() }).nullable().default(null),
})

export const ShapeKindSchema = z.enum(['rect', 'ellipse', 'triangle', 'star', 'hexagon', 'bubble', 'line', 'arrow'])

export const ShapePropsSchema = z.object({
  kind: ShapeKindSchema,
  fill: ColorSchema.nullable(),
  stroke: ColorSchema.nullable(),
  strokeWidth: z.number().min(0),
  radius: z.number().min(0),
})

export const EasingSchema = z.enum(['linear', 'ease', 'easeOut', 'easeIn', 'back', 'elastic', 'bounce'])

/** Direction du mouvement (vers où l'élément se déplace). */
export const DirectionSchema = z.enum(['left', 'right', 'up', 'down'])

export const IN_OUT_PRESETS = ['fade', 'slide', 'pop', 'zoom', 'blur', 'wipe', 'typewriter', 'draw'] as const
export const EMPHASIS_PRESETS = ['pulse', 'shake', 'wobble', 'bounce', 'flash'] as const

/** Animation d'entrée ou de sortie, calée sur le début / la fin du calque. */
export const InOutAnimSchema = z.object({
  preset: z.enum(IN_OUT_PRESETS),
  duration: z.number().positive(),
  easing: EasingSchema,
  direction: DirectionSchema,
  /** Distance de glissement, en pixels de composition. */
  distance: z.number().min(0),
})

/** Effet de mise en avant, joué pendant que le calque est à l'écran. */
export const EmphasisSchema = z.object({
  preset: z.enum(EMPHASIS_PRESETS),
  /** Début, en secondes après le début du calque. */
  at: z.number().min(0),
  duration: z.number().positive(),
  repeat: z.boolean(),
  intensity: z.number().min(0),
})

export const AnimPropSchema = z.enum(['x', 'y', 'scale', 'rotation', 'opacity', 'color'])

/** Image clé : `easing` décrit la transition vers l'image clé suivante. Temps absolu, en secondes. */
export const KeyframeSchema = z.object({
  time: z.number().min(0),
  value: z.union([z.number(), ColorSchema]),
  easing: EasingSchema,
})

const layerBase = {
  id: z.string().min(1),
  name: z.string(),
  /** Intervalle de présence du calque, en secondes : [start, end[. */
  start: z.number().min(0),
  end: z.number().min(0),
  visible: z.boolean(),
  locked: z.boolean(),
  transform: TransformSchema,
  animIn: InOutAnimSchema.nullable().default(null),
  animOut: InOutAnimSchema.nullable().default(null),
  emphasis: EmphasisSchema.nullable().default(null),
  /** Images clés par propriété, triées par temps. Une propriété sans image clé garde sa valeur de base. */
  keyframes: z.partialRecord(AnimPropSchema, z.array(KeyframeSchema)).default({}),
}

export const MediaPropsSchema = z.object({
  assetId: z.string(),
  /** Comment l'image remplit la boîte : recadrée, entière ou étirée. */
  fit: z.enum(['cover', 'contain', 'fill']),
  radius: z.number().min(0),
  stroke: ColorSchema.nullable(),
  strokeWidth: z.number().min(0),
  shadow: z.boolean(),
  /** Vidéo : instant de la source affiché au début du calque, en secondes. */
  videoStart: z.number().min(0),
  /** Volume du son de la vidéo (0 = muet, 1 = 100 %). */
  volume: z.number().min(0).max(2).default(1),
  /** Zooms caméra : l'image se resserre en douceur sur une zone de la source (captures d'écran). */
  zooms: z.array(z.lazy(() => ZoomSchema)).default([]),
})

/** Zoom caméra sur un média. Temps relatifs au début du calque ; centre en fraction de la source (0–1). */
export const ZoomSchema = z.object({
  id: z.string(),
  at: z.number().min(0),
  duration: z.number().positive(),
  /** Grossissement (2 = deux fois plus près). */
  scale: z.number().min(1).max(8),
  cx: z.number().min(0).max(1),
  cy: z.number().min(0).max(1),
  /** Durée de l'aller (et du retour), en secondes. */
  ramp: z.number().min(0),
})

/** Piste audio : musique, effet sonore, voix off. Rien n'est dessiné à l'image. */
export const AudioPropsSchema = z.object({
  assetId: z.string(),
  volume: z.number().min(0).max(2),
  /** Durées des fondus d'entrée et de sortie du son, en secondes. */
  fadeIn: z.number().min(0),
  fadeOut: z.number().min(0),
  /** Instant de la source joué au début du calque, en secondes. */
  sourceStart: z.number().min(0),
  /** Rejouer la source en boucle si le calque est plus long qu'elle (musiques). */
  loop: z.boolean(),
  /** Tempo (battements par minute) pour caler les animations sur le rythme ; `null` si inconnu. */
  bpm: z.number().positive().nullable().default(null),
})

/** Un sous-titre. Temps relatifs au début du calque de sous-titres. */
export const CueSchema = z.object({
  id: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
})

export const SubtitleStyleSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(900),
  color: ColorSchema,
  /** Fond derrière le texte (`null` : contour sombre à la place). */
  background: ColorSchema.nullable(),
  /** Position verticale du centre des sous-titres, en fraction de la hauteur (0 = haut, 1 = bas). */
  y: z.number().min(0).max(1),
  /** Largeur maximale d'une ligne, en fraction de la largeur du cadre. */
  maxWidth: z.number().min(0.2).max(1),
  animation: z.enum(['none', 'fade', 'pop', 'karaoke']),
  /** Couleur du mot prononcé (animation karaoké). */
  accent: ColorSchema,
})

/** Piste de sous-titres saisis à la main. */
export const SubtitlesPropsSchema = z.object({
  cues: z.array(CueSchema),
  style: SubtitleStyleSchema,
})

/** Zone floutée ou pixellisée : masque ce qui se trouve dessous (e-mail, mot de passe…). */
export const BlurPropsSchema = z.object({
  mode: z.enum(['blur', 'pixelate']),
  /** Rayon du flou, ou taille des pixels, en pixels de composition. */
  amount: z.number().positive(),
  radius: z.number().min(0),
})

/** Pictogramme vectoriel (bibliothèque d'icônes), dessiné au trait. */
export const IconPropsSchema = z.object({
  icon: z.string(),
  color: ColorSchema,
  strokeWidth: z.number().positive(),
})

export const BackgroundPropsSchema = z.object({
  fill: z.enum(['solid', 'linear', 'radial']),
  color1: ColorSchema,
  color2: ColorSchema,
  /** Angle du dégradé linéaire, en degrés (0 = de gauche à droite). */
  angle: z.number(),
  pattern: z.enum(['none', 'grid', 'dots', 'lines']),
  patternColor: ColorSchema,
  /** Pas du motif, en pixels de composition. */
  patternSize: z.number().positive(),
})

export const TextLayerSchema = z.object({ ...layerBase, type: z.literal('text'), props: TextPropsSchema })
export const ShapeLayerSchema = z.object({ ...layerBase, type: z.literal('shape'), props: ShapePropsSchema })
export const MediaLayerSchema = z.object({ ...layerBase, type: z.literal('media'), props: MediaPropsSchema })
export const AudioLayerSchema = z.object({ ...layerBase, type: z.literal('audio'), props: AudioPropsSchema })
export const IconLayerSchema = z.object({ ...layerBase, type: z.literal('icon'), props: IconPropsSchema })
export const SubtitlesLayerSchema = z.object({ ...layerBase, type: z.literal('subtitles'), props: SubtitlesPropsSchema })
export const BlurLayerSchema = z.object({ ...layerBase, type: z.literal('blur'), props: BlurPropsSchema })
/** Fond plein cadre : non sélectionnable sur le canevas, on le choisit dans la timeline. */
export const BackgroundLayerSchema = z.object({ ...layerBase, type: z.literal('background'), props: BackgroundPropsSchema })
export const LayerSchema = z.discriminatedUnion('type', [
  TextLayerSchema,
  ShapeLayerSchema,
  MediaLayerSchema,
  BackgroundLayerSchema,
  AudioLayerSchema,
  IconLayerSchema,
  SubtitlesLayerSchema,
  BlurLayerSchema,
])

/** Fichier importé. `src` est une URL data (image) ou blob (vidéo, valable pendant la session). */
export const AssetSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['image', 'video', 'audio']),
  name: z.string(),
  src: z.string(),
  /** Chemin sur le disque quand il est connu (application de bureau) : sert à la sauvegarde. */
  path: z.string().nullable().default(null),
  width: z.number().positive(),
  height: z.number().positive(),
  /** Durée en secondes (0 pour une image). */
  duration: z.number().min(0),
  /**
   * Son généré par Motio (musique ou effet de la bibliothèque) : seul son identifiant est
   * enregistré, le son est recalculé à l'ouverture du projet.
   */
  generated: z.string().nullable().default(null),
})

export const ProjectSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  /** Durée totale, en secondes. */
  duration: z.number().positive(),
  background: ColorSchema,
  /** Couleurs de la charte, proposées dans tous les sélecteurs de couleur. */
  palette: z.array(ColorSchema).default([]),
  assets: z.array(AssetSchema).default([]),
  /** Ordre de dessin : index 0 = tout en bas. */
  layers: z.array(LayerSchema),
})

export type Transform = z.infer<typeof TransformSchema>
export type TextProps = z.infer<typeof TextPropsSchema>
export type ShapeKind = z.infer<typeof ShapeKindSchema>
export type ShapeProps = z.infer<typeof ShapePropsSchema>
export type TextLayer = z.infer<typeof TextLayerSchema>
export type ShapeLayer = z.infer<typeof ShapeLayerSchema>
export type MediaProps = z.infer<typeof MediaPropsSchema>
export type MediaLayer = z.infer<typeof MediaLayerSchema>
export type BackgroundProps = z.infer<typeof BackgroundPropsSchema>
export type BackgroundLayer = z.infer<typeof BackgroundLayerSchema>
export type Asset = z.infer<typeof AssetSchema>
export type AudioProps = z.infer<typeof AudioPropsSchema>
export type AudioLayer = z.infer<typeof AudioLayerSchema>
export type IconProps = z.infer<typeof IconPropsSchema>
export type IconLayer = z.infer<typeof IconLayerSchema>
export type Zoom = z.infer<typeof ZoomSchema>
export type Cue = z.infer<typeof CueSchema>
export type SubtitleStyle = z.infer<typeof SubtitleStyleSchema>
export type SubtitlesLayer = z.infer<typeof SubtitlesLayerSchema>
export type BlurProps = z.infer<typeof BlurPropsSchema>
export type BlurLayer = z.infer<typeof BlurLayerSchema>
export type Layer = z.infer<typeof LayerSchema>
export type Project = z.infer<typeof ProjectSchema>
export type Easing = z.infer<typeof EasingSchema>
export type Direction = z.infer<typeof DirectionSchema>
export type InOutPreset = (typeof IN_OUT_PRESETS)[number]
export type EmphasisPreset = (typeof EMPHASIS_PRESETS)[number]
export type InOutAnim = z.infer<typeof InOutAnimSchema>
export type Emphasis = z.infer<typeof EmphasisSchema>
export type AnimProp = z.infer<typeof AnimPropSchema>
export type Keyframe = z.infer<typeof KeyframeSchema>
