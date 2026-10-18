import type { Project } from '@/model/schema'

/**
 * Temps forts des musiques dont le tempo est connu (calques audio visibles), en temps du projet.
 * La source est supposée commencer sur un temps ; une boucle de musique garde le même rythme.
 */
export function beatTimes(project: Pick<Project, 'layers'>): number[] {
  const times: number[] = []
  for (const layer of project.layers) {
    if (layer.type !== 'audio' || !layer.visible || !layer.props.bpm) continue
    const period = 60 / layer.props.bpm
    // Premier temps après le début du calque, compte tenu du décalage dans la source.
    const phase = (period - (layer.props.sourceStart % period)) % period
    for (let t = layer.start + phase; t < layer.end - 1e-6; t += period) times.push(t)
  }
  times.sort((a, b) => a - b)
  return times.filter((t, i) => i === 0 || t - times[i - 1] > 0.02)
}

/** Premier temps à partir de `t` (ou `null`). */
export function nextBeat(beats: number[], t: number): number | null {
  return beats.find((b) => b >= t - 1e-6) ?? null
}
