import { isActive } from '@/engine/geometry'
import type { MediaResolver } from '@/engine/render'
import type { Asset, Project } from '@/model/schema'

function once(target: EventTarget, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      target.removeEventListener(event, done)
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    target.addEventListener(event, done, { once: true })
  })
}

/**
 * Médias pour l'export : contrairement à l'aperçu, chaque vidéo est calée exactement sur
 * l'image demandée (on attend la fin de chaque recherche) avant de dessiner.
 */
export class ExportMedia {
  private images = new Map<string, HTMLImageElement>()
  private videos = new Map<string, HTMLVideoElement>()

  async prepare(project: Project, time: number): Promise<void> {
    for (const layer of project.layers) {
      if (layer.type !== 'media' || !isActive(layer, time)) continue
      const asset = project.assets.find((a) => a.id === layer.props.assetId)
      if (!asset || !asset.src) continue
      if (asset.kind === 'image') await this.image(asset)
      else await this.seek(asset, time - layer.start + layer.props.videoStart)
    }
  }

  private async image(asset: Asset): Promise<void> {
    if (this.images.has(asset.id)) return
    const img = new Image()
    img.src = asset.src
    await img.decode().catch(() => {})
    this.images.set(asset.id, img)
  }

  private async seek(asset: Asset, sourceTime: number): Promise<void> {
    let v = this.videos.get(asset.id)
    if (!v) {
      v = document.createElement('video')
      // Lecture en CORS : le canvas reste exploitable pour l'export.
      v.crossOrigin = 'anonymous'
      v.muted = true
      v.preload = 'auto'
      v.src = asset.src
      this.videos.set(asset.id, v)
    }
    if (v.readyState < 2) await once(v, 'loadeddata', 5000)
    // Un léger décalage évite de tomber sur l'image précédente à cause des arrondis.
    const target = Math.min(Math.max(0, sourceTime) + 0.0005, Math.max(0, asset.duration - 0.01))
    if (Math.abs(v.currentTime - target) < 0.0001) return
    v.currentTime = target
    await once(v, 'seeked', 3000)
  }

  resolve: MediaResolver = (asset) => {
    if (asset.kind === 'image') {
      const img = this.images.get(asset.id)
      return img && img.naturalWidth > 0 ? img : null
    }
    const v = this.videos.get(asset.id)
    return v && v.readyState >= 2 ? v : null
  }

  dispose(): void {
    for (const v of this.videos.values()) {
      v.removeAttribute('src')
      v.load()
    }
    this.videos.clear()
    this.images.clear()
  }
}
