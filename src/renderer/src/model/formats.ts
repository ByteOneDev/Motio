export interface Format {
  id: string
  label: string
  width: number
  height: number
}

export const FORMATS: Format[] = [
  { id: '1080p', label: '16:9 · 1920 × 1080', width: 1920, height: 1080 },
  { id: '4k', label: '16:9 · 3840 × 2160 (4K)', width: 3840, height: 2160 },
  { id: '720p', label: '16:9 · 1280 × 720', width: 1280, height: 720 },
  { id: 'vertical', label: '9:16 · 1080 × 1920', width: 1080, height: 1920 },
  { id: 'square', label: '1:1 · 1080 × 1080', width: 1080, height: 1080 },
]

export function findFormat(width: number, height: number): Format | undefined {
  return FORMATS.find((f) => f.width === width && f.height === height)
}
