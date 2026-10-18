import { describe, expect, it } from 'vitest'
import { createProject, createText } from '@/model/factories'
import { resizeBox, resizeLayer, rotationFromDrag, snapPosition } from './transform'

const box = { x: 100, y: 100, w: 100, h: 50, rotation: 0 }

describe('resizeBox', () => {
  it('garde le coin opposé fixe', () => {
    const r = resizeBox(box, 'se', { x: 200, y: 150 })
    expect(r).toEqual({ x: 125, y: 112.5, w: 150, h: 75 })
  })

  it('depuis le centre avec Alt', () => {
    const r = resizeBox(box, 'se', { x: 200, y: 150 }, { fromCenter: true })
    expect(r).toEqual({ x: 100, y: 100, w: 200, h: 100 })
  })

  it('conserve les proportions avec Maj', () => {
    const r = resizeBox(box, 'se', { x: 250, y: 130 }, { keepRatio: true })
    expect(r.w / r.h).toBeCloseTo(2)
    expect(r.w).toBeCloseTo(200)
  })

  it('respecte la rotation du calque', () => {
    const r = resizeBox({ x: 0, y: 0, w: 100, h: 50, rotation: 90 }, 'e', { x: 0, y: 100 })
    expect(r.w).toBeCloseTo(150)
    expect(r.x).toBeCloseTo(0)
    expect(r.y).toBeCloseTo(25)
  })

  it('ne descend pas sous la taille minimale', () => {
    expect(resizeBox(box, 'e', { x: -500, y: 100 }, { minSize: 5 }).w).toBe(5)
  })
})

describe('resizeLayer', () => {
  it('un coin met le texte à l’échelle', () => {
    const start = createText(createProject(), 'title', { x: 0, y: 0 })
    const draft = structuredClone(start)
    resizeLayer(draft, start, { w: 200, h: 100 }, 'se', { x: 300, y: 150 }, { shift: false, alt: false })
    expect(draft.props.fontSize).toBeCloseTo(start.props.fontSize * 2, 0)
    expect(draft.props.autoWidth).toBe(true)
  })

  it('un côté fixe la largeur du texte', () => {
    const start = createText(createProject(), 'body', { x: 0, y: 0 })
    const draft = structuredClone(start)
    resizeLayer(draft, start, { w: 200, h: 100 }, 'e', { x: 400, y: 0 }, { shift: false, alt: false })
    expect(draft.props.autoWidth).toBe(false)
    expect(draft.transform.width).toBeCloseTo(500)
  })
})

describe('rotationFromDrag', () => {
  it('ajoute l’angle parcouru et s’aimante à 15° avec Maj', () => {
    const c = { x: 0, y: 0 }
    expect(rotationFromDrag(10, c, { x: 1, y: 0 }, { x: 0, y: 1 }, false)).toBeCloseTo(100)
    expect(rotationFromDrag(10, c, { x: 1, y: 0 }, { x: 0, y: 1 }, true)).toBe(105)
  })
})

describe('snapPosition', () => {
  const comp = { width: 1000, height: 500 }
  it('aimante le centre au centre de la composition', () => {
    const r = snapPosition({ x: 503, y: 100 }, { ex: 50, ey: 50 }, comp, { xs: [], ys: [] }, 5)
    expect(r.x).toBe(500)
    expect(r.guides).toEqual([{ axis: 'x', value: 500 }])
  })

  it('aimante les bords aux bords de la composition', () => {
    const r = snapPosition({ x: 52, y: 448 }, { ex: 50, ey: 50 }, comp, { xs: [], ys: [] }, 5)
    expect(r.x).toBe(50)
    expect(r.y).toBe(450)
  })

  it('ne bouge pas au-delà du seuil', () => {
    const r = snapPosition({ x: 300, y: 100 }, { ex: 50, ey: 50 }, comp, { xs: [], ys: [] }, 5)
    expect(r).toEqual({ x: 300, y: 100, guides: [] })
  })
})
