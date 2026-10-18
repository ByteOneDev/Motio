import { findIcon } from '@/model/icons'
import type { Asset, BackgroundLayer, BlurLayer, IconLayer, Layer, MediaLayer, Project, ShapeLayer, SubtitlesLayer, TextLayer } from '@/model/schema'
import { activeCue, cueProgress, spokenWords } from './subtitles'
import { zoomAt, zoomRect } from './zoom'
import { presetModifiers, resolveLayer, type Modifiers } from './animate'
import { arrowHead, isActive, layerSize, rad } from './geometry'
import { fontString, layoutText, type Measure } from './text'

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** Fournit l'image à dessiner pour un média (`time` = instant dans la source, en secondes). */
export type MediaResolver = (asset: Asset, time: number) => CanvasImageSource | null

export interface RenderOptions {
  /** Pixels du canvas par pixel de composition (sert à mettre flous et ombres à la bonne échelle). */
  pixelScale?: number
  /** Sans résolveur (tests, miniatures), les médias sont dessinés comme des emplacements vides. */
  media?: MediaResolver
  /** Export avec transparence : ni la couleur de fond du projet, ni les calques de fond. */
  transparent?: boolean
}

interface DrawContext {
  project: Project
  time: number
  measure: Measure
  pixelScale: number
  media?: MediaResolver
}

/**
 * Dessine l'image de la composition à l'instant `time`, dans le repère courant de `ctx`
 * (1 unité = 1 pixel de composition). Fonction pure : aucun état caché.
 */
export function renderFrame(ctx: Ctx, project: Project, time: number, measure: Measure, opts: RenderOptions = {}): void {
  ctx.save()
  if (!opts.transparent) {
    ctx.fillStyle = project.background
    ctx.fillRect(0, 0, project.width, project.height)
  }
  const dc: DrawContext = { project, time, measure, pixelScale: opts.pixelScale ?? 1, media: opts.media }
  for (const layer of project.layers) {
    if (layer.type === 'audio' || !isActive(layer, time) || (opts.transparent && layer.type === 'background')) continue
    const resolved = resolveLayer(layer, time)
    drawLayer(ctx, resolved, presetModifiers(resolved, time, project), dc)
  }
  ctx.restore()
}

function drawLayer(ctx: Ctx, layer: Layer, m: Modifiers, dc: DrawContext): void {
  const { measure, pixelScale } = dc
  const t = layer.transform
  const opacity = t.opacity * m.opacity
  const scale = t.scale * m.scale
  if (opacity <= 0.001 || scale <= 0.0001 || m.reveal <= 0) return

  ctx.save()
  ctx.translate(t.x + m.dx, t.y + m.dy)
  ctx.rotate(rad(t.rotation + m.rotation))
  ctx.scale(scale, scale)
  ctx.globalAlpha *= opacity
  if (m.blur > 0.01) ctx.filter = `blur(${m.blur * pixelScale}px)`
  if (m.wipe) clipWipe(ctx, layer, m.wipe, measure)

  // Ombres et contours sont définis dans le repère du calque : on les convertit en pixels du canvas.
  const px = pixelScale * scale
  switch (layer.type) {
    case 'text':
      drawText(ctx, layer, measure, m.reveal, px)
      break
    case 'shape':
      drawShape(ctx, layer, m.reveal)
      break
    case 'media':
      drawMedia(ctx, layer, dc, px)
      break
    case 'background':
      drawBackground(ctx, layer)
      break
    case 'icon':
      drawIcon(ctx, layer, m.reveal)
      break
    case 'subtitles':
      drawSubtitles(ctx, layer, dc)
      break
    case 'blur':
      drawRegionEffect(ctx, layer)
      break
    case 'audio':
      break
  }
  ctx.restore()
}

