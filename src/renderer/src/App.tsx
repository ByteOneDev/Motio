import { Inspector } from './ui/inspector/Inspector'
import { Library } from './ui/library/Library'
import { Timeline } from './ui/timeline/Timeline'
import { TopBar } from './ui/TopBar'
import { useEffect } from 'react'
import { useAudioPlayback } from './ui/audio'
import { useBrand } from './ui/brand'
import { BrandDialog } from './ui/brand/BrandDialog'
import { RecordDialog, RecordingBar } from './ui/recording/RecordDialog'
import { ExportDialog } from './ui/export/ExportDialog'
import { useAutosave, useDocument } from './ui/fileActions'
import { useProjectFonts } from './ui/fonts'
import { Toasts } from './ui/toast'
import { usePlayback } from './ui/usePlayback'
import { useShortcuts } from './ui/useShortcuts'
import { Viewport } from './ui/canvas/Viewport'

export function App() {
  useShortcuts()
  usePlayback()
  useAudioPlayback()
  useProjectFonts()
  useAutosave()
  useDocument()
  useEffect(() => void useBrand.getState().load(), [])
  return (
    <div className="grid h-full grid-cols-[232px_1fr_288px] grid-rows-[44px_1fr_300px]">
      <TopBar className="col-span-3" />
      <Library className="border-r border-ui-line" />
      <Viewport />
      <Inspector className="row-span-2 border-l border-ui-line" />
      <Timeline className="col-span-2 border-t border-ui-line" />
      <ExportDialog />
      <BrandDialog />
      <RecordDialog />
      <RecordingBar />
      <Toasts />
    </div>
  )
}
