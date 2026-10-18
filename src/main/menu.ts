import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import type { MenuCommand } from '../shared/api'

function send(command: MenuCommand) {
  return () => BrowserWindow.getFocusedWindow()?.webContents.send('menu', command)
}

/** Menu natif en français. Les commandes de fichier sont exécutées par le renderer. */
export function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: `À propos de ${app.name}` },
              { type: 'separator' },
              { role: 'hide', label: `Masquer ${app.name}` },
              { role: 'hideOthers', label: 'Masquer les autres' },
              { role: 'unhide', label: 'Tout afficher' },
              { type: 'separator' },
              { role: 'quit', label: `Quitter ${app.name}` },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'Fichier',
      submenu: [
        { label: 'Nouveau projet', accelerator: 'CmdOrCtrl+N', click: send('new') },
        { label: 'Ouvrir…', accelerator: 'CmdOrCtrl+O', click: send('open') },
        { role: 'recentDocuments', label: 'Ouvrir récent', submenu: [{ role: 'clearRecentDocuments', label: 'Effacer la liste' }] },
        { type: 'separator' },
        { label: 'Enregistrer', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { label: 'Enregistrer sous…', accelerator: 'Shift+CmdOrCtrl+S', click: send('saveAs') },
        { type: 'separator' },
        { label: 'Exporter…', accelerator: 'CmdOrCtrl+E', click: send('export') },
        ...(isMac ? [] : [{ type: 'separator' } as const, { role: 'quit', label: 'Quitter' } as const]),
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' },
      ],
    },
    {
      label: 'Présentation',
      submenu: [
        ...(app.isPackaged ? [] : [{ role: 'reload', label: 'Recharger' } as const, { role: 'toggleDevTools', label: 'Outils de développement' } as const]),
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
      ],
    },
    { role: 'windowMenu', label: 'Fenêtre' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