function clipWipe(ctx: Ctx, layer: Layer, wipe: NonNullable<Modifiers['wipe']>, measure: Measure): void {
  const size = layerSize(layer, measure)
  // Marge pour les contours et les pointes de flèche qui débordent de la boîte.
  const pad =
    layer.type === 'shape'
      ? layer.props.strokeWidth + arrowHead(layer.props).half
      : layer.type === 'text'
        ? layer.props.fontSize * 0.2 + (layer.props.outline?.width ?? 0)
        : layer.type === 'media'
          ? layer.props.strokeWidth
          : 0
  const w = size.w + pad * 2
  const h = size.h + pad * 2
  const left = -w / 2
  const top = -h / 2
  const a = wipe.amount
  // En entrée, la zone visible s'étend dans le sens du mouvement ; en sortie, elle s'efface dans ce sens.
  const fromStart = wipe.entering
  ctx.beginPath()
  switch (wipe.direction) {
    case 'right':
      ctx.rect(fromStart ? left : left + w * (1 - a), top, w * a, h)
      break
    case 'left':
      ctx.rect(fromStart ? left + w * (1 - a) : left, top, w * a, h)
      break
    case 'down':
      ctx.rect(left, fromStart ? top : top + h * (1 - a), w, h * a)
      break
    case 'up':
      ctx.rect(left, fromStart ? top + h * (1 - a) : top, w, h * a)
      break
  }
  ctx.clip()
}

function drawText(ctx: Ctx, layer: TextLayer, measure: Measure, reveal: number, px: number): void {
  const p = layer.props
  const layout = layoutText(p, layer.transform.width, measure)
  const font = fontString(p)
  const shadow = () => {
    if (!p.shadow) return
    ctx.shadowColor = p.shadow.color
    ctx.shadowBlur = p.shadow.blur * px
    ctx.shadowOffsetY = p.shadow.offsetY * px
  }

  // Pastille de fond : c'est elle qui porte l'ombre, s'il y en a une.
  if (p.highlight) {
    const pad = p.highlight.padding
    const w = layout.width + pad * 2
    const h = layout.height + pad * 2
    ctx.save()
    shadow()
    ctx.fillStyle = p.highlight.color
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(p.highlight.radius, w / 2, h / 2))
    ctx.fill()
    ctx.restore()
  } else {
    shadow()
  }

  ctx.font = font
  ctx.letterSpacing = `${p.letterSpacing}px`
  ctx.fillStyle = p.color
  ctx.textBaseline = 'middle'
  // Alignement calculé à la main : un texte partiellement tapé garde la position de ses lettres.
  ctx.textAlign = 'left'

  const lines = layout.lines.map((l) => ({ ...l, chars: Array.from(l.text) }))
  const total = lines.reduce((n, l) => n + l.chars.length, 0)
  let remaining = reveal >= 1 ? Infinity : Math.floor(total * reveal)
  let caret: { x: number; y: number } | null = null

  let y = -layout.height / 2 + layout.lineHeight / 2
  for (const line of lines) {
    if (reveal < 1 && remaining <= 0 && caret) break
    const x0 = p.align === 'left' ? -layout.width / 2 : p.align === 'right' ? layout.width / 2 - line.width : -line.width / 2
    const shown = remaining >= line.chars.length ? line.text : line.chars.slice(0, remaining).join('')
    if (p.outline && p.outline.width > 0) {
      // Trait centré sur le contour des lettres : on double l'épaisseur, le remplissage recouvre l'intérieur.
      ctx.strokeStyle = p.outline.color
      ctx.lineWidth = p.outline.width * 2
      ctx.lineJoin = 'round'
      ctx.strokeText(shown, x0, y)
    }
    ctx.fillText(shown, x0, y)
    remaining -= line.chars.length
    if (reveal < 1) caret = { x: x0 + measure(shown, font, p.letterSpacing), y }
    y += layout.lineHeight
  }

  if (caret) {
    ctx.fillRect(caret.x + p.fontSize * 0.04, caret.y - p.fontSize * 0.45, Math.max(1, p.fontSize * 0.06), p.fontSize * 0.9)
  }
}

function ellipsePerimeter(a: number, b: number): number {
  // Approximation de Ramanujan.
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
}

