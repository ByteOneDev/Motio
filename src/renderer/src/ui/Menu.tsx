import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface MenuItem {
  label: string
  icon?: ReactNode
  hint?: string
  shortcut?: string
  onClick: () => void
}

export type MenuEntry = MenuItem | 'separator'

/** Bouton qui ouvre une liste d'actions (barre d'outils). */
export function Menu({ label, icon, title, items }: { label: string; icon: ReactNode; title: string; items: MenuEntry[] }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null)
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
    <div ref={root} className="relative">
      <button
        type="button"
        title={title}
        onClick={(e) => {
          // Position fixe : le menu ne doit pas être rogné par une barre d'outils qui défile.
          const r = e.currentTarget.getBoundingClientRect()
          setAnchor({ left: r.left, bottom: window.innerHeight - r.top + 4 })
          setOpen((o) => !o)
        }}
        className={`flex h-7 items-center gap-1 rounded px-1.5 text-[11px] ${open ? 'bg-ui-hover text-ui-text' : 'text-ui-muted hover:bg-ui-hover hover:text-ui-text'}`}
      >
        {icon}
        <span className="hidden xl:inline">{label}</span>
        <ChevronDown size={11} />
      </button>
      {open && anchor && (
        <div className="fixed z-50 min-w-56 rounded-md border border-ui-line bg-ui-raised py-1 shadow-2xl" style={{ left: anchor.left, bottom: anchor.bottom }}>
          {items.map((item, i) =>
            item === 'separator' ? (
              <div key={i} className="my-1 h-px bg-ui-line" />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-ui-hover"
              >
                <span className="w-4 text-ui-muted">{item.icon}</span>
                <span className="flex-1">
                  <span className="block text-[12px] text-ui-text">{item.label}</span>
                  {item.hint && <span className="block text-[10px] text-ui-faint">{item.hint}</span>}
                </span>
                {item.shortcut && <span className="text-[10px] text-ui-faint">{item.shortcut}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
