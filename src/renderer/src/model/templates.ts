import { findSound } from '@/audio/library'
import { ACCENT, createAudioLayer, createEmphasis, createIcon, createInOut, createShape, createText, generatedAsset, uniqueName, unit } from './factories'
import type { Asset, AudioLayer, InOutPreset, Layer, Project } from './schema'

/**
 * Modèles de scènes : un ensemble de calques déjà animés, inséré à la tête de lecture.
 * Tout est positionné par rapport au cadre, donc ils s'adaptent au format du projet.
 */
export interface Template {
  id: string
  label: string
  description: string
  /** Durée de la scène, en secondes. */
  length: number
  /** Instant montré dans la miniature. */
  thumbTime: number
  build: (project: Project, kit: TemplateKit) => Layer[]
}

/** Outils donnés aux modèles : ajouter un son de la bibliothèque (musique ou bruitage). */
export interface TemplateKit {
  sound: (soundId: string, start: number, name: string) => AudioLayer
}

type Anim = { preset: InOutPreset; duration?: number; direction?: 'left' | 'right' | 'up' | 'down' }

/** Calage dans le temps (relatif au début de la scène) et animations d'entrée / sortie. */
function timed<L extends Layer>(project: Project, layer: L, start: number, end: number, animIn?: Anim, animOut?: Anim): L {
  layer.start = start
  layer.end = end
  if (animIn) {
    layer.animIn = { ...createInOut(animIn.preset, layer, project, true), ...pick(animIn) }
  }
  if (animOut) {
    layer.animOut = { ...createInOut(animOut.preset, layer, project, false), ...pick(animOut) }
  }
  return layer
}

function pick(a: Anim) {
  return { ...(a.duration ? { duration: a.duration } : {}), ...(a.direction ? { direction: a.direction } : {}) }
}

function named<L extends Layer>(layer: L, prefix: string, name: string): L {
  layer.name = `${prefix} · ${name}`
  return layer
}

