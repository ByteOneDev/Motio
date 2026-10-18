import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_PRESETS,
  createBackground,
  createMedia,
  createProject,
  createShape,
  createText,
  SHAPE_PRESETS,
  TEXT_STYLES,
  uniqueName,
} from './factories'
import { changeFormat } from './operations'
import { ProjectSchema, type Asset } from './schema'
import { instantiateTemplate, TEMPLATES } from './templates'

const image: Asset = { id: 'img', kind: 'image', name: 'capture.png', src: 'data:', path: null, width: 2000, height: 1000, duration: 0, generated: null }

describe('modèle', () => {
  it('tous les éléments de la bibliothèque respectent le schéma', () => {
    const project = createProject()
    for (const preset of SHAPE_PRESETS) project.layers.push(createShape(project, preset.id))
    for (const style of TEXT_STYLES) project.layers.push(createText(project, style.id))
    for (const bg of BACKGROUND_PRESETS) project.layers.push(createBackground(project, bg.id))
    project.assets.push(image)
    project.layers.push(createMedia(project, image))
    expect(() => ProjectSchema.parse(project)).not.toThrow()
  })

  it('chaque modèle de scène produit des calques valides, dans la durée du projet', () => {
    for (const template of TEMPLATES) {
      const project = createProject()
      const { layers, assets } = instantiateTemplate(template, project, 9)
      expect(layers.length).toBeGreaterThan(0)
      project.layers.push(...layers)
      project.assets.push(...assets)
      expect(() => ProjectSchema.parse(project), template.id).not.toThrow()
      for (const l of layers) {
        expect(l.start).toBeGreaterThanOrEqual(0)
        expect(l.end).toBeLessThanOrEqual(project.duration)
        expect(l.start).toBeLessThan(l.end)
      }
    }
  })

  it('un modèle inséré deux fois garde des noms distincts', () => {
    const project = createProject()
    project.layers.push(...instantiateTemplate(TEMPLATES[0], project, 0).layers)
    const again = instantiateTemplate(TEMPLATES[0], project, 0).layers
    const names = new Set(project.layers.map((l) => l.name))
    expect(again.every((l) => !names.has(l.name))).toBe(true)
  })

  it('un modèle réutilise un son déjà présent dans le projet', () => {
    const project = createProject()
    const click = TEMPLATES.find((t) => t.id === 'mouse-click')!
    const first = instantiateTemplate(click, project, 0)
    expect(first.assets).toHaveLength(1)
    project.assets.push(...first.assets)
    expect(instantiateTemplate(click, project, 0).assets).toHaveLength(0)
  })

  it('les images clés d’un modèle suivent son instant d’insertion', () => {
    const project = createProject()
    const click = TEMPLATES.find((t) => t.id === 'mouse-click')!
    const { layers } = instantiateTemplate(click, project, 2)
    const cursor = layers.find((l) => l.name.includes('Curseur'))!
    expect(cursor.keyframes.x![0].time).toBe(2)
  })

  it('un média tient dans le cadre en gardant ses proportions', () => {
    const project = createProject()
    const layer = createMedia(project, image)
    expect(layer.transform.width / layer.transform.height).toBeCloseTo(2)
    expect(layer.transform.width).toBeLessThanOrEqual(project.width * 0.7)
  })

  it('changer de format garde le fond plein cadre', () => {
    const project = createProject()
    changeFormat(project, 1080, 1920)
    const bg = project.layers.find((l) => l.type === 'background')!
    expect(bg.transform).toMatchObject({ x: 540, y: 960, width: 1080, height: 1920 })
  })

  it('uniqueName numérote sans empiler les numéros', () => {
    const project = createProject()
    const a = createShape(project, 'rect')
    project.layers.push(a)
    expect(uniqueName('Rectangle', project.layers)).toBe('Rectangle 2')
    project.layers.push({ ...a, id: 'b', name: 'Rectangle 2' })
    expect(uniqueName('Rectangle 2', project.layers)).toBe('Rectangle 3')
  })
})
