import { create } from 'zustand'

/**
 * État d'affichage du canevas (hors historique et hors fichier projet).
 * La composition est centrée dans le viewport puis décalée de (panX, panY) pixels écran.
 */
export interface ViewState {
  /** En mode « ajuster », le zoom suit la taille de la fenêtre. */
  fit: boolean
  zoom: number
  /** Zoom qui fait tenir la composition dans le viewport (calculé par le canevas). */
  fitZoom: number
  panX: number
  panY: number
  /** Barre d'espace maintenue : glisser sur le canevas déplace la vue. */
  spaceHeld: boolean
  /** Vrai si la vue a été déplacée pendant l'appui : relâcher l'espace ne lance alors pas la lecture. */
  spacePanned: boolean
  /** Fenêtre d'export ouverte : les raccourcis de l'éditeur sont suspendus. */
  exportOpen: boolean
  /** Aimantation (canevas et timeline). */
  snapping: boolean
  /** Zoom horizontal de la timeline (1 = toute la durée visible). */
  timelineZoom: number
  setExportOpen: (open: boolean) => void
  setView: (v: Partial<Pick<ViewState, 'fit' | 'zoom' | 'fitZoom' | 'panX' | 'panY' | 'spaceHeld' | 'spacePanned' | 'snapping' | 'timelineZoom'>>) => void
  fitToScreen: () => void
  zoomTo: (zoom: number) => void
}

export const useView = create<ViewState>()((set) => ({
  fit: true,
  zoom: 1,
  fitZoom: 1,
  panX: 0,
  panY: 0,
  spaceHeld: false,
  spacePanned: false,
  exportOpen: false,
  snapping: true,
  timelineZoom: 1,
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setView: (v) => set(v),
  fitToScreen: () => set({ fit: true, panX: 0, panY: 0 }),
  zoomTo: (zoom) => set({ fit: false, zoom, panX: 0, panY: 0 }),
}))

export function effectiveZoom(v: Pick<ViewState, 'fit' | 'zoom' | 'fitZoom'>): number {
  return v.fit ? v.fitZoom : v.zoom
}
