import { describe, expect, it } from 'vitest'
import { enablePatches, produceWithPatches } from 'immer'
import { createInOut, createProject, createShape, createText } from '@/model/factories'
import type { Layer } from '@/model/schema'
import {
  animWindows,
  editResolved,
  evalKeyframes,
  keyState,
  keyTimes,
  lerpColor,
  moveKeyGroup,
  presetModifiers,
  resolveLayer,
  toggleKeyframe,
} from './animate'

enablePatches()
const project = createProject()
const comp = { width: 1920, height: 1080 }

function rect(): Layer {
  const layer = createShape(project, 'rect', { x: 100, y: 100 })
  layer.start = 0
  layer.end = 10
  return layer
}

describe('images clés', () => {
  it('interpole entre deux images clés avec la courbe de la première', () => {
    const kfs = [
      { time: 0, value: 0, easing: 'linear' as const },
      { time: 2, value: 100, easing: 'linear' as const },
    ]
    expect(evalKeyframes(kfs, -1)).toBe(0)
    expect(evalKeyframes(kfs, 1)).toBe(50)
    expect(evalKeyframes(kfs, 5)).toBe(100)
  })

  it('interpole les couleurs', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('toggleKeyframe crée, ajoute puis retire', () => {
    const layer = rect()
    toggleKeyframe(layer, 'x', 0)
    expect(keyState(layer, 'x', 0)).toBe('key')
    expect(keyState(layer, 'x', 1)).toBe('animated')
    toggleKeyframe(layer, 'x', 1)
    expect(layer.keyframes.x).toHaveLength(2)
    toggleKeyframe(layer, 'x', 1)
    toggleKeyframe(layer, 'x', 0)
    expect(layer.keyframes.x).toBeUndefined()
    expect(layer.transform.x).toBe(100)
  })

  it('editResolved crée une image clé quand une propriété animée change', () => {
    const layer = rect()
    toggleKeyframe(layer, 'x', 0)
    editResolved(layer, 2, (l) => void (l.transform.x = 300))
    expect(layer.keyframes.x!.map((k) => [k.time, k.value])).toEqual([
      [0, 100],
      [2, 300],
    ])
    expect(layer.transform.x).toBe(100)
    expect(resolveLayer(layer, 2).transform.x).toBe(300)
  })

  it('editResolved ne touche pas aux propriétés non animées', () => {
    const layer = rect()
    editResolved(layer, 2, (l) => void (l.transform.y = 42))
    expect(layer.transform.y).toBe(42)
    expect(layer.keyframes).toEqual({})
  })

  it('editResolved ne produit aucun patch parasite', () => {
    const layer = rect()
    toggleKeyframe(layer, 'x', 0)
    toggleKeyframe(layer, 'x', 2)
    const [, patches] = produceWithPatches(layer, (draft) => editResolved(draft, 1, (l) => void (l.end = 8)))
    expect(patches).toEqual([{ op: 'replace', path: ['end'], value: 8 }])
  })

  it('déplace un groupe d’images clés', () => {
    const layer = rect()
    toggleKeyframe(layer, 'x', 0)
    toggleKeyframe(layer, 'opacity', 1)
    toggleKeyframe(layer, 'x', 1)
    expect(keyTimes(layer)).toEqual([0, 1])
    moveKeyGroup(layer, 1, 3)
    expect(keyTimes(layer)).toEqual([0, 3])
  })
})

describe('animations prédéfinies', () => {
  it('un fondu d’entrée part de 0 et finit à 1', () => {
    const layer = rect()
    layer.animIn = { ...createInOut('fade', layer, project, true), easing: 'linear', duration: 1 }
    expect(presetModifiers(layer, 0, comp).opacity).toBe(0)
    expect(presetModifiers(layer, 0.5, comp).opacity).toBe(0.5)
    expect(presetModifiers(layer, 2, comp).opacity).toBe(1)
  })

  it('un glissement d’entrée vers le haut part d’en dessous', () => {
    const layer = rect()
    layer.animIn = { ...createInOut('slide', layer, project, true), direction: 'up', distance: 100, easing: 'linear' }
    expect(presetModifiers(layer, 0, comp).dy).toBe(100)
  })

  it('une sortie glissante vers le bas finit en dessous', () => {
    const layer = rect()
    layer.animOut = { ...createInOut('slide', layer, project, false), direction: 'down', distance: 100, easing: 'linear', duration: 1 }
    expect(presetModifiers(layer, 9.999, comp).dy).toBeCloseTo(100, 0)
    expect(presetModifiers(layer, 8, comp).dy).toBe(0)
  })

  it('réduit l’entrée et la sortie si le calque est trop court', () => {
    const layer = rect()
    layer.end = 1
    layer.animIn = { ...createInOut('fade', layer, project, true), duration: 1 }
    layer.animOut = { ...createInOut('fade', layer, project, false), duration: 1 }
    expect(animWindows(layer)).toEqual({ inEnd: 0.5, outStart: 0.5 })
  })

  it('la machine à écrire révèle le texte progressivement', () => {
    const layer = createText(project, 'body')
    layer.animIn = { ...createInOut('typewriter', layer, project, true), duration: 2 }
    expect(presetModifiers(layer, 1, comp).reveal).toBeCloseTo(0.5)
  })

  it('la mise en avant répétée s’arrête au début de la sortie', () => {
    const layer = rect()
    layer.animOut = { ...createInOut('fade', layer, project, false), duration: 1 }
    layer.emphasis = { preset: 'pulse', at: 0, duration: 1, repeat: true, intensity: 1 }
    expect(presetModifiers(layer, 5.5, comp).scale).toBeGreaterThan(1)
    expect(presetModifiers(layer, 9.5, comp).scale).toBe(1)
  })
})
