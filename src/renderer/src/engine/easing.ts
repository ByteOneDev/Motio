import type { Easing } from '@/model/schema'

const c1 = 1.70158
const c3 = c1 + 1

function bounceOut(t: number): number {
  const n = 7.5625
  const d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}

/** Courbes d'accélération : t ∈ [0, 1] → progression (peut dépasser 1 pour « back » et « elastic »). */
export const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  ease: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  easeOut: (t) => 1 - (1 - t) ** 3,
  easeIn: (t) => t * t * t,
  back: (t) => 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2,
  elastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  bounce: bounceOut,
}

export const EASING_LABELS: Record<Easing, string> = {
  ease: 'Douce',
  easeOut: 'Décélération',
  easeIn: 'Accélération',
  linear: 'Linéaire',
  back: 'Dépassement',
  elastic: 'Élastique',
  bounce: 'Rebond',
}

export function ease(easing: Easing, t: number): number {
  return EASINGS[easing](Math.min(1, Math.max(0, t)))
}
