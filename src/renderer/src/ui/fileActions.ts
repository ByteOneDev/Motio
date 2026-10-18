import { useEffect } from 'react'
import { createEmptyProject } from '@/model/factories'
import { parseProject, ProjectFileError, serializeProject } from '@/file/projectFile'
import { useEditor, useIsDirty } from '@/store/editor'
import { useView } from '@/store/view'
import { mediaUrl, type AutosaveData } from '../../../shared/api'
import { notify } from './toast'

/** Dans un simple navigateur (npm run dev:web), il n'y a pas d'accès aux fichiers du disque. */
const api = () => window.motio

function isDirty(): boolean {
  const s = useEditor.getState()
  return s.project !== s.savedProject
}

function confirmDiscard(): boolean {
  if (!isDirty()) return true
  return window.confirm(`Les modifications de « ${useEditor.getState().project.name} » qui ne sont pas enregistrées seront perdues. Continuer ?`)
}

function loadFromText(text: string, path: string | null): void {
  const { project, missing } = parseProject(text, mediaUrl)
  useEditor.getState().loadProject(project, path)
  if (missing.length) {
    notify(`${missing.length} média${missing.length > 1 ? 's' : ''} introuvable${missing.length > 1 ? 's' : ''} (vidéo ou son) : réimportez-les depuis l’onglet Médias.`, 'error')
  }
}

export function newProject(): void {
  if (!confirmDiscard()) return
  useEditor.getState().loadProject(createEmptyProject(), null)
}

export async function openProject(): Promise<void> {
  if (!confirmDiscard()) return
  try {
    const motio = api()
    if (motio) {
      const file = await motio.openProject()
      if (file) loadFromText(file.data, file.path)
      return
    }
    const file = await pickFile('.motio')
    if (file) loadFromText(await file.text(), null)
  } catch (e) {
    notify(e instanceof ProjectFileError ? e.message : `Impossible d’ouvrir le projet : ${String(e)}`, 'error')
  }
}

export async function saveProject(saveAs = false): Promise<void> {
  const s = useEditor.getState()
  const data = serializeProject(s.project)
  try {
    const motio = api()
    if (motio) {
      const path = await motio.saveProject(data, saveAs ? null : s.filePath, s.project.name)
      if (!path) return
      useEditor.getState().markSaved(path)
      notify('Projet enregistré')
      return
    }
    download(new Blob([data], { type: 'application/json' }), `${s.project.name}.motio`)
    useEditor.getState().markSaved(null)
  } catch (e) {
    notify(`Échec de l’enregistrement : ${String(e)}`, 'error')
  }
}

export function openExport(): void {
  useEditor.getState().pause()
  useView.getState().setExportOpen(true)
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

// --- Sauvegarde automatique ------------------------------------------------------

const LOCAL_KEY = 'motio:autosave'
const AUTOSAVE_DELAY = 1500

async function readAutosave(): Promise<AutosaveData | null> {
  const motio = api()
  if (motio) return motio.readAutosave()
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as AutosaveData) : null
  } catch {
    return null
  }
}

async function writeAutosave(save: AutosaveData): Promise<void> {
  const motio = api()
  if (motio) return motio.writeAutosave(save)
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(save))
  } catch {
    // Quota dépassé (grosses images) : la sauvegarde automatique est ignorée dans le navigateur.
  }
}

/** Un projet ouvert depuis le Finder passe avant la session précédente. */
async function restoreSession(): Promise<AutosaveData | null> {
  const pending = await api()?.takePendingFile()
  if (pending) return { data: pending.data, path: pending.path, dirty: false }
  return readAutosave()
}

/**
 * Restaure la dernière session au lancement, puis enregistre le projet en continu
 * (1,5 s après la dernière modification) pour ne jamais perdre de travail.
 */
export function useAutosave(): void {
  useEffect(() => {
    let ready = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false

    restoreSession()
      .then((saved) => {
        if (disposed || !saved) return
        const { project, missing } = parseProject(saved.data, mediaUrl)
        useEditor.getState().loadProject(project, saved.path, !saved.dirty)
        if (missing.length) notify('Des vidéos ou des sons de la session précédente sont à réimporter.', 'error')
      })
      .catch(() => {})
      .finally(() => {
        ready = true
      })

    const write = () => {
      const s = useEditor.getState()
      writeAutosave({ data: serializeProject(s.project), path: s.filePath, dirty: s.project !== s.savedProject }).catch(() => {})
    }
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (!ready || (s.project === prev.project && s.savedProject === prev.savedProject && s.filePath === prev.filePath)) return
      clearTimeout(timer)
      timer = setTimeout(write, AUTOSAVE_DELAY)
    })
    const flush = () => {
      if (timer) write()
    }
    window.addEventListener('beforeunload', flush)
    return () => {
      disposed = true
      clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('beforeunload', flush)
    }
  }, [])
}

/** Titre de la fenêtre, point « modifié » de macOS et commandes du menu natif. */
export function useDocument(): void {
  const name = useEditor((s) => s.project.name)
  const filePath = useEditor((s) => s.filePath)
  const dirty = useIsDirty()

  useEffect(() => {
    const title = `${name}${dirty ? ' — modifié' : ''}`
    document.title = `${title} · Motio`
    api()?.setDocumentState({ dirty, path: filePath, title })
  }, [name, filePath, dirty])

  useEffect(
    () =>
      api()?.onOpenFile((file) => {
        if (!confirmDiscard()) return
        try {
          loadFromText(file.data, file.path)
        } catch (e) {
          notify(e instanceof ProjectFileError ? e.message : `Impossible d’ouvrir le projet : ${String(e)}`, 'error')
        }
      }),
    [],
  )

  useEffect(
    () =>
      api()?.onMenu((command) => {
        if (useView.getState().exportOpen) return
        if (command === 'new') newProject()
        else if (command === 'open') openProject()
        else if (command === 'save') saveProject()
        else if (command === 'saveAs') saveProject(true)
        else if (command === 'export') openExport()
      }),
    [],
  )
}
