import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { MenuCommand, MotioApi, OpenedFile } from '../shared/api'

const api: MotioApi = {
  platform: process.platform,
  pathForFile: (file) => webUtils.getPathForFile(file),

  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (data, path, suggestedName) => ipcRenderer.invoke('project:save', data, path, suggestedName),
  readAutosave: () => ipcRenderer.invoke('autosave:read'),
  takePendingFile: () => ipcRenderer.invoke('project:pending'),
  readBrand: () => ipcRenderer.invoke('brand:read'),
  writeBrand: (data) => ipcRenderer.invoke('brand:write', data),
  onOpenFile: (listener) => {
    const handler = (_: unknown, file: OpenedFile) => listener(file)
    ipcRenderer.on('project:opened', handler)
    return () => ipcRenderer.removeListener('project:opened', handler)
  },
  writeAutosave: (save) => ipcRenderer.invoke('autosave:write', save),

  chooseExportPath: (suggestedName, kind) => ipcRenderer.invoke('export:choose', suggestedName, kind),
  writeExport: (path, data, fileInFolder) => ipcRenderer.invoke('export:write', path, data, fileInFolder),
  revealInFinder: (path) => ipcRenderer.send('reveal', path),

  captureSources: () => ipcRenderer.invoke('capture:sources'),
  selectCaptureSource: (id) => ipcRenderer.invoke('capture:select', id),
  requestMicAccess: () => ipcRenderer.invoke('capture:mic-access'),
  openCaptureSettings: () => ipcRenderer.invoke('capture:open-settings'),
  setStopShortcut: (on) => ipcRenderer.invoke('capture:shortcut', on),
  onStopShortcut: (listener) => {
    const handler = () => listener()
    ipcRenderer.on('capture:stop', handler)
    return () => ipcRenderer.removeListener('capture:stop', handler)
  },
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  saveRecording: (data, ext, kind) => ipcRenderer.invoke('capture:save', data, ext, kind),

  setDocumentState: (state) => ipcRenderer.send('document:state', state),
  onMenu: (listener) => {
    const handler = (_: unknown, command: MenuCommand) => listener(command)
    ipcRenderer.on('menu', handler)
    return () => ipcRenderer.removeListener('menu', handler)
  },
}

contextBridge.exposeInMainWorld('motio', api)
