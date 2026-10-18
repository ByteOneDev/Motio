import { useEffect } from 'react'
import { deleteKeyGroup } from '@/engine/animate'
import { lastFrame, useEditor } from '@/store/editor'
import { useView } from '@/store/view'
import { useBrand } from './brand'
import { addKeyframes, splitAtPlayhead } from './editActions'
import { useRecording } from './recording/recorder'
import { newProject, openExport, openProject, saveProject } from './fileActions'

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/** Raccourcis globaux de l'éditeur (ignorés pendant la saisie dans un champ). */
export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Une fenêtre (export, marque, enregistrement) est ouverte : les raccourcis de l'éditeur attendent.
      if (useView.getState().exportOpen || useBrand.getState().editing || useRecording.getState().dialogOpen) return
      const s = useEditor.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const frame = 1 / s.project.fps

      // Commandes de fichier : dans l'application de bureau, c'est le menu natif qui s'en charge.
      if (mod && !window.motio && ['s', 'o', 'n', 'e'].includes(key)) {
        e.preventDefault()
        if (key === 's') saveProject(e.shiftKey)
        else if (key === 'o') openProject()
        else if (key === 'n') newProject()
        else openExport()
        return
      }
      if (isEditable(e.target)) return

      // Espace : appui bref = lecture/pause, maintenu + glisser = déplacer la vue (comme After Effects).
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) useView.getState().setView({ spaceHeld: true, spacePanned: false })
        return
      }
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      if (mod && key === 'b') {
        e.preventDefault()
        splitAtPlayhead()
        return
      }
      if (!mod && key === 'k') {
        addKeyframes()
        return
      }
      if (mod && key === 'd') {
        e.preventDefault()
        s.duplicateLayers(s.selection)
        return
      }
      if (mod && key === 'a') {
        e.preventDefault()
        s.select(s.project.layers.filter((l) => !l.locked).map((l) => l.id))
        return
      }
      if (mod && (e.key === ']' || e.key === '[') && s.selection.length === 1) {
        e.preventDefault()
        const id = s.selection[0]
        const index = s.project.layers.findIndex((l) => l.id === id)
        const up = e.key === ']'
        s.reorderLayer(id, e.shiftKey ? (up ? s.project.layers.length - 1 : 0) : index + (up ? 1 : -1))
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        const k = s.selectedKey
        if (k) {
          s.update('Supprimer l’image clé', (draft) => {
            const layer = draft.layers.find((l) => l.id === k.layerId)
            if (layer) deleteKeyGroup(layer, k.time)
          })
          s.selectKey(null)
        } else {
          s.removeLayers(s.selection)
        }
        return
      }
      if (e.key === 'Escape') {
        if (s.selectedKey) s.selectKey(null)
        else s.select([])
        return
      }
      if (e.key === 'Home') {
        e.preventDefault()
        s.setTime(0)
        return
      }
      if (e.key === 'End') {
        e.preventDefault()
        s.setTime(lastFrame(s.project))
        return
      }
      // , et . : image précédente / suivante (Maj : une seconde).
      if (e.key === ',' || e.key === '.' || e.key === '?' || e.key === ';') {
        const back = e.key === ',' || e.key === '?'
        s.setTime(s.time + (back ? -1 : 1) * (e.shiftKey ? 1 : frame))
        return
      }
      if (e.shiftKey && e.code === 'Digit1') {
        useView.getState().fitToScreen()
        return
      }
      if (e.shiftKey && e.code === 'Digit0') {
        useView.getState().zoomTo(1)
        return
      }

      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      const dir = arrows[e.key]
      if (!dir) return
      e.preventDefault()
      const movable = s.project.layers.filter((l) => s.selection.includes(l.id) && !l.locked).map((l) => l.id)
      if (movable.length === 0) {
        // Sans sélection, ← / → avancent image par image.
        if (dir[0]) s.setTime(s.time + dir[0] * (e.shiftKey ? 1 : frame))
        return
      }
      const step = e.shiftKey ? 10 : 1
      s.updateLayers(
        movable,
        'Décaler',
        (layer) => {
          layer.transform.x += dir[0] * step
          layer.transform.y += dir[1] * step
        },
        { coalesce: `nudge:${movable.join(',')}` },
      )
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const view = useView.getState()
      if (!view.spaceHeld) return
      e.preventDefault()
      if (!view.spacePanned && !isEditable(e.target)) useEditor.getState().togglePlay()
      view.setView({ spaceHeld: false, spacePanned: false })
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])
}
