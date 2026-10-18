import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, session, shell, systemPreferences } from 'electron'
import type { CaptureSource } from '../shared/api'

const STOP_SHORTCUT = 'CommandOrControl+Shift+2'

let sources: Electron.DesktopCapturerSource[] = []
let selectedId: string | null = null

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} à ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`
}

/**
 * Enregistrement d'écran : l'interface choisit une source (écran ou fenêtre) dans sa propre
 * liste, puis demande le flux avec getDisplayMedia ; on lui renvoie la source choisie.
 */
export function registerCaptureHandlers(): void {
  ipcMain.handle('capture:sources', async (): Promise<{ status: string; sources: CaptureSource[] }> => {
    const status = process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'granted'
    try {
      sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 200 }, fetchWindowIcons: false })
    } catch {
      sources = []
    }
    return {
      status,
      sources: sources
        // La fenêtre de Motio elle-même n'a pas d'intérêt à être filmée.
        .filter((s) => s.name !== app.getName())
        .map((s) => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL(), kind: s.id.startsWith('screen') ? 'screen' : 'window' })),
    }
  })

  ipcMain.handle('capture:select', (_e, id: string) => {
    selectedId = id
  })

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    const source = sources.find((s) => s.id === selectedId)
    // Sans source choisie, la demande est refusée.
    callback(source ? { video: source } : {})
  })

  ipcMain.handle('capture:mic-access', async () => (process.platform === 'darwin' ? systemPreferences.askForMediaAccess('microphone') : true))

  ipcMain.handle('capture:open-settings', () => {
    if (process.platform === 'darwin') shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
  })

  // Pendant l'enregistrement, ⇧⌘2 arrête depuis n'importe quelle application.
  ipcMain.handle('capture:shortcut', (e, on: boolean) => {
    globalShortcut.unregister(STOP_SHORTCUT)
    if (!on) return
    globalShortcut.register(STOP_SHORTCUT, () => {
      const win = BrowserWindow.fromWebContents(e.sender)
      win?.restore()
      win?.show()
      e.sender.send('capture:stop')
    })
  })

  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())

  ipcMain.handle('capture:save', async (_e, data: ArrayBuffer, ext: 'webm' | 'mp4', kind: 'screen' | 'voice') => {
    const dir = join(app.getPath('videos'), 'Motio')
    await mkdir(dir, { recursive: true })
    const path = join(dir, `${kind === 'voice' ? 'Voix off' : 'Enregistrement'} ${stamp()}.${ext}`)
    await writeFile(path, Buffer.from(data))
    return path
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())
}
