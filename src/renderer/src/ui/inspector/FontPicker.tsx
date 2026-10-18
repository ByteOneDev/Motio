import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FONTS, fontLabel, type FontCategory } from '@/model/fonts'

const CATEGORIES: FontCategory[] = ['Sans', 'Titrage', 'Serif', 'Code', 'Manuscrite', 'Système']

/** Liste des polices, chacune affichée dans sa propre police. */
export function FontPicker({ value, onChange, label = 'Police' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={root} className="relative flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-ui-muted">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 min-w-0 flex-1 items-center justify-between rounded border border-transparent bg-ui-raised px-2 text-[13px] text-ui-text hover:border-ui-line"
        style={{ fontFamily: value }}
      >
        <span className="truncate">{fontLabel(value)}</span>
        <ChevronDown size={13} className="shrink-0 text-ui-muted" />
      </button>
      {open && (
        <div className="absolute top-8 right-0 left-0 z-50 max-h-80 overflow-y-auto rounded-md border border-ui-line bg-ui-raised py-1 shadow-2xl">
          {CATEGORIES.map((cat) => (
            <div key={cat}>
              <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-ui-faint uppercase">{cat}</div>
              {FONTS.filter((f) => f.category === cat).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    onChange(f.value)
                    setOpen(false)
                  }}
                  className={`block w-full truncate px-2.5 py-1 text-left text-[15px] hover:bg-ui-hover ${f.value === value ? 'text-accent' : 'text-ui-text'}`}
                  style={{ fontFamily: f.value }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
