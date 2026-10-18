// Renderer seul, servi dans un navigateur (sans Electron) — pratique pour itérer sur l'UI.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: 'src/renderer',
  resolve: { alias: { '@': resolve('src/renderer/src') } },
  plugins: [react(), tailwindcss()],
  server: { port: 5180, strictPort: true },
})
