import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { useEditor } from './store/editor'
import './fonts'
import './index.css'

// En développement, le store est accessible depuis la console : __motio.getState()
if (import.meta.env.DEV) Object.assign(window, { __motio: useEditor })

// Un fichier lâché hors d'une zone prévue ne doit pas remplacer l'application par son contenu.
for (const type of ['dragover', 'drop']) {
  window.addEventListener(type, (e) => {
    if ((e as DragEvent).dataTransfer?.types.includes('Files')) e.preventDefault()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