function drawShape(ctx: Ctx, layer: ShapeLayer, reveal: number): void {
  const p = layer.props
  const w = layer.transform.width
  const h = layer.transform.height

  if (p.kind === 'line' || p.kind === 'arrow') {
    const color = p.stroke ?? '#ffffff'
    const head = p.kind === 'arrow' ? arrowHead(p) : null
    // Le tracé progresse de gauche à droite ; la pointe suit son extrémité.
    const tip = -w / 2 + w * reveal
    const headLength = head ? Math.min(head.length, w * reveal) : 0
    ctx.strokeStyle = color
    ctx.lineWidth = p.strokeWidth
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-w / 2, 0)
    ctx.lineTo(Math.max(-w / 2, tip - headLength * 0.8), 0)
    ctx.stroke()
    if (head && headLength > 0) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(tip, 0)
      ctx.lineTo(tip - headLength, -head.half)
      ctx.lineTo(tip - headLength, head.half)
      ctx.closePath()
      ctx.fill()
    }
    return
  }

  const radius = Math.min(p.radius, w / 2, h / 2)
  const points = p.kind === 'triangle' || p.kind === 'star' || p.kind === 'hexagon' ? polygon(p.kind, w, h) : null
  ctx.beginPath()
  if (p.kind === 'ellipse') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
  else if (p.kind === 'bubble') bubblePath(ctx, w, h, radius)
  else if (points) {
    points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)))
    ctx.closePath()
  } else ctx.roundRect(-w / 2, -h / 2, w, h, radius)

  if (p.fill) {
    ctx.save()
    // Pendant un tracé, le remplissage apparaît progressivement.
    if (reveal < 1) ctx.globalAlpha *= reveal
    ctx.fillStyle = p.fill
    ctx.fill()
    ctx.restore()
  }
  if (p.stroke && p.strokeWidth > 0) {
    if (reveal < 1) {
      const perimeter = p.kind === 'ellipse' ? ellipsePerimeter(w / 2, h / 2) : points ? polygonPerimeter(points) : 2 * (w + h)
      ctx.setLineDash([perimeter * reveal, perimeter])
    }
    ctx.strokeStyle = p.stroke
    ctx.lineWidth = p.strokeWidth
    ctx.stroke()
  }
}

/** Bulle de dialogue : un rectangle arrondi et sa pointe en bas à gauche, en un seul contour. */
function bubblePath(ctx: Ctx, w: number, h: number, radius: number): void {
  const bodyH = h * 0.8
  const top = -h / 2
  const bottom = top + bodyH
  const left = -w / 2
  const right = w / 2
  const r = Math.min(radius, w / 2, bodyH / 2)
  ctx.moveTo(left + r, top)
  ctx.arcTo(right, top, right, bottom, r)
  ctx.arcTo(right, bottom, left, bottom, r)
  ctx.lineTo(left + w * 0.34, bottom)
  ctx.lineTo(left + w * 0.16, h / 2)
  ctx.lineTo(left + w * 0.2, bottom)
  ctx.arcTo(left, bottom, left, top, r)
  ctx.arcTo(left, top, right, top, r)
  ctx.closePath()
}

function polygon(kind: 'triangle' | 'star' | 'hexagon', w: number, h: number): { x: number; y: number }[] {
  if (kind === 'hexagon') {
    return Array.from({ length: 6 }, (_, i) => {
      const a = (i * Math.PI) / 3
      return { x: (Math.cos(a) * w) / 2, y: (Math.sin(a) * h) / 2 }
    })
  }
  if (kind === 'triangle') {
    return [
      { x: 0, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ]
  }
  // Étoile à cinq branches, rayon intérieur à 45 %, pointe vers le haut.
  const pts = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : 0.45
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push({ x: (Math.cos(a) * r * w) / 2, y: (Math.sin(a) * r * h) / 2 })
  }
  return pts
}

function polygonPerimeter(points: { x: number; y: number }[]): number {
  return points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]
    return sum + Math.hypot(q.x - p.x, q.y - p.y)
  }, 0)
}

