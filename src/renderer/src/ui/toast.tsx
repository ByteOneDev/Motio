import { create } from 'zustand'

interface Toast {
  id: number
  message: string
  kind: 'info' | 'error'
}

const useToasts = create<{ toasts: Toast[] }>()(() => ({ toasts: [] }))
let nextId = 1

/** Petit message temporaire en bas du canevas (enregistrement, erreurs…). */
export function notify(message: string, kind: Toast['kind'] = 'info'): void {
  const id = nextId++
  useToasts.setState((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
  setTimeout(() => useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 6000 : 2500)
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed bottom-[276px] left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-md px-3 py-2 text-[12px] shadow-xl ${t.kind === 'error' ? 'bg-red-500/90 text-white' : 'bg-ui-raised text-ui-text ring-1 ring-ui-line'}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
