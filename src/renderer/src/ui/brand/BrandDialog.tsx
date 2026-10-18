import { ImagePlus, Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { DEFAULT_FONT } from '@/model/fonts'
import { useEditor } from '@/store/editor'
import { FontPicker } from '../inspector/FontPicker'
import { notify } from '../toast'
import { useBrand, type Brand } from '../brand'

/** Fenêtre du kit de marque : chaque modification est enregistrée aussitôt. */
export function BrandDialog() {
  const editing = useBrand((s) => s.editing)
  return editing ? <Dialog /> : null
}

function readImage(file: File): Promise<NonNullable<Brand['logo']>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = async () => {
      const src = String(reader.result)
      const img = new Image()
      img.src = src
      await img.decode()
      resolve({ src, width: img.naturalWidth || 512, height: img.naturalHeight || 512, name: file.name })
    }
    reader.readAsDataURL(file)
  })
}

function Dialog() {
  const brand = useBrand((s) => s.brand)
  const save = useBrand((s) => s.save)
  const close = () => useBrand.getState().setEditing(false)
  const set = (patch: Partial<Brand>) => save({ ...brand, ...patch })
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="flex w-[460px] max-w-[calc(100vw-32px)] flex-col rounded-xl border border-ui-line bg-ui-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-ui-line px-4 py-3">
          <h2 className="text-[14px] font-semibold">Kit de marque</h2>
          <button type="button" onClick={close} className="rounded p-1 text-ui-muted hover:bg-ui-hover hover:text-ui-text" title="Fermer (Échap)">
            <X size={16} />
          </button>
        </header>
        <div className="flex flex-col gap-4 p-4">
          <p className="text-[11px] leading-snug text-ui-faint">Votre logo, vos couleurs et vos polices, disponibles dans tous vos projets (onglet Éléments › Ma marque).</p>

          <label className="flex items-center gap-3">
            <span className="w-24 text-[12px] text-ui-muted">Nom</span>
            <input
              value={brand.name}
              onChange={(e) => set({ name: e.target.value })}
              className="h-8 flex-1 rounded border border-transparent bg-ui-raised px-2 text-[13px] text-ui-text outline-none hover:border-ui-line focus:border-accent"
            />
          </label>

          <div className="flex items-center gap-3">
            <span className="w-24 text-[12px] text-ui-muted">Logo</span>
            {brand.logo ? (
              <div className="flex flex-1 items-center gap-2">
                <div className="flex h-14 flex-1 items-center justify-center rounded bg-[repeating-conic-gradient(#2a2e38_0_25%,#1c1f27_0_50%)] bg-[length:12px_12px] p-1">
                  <img src={brand.logo.src} alt="" className="max-h-full max-w-full object-contain" />
                </div>
                <button type="button" title="Retirer le logo" onClick={() => set({ logo: null })} className="rounded p-1.5 text-ui-muted hover:bg-ui-hover hover:text-ui-text">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded border border-dashed border-ui-line text-[12px] text-ui-muted hover:border-accent/60 hover:text-ui-text"
              >
                <ImagePlus size={16} /> Choisir une image (PNG transparent conseillé)
              </button>
            )}
            <input
              ref={input}
              type="file"
              accept="image/png,image/svg+xml,image/webp,image/jpeg"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  set({ logo: await readImage(f) })
                } catch {
                  notify('Image illisible.', 'error')
                }
              }}
            />
          </div>

          <div className="flex items-start gap-3">
            <span className="w-24 pt-1.5 text-[12px] text-ui-muted">Couleurs</span>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {brand.colors.map((color, i) => (
                  <div key={i} className="group relative">
                    <label className="block h-8 w-8 cursor-pointer rounded border border-white/15" style={{ background: color }} title={color}>
                      <input
                        type="color"
                        className="h-0 w-0 opacity-0"
                        value={color.slice(0, 7)}
                        onChange={(e) => set({ colors: brand.colors.map((c, j) => (j === i ? e.target.value : c)) })}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => set({ colors: brand.colors.filter((_, j) => j !== i) })}
                      className="absolute -top-1.5 -right-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-ui-bg text-[9px] text-ui-muted group-hover:flex hover:text-white"
                      title="Retirer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set({ colors: [...brand.colors, '#7c5cff'] })}
                  className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-ui-line text-ui-muted hover:border-accent/60 hover:text-ui-text"
                  title="Ajouter une couleur"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => set({ colors: [...useEditor.getState().project.palette] })}
                className="self-start text-[11px] text-accent hover:underline"
              >
                Reprendre la charte du projet en cours
              </button>
            </div>
          </div>

          <FontPicker label="Titres" value={brand.titleFont ?? DEFAULT_FONT} onChange={(v) => set({ titleFont: v })} />
          <FontPicker label="Textes" value={brand.textFont ?? DEFAULT_FONT} onChange={(v) => set({ textFont: v })} />
        </div>
        <footer className="flex justify-end border-t border-ui-line px-4 py-3">
          <button type="button" onClick={close} className="rounded-md bg-accent px-4 py-2 text-[12px] font-medium text-white hover:brightness-110">
            Terminé
          </button>
        </footer>
      </div>
    </div>
  )
}
