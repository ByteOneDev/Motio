import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { protocol } from 'electron'
import { MEDIA_SCHEME } from '../shared/api'

const CORS = { 'Access-Control-Allow-Origin': '*' }

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
}

/** À appeler avant `app.whenReady()`. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    // `corsEnabled` + en-tête CORS : sans cela, dessiner une vidéo dans un canvas le « contaminerait »
    // et l'export (qui relit les pixels du canvas) serait refusé par le navigateur.
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  ])
}

/**
 * Sert les médias locaux (vidéos importées) au renderer, avec la prise en charge des
 * requêtes partielles (Range) indispensable pour se déplacer dans une vidéo.
 * Seuls les fichiers image et vidéo sont servis.
 */
export function handleMediaScheme(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const path = new URL(request.url).searchParams.get('p') ?? ''
    const type = MIME[extname(path).toLowerCase()]
    if (!path || !type) return new Response('Type de fichier non pris en charge', { status: 415, headers: CORS })

    let size: number
    try {
      size = (await stat(path)).size
    } catch {
      return new Response('Fichier introuvable', { status: 404, headers: CORS })
    }

    const range = request.headers.get('range')?.match(/bytes=(\d*)-(\d*)/)
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { ...CORS, 'Content-Range': `bytes */${size}` } })
      }
      const stream = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream
      return new Response(stream, {
        status: 206,
        headers: {
          ...CORS,
          'Content-Type': type,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
        },
      })
    }

    const stream = Readable.toWeb(createReadStream(path)) as ReadableStream
    return new Response(stream, {
      headers: { ...CORS, 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' },
    })
  })
}
