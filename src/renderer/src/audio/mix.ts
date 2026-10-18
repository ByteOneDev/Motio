import type { Asset, Layer, Project } from '@/model/schema'

/** Un calque qui produit du son : piste audio, ou vidéo dont le son n'est pas coupé. */
export interface AudibleLayer {
  layer: Layer
  asset: Asset
  volume: number
  fadeIn: number
  fadeOut: number
  /** Instant de la source joué au début du calque. */
  sourceStart: number
  loop: boolean
}

export function audibleLayers(project: Project): AudibleLayer[] {
  const out: AudibleLayer[] = []
  for (const layer of project.layers) {
    // Un calque masqué est muet (l'œil de la timeline sert aussi de bouton « couper le son »).
    if (!layer.visible) continue
    if (layer.type === 'audio') {
      const asset = project.assets.find((a) => a.id === layer.props.assetId)
      if (asset) out.push({ layer, asset, ...layer.props })
    } else if (layer.type === 'media' && layer.props.volume > 0) {
      const asset = project.assets.find((a) => a.id === layer.props.assetId)
      if (asset?.kind === 'video') {
        out.push({ layer, asset, volume: layer.props.volume, fadeIn: 0, fadeOut: 0, sourceStart: layer.props.videoStart, loop: false })
      }
    }
  }
  return out
}

/** Volume d'un calque à l'instant `t` (volume × fondus d'entrée et de sortie). */
export function gainAt(a: AudibleLayer, t: number): number {
  const { start, end } = a.layer
  const fadeIn = a.fadeIn > 0 ? Math.min(1, Math.max(0, (t - start) / a.fadeIn)) : 1
  const fadeOut = a.fadeOut > 0 ? Math.min(1, Math.max(0, (end - t) / a.fadeOut)) : 1
  return a.volume * fadeIn * fadeOut
}

/**
 * Programme le son du projet entre `from` et `to` (temps du projet) dans un contexte audio,
 * `when` étant l'instant du contexte qui correspond à `from`. Sert à la lecture comme à l'export.
 */
export function scheduleMix(
  ctx: BaseAudioContext,
  destination: AudioNode,
  project: Project,
  buffers: (asset: Asset) => AudioBuffer | null,
  from: number,
  to: number,
  when: number,
): AudioScheduledSourceNode[] {
  const sources: AudioScheduledSourceNode[] = []
  for (const a of audibleLayers(project)) {
    const segStart = Math.max(a.layer.start, from)
    const segEnd = Math.min(a.layer.end, to)
    if (segEnd <= segStart) continue
    const buffer = buffers(a.asset)
    if (!buffer || buffer.duration <= 0) continue

    let offset = a.sourceStart + (segStart - a.layer.start)
    if (a.loop) offset %= buffer.duration
    else if (offset >= buffer.duration) continue

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = a.loop
    const gain = ctx.createGain()
    src.connect(gain)
    gain.connect(destination)

    // Enveloppe de volume : points clés des fondus, interpolés linéairement.
    const points = [segStart, a.layer.start + a.fadeIn, a.layer.end - a.fadeOut, segEnd]
      .filter((t) => t >= segStart && t <= segEnd)
      .sort((x, y) => x - y)
    gain.gain.setValueAtTime(gainAt(a, segStart), when + segStart - from)
    for (const t of points.slice(1)) gain.gain.linearRampToValueAtTime(gainAt(a, t), when + t - from)

    src.start(when + segStart - from, offset)
    src.stop(when + segEnd - from)
    sources.push(src)
  }
  return sources
}

export function hasAudio(project: Project, from = 0, to = project.duration): boolean {
  return audibleLayers(project).some((a) => a.layer.end > from && a.layer.start < to)
}
