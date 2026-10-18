import { describe, expect, it } from 'vitest'
import { createMedia, createProject } from '@/model/factories'
import type { Asset } from '@/model/schema'
import { zoomAt, zoomRect } from './zoom'

const asset: Asset = { id: 'a', kind: 'image', name: 'x.png', src: '', path: null, width: 1920, height: 1080, duration: 0, generated: null }

describe('zoom caméra', () => {
  const layer = createMedia(createProject(), asset)
  layer.start = 1
  layer.props.zooms = [{ id: 'z', at: 1, duration: 3, scale: 2, cx: 0.8, cy: 0.2, ramp: 0.5 }]

  it('monte, tient, puis redescend', () => {
    expect(zoomAt(layer, 1.5).scale).toBe(1)
    expect(zoomAt(layer, 2.25).scale).toBeCloseTo(1.5)
    expect(zoomAt(layer, 3).scale).toBe(2)
    expect(zoomAt(layer, 5.2).scale).toBe(1)
  })

  it('reste dans l’image même près du bord', () => {
    const r = zoomRect({ sx: 0, sy: 0, sw: 1920, sh: 1080 }, { scale: 2, cx: 1, cy: 0 }, asset)
    expect(r).toEqual({ sx: 960, sy: 0, sw: 960, sh: 540 })
  })
})
