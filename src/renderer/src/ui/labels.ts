import type { AnimProp, EmphasisPreset, InOutPreset } from '@/model/schema'

export const IN_OUT_LABELS: Record<InOutPreset, string> = {
  fade: 'Fondu',
  slide: 'Glissement',
  pop: 'Pop',
  zoom: 'Zoom',
  blur: 'Flou',
  wipe: 'Volet',
  typewriter: 'Machine à écrire',
  draw: 'Tracé',
}

export const EMPHASIS_LABELS: Record<EmphasisPreset, string> = {
  pulse: 'Pulsation',
  shake: 'Secousse',
  wobble: 'Balancement',
  bounce: 'Rebond',
  flash: 'Clignotement',
}

export const PROP_LABELS: Record<AnimProp, string> = {
  x: 'Position X',
  y: 'Position Y',
  scale: 'Échelle',
  rotation: 'Rotation',
  opacity: 'Opacité',
  color: 'Couleur',
}

/** 0:02.50 — minutes, secondes, centièmes. */
export function formatTime(t: number): string {
  const total = Math.max(0, t)
  const m = Math.floor(total / 60)
  const sec = total - m * 60
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`
}
