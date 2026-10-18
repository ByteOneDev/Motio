import { AudioBufferSource, BufferTarget, CanvasSource, canEncodeAudio, canEncodeVideo, Mp4OutputFormat, Output, Quality, WebMOutputFormat } from 'mediabunny'
import { SAMPLE_RATE } from '@/audio/library'
import { hasAudio, scheduleMix } from '@/audio/mix'
import { canvasMeasure } from '@/engine/measure'
import { renderFrame } from '@/engine/render'
import type { Project } from '@/model/schema'
import { audioBuffer, loadProjectAudio } from '@/ui/audio'
import { layerFonts } from '@/ui/fonts'
import { ExportMedia } from './exportMedia'

export type ExportFormat = 'mp4' | 'webm' | 'png-sequence' | 'png-frame'
export type ExportQuality = 'medium' | 'high' | 'very-high'

export interface ExportSettings {
  format: ExportFormat
  /** Facteur de résolution par rapport au format du projet (0,5 = moitié, 2 = double). */
  scale: number
  quality: ExportQuality
  /** Fond transparent (WebM et PNG uniquement : le MP4 ne gère pas la transparence). */
  transparent: boolean
  /** Plage exportée, en secondes. */
  from: number
  to: number
}

export interface ExportProgress {
  frame: number
  total: number
}

export function supportsTransparency(format: ExportFormat): boolean {
  return format !== 'mp4'
}

/** Dimensions de sortie, paires (exigé par l'encodeur H.264). */
export function exportSize(project: Pick<Project, 'width' | 'height'>, scale: number): { width: number; height: number } {
  const even = (v: number) => Math.max(2, Math.round((v * scale) / 2) * 2)
  return { width: even(project.width), height: even(project.height) }
}

export function frameCount(project: Pick<Project, 'fps'>, settings: Pick<ExportSettings, 'from' | 'to'>): number {
  return Math.max(1, Math.round((settings.to - settings.from) * project.fps))
}

/** Toutes les polices utilisées doivent être chargées avant la première image. */
async function loadFonts(project: Project): Promise<void> {
  const fonts = layerFonts(project.layers)
  await Promise.all(fonts.map((f) => document.fonts.load(f).catch(() => [])))
  await document.fonts.ready
}

/** Dessine les images de la composition dans un canvas hors écran, à la résolution d'export. */
class FrameRenderer {
  readonly canvas: OffscreenCanvas
  private ctx: OffscreenCanvasRenderingContext2D
  private media = new ExportMedia()
  private scale: number

  constructor(
    private project: Project,
    private transparent: boolean,
    scale: number,
  ) {
    const { width, height } = exportSize(project, scale)
    this.canvas = new OffscreenCanvas(width, height)
    this.ctx = this.canvas.getContext('2d', { alpha: true })!
    this.scale = width / project.width
  }

  async draw(time: number): Promise<void> {
    await this.media.prepare(this.project, time)
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    renderFrame(ctx, this.project, time, canvasMeasure, {
      pixelScale: this.scale,
      media: this.media.resolve,
      transparent: this.transparent,
    })
  }

  async png(): Promise<ArrayBuffer> {
    return (await this.canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()
  }

  dispose(): void {
    this.media.dispose()
  }
}

/** Mixe tout le son de la plage exportée (musiques, bruitages, son des vidéos). */
export async function renderMix(project: Project, from: number, to: number): Promise<AudioBuffer> {
  await loadProjectAudio(project)
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil((to - from) * SAMPLE_RATE)), SAMPLE_RATE)
  scheduleMix(ctx, ctx.destination, project, audioBuffer, from, to, 0)
  return ctx.startRendering()
}

function checkAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Export annulé', 'AbortError')
}

/** Encode la séquence en MP4 (H.264) ou WebM (VP9, avec transparence si demandée). */
export async function exportVideo(
  project: Project,
  settings: ExportSettings,
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const isMp4 = settings.format === 'mp4'
  const transparent = settings.transparent && !isMp4
  const codec = isMp4 ? 'avc' : 'vp9'
  const { width, height } = exportSize(project, settings.scale)
  const quality = new Quality(settings.quality)
  if (!(await canEncodeVideo(codec, { width, height, quality, frameRate: project.fps }))) {
    throw new Error(`Votre système ne sait pas encoder cette vidéo en ${width} × ${height}. Essayez une résolution plus petite.`)
  }

  await loadFonts(project)
  const frames = new FrameRenderer(project, transparent, settings.scale)
  const output = new Output({
    format: isMp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  })
  const source = new CanvasSource(frames.canvas, {
    codec,
    quality,
    alpha: transparent ? 'keep' : 'discard',
    keyFrameInterval: 2,
  })
  output.addVideoTrack(source, { frameRate: project.fps, canBeTransparent: transparent })

  // Piste son : AAC dans un MP4, Opus dans un WebM.
  const audioCodec = isMp4 ? 'aac' : 'opus'
  const withAudio = hasAudio(project, settings.from, settings.to) && (await canEncodeAudio(audioCodec))
  const audio = withAudio ? new AudioBufferSource({ codec: audioCodec, quality }) : null
  if (audio) output.addAudioTrack(audio)

  try {
    await output.start()
    if (audio) {
      await audio.add(await renderMix(project, settings.from, settings.to))
      audio.close()
    }
    const total = frameCount(project, settings)
    const dt = 1 / project.fps
    for (let i = 0; i < total; i++) {
      checkAborted(signal)
      await frames.draw(settings.from + i * dt)
      await source.add(i * dt, dt)
      onProgress({ frame: i + 1, total })
    }
    source.close()
    await output.finalize()
    return (output.target as BufferTarget).buffer!
  } catch (e) {
    if (output.state !== 'finalized') await output.cancel().catch(() => {})
    throw e
  } finally {
    frames.dispose()
  }
}

/** Écrit une image PNG par image de la séquence (format accepté par tous les logiciels de montage). */
export async function exportPngSequence(
  project: Project,
  settings: ExportSettings,
  writeFrame: (name: string, data: ArrayBuffer) => Promise<void>,
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
): Promise<void> {
  await loadFonts(project)
  const frames = new FrameRenderer(project, settings.transparent, settings.scale)
  try {
    const total = frameCount(project, settings)
    const digits = String(total).length
    for (let i = 0; i < total; i++) {
      checkAborted(signal)
      await frames.draw(settings.from + i / project.fps)
      await writeFrame(`${String(i + 1).padStart(Math.max(4, digits), '0')}.png`, await frames.png())
      onProgress({ frame: i + 1, total })
    }
  } finally {
    frames.dispose()
  }
}

/** Une seule image (miniature YouTube, illustration…). */
export async function exportPngFrame(project: Project, time: number, settings: Pick<ExportSettings, 'scale' | 'transparent'>): Promise<ArrayBuffer> {
  await loadFonts(project)
  const frames = new FrameRenderer(project, settings.transparent, settings.scale)
  try {
    await frames.draw(time)
    return await frames.png()
  } finally {
    frames.dispose()
  }
}