function drawMedia(ctx: Ctx, layer: MediaLayer, dc: DrawContext, px: number): void {
  const p = layer.props
  const { width: w, height: h } = layer.transform
  const asset = dc.project.assets.find((a) => a.id === p.assetId)
  const source = asset && dc.media ? dc.media(asset, Math.max(0, dc.time - layer.start + p.videoStart)) : null
  const path = () => {
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(p.radius, w / 2, h / 2))
  }

  if (p.shadow) {
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = 48 * px
    ctx.shadowOffsetY = 18 * px
    ctx.fillStyle = '#000000'
    path()
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  path()
  ctx.clip()
  if (source && asset) {
    const iw = asset.width
    const ih = asset.height
    // Zone de la source à afficher (recadrée en « Remplir »), puis resserrée par le zoom caméra.
    let src = { sx: 0, sy: 0, sw: iw, sh: ih }
    let dest = { x: -w / 2, y: -h / 2, w, h }
    if (p.fit === 'cover') {
      const s = Math.max(w / iw, h / ih)
      src = { sx: (iw - w / s) / 2, sy: (ih - h / s) / 2, sw: w / s, sh: h / s }
    } else if (p.fit === 'contain') {
      const s = Math.min(w / iw, h / ih)
      dest = { x: (-iw * s) / 2, y: (-ih * s) / 2, w: iw * s, h: ih * s }
    }
    src = zoomRect(src, zoomAt(layer, dc.time), asset)
    ctx.drawImage(source, src.sx, src.sy, src.sw, src.sh, dest.x, dest.y, dest.w, dest.h)
  } else {
    // Média absent ou en cours de chargement.
    ctx.fillStyle = '#262a33'
    ctx.fillRect(-w / 2, -h / 2, w, h)
  }
  ctx.restore()

  if (p.stroke && p.strokeWidth > 0) {
    path()
    ctx.strokeStyle = p.stroke
    ctx.lineWidth = p.strokeWidth
    ctx.stroke()
  }
}

function drawBackground(ctx: Ctx, layer: BackgroundLayer): void {
  const p = layer.props
  const { width: w, height: h } = layer.transform
  if (p.fill === 'linear') {
    const a = rad(p.angle)
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    // Demi-longueur de la projection du cadre sur la direction du dégradé.
    const l = Math.abs((w / 2) * cos) + Math.abs((h / 2) * sin)
    const g = ctx.createLinearGradient(-cos * l, -sin * l, cos * l, sin * l)
    g.addColorStop(0, p.color1)
    g.addColorStop(1, p.color2)
    ctx.fillStyle = g
  } else if (p.fill === 'radial') {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.hypot(w, h) / 2)
    g.addColorStop(0, p.color1)
    g.addColorStop(1, p.color2)
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = p.color1
  }
  ctx.fillRect(-w / 2, -h / 2, w, h)
  if (p.pattern === 'none') return

  const size = p.patternSize
  ctx.save()
  ctx.beginPath()
  ctx.rect(-w / 2, -h / 2, w, h)
  ctx.clip()
  ctx.beginPath()
  if (p.pattern === 'grid') {
    for (let x = -w / 2; x <= w / 2; x += size) {
      ctx.moveTo(x, -h / 2)
      ctx.lineTo(x, h / 2)
    }
    for (let y = -h / 2; y <= h / 2; y += size) {
      ctx.moveTo(-w / 2, y)
      ctx.lineTo(w / 2, y)
    }
    ctx.strokeStyle = p.patternColor
    ctx.lineWidth = Math.max(1, size * 0.03)
    ctx.stroke()
  } else if (p.pattern === 'lines') {
    for (let x = -w / 2 - h; x <= w / 2; x += size) {
      ctx.moveTo(x, -h / 2)
      ctx.lineTo(x + h, h / 2)
    }
    ctx.strokeStyle = p.patternColor
    ctx.lineWidth = Math.max(1, size * 0.25)
    ctx.stroke()
  } else {
    const r = Math.max(1, size * 0.07)
    for (let x = -w / 2 + size / 2; x < w / 2; x += size) {
      for (let y = -h / 2 + size / 2; y < h / 2; y += size) {
        ctx.moveTo(x + r, y)
        ctx.arc(x, y, r, 0, Math.PI * 2)
      }
    }
    ctx.fillStyle = p.patternColor
    ctx.fill()
  }
  ctx.restore()
}

