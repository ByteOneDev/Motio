import { ProjectSchema, type Asset, type Project } from '@/model/schema'

/** Marqueur du format de fichier, pour reconnaître un .motio. */
export const FILE_FORMAT = 'motio'

/**
 * Projet → contenu d'un fichier .motio (JSON lisible).
 * Les images y sont intégrées ; vidéos et sons ne gardent que leur chemin sur le disque
 * (ou, pour les sons générés par Motio, leur identifiant).
 */
export function serializeProject(project: Project): string {
  const assets = project.assets.map((a) => (a.kind === 'image' ? a : { ...a, src: '' }))
  return JSON.stringify({ format: FILE_FORMAT, ...project, assets }, null, 2)
}

export interface ParsedProject {
  project: Project
  /** Vidéos et sons dont le fichier n'est plus accessible (pas de chemin connu). */
  missing: Asset[]
}

export class ProjectFileError extends Error {}

/**
 * Contenu d'un fichier .motio → projet validé. Les champs ajoutés dans les versions récentes
 * prennent leur valeur par défaut, donc les anciens fichiers restent lisibles.
 */
export function parseProject(text: string, mediaUrl?: (path: string) => string): ParsedProject {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ProjectFileError('Ce fichier n’est pas un projet Motio lisible.')
  }
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== FILE_FORMAT) {
    throw new ProjectFileError('Ce fichier n’est pas un projet Motio.')
  }
  const { format: _format, ...data } = raw as Record<string, unknown>
  const result = ProjectSchema.safeParse(data)
  if (!result.success) {
    throw new ProjectFileError(`Projet invalide : ${result.error.issues[0]?.message ?? 'contenu inattendu'}.`)
  }
  const project = result.data
  const missing: Asset[] = []
  for (const asset of project.assets) {
    // Les images sont dans le fichier, les sons générés sont recalculés : rien à retrouver.
    if (asset.kind === 'image' || asset.generated) continue
    if (asset.path && mediaUrl) asset.src = mediaUrl(asset.path)
    else missing.push(asset)
  }
  return { project, missing }
}
