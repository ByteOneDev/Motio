/** Commandes envoyées par le menu natif de l'application. */
export type MenuCommand = 'new' | 'open' | 'save' | 'saveAs' | 'export'

export interface OpenedFile {
  path: string
  data: string
}

export interface AutosaveData {
  data: string
  /** Fichier .motio d'origine du projet, s'il a déjà été enregistré. */
  path: string | null
  /** Vrai si la sauvegarde automatique contient des modifications absentes du fichier. */
  dirty: boolean
}

export interface CaptureSource {
  id: string
  name: string
  /** Miniature (URL data). */
  thumbnail: string
  kind: 'screen' | 'window'
}

export type ExportKind = 'mp4' | 'webm' | 'png' | 'srt' | 'folder'

/** API exposée par le preload sur `window.motio`. */
export interface MotioApi {
  platform: string
  /** Chemin sur le disque d'un fichier glissé ou choisi (vide s'il n'existe pas sur le disque). */
  pathForFile: (file: File) => string

  /** Ouvre un projet (boîte de dialogue). `null` si l'utilisateur annule. */
  openProject: () => Promise<OpenedFile | null>
  /** Enregistre ; sans `path`, demande où. Renvoie le chemin écrit, ou `null` si annulé. */
  saveProject: (data: string, path: string | null, suggestedName: string) => Promise<string | null>
  readAutosave: () => Promise<AutosaveData | null>
  /** Kit de marque (JSON), partagé par tous les projets. */
  readBrand: () => Promise<string | null>
  writeBrand: (data: string) => Promise<void>
  /** Projet ouvert depuis le Finder au lancement de l'application (double-clic sur un .motio). */
  takePendingFile: () => Promise<OpenedFile | null>
  /** Projet ouvert depuis le Finder alors que l'application tourne déjà. */
  onOpenFile: (listener: (file: OpenedFile) => void) => () => void
  writeAutosave: (save: AutosaveData) => Promise<void>

  /** Demande où exporter un fichier ; `folder` pour une séquence d'images. */
  chooseExportPath: (suggestedName: string, kind: ExportKind) => Promise<string | null>
  /** Écrit un fichier d'export. Seuls les emplacements choisis via `chooseExportPath` sont autorisés. */
  writeExport: (path: string, data: ArrayBuffer, fileInFolder?: string) => Promise<void>
  revealInFinder: (path: string) => void

  /** Point rouge de la fenêtre (modifications non enregistrées) et nom du fichier. */
  /** Écrans et fenêtres enregistrables ; `status` = autorisation macOS d'enregistrement de l'écran. */
  captureSources: () => Promise<{ status: string; sources: CaptureSource[] }>
  selectCaptureSource: (id: string) => Promise<void>
  requestMicAccess: () => Promise<boolean>
  openCaptureSettings: () => Promise<void>
  /** Active / désactive le raccourci global ⇧⌘2 qui arrête l'enregistrement. */
  setStopShortcut: (on: boolean) => Promise<void>
  onStopShortcut: (listener: () => void) => () => void
  minimizeWindow: () => void
  /** Enregistre la capture dans Vidéos/Motio et renvoie son chemin. */
  saveRecording: (data: ArrayBuffer, ext: 'webm' | 'mp4', kind: 'screen' | 'voice') => Promise<string>

  setDocumentState: (state: { dirty: boolean; path: string | null; title: string }) => void
  onMenu: (listener: (command: MenuCommand) => void) => () => void
}

/** URL servie par le processus principal pour lire un média local (vidéos). */
export const MEDIA_SCHEME = 'motio-media'

export function mediaUrl(path: string): string {
  return `${MEDIA_SCHEME}://file/?p=${encodeURIComponent(path)}`
}
