import type { Cue, SubtitlesLayer } from '@/model/schema'

/** Sous-titre affiché à l'instant `time` (temps du projet), s'il y en a un. */
export function activeCue(layer: SubtitlesLayer, time: number): Cue | null {
  const rel = time - layer.start
  return layer.props.cues.find((c) => rel >= c.start && rel < c.end) ?? null
}

/** Avancement dans le sous-titre (0 → 1), pour le karaoké et les apparitions. */
export function cueProgress(cue: Cue, layer: SubtitlesLayer, time: number): number {
  const rel = time - layer.start
  return Math.min(1, Math.max(0, (rel - cue.start) / Math.max(0.001, cue.end - cue.start)))
}

/**
 * Nombre de mots « prononcés » : chaque mot dure en proportion de sa longueur
 * (un mot long prend plus de temps à dire).
 */
export function spokenWords(words: string[], progress: number): number {
  const total = words.reduce((n, w) => n + w.length + 1, 0)
  let acc = 0
  for (let i = 0; i < words.length; i++) {
    acc += words[i].length + 1
    if (acc / total > progress) return i
  }
  return words.length
}

/** Vitesse de lecture confortable pour des sous-titres (caractères par seconde). */
export const READING_CPS = 15

/**
 * Découpe un script en sous-titres : une phrase (ou une ligne) par sous-titre, coupée si
 * elle dépasse `maxChars` ; chaque sous-titre dure le temps de le lire.
 */
export function scriptToCues(script: string, start: number, maxChars = 84): Omit<Cue, 'id'>[] {
  const chunks: string[] = []
  for (const line of script.split(/\n+/)) {
    const sentences = line.match(/[^.!?…]+[.!?…]*["»”]?\s*/g) ?? []
    for (const raw of sentences) {
      const sentence = raw.trim()
      if (!sentence) continue
      if (sentence.length <= maxChars) {
        chunks.push(sentence)
        continue
      }
      // Phrase trop longue : on coupe entre deux mots, au plus près de `maxChars`.
      let current = ''
      for (const word of sentence.split(/\s+/)) {
        if (current && current.length + word.length + 1 > maxChars) {
          chunks.push(current)
          current = word
        } else current = current ? `${current} ${word}` : word
      }
      if (current) chunks.push(current)
    }
  }
  let t = start
  return chunks.map((text) => {
    const duration = Math.min(7, Math.max(1.2, text.length / READING_CPS))
    const cue = { start: t, end: t + duration, text }
    t += duration
    return cue
  })
}

// --- Format SRT -------------------------------------------------------------------

function srtTime(t: number): string {
  const ms = Math.max(0, Math.round(t * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`
}

/** Sous-titres → fichier .srt (temps absolus, accepté par YouTube et les logiciels de montage). */
export function toSrt(cues: Cue[], offset = 0): string {
  return cues
    .filter((c) => c.text.trim())
    .map((c, i) => `${i + 1}\n${srtTime(c.start + offset)} --> ${srtTime(c.end + offset)}\n${c.text.trim()}\n`)
    .join('\n')
}

/** Fichier .srt → sous-titres (temps en secondes). Les blocs illisibles sont ignorés. */
export function parseSrt(text: string): Omit<Cue, 'id'>[] {
  const time = (s: string) => {
    const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/)
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0').slice(0, 3)) / 1000 : NaN
  }
  const cues: Omit<Cue, 'id'>[] = []
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.trim().split('\n')
    const timing = lines.findIndex((l) => l.includes('-->'))
    if (timing === -1) continue
    const [a, b] = lines[timing].split('-->')
    const start = time(a)
    const end = time(b)
    const body = lines.slice(timing + 1).join('\n').replace(/<[^>]+>/g, '').trim()
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && body) cues.push({ start, end, text: body })
  }
  return cues
}