/** Icône au trait (grille 24 × 24 étirée à la boîte du calque). */
function drawIcon(ctx: Ctx, layer: IconLayer, reveal: number): void {
  const icon = findIcon(layer.props.icon)
  if (!icon) return
  const { width: w, height: h } = layer.transform
  ctx.save()
  ctx.translate(-w / 2, -h / 2)
  ctx.scale(w / 24, h / 24)
  ctx.strokeStyle = layer.props.color
  ctx.lineWidth = layer.props.strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Tracé progressif : les traits d'une icône font moins de 80 unités.
  if (reveal < 1) ctx.setLineDash([80 * reveal, 80])
  for (const [tag, a] of icon.node) {
    const n = (k: string) => Number(a[k] ?? 0)
    ctx.beginPath()
    switch (tag) {
      case 'path':
        ctx.stroke(new Path2D(a.d))
        continue
      case 'circle':
        ctx.arc(n('cx'), n('cy'), n('r'), 0, Math.PI * 2)
        break
      case 'ellipse':
        ctx.ellipse(n('cx'), n('cy'), n('rx'), n('ry'), 0, 0, Math.PI * 2)
        break
      case 'rect':
        ctx.roundRect(n('x'), n('y'), n('width'), n('height'), n('rx'))
        break
      case 'line':
        ctx.moveTo(n('x1'), n('y1'))
        ctx.lineTo(n('x2'), n('y2'))
        break
      case 'polyline':
      case 'polygon': {
        const pts = (a.points ?? '').trim().split(/[\s,]+/).map(Number)
        for (let i = 0; i + 1 < pts.length; i += 2) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, pts[i], pts[i + 1])
        if (tag === 'polygon') ctx.closePath()
        break
      }
    }
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Sous-titre courant, centré horizontalement à la hauteur choisie. Chaque ligne a sa pastille
 * (ou un contour sombre) ; en karaoké, les mots prononcés prennent la couleur d'accent.
 */
function drawSubtitles(ctx: Ctx, layer: SubtitlesLayer, dc: DrawContext): void {
  const cue = activeCue(layer, dc.time)
  if (!cue || !cue.text.trim()) return
  const st = layer.props.style
  const { width: W, height: H } = layer.transform
  const progress = cueProgress(cue, layer, dc.time)
  const elapsed = (dc.time - layer.start) - cue.start
  const remaining = cue.end - (dc.time - layer.start)
  const appear = Math.min(1, elapsed / 0.15, remaining / 0.15)

  ctx.save()
  if (st.animation === 'fade' || st.animation === 'pop') ctx.globalAlpha *= Math.max(0, appear)
  const cy = (st.y - 0.5) * H
  if (st.animation === 'pop') {
    const k = 0.92 + 0.08 * Math.min(1, elapsed / 0.15)
    ctx.translate(0, cy)
    ctx.scale(k, k)
    ctx.translate(0, -cy)
  }

  const props = {
    text: cue.text,
    fontFamily: st.fontFamily,
    fontSize: st.fontSize,
    fontWeight: st.fontWeight,
    italic: false,
    color: st.color,
    align: 'center' as const,
    lineHeight: 1.3,
    letterSpacing: 0,
    autoWidth: false,
    uppercase: false,
    highlight: null,
    outline: null,
    shadow: null,
  }
  const layout = layoutText(props, W * st.maxWidth, dc.measure)
  const font = fontString(props)
  const space = dc.measure(' ', font, 0)
  const padX = st.fontSize * 0.35
  const padY = st.fontSize * 0.14
  const words = cue.text.split(/\s+/).filter(Boolean)
  const spoken = st.animation === 'karaoke' ? spokenWords(words, progress) : words.length

  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.lineJoin = 'round'
  let y = cy - layout.height / 2 + layout.lineHeight / 2
  let wordIndex = 0
  for (const line of layout.lines) {
    if (st.background) {
      ctx.fillStyle = st.background
      ctx.beginPath()
      ctx.roundRect(-line.width / 2 - padX, y - layout.lineHeight / 2 + padY / 2, line.width + padX * 2, layout.lineHeight - padY, st.fontSize * 0.2)
      ctx.fill()
    }
    let x = -line.width / 2
    for (const word of line.text.split(/\s+/).filter(Boolean)) {
      const wWidth = dc.measure(word, font, 0)
      if (!st.background) {
        // Sans fond, un contour sombre garde le texte lisible sur n'importe quelle image.
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)'
        ctx.lineWidth = Math.max(2, st.fontSize * 0.14)
        ctx.strokeText(word, x, y)
      }
      const karaoke = st.animation === 'karaoke'
      const upcoming = karaoke && wordIndex >= spoken
      ctx.save()
      // En karaoké, les mots à venir restent un peu en retrait.
      if (upcoming) ctx.globalAlpha *= 0.75
      ctx.fillStyle = karaoke && !upcoming ? st.accent : st.color
      ctx.fillText(word, x, y)
      ctx.restore()
      x += wWidth + space
      wordIndex++
    }
    y += layout.lineHeight
  }
  ctx.restore()
}

