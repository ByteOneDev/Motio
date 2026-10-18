import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { AutosaveData, ExportKind, OpenedFile } from '../shared/api'

const PROJECT_FILTER = { name: 'Projet Motio', extensions: ['motio'] }

/**
 * Le renderer ne peut écrire que là où l'utilisateur a choisi d'écrire (boîtes de dialogue),
 * plus le fichier de sauvegarde automatique.
 */
const allowedProjectPaths = new Set<string>()
const allowedExportPaths = new Set<string>()

const autosavePath = () => join(app.getPath('userData'), 'autosave.motio')
const autosaveMetaPath = () => join(app.getPath('userData'), 'autosave.json')

/** Écriture atomique : un plantage pendant l'écriture ne corrompt jamais le fichier existant. */
async function writeAtomic(path: string, data: string | Buffer): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}`
  await writeFile(tmp, data)
  await rename(tmp, path)
}

function openDialog(e: Electron.IpcMainInvokeEvent, options: Electron.OpenDialogOptions) {
  const win = BrowserWindow.fromWebContents(e.sender)
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
}

function saveDialog(e: Electron.IpcMainInvokeEvent, options: Electron.SaveDialogOptions) {
  const win = BrowserWindow.fromWebContents(e.sender)
  return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options)
}

function sanitizeName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'Sans titre'
}

let pendingFile: OpenedFile | null = null

/**
 * Double-clic sur un .motio dans le Finder. Au lancement, le fichier attend que l'interface le
 * réclame ; si l'application tourne déjà, il lui est envoyé directement.
 */
export async function openFromFinder(path: string): Promise<void> {
  try {
    const file = { path, data: await readFile(path, 'utf8') }
    allowedProjectPaths.add(path)
    app.addRecentDocument(path)
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.webContents.isLoading()) {
      win.webContents.send('project:opened', file)
      win.show()
    } else {
      pendingFile = file
    }
  } catch {
    // Fichier illisible : rien à ouvrir.
  }
}

export function registerFileHandlers(): void {
  ipcMain.handle('project:pending', () => {
    const file = pendingFile
    pendingFile = null
    return file
  })

  ipcMain.handle('project:open', async (e) => {
    const result = await openDialog(e, { filters: [PROJECT_FILTER], properties: ['openFile'] })
    if (result.canceled || !result.filePaths[0]) return null
    const path = result.filePaths[0]
    allowedProjectPaths.add(path)
    return { path, data: await readFile(path, 'utf8') }
  })

  ipcMain.handle('project:save', async (e, data: string, path: string | null, suggestedName: string) => {
    let target = path && allowedProjectPaths.has(path) ? path : null
    if (!target) {
        const result = await saveDialog(e, {
        defaultPath: `${sanitizeName(suggestedName)}.motio`,
        filters: [PROJECT_FILTER],
      })
      if (result.canceled || !result.filePath) return null
      target = result.filePath
      allowedProjectPaths.add(target)
    }
    await writeAtomic(target, data)
    app.addRecentDocument(target)
    return target
  })

  const brandPath = () => join(app.getPath('userData'), 'brand.json')
  ipcMain.handle('brand:read', () => readFile(brandPath(), 'utf8').catch(() => null))
  ipcMain.handle('brand:write', async (_e, data: string) => {
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeAtomic(brandPath(), data)
  })

  ipcMain.handle('autosave:read', async (): Promise<AutosaveData | null> => {
    try {
      const data = await readFile(autosavePath(), 'utf8')
      const meta = JSON.parse(await readFile(autosaveMetaPath(), 'utf8').catch(() => '{}')) as Partial<AutosaveData>
      const path = meta.path ?? null
      if (path) allowedProjectPaths.add(path)
      return { data, path, dirty: meta.dirty ?? true }
    } catch {
      return null
    }
  })

  ipcMain.handle('autosave:write', async (_e, save: AutosaveData) => {
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeAtomic(autosavePath(), save.data)
    await writeAtomic(autosaveMetaPath(), JSON.stringify({ path: save.path, dirty: save.dirty }))
  })

  ipcMain.handle('export:choose', async (e, suggestedName: string, kind: ExportKind) => {
    const name = sanitizeName(suggestedName)
    if (kind === 'folder') {
      const result = await openDialog(e, {
        title: 'Dossier où créer la séquence PNG',
        buttonLabel: 'Choisir',
        properties: ['openDirectory', 'createDirectory'],
      })
      if (result.canceled || !result.filePaths[0]) return null
      // Les images vont dans un sous-dossier au nom du projet.
      const folder = join(result.filePaths[0], name)
      await mkdir(folder, { recursive: true })
      allowedExportPaths.add(folder)
      return folder
    }
    const labels = { mp4: 'Vidéo MP4', webm: 'Vidéo WebM', png: 'Image PNG', srt: 'Sous-titres SRT' }
    const result = await saveDialog(e, {
      defaultPath: `${name}.${kind}`,
      filters: [{ name: labels[kind], extensions: [kind] }],
    })
    if (result.canceled || !result.filePath) return null
    allowedExportPaths.add(result.filePath)
    return result.filePath
  })

  ipcMain.handle('export:write', async (_e, path: string, data: ArrayBuffer, fileInFolder?: string) => {
    if (!allowedExportPaths.has(path)) throw new Error('Emplacement d’export non autorisé')
    const target = fileInFolder ? join(path, basename(fileInFolder)) : path
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, Buffer.from(data))
  })

  ipcMain.on('reveal', (_e, path: string) => {
    if (allowedExportPaths.has(path) || allowedProjectPaths.has(path)) shell.showItemInFolder(path)
  })

  ipcMain.on('document:state', (e, state: { dirty: boolean; path: string | null; title: string }) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    win.setDocumentEdited(state.dirty)
    win.setRepresentedFilename(state.path ?? '')
    win.setTitle(state.title)
  })
}
