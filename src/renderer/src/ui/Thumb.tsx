import { useEffect, useRef } from 'react'
import { canvasMeasure } from '@/engine/measure'
import { renderFrame } from '@/engine/render'
import type { Project } from '@/model/schema'
import { ensureFonts, useFontsVersion } from './fonts'

/** Miniature exacte d'une composition, dessinée par le moteur de rendu. */
export function Thumb({ project, time, className = '' }: { project: Project; time: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const fonts = useFontsVersion()

  useEffect(() => {
    ensureFonts(project.layers)
    const canvas = ref.current!
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    const s = w / project.width
    ctx.setTransform(s, 0, 0, s, 0, 0)
    renderFrame(ctx, project, time, canvasMeasure, { pixelScale: s })
  }, [project, time, fonts])

  return <canvas ref={ref} className={`block aspect-video w-full ${className}`} />
}
