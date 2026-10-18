import { useEffect } from 'react'
import { lastFrame, useEditor } from '@/store/editor'

/** Fait avancer le temps pendant la lecture, image par image, en suivant l'horloge réelle. */
export function usePlayback(): void {
  const playing = useEditor((s) => s.playing)

  useEffect(() => {
    if (!playing) return
    let originTime = useEditor.getState().time
    let originClock = performance.now()
    let lastSet = originTime
    let raf = 0

    const tick = (now: number) => {
      const s = useEditor.getState()
      if (!s.playing) return
      // Si l'utilisateur a déplacé la tête de lecture, on repart de là.
      if (s.time !== lastSet) {
        originTime = s.time
        originClock = now
      }
      let t = originTime + (now - originClock) / 1000
      const end = s.playUntil ?? lastFrame(s.project)
      if (t > end) {
        if (s.loop && s.playUntil === null) {
          originTime = 0
          originClock = now
          t = 0
        } else {
          s.setTime(end)
          s.pause()
          return
        }
      }
      s.setTime(t)
      lastSet = useEditor.getState().time
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])
}