export const TEMPLATES: Template[] = [
  {
    id: 'intro',
    label: 'Intro',
    description: 'Grand titre, soulignement et sous-titre',
    length: 4,
    thumbTime: 1.6,
    build(p) {
      const u = unit(p)
      const cx = p.width / 2
      const cy = p.height / 2
      const title = createText(p, 'impact', { x: cx, y: cy - 40 * u }, 'Mon tutoriel')
      const bar = createShape(p, 'pill', { x: cx, y: cy + 80 * u })
      bar.transform.width = 260 * u
      bar.transform.height = 14 * u
      const sub = createText(p, 'subtitle', { x: cx, y: cy + 150 * u }, 'Apprenez en 5 minutes')
      return [
        named(timed(p, title, 0, 4, { preset: 'pop' }, { preset: 'fade' }), 'Intro', 'Titre'),
        named(timed(p, bar, 0.35, 4, { preset: 'wipe' }, { preset: 'fade' }), 'Intro', 'Barre'),
        named(timed(p, sub, 0.6, 4, { preset: 'slide' }, { preset: 'fade' }), 'Intro', 'Sous-titre'),
      ]
    },
  },
  {
    id: 'lower-third',
    label: 'Lower-third',
    description: 'Nom et fonction en bas de l’écran',
    length: 5,
    thumbTime: 1.5,
    build(p) {
      const u = unit(p)
      const left = 120 * u
      const y = p.height - 190 * u
      const panel = createShape(p, 'rect', { x: left + 260 * u, y })
      panel.transform.width = 520 * u
      panel.transform.height = 150 * u
      panel.props.radius = 18 * u
      panel.props.fill = '#14161cE6'
      const accent = createShape(p, 'rect', { x: left + 6 * u, y })
      accent.transform.width = 12 * u
      accent.transform.height = 150 * u
      accent.props.radius = 6 * u
      const name = createText(p, 'title', { x: left + 260 * u, y: y - 26 * u }, 'Camille Martin')
      Object.assign(name.props, { fontSize: 54 * u, align: 'left', autoWidth: false, letterSpacing: 0 })
      name.transform.width = 460 * u
      const role = createText(p, 'subtitle', { x: left + 260 * u, y: y + 34 * u }, 'Développeuse front-end')
      Object.assign(role.props, { fontSize: 32 * u, align: 'left', autoWidth: false, color: '#b9bccb' })
      role.transform.width = 460 * u
      return [
        named(timed(p, panel, 0, 5, { preset: 'wipe', direction: 'right' }, { preset: 'wipe', direction: 'left' }), 'Lower-third', 'Fond'),
        named(timed(p, accent, 0, 5, { preset: 'slide', direction: 'up' }, { preset: 'fade' }), 'Lower-third', 'Accent'),
        named(timed(p, name, 0.3, 5, { preset: 'slide', direction: 'right' }, { preset: 'fade', duration: 0.4 }), 'Lower-third', 'Nom'),
        named(timed(p, role, 0.5, 5, { preset: 'fade' }, { preset: 'fade', duration: 0.4 }), 'Lower-third', 'Fonction'),
      ]
    },
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Cadre, flèche et étiquette pour pointer une zone',
    length: 4,
    thumbTime: 1.8,
    build(p) {
      const u = unit(p)
      const cx = p.width / 2 + 160 * u
      const cy = p.height / 2
      const frame = createShape(p, 'frame', { x: cx, y: cy })
      const arrow = createShape(p, 'arrow', { x: cx - 420 * u, y: cy + 60 * u })
      arrow.transform.width = 240 * u
      arrow.transform.rotation = -15
      arrow.props.stroke = '#ff4d8d'
      const label = createText(p, 'label', { x: cx - 600 * u, y: cy + 110 * u }, 'Cliquez ici')
      label.props.highlight!.color = '#ff4d8d'
      return [
        named(timed(p, frame, 0, 4, { preset: 'draw' }, { preset: 'fade' }), 'Callout', 'Cadre'),
        named(timed(p, arrow, 0.5, 4, { preset: 'draw', duration: 0.5 }, { preset: 'fade' }), 'Callout', 'Flèche'),
        named(timed(p, label, 0.8, 4, { preset: 'pop' }, { preset: 'fade' }), 'Callout', 'Étiquette'),
      ]
    },
  },
  {
    id: 'chapter',
    label: 'Chapitre',
    description: 'Numéro de partie et titre de section',
    length: 3,
    thumbTime: 1.2,
    build(p) {
      const u = unit(p)
      const cx = p.width / 2
      const cy = p.height / 2
      const tag = createText(p, 'label', { x: cx, y: cy - 90 * u }, 'Partie 1')
      const title = createText(p, 'title', { x: cx, y: cy + 20 * u }, 'Les bases')
      return [
        named(timed(p, tag, 0, 3, { preset: 'pop' }, { preset: 'fade' }), 'Chapitre', 'Numéro'),
        named(timed(p, title, 0.25, 3, { preset: 'wipe' }, { preset: 'wipe', direction: 'right' }), 'Chapitre', 'Titre'),
      ]
    },
  },
  {
    id: 'command',
    label: 'Commande',
    description: 'Ligne de terminal tapée en direct',
    length: 4,
    thumbTime: 1.2,
    build(p) {
      const u = unit(p)
      const code = createText(p, 'code', { x: p.width / 2, y: p.height / 2 + 20 * u }, '$ npm install motio')
      code.props.fontSize = 48 * u
      const caption = createText(p, 'subtitle', { x: p.width / 2, y: p.height / 2 - 90 * u }, 'Dans le terminal :')
      caption.props.fontSize = 40 * u
      return [
        named(timed(p, caption, 0, 4, { preset: 'fade' }, { preset: 'fade' }), 'Commande', 'Légende'),
        named(timed(p, code, 0.3, 4, { preset: 'typewriter', duration: 1.2 }, { preset: 'fade' }), 'Commande', 'Code'),
      ]
    },
  },
  {
    id: 'shortcut',
    label: 'Raccourci',
    description: 'Combinaison de touches qui apparaît touche par touche',
    length: 3,
    thumbTime: 1.4,
    build(p) {
      const u = unit(p)
      const cx = p.width / 2
      const cy = p.height / 2
      const k1 = createText(p, 'key', { x: cx - 130 * u, y: cy }, '⌘')
      const plus = createText(p, 'subtitle', { x: cx, y: cy }, '+')
      const k2 = createText(p, 'key', { x: cx + 130 * u, y: cy }, 'K')
      for (const k of [k1, k2]) k.props.fontSize = 64 * u
      return [
        named(timed(p, k1, 0, 3, { preset: 'pop' }, { preset: 'fade' }), 'Raccourci', 'Touche 1'),
        named(timed(p, plus, 0.2, 3, { preset: 'fade' }, { preset: 'fade' }), 'Raccourci', 'Plus'),
        named(timed(p, k2, 0.35, 3, { preset: 'pop' }, { preset: 'fade' }), 'Raccourci', 'Touche 2'),
      ]
    },
  },
  {
    id: 'subscribe',
    label: 'Abonnez-vous',
    description: 'Bouton qui pulse pour inviter à s’abonner',
    length: 4,
    thumbTime: 1.5,
    build(p) {
      const u = unit(p)
      const x = p.width - 300 * u
      const y = p.height - 150 * u
      const button = createText(p, 'label', { x, y }, 'S’abonner')
      Object.assign(button.props, { fontSize: 44 * u })
      button.props.highlight = { color: '#ff0033', padding: 26 * u, radius: 14 * u }
      const layer = named(timed(p, button, 0, 4, { preset: 'pop' }, { preset: 'pop' }), 'Abonnez-vous', 'Bouton')
      layer.emphasis = { ...createEmphasis('pulse', layer), at: 0.8, repeat: true }
      return [layer]
    },
  },
  {
    id: 'countdown',
    label: 'Compte à rebours',
    description: '3, 2, 1… pour un trailer',
    length: 3.6,
    thumbTime: 1.3,
    build(p) {
      const u = unit(p)
      const at = { x: p.width / 2, y: p.height / 2 }
      const numbers = ['3', '2', '1'].map((n, i) => {
        const t = createText(p, 'impact', at, n)
        t.props.fontSize = 380 * u
        return named(timed(p, t, i, i + 1, { preset: 'zoom', duration: 0.35 }, { preset: 'fade', duration: 0.25 }), 'Rebours', n)
      })
      const go = createText(p, 'impact', at, 'Go !')
      go.props.fontSize = 300 * u
      go.props.color = '#ffd60a'
      return [...numbers, named(timed(p, go, 3, 3.6, { preset: 'pop', duration: 0.3 }), 'Rebours', 'Go')]
    },
  },
  {
    id: 'quote',
    label: 'Citation',
    description: 'Citation et auteur',
    length: 5,
    thumbTime: 2,
    build(p) {
      const u = unit(p)
      const cx = p.width / 2
      const cy = p.height / 2
      const quote = createText(p, 'quote', { x: cx, y: cy - 30 * u }, '« La simplicité est la sophistication suprême. »')
      quote.props.autoWidth = false
      quote.transform.width = 1100 * u
      const author = createText(p, 'subtitle', { x: cx, y: cy + 130 * u }, '— Léonard de Vinci')
      author.props.fontSize = 36 * u
      return [
        named(timed(p, quote, 0, 5, { preset: 'blur', duration: 0.9 }, { preset: 'fade' }), 'Citation', 'Texte'),
        named(timed(p, author, 0.8, 5, { preset: 'slide' }, { preset: 'fade' }), 'Citation', 'Auteur'),
      ]
    },
  },
  {
    id: 'badge',
    label: 'Badge',
    description: 'Étoile « Nouveau » qui se balance',
    length: 4,
    thumbTime: 1.2,
    build(p) {
      const u = unit(p)
      const x = p.width - 260 * u
      const y = 220 * u
      const star = createShape(p, 'star', { x, y })
      star.transform.rotation = -12
      const text = createText(p, 'title', { x, y: y + 6 * u }, 'Nouveau')
      Object.assign(text.props, { fontSize: 40 * u, color: '#1b1d23', uppercase: true, letterSpacing: 0 })
      text.transform.rotation = -12
      const layers = [
        named(timed(p, star, 0, 4, { preset: 'pop' }, { preset: 'pop' }), 'Badge', 'Étoile'),
        named(timed(p, text, 0.15, 4, { preset: 'pop' }, { preset: 'pop' }), 'Badge', 'Texte'),
      ]
      for (const l of layers) l.emphasis = { ...createEmphasis('wobble', l), at: 0.7, repeat: true, duration: 1.2 }
      return layers
    },
  },
  {
    id: 'outro',
    label: 'Outro',
    description: 'Remerciements de fin de vidéo',
    length: 4,
    thumbTime: 1.6,
    build(p) {
      const u = unit(p)
      const cx = p.width / 2
      const cy = p.height / 2
      const thanks = createText(p, 'title', { x: cx, y: cy - 30 * u }, 'Merci d’avoir regardé !')
      const next = createText(p, 'handwritten', { x: cx, y: cy + 90 * u }, 'À bientôt')
      const line = createShape(p, 'line', { x: cx, y: cy + 160 * u })
      line.transform.width = 200 * u
      line.props.stroke = ACCENT
      return [
        named(timed(p, thanks, 0, 4, { preset: 'slide' }, { preset: 'fade' }), 'Outro', 'Merci'),
        named(timed(p, next, 0.5, 4, { preset: 'pop' }, { preset: 'fade' }), 'Outro', 'À bientôt'),
        named(timed(p, line, 0.8, 4, { preset: 'draw' }, { preset: 'fade' }), 'Outro', 'Trait'),
      ]
    },
  },
  {
    id: 'mouse-click',
    label: 'Clic souris',
    description: 'Le curseur se déplace et clique, avec le son',
    length: 3,
    thumbTime: 1.35,
    build(p, kit) {
      const u = unit(p)
      const target = { x: p.width / 2, y: p.height / 2 }
      const ring = createShape(p, 'ring', target)
      ring.transform.width = ring.transform.height = 120 * u
      ring.props.stroke = '#ffffff'
      ring.props.strokeWidth = 6 * u
      const cursor = createIcon(p, 'mouse-pointer-2', 'Curseur', { x: target.x + 40 * u, y: target.y + 45 * u })
      cursor.transform.width = cursor.transform.height = 110 * u
      cursor.props.strokeWidth = 1.6
      // Le curseur arrive d'en bas à droite puis « s'enfonce » au moment du clic.
      const from = { x: target.x + 420 * u, y: target.y + 300 * u }
      cursor.keyframes = {
        x: [
          { time: 0, value: from.x, easing: 'ease' },
          { time: 1.1, value: cursor.transform.x, easing: 'ease' },
        ],
        y: [
          { time: 0, value: from.y, easing: 'ease' },
          { time: 1.1, value: cursor.transform.y, easing: 'ease' },
        ],
        scale: [
          { time: 1.15, value: 1, easing: 'easeOut' },
          { time: 1.25, value: 0.82, easing: 'back' },
          { time: 1.45, value: 1, easing: 'linear' },
        ],
      }
      const ringLayer = timed(p, ring, 1.25, 1.9, { preset: 'pop', duration: 0.25 }, { preset: 'fade', duration: 0.35 })
      return [
        named(ringLayer, 'Clic', 'Onde'),
        named(timed(p, cursor, 0, 3, { preset: 'fade', duration: 0.2 }, { preset: 'fade', duration: 0.3 }), 'Clic', 'Curseur'),
        kit.sound('sfx:mouse', 1.2, 'Clic · Son'),
      ]
    },
  },
  {
    id: 'notification',
    label: 'Notification',
    description: 'Carte de notification avec cloche et son',
    length: 4,
    thumbTime: 1.2,
    build(p, kit) {
      const u = unit(p)
      const x = p.width - 330 * u
      const y = 150 * u
      const card = createShape(p, 'rect', { x, y })
      card.transform.width = 520 * u
      card.transform.height = 130 * u
      card.props.fill = '#ffffff'
      card.props.radius = 24 * u
      const bell = createIcon(p, 'bell', 'Cloche', { x: x - 190 * u, y })
      bell.transform.width = bell.transform.height = 64 * u
      bell.props.color = ACCENT
      const title = createText(p, 'title', { x: x + 40 * u, y: y - 20 * u }, 'Nouveau message')
      Object.assign(title.props, { fontSize: 36 * u, color: '#1b1d23', align: 'left', autoWidth: false, letterSpacing: 0 })
      title.transform.width = 360 * u
      const body = createText(p, 'body', { x: x + 40 * u, y: y + 24 * u }, 'Camille vous a répondu')
      Object.assign(body.props, { fontSize: 26 * u, color: '#5a6070', align: 'left', autoWidth: false })
      body.transform.width = 360 * u
      const slide = { preset: 'slide' as const, direction: 'left' as const, duration: 0.45 }
      const out = { preset: 'slide' as const, direction: 'right' as const, duration: 0.4 }
      const bellLayer = named(timed(p, bell, 0.1, 4, slide, out), 'Notification', 'Cloche')
      bellLayer.emphasis = { ...createEmphasis('wobble', bellLayer), at: 0.45, duration: 0.9 }
      return [
        named(timed(p, card, 0, 4, slide, out), 'Notification', 'Carte'),
        bellLayer,
        named(timed(p, title, 0.1, 4, slide, out), 'Notification', 'Titre'),
        named(timed(p, body, 0.15, 4, slide, out), 'Notification', 'Texte'),
        kit.sound('sfx:notification', 0.2, 'Notification · Son'),
      ]
    },
  },
  {
    id: 'checklist',
    label: 'Liste à cocher',
    description: 'Trois étapes qui se cochent une à une',
    length: 5,
    thumbTime: 2.2,
    build(p, kit) {
      const u = unit(p)
      const left = p.width / 2 - 300 * u
      const items = ['Installer Motio', 'Choisir un modèle', 'Exporter la vidéo']
      return items.flatMap((label, i) => {
        const y = p.height / 2 + (i - 1) * 110 * u
        const at = 0.3 + i * 0.6
        const check = createIcon(p, 'circle-check', 'Coche', { x: left, y })
        check.transform.width = check.transform.height = 64 * u
        check.props.color = '#2ec4b6'
        const text = createText(p, 'subtitle', { x: left + 60 * u + 200 * u, y }, label)
        Object.assign(text.props, { fontSize: 48 * u, color: '#ffffff', align: 'left', autoWidth: false })
        text.transform.width = 400 * u
        return [
          named(timed(p, check, at, 5, { preset: 'pop', duration: 0.35 }, { preset: 'fade' }), 'Liste', `Coche ${i + 1}`),
          named(timed(p, text, at + 0.05, 5, { preset: 'slide', direction: 'right', duration: 0.4 }, { preset: 'fade' }), 'Liste', `Étape ${i + 1}`),
          kit.sound('sfx:pop', at, `Liste · Son ${i + 1}`),
        ]
      })
    },
  },
  {
    id: 'progress',
    label: 'Barre de progression',
    description: 'Chargement qui se remplit',
    length: 4,
    thumbTime: 2,
    build(p) {
      const u = unit(p)
      const cx = p.width / 2
      const cy = p.height / 2 + 30 * u
      const track = createShape(p, 'pill', { x: cx, y: cy })
      track.transform.width = 700 * u
      track.transform.height = 28 * u
      track.props.fill = '#ffffff22'
      const fill = createShape(p, 'pill', { x: cx, y: cy })
      fill.transform.width = 700 * u
      fill.transform.height = 28 * u
      const label = createText(p, 'subtitle', { x: cx, y: cy - 70 * u }, 'Installation en cours…')
      label.props.fontSize = 40 * u
      const fillLayer = timed(p, fill, 0.3, 4, { preset: 'wipe', direction: 'right', duration: 2.6 }, { preset: 'fade' })
      fillLayer.animIn!.easing = 'ease'
      return [
        named(timed(p, track, 0, 4, { preset: 'fade', duration: 0.3 }, { preset: 'fade' }), 'Progression', 'Fond'),
        named(fillLayer, 'Progression', 'Remplissage'),
        named(timed(p, label, 0, 4, { preset: 'fade' }, { preset: 'fade' }), 'Progression', 'Texte'),
      ]
    },
  },
  {
    id: 'reveal',
    label: 'Révélation trailer',
    description: 'Montée, impact, flash et grand titre',
    length: 5,
    thumbTime: 2.6,
    build(p, kit) {
      const title = createText(p, 'impact', { x: p.width / 2, y: p.height / 2 }, 'Bientôt')
      title.props.fontSize = 260 * unit(p)
      const flash = createShape(p, 'rect', { x: p.width / 2, y: p.height / 2 })
      flash.transform.width = p.width
      flash.transform.height = p.height
      flash.props.fill = '#ffffff'
      flash.props.radius = 0
      const titleLayer = named(timed(p, title, 2.4, 5, { preset: 'zoom', duration: 0.5 }, { preset: 'fade' }), 'Révélation', 'Titre')
      titleLayer.emphasis = { ...createEmphasis('shake', titleLayer), at: 0.05, duration: 0.5, intensity: 1.2 }
      return [
        titleLayer,
        named(timed(p, flash, 2.4, 2.9, { preset: 'fade', duration: 0.04 }, { preset: 'fade', duration: 0.46 }), 'Révélation', 'Flash'),
        kit.sound('sfx:riser', 0, 'Révélation · Montée'),
        kit.sound('sfx:impact', 2.4, 'Révélation · Impact'),
      ]
    },
  },
]

