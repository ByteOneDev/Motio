import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useEditor } from '@/store/editor'

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="border-b border-ui-line px-3 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-wide text-ui-muted uppercase">{title}</h3>
        {actions}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

const inputClass =
  'h-7 w-full min-w-0 rounded border border-transparent bg-ui-raised px-2 text-ui-text outline-none hover:border-ui-line focus:border-accent'

function format(value: number, precision: number): string {
  return String(Number(value.toFixed(precision)))
}

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  /** Libellé de l'entrée d'historique quand on glisse sur l'étiquette. */
  historyLabel?: string
  step?: number
  min?: number
  max?: number
  precision?: number
  suffix?: string
  title?: string
  /** Élément affiché à droite du champ (ex. bouton d'image clé). */
  extra?: ReactNode
}

/**
 * Champ numérique : on tape une valeur, on utilise ↑/↓ (Maj : ×10),
 * ou on glisse horizontalement sur l'étiquette pour faire varier la valeur.
 */
export function NumberField({
  label,
  value,
  onChange,
  historyLabel = label,
  step = 1,
  min = -Infinity,
  max = Infinity,
  precision = 0,
  suffix,
  title,
  extra,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const scrub = useRef<{ x: number; value: number } | null>(null)
  const clamp = (v: number) => Math.min(max, Math.max(min, v))

  const commit = () => {
    if (draft === null) return
    const v = Number(draft.replace(',', '.'))
    if (Number.isFinite(v)) onChange(clamp(v))
    setDraft(null)
  }

  return (
    <label className="flex items-center rounded bg-ui-raised" title={title}>
      <span
        className="w-6 shrink-0 cursor-ew-resize pl-2 text-[11px] text-ui-muted select-none"
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          scrub.current = { x: e.clientX, value }
          useEditor.getState().beginGesture(historyLabel)
        }}
        onPointerMove={(e) => {
          if (!scrub.current) return
          const factor = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
          const v = scrub.current.value + (e.clientX - scrub.current.x) * step * factor
          onChange(clamp(Number(v.toFixed(Math.max(precision, e.altKey ? precision + 1 : 0)))))
        }}
        onPointerUp={() => {
          scrub.current = null
          useEditor.getState().endGesture()
        }}
      >
        {label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        className={`${inputClass} bg-transparent pl-1`}
        value={draft ?? format(value, precision)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraft(null)
            requestAnimationFrame(() => (e.target as HTMLInputElement).blur())
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
            setDraft(null)
            onChange(clamp(Number((value + delta).toFixed(precision))))
          }
        }}
      />
      {suffix && <span className="pr-2 text-[11px] text-ui-faint">{suffix}</span>}
      {extra}
    </label>
  )
}

export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = '%',
  historyLabel = label,
  extra,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
  historyLabel?: string
  extra?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-ui-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        className="h-1 min-w-0 flex-1 accent-accent"
        onPointerDown={() => useEditor.getState().beginGesture(historyLabel)}
        onPointerUp={() => useEditor.getState().endGesture()}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-10 text-right text-[11px] text-ui-text tabular-nums">
        {Math.round(value)}
        {suffix}
      </span>
      {extra}
    </div>
  )
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

function normalizeHex(v: string): string | null {
  const m = v.trim().match(HEX)
  if (!m) return null
  let hex = m[1].toLowerCase()
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('')
  return `#${hex}`
}

/** Couleur ; avec `onClear`, la couleur peut être retirée (« aucun »). */
export function ColorField({
  label,
  value,
  onChange,
  onClear,
  extra,
}: {
  label: string
  value: string | null
  onChange: (v: string) => void
  onClear?: () => void
  extra?: ReactNode
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const palette = useEditor((s) => s.project.palette)
  const swatch = value ? value.slice(0, 7) : '#000000'

  return (
    <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-ui-muted">{label}</span>
      <label
        className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded border border-ui-line"
        style={{ background: value ? swatch : undefined }}
        title="Choisir une couleur"
      >
        {!value && <span className="absolute inset-0 bg-[linear-gradient(135deg,transparent_45%,#ff4d6d_45%,#ff4d6d_55%,transparent_55%)]" />}
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={swatch}
          // Le sélecteur natif ignore la transparence : on garde celle de la couleur actuelle.
          onChange={(e) => onChange(e.target.value + (value?.length === 9 ? value.slice(7) : ''))}
        />
      </label>
      {value ? (
        <input
          className={`${inputClass} font-mono uppercase`}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const hex = draft && normalizeHex(draft)
            if (hex) onChange(hex)
            setDraft(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      ) : (
        <button type="button" className="h-7 flex-1 rounded bg-ui-raised text-left px-2 text-ui-faint hover:text-ui-text" onClick={() => onChange('#ffffff')}>
          Aucun — ajouter
        </button>
      )}
      {onClear && value && (
        <button type="button" className="h-7 rounded px-1.5 text-ui-faint hover:bg-ui-hover hover:text-ui-text" onClick={onClear} title="Retirer">
          ✕
        </button>
      )}
      {extra}
    </div>
    {palette.length > 0 && (
      <div className="flex flex-wrap gap-1 pl-[72px]">
        {palette.map((c, i) => (
          <button
            key={`${c}-${i}`}
            type="button"
            title={`Couleur de la charte : ${c}`}
            onClick={() => onChange(c)}
            className={`h-3.5 w-3.5 rounded-sm border ${value?.toLowerCase() === c.toLowerCase() ? 'border-white' : 'border-white/15 hover:border-white/60'}`}
            style={{ background: c }}
          />
        ))}
      </div>
    )}
    </div>
  )
}

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { label: string; value: T }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-ui-muted">{label}</span>
      <select
        className={`${inputClass} cursor-pointer`}
        value={String(value)}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value)
          if (opt) onChange(opt.value)
        }}
      >
        {!options.some((o) => o.value === value) && <option value={String(value)}>{String(value)}</option>}
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; icon: ReactNode; title: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex h-7 rounded bg-ui-raised p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center rounded ${o.value === value ? 'bg-ui-hover text-ui-text' : 'text-ui-muted hover:text-ui-text'}`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}

export function ToggleButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 items-center justify-center gap-1.5 rounded px-2 ${active ? 'bg-accent-soft text-ui-text' : 'bg-ui-raised text-ui-muted hover:text-ui-text'}`}
    >
      {children}
    </button>
  )
}

export function IconButton({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 items-center justify-center rounded bg-ui-raised px-2 text-ui-muted hover:bg-ui-hover hover:text-ui-text"
    >
      {children}
    </button>
  )
}

/** Zone de texte qui se met à jour en direct ; s'ouvre au double-clic sur un texte du canevas. */
export function TextAreaField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const focus = () => {
      ref.current?.focus()
      ref.current?.select()
    }
    window.addEventListener('motio:edit-text', focus)
    return () => window.removeEventListener('motio:edit-text', focus)
  }, [])
  return (
    <textarea
      ref={ref}
      rows={3}
      className="w-full resize-y rounded border border-transparent bg-ui-raised px-2 py-1.5 text-[13px] leading-snug text-ui-text outline-none hover:border-ui-line focus:border-accent"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
    />
  )
}

/** Petit bouton d'aperçu (lecture d'une portion de la séquence). */
export function PreviewButton({ onClick, title = 'Aperçu' }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        onClick()
        e.currentTarget.blur()
      }}
      className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-ui-muted hover:bg-ui-hover hover:text-ui-text"
    >
      ▶ Aperçu
    </button>
  )
}
