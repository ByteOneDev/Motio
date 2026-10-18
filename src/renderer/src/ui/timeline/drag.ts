import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEditor } from '@/store/editor'

/**
 * Démarre un glisser horizontal sur l'élément pressé. Au-delà de 3 px, le geste devient une
 * seule entrée d'historique ; un simple clic appelle `onClick`.
 */
export function startDrag(
  e: ReactPointerEvent,
  label: string,
  onMove: (dx: number, ev: PointerEvent) => void,
  onClick?: () => void,
): void {
  if (e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const x0 = e.clientX
  let moved = false

  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - x0
    if (!moved) {
      if (Math.abs(dx) < 3) return
      moved = true
      useEditor.getState().beginGesture(label)
    }
    onMove(dx, ev)
  }
  const up = (ev: PointerEvent) => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    if (moved) {
      onMove(ev.clientX - x0, ev)
      useEditor.getState().endGesture()
    } else {
      onClick?.()
    }
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

/** Aimante `t` sur la cible la plus proche à moins de `threshold` secondes. */
export function snapTime(t: number, targets: number[], threshold: number): number {
  let best = t
  let bestDistance = threshold
  for (const target of targets) {
    const d = Math.abs(target - t)
    if (d < bestDistance) {
      best = target
      bestDistance = d
    }
  }
  return best
}