export interface PlacedTemplate {
  layers: Layer[]
  /** Sons générés à ajouter au projet (ceux qu'il ne contient pas déjà). */
  assets: Asset[]
}

/**
 * Calques d'un modèle placés à partir de `startAt` (décalé si la scène dépasse la fin du projet).
 * Les sons déjà présents dans le projet sont réutilisés.
 */
export function instantiateTemplate(template: Template, project: Project, startAt: number): PlacedTemplate {
  const t0 = Math.max(0, Math.min(startAt, project.duration - template.length))
  const assets: Asset[] = []
  const kit: TemplateKit = {
    sound(soundId, start, name) {
      const def = findSound(soundId)
      let asset = [...project.assets, ...assets].find((a) => a.generated === soundId)
      if (!asset) {
        asset = generatedAsset(soundId, def?.label ?? soundId, def?.duration ?? 1)
        assets.push(asset)
      }
      const layer = createAudioLayer(project, asset, start)
      layer.name = name
      return layer
    },
  }
  const placed: Layer[] = []
  for (const layer of template.build(project, kit)) {
    const end = Math.min(project.duration, layer.end + t0)
    const keyframes = Object.fromEntries(
      Object.entries(layer.keyframes).map(([prop, kfs]) => [prop, kfs?.map((k) => ({ ...k, time: k.time + t0 }))]),
    )
    placed.push({
      ...layer,
      // Un modèle inséré deux fois garde des noms de calques distincts.
      name: uniqueName(layer.name, [...project.layers, ...placed]),
      start: Math.min(layer.start + t0, Math.max(0, end - 0.1)),
      end,
      keyframes,
    })
  }
  return { layers: placed, assets }
}