let effectCanvas: OffscreenCanvas | null = null

function scratch(w: number, h: number): OffscreenCanvasRenderingContext2D {
  if (!effectCanvas || effectCanvas.width < w || effectCanvas.height < h) {
    effectCanvas = new OffscreenCanvas(Math.max(w, effectCanvas?.width ?? 0), Math.max(h, effectCanvas?.height ?? 0))
  }
  const g = effectCanvas.getContext('2d')!
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, w, h)
  return g
}

/**
 * Flou ou pixellisation de la zone : on relit ce qui a déjà été dessiné sous le calque,
 * puis on le redessine transformé, découpé à la forme (arrondie) du calque.
 */
function drawRegionEffect(ctx: Ctx, layer: BlurLayer): void {
  const { width: w, height: h } = layer.transform
  const { mode, amount, radius } = layer.props
  const m = ctx.getTransform()
  const canvas = ctx.canvas
  const pts = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }))
  // Échelle repère du calque → pixels du canvas (zoom, écran Retina, échelle du calque).
  const k = Math.hypot(m.a, m.b)
  const pad = mode === 'blur' ? Math.ceil(amount * k * 2) : 0
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x))) - pad)
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y))) - pad)
  const x1 = Math.min(canvas.width, Math.ceil(Math.max(...pts.map((p) => p.x))) + pad)
  const y1 = Math.min(canvas.height, Math.ceil(Math.max(...pts.map((p) => p.y))) + pad)
  const aw = x1 - x0
  const ah = y1 - y0
  if (aw < 1 || ah < 1) return

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(radius, w / 2, h / 2))
  ctx.clip()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (mode === 'pixelate') {
    const cell = Math.max(1, amount * k)
    const tw = Math.max(1, Math.ceil(aw / cell))
    const th = Math.max(1, Math.ceil(ah / cell))
    const g = scratch(tw, th)
    g.imageSmoothingEnabled = true
    g.drawImage(canvas, x0, y0, aw, ah, 0, 0, tw, th)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(effectCanvas!, 0, 0, tw, th, x0, y0, tw * cell, th * cell)
  } else {
    const g = scratch(aw, ah)
    g.drawImage(canvas, x0, y0, aw, ah, 0, 0, aw, ah)
    ctx.filter = `blur(${amount * k}px)`
    ctx.drawImage(effectCanvas!, 0, 0, aw, ah, x0, y0, aw, ah)
  }
  ctx.restore()
}
