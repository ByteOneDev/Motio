import { describe, expect, it } from 'vitest'
import { createProject, createShape } from '@/model/factories'
import type { Project } from '@/model/schema'
import { aabbHalfExtents, hitTest, toLocal, toWorld } from './geometry'
import type { Measure } from './text'

const measure: Measure = (s) => s.length * 10

function scene(): Project {
  const project = createProject()
  project.layers = []
  const bottom = createShape(project, 'rect', { x: 500, y: 500 })
  bottom.id = 'bottom'
  const top = createShape(project, 'ellipse', { x: 500, y: 500 })
  top.id = 'top'
  project.layers.push(bottom, top)
  return project
}

describe('geometry', () => {
  it('toLocal et toWorld sont inverses', () => {
    const t = { x: 10, y: 20, width: 1, height: 1, rotation: 33, opacity: 1, scale: 1 }
    const p = toWorld(t, toLocal(t, { x: 123, y: -45 }))
    expect(p.x).toBeCloseTo(123)
    expect(p.y).toBeCloseTo(-45)
  })

  it('touche le calque le plus haut', () => {
    expect(hitTest(scene(), 0, { x: 500, y: 500 }, measure)).toBe('top')
  })

  it('ignore les calques verrouillés, masqués ou hors de leur intervalle', () => {
    const project = scene()
    project.layers[1].locked = true
    expect(hitTest(project, 0, { x: 500, y: 500 }, measure)).toBe('bottom')
    project.layers[0].visible = false
    expect(hitTest(project, 0, { x: 500, y: 500 }, measure)).toBeNull()
    project.layers[0].visible = true
    project.layers[0].start = 2
    expect(hitTest(project, 1, { x: 500, y: 500 }, measure)).toBeNull()
  })

  it('une ellipse ne capte pas les coins de sa boîte', () => {
    const project = scene()
    const r = project.layers[1].transform.width / 2
    expect(hitTest(project, 0, { x: 500 + r * 0.8, y: 500 + r * 0.75 }, measure)).toBe('bottom')
  })

  it('la boîte englobante d’un calque tourné de 90° est inversée', () => {
    const { ex, ey } = aabbHalfExtents({ w: 100, h: 40 }, 90)
    expect(ex).toBeCloseTo(20)
    expect(ey).toBeCloseTo(50)
  })
})
