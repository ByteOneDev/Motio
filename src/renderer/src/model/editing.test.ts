import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { createAudioLayer, createInOut, createProject, createShape, generatedAsset } from './factories'
import { crossfade, overlayTransition, OVERLAY_TRANSITIONS, snapToBeats, splitLayers, trimToTime } from './editing'
import { beatTimes } from '@/engine/beats'
import { ProjectSchema } from './schema'

function project() {
  const p = createProject()
  p.layers = []
  return p
}

describe('couper', () => {
  it('coupe un calque en deux à la tête de lecture', () => {
    const p = project()
    const a = createShape(p, 'rect')
    a.animIn = createInOut('fade', a, p, true)
    a.animOut = createInOut('fade', a, p, false)
    p.layers.push(a)
    const [rightId] = splitLayers(p, [a.id], 4)
    const right = p.layers.find((l) => l.id === rightId)!
    expect([a.start, a.end]).toEqual([0, 4])
    expect([right.start, right.end]).toEqual([4, 10])
    expect(a.animOut).toBeNull()
    expect(right.animIn).toBeNull()
    expect(right.animOut).not.toBeNull()
    expect(p.layers.indexOf(right)).toBe(p.layers.indexOf(a) + 1)
  })

  it('fonctionne aussi dans une modification Immer (comme dans le store)', () => {
    const p = project()
    const a = createShape(p, 'rect')
    p.layers.push(a)
    const next = produce(p, (draft) => void splitLayers(draft, [a.id], 4))
    expect(next.layers).toHaveLength(2)
    expect(p.layers).toHaveLength(1)
  })

  it('la seconde partie d’un son reprend là où la coupe a eu lieu', () => {
    const p = project()
    const asset = generatedAsset('sfx:whoosh', 'Whoosh', 8)
    p.assets.push(asset)
    const sound = createAudioLayer(p, asset, 1)
    p.layers.push(sound)
    const [rightId] = splitLayers(p, [sound.id], 3)
    const right = p.layers.find((l) => l.id === rightId)!
    expect(right.type === 'audio' && right.props.sourceStart).toBe(2)
  })

  it('ne coupe ni un calque verrouillé ni hors de son intervalle', () => {
    const p = project()
    const a = createShape(p, 'rect')
    a.locked = true
    p.layers.push(a)
    expect(splitLayers(p, [a.id], 5)).toEqual([])
    a.locked = false
    expect(splitLayers(p, [a.id], 12)).toEqual([])
  })
})

describe('transitions', () => {
  it('chaque transition produit des calques valides centrés sur l’instant demandé', () => {
    for (const t of OVERLAY_TRANSITIONS) {
      const p = project()
      const layers = overlayTransition(p, t.id, 5, '#7c5cff')
      p.layers.push(...layers)
      expect(() => ProjectSchema.parse(p), t.id).not.toThrow()
      const mid = (Math.min(...layers.map((l) => l.start)) + Math.max(...layers.map((l) => l.end))) / 2
      expect(mid).toBeCloseTo(5, 1)
    }
  })

  it('un fondu enchaîné fait se chevaucher deux calques consécutifs', () => {
    const p = project()
    const a = createShape(p, 'rect')
    const b = createShape(p, 'ellipse')
    a.end = 5
    b.start = 5
    p.layers.push(a, b)
    expect(crossfade(p, [a.id, b.id], 0.6)).toBe(true)
    expect(a.end - b.start).toBeCloseTo(0.6)
    expect(a.animOut?.preset).toBe('fade')
    expect(b.animIn?.preset).toBe('fade')
  })
})

describe('recadrage', () => {
  it('« Début ici » garde le contenu d’un média à sa place', () => {
    const p = project()
    const asset = generatedAsset('music:lofi', 'Lo-fi', 24)
    const sound = createAudioLayer(p, asset, 0, { loop: true })
    p.layers.push(sound)
    trimToTime(p, [sound.id], 2.5, 'start')
    expect(sound.start).toBe(2.5)
    expect(sound.type === 'audio' && sound.props.sourceStart).toBe(2.5)
    trimToTime(p, [sound.id], 6, 'end')
    expect(sound.end).toBe(6)
  })
})

describe('rythme', () => {
  it('les temps d’une musique à 120 BPM tombent toutes les demi-secondes', () => {
    const p = project()
    const asset = generatedAsset('music:electro', 'Électro', 8)
    const music = createAudioLayer(p, asset, 1, { loop: true, bpm: 120 })
    p.layers.push(music)
    const beats = beatTimes(p)
    expect(beats.slice(0, 3)).toEqual([1, 1.5, 2])
    expect(beats.at(-1)).toBeCloseTo(9.5)
  })

  it('cale les calques sélectionnés sur des temps successifs', () => {
    const p = project()
    const asset = generatedAsset('music:electro', 'Électro', 8)
    p.layers.push(createAudioLayer(p, asset, 0, { loop: true, bpm: 120 }))
    const [a, b, c] = ['rect', 'ellipse', 'star'].map((k) => createShape(p, k))
    a.start = 0.2
    b.start = 0.3
    c.start = 0.9
    for (const l of [a, b, c]) l.end = l.start + 1
    p.layers.push(a, b, c)
    expect(snapToBeats(p, [a.id, b.id, c.id], beatTimes(p))).toBe(3)
    expect([a.start, b.start, c.start]).toEqual([0.5, 1, 1.5])
    expect(a.end).toBeCloseTo(1.5)
  })
})
