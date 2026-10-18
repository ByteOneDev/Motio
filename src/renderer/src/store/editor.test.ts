import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createShape } from '@/model/factories'
import { useEditor } from './editor'

const s = () => useEditor.getState()

beforeEach(() => {
  const project = createProject()
  project.layers = [createShape(project, 'rect')]
  s().loadProject(project)
})

const firstX = () => s().project.layers[0].transform.x

describe('historique', () => {
  it('annule et rétablit', () => {
    const x = firstX()
    const id = s().project.layers[0].id
    s().updateLayer(id, 'Déplacer', (l) => void (l.transform.x = 42))
    expect(firstX()).toBe(42)
    s().undo()
    expect(firstX()).toBe(x)
    s().redo()
    expect(firstX()).toBe(42)
  })

  it('un geste ne crée qu’une entrée', () => {
    const id = s().project.layers[0].id
    s().beginGesture('Déplacer')
    for (let i = 1; i <= 10; i++) s().updateLayer(id, 'Déplacer', (l) => void (l.transform.x = i))
    s().endGesture()
    expect(s().past).toHaveLength(1)
    s().undo()
    expect(s().past).toHaveLength(0)
  })

  it('fusionne les modifications ayant la même clé', () => {
    const id = s().project.layers[0].id
    s().updateLayer(id, 'X', (l) => void (l.transform.x = 1), { coalesce: 'x' })
    s().updateLayer(id, 'X', (l) => void (l.transform.x = 2), { coalesce: 'x' })
    s().updateLayer(id, 'Y', (l) => void (l.transform.y = 3), { coalesce: 'y' })
    expect(s().past).toHaveLength(2)
  })

  it('une nouvelle modification efface le futur', () => {
    const id = s().project.layers[0].id
    s().updateLayer(id, 'X', (l) => void (l.transform.x = 1))
    s().undo()
    expect(s().future).toHaveLength(1)
    s().updateLayer(id, 'X', (l) => void (l.transform.x = 2))
    expect(s().future).toHaveLength(0)
  })
})

describe('calques', () => {
  it('duplique au-dessus de l’original et sélectionne la copie', () => {
    const id = s().project.layers[0].id
    s().duplicateLayers([id])
    const layers = s().project.layers
    expect(layers).toHaveLength(2)
    expect(layers[1].name).toBe('Rectangle 2')
    expect(s().selection).toEqual([layers[1].id])
    s().undo()
    expect(s().project.layers).toHaveLength(1)
    expect(s().selection).toEqual([])
  })

  it('annuler une suppression resélectionne le calque', () => {
    const id = s().project.layers[0].id
    s().select([id])
    s().removeLayers([id])
    expect(s().selection).toEqual([])
    s().undo()
    expect(s().selection).toEqual([id])
    s().redo()
    expect(s().selection).toEqual([])
  })

  it('supprime et réordonne', () => {
    s().addLayer(createShape(s().project, 'ellipse'))
    const [a, b] = s().project.layers.map((l) => l.id)
    s().reorderLayer(b, 0)
    expect(s().project.layers.map((l) => l.id)).toEqual([b, a])
    s().removeLayers([b])
    expect(s().project.layers.map((l) => l.id)).toEqual([a])
  })
})

describe('animation', () => {
  it('modifier une propriété animée à un autre instant crée une image clé', () => {
    const id = s().project.layers[0].id
    s().updateLayer(id, 'Animer', (l) => {
      l.keyframes.x = [{ time: 0, value: l.transform.x, easing: 'ease' }]
    })
    s().setTime(2)
    s().updateLayer(id, 'Déplacer', (l) => void (l.transform.x = 500))
    expect(s().project.layers[0].keyframes.x!.map((k) => k.time)).toEqual([0, 2])
  })

  it('le temps est calé sur les images et borné', () => {
    s().setTime(1.01)
    expect(s().time).toBeCloseTo(1, 5)
    s().setTime(999)
    expect(s().time).toBeCloseTo(s().project.duration - 1 / s().project.fps, 5)
  })
})
