import { describe, expect, it } from 'vitest'
import { createProject } from '@/model/factories'
import { parseProject, ProjectFileError, serializeProject } from './projectFile'

describe('fichier .motio', () => {
  it('un projet enregistré puis rouvert est identique', () => {
    const project = createProject()
    const { project: back, missing } = parseProject(serializeProject(project))
    expect(back).toEqual(project)
    expect(missing).toEqual([])
  })

  it('les vidéos sont référencées par leur chemin et rechargées depuis le disque', () => {
    const project = createProject()
    project.assets.push({ id: 'v', kind: 'video', name: 'demo.mp4', src: 'blob:xyz', path: '/tmp/demo.mp4', width: 1920, height: 1080, duration: 3, generated: null })
    const text = serializeProject(project)
    expect(text).not.toContain('blob:xyz')
    const { project: back } = parseProject(text, (p) => `media:${p}`)
    expect(back.assets[0].src).toBe('media:/tmp/demo.mp4')
  })

  it('signale une vidéo sans chemin', () => {
    const project = createProject()
    project.assets.push({ id: 'v', kind: 'video', name: 'web.mp4', src: 'blob:xyz', path: null, width: 1, height: 1, duration: 1, generated: null })
    expect(parseProject(serializeProject(project)).missing).toHaveLength(1)
  })

  it('les anciens fichiers sans champs récents restent lisibles', () => {
    const project = createProject()
    const old = JSON.parse(serializeProject(project))
    delete old.palette
    delete old.assets
    for (const layer of old.layers) {
      delete layer.keyframes
      delete layer.animIn
      delete layer.transform.scale
    }
    const { project: back } = parseProject(JSON.stringify(old))
    expect(back.palette).toEqual([])
    expect(back.layers[1].transform.scale).toBe(1)
  })

  it('refuse un fichier qui n’est pas un projet', () => {
    expect(() => parseProject('{"hello": 1}')).toThrow(ProjectFileError)
    expect(() => parseProject('pas du json')).toThrow(ProjectFileError)
  })
})
