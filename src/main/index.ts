import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { registerCaptureHandlers } from './capture'
import { openFromFinder, registerFileHandlers } from './files'
import { handleMediaScheme, registerMediaScheme } from './mediaProtocol'
import { buildMenu } from './menu'

app.setName('Motio')
registerMediaScheme()

// Doit être enregistré avant `ready` pour recevoir le fichier qui a lancé l'application.
app.on('open-file', (e, path) => {
  e.preventDefault()
  openFromFinder(path)
})

/**
 * Icône de l'application. Une fois empaquetée, l'icône vient du bundle (build/icon.icns) ;
 * en développement, on remplace l'icône d'Electron dans le Dock par celle de Motio.
 */
const ICON_PATH = join(__dirname, '../../build/icon.png')
const icon = !app.isPackaged && existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : undefined

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    title: 'Motio',
    backgroundColor: '#0b0c10',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())
  // L'application ne quitte jamais sa page (par exemple si un fichier est lâché sur la fenêtre).
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (icon && process.platform === 'darwin') app.dock?.setIcon(icon)
  handleMediaScheme()
  registerFileHandlers()
  registerCaptureHandlers()
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
