export type FontCategory = 'Sans' | 'Titrage' | 'Serif' | 'Code' | 'Manuscrite' | 'Système'

export interface FontOption {
  label: string
  /** Valeur CSS `font-family`, avec des polices de secours. */
  value: string
  category: FontCategory
}

export const FONTS: FontOption[] = [
  { label: 'Inter', value: '"Inter Variable", system-ui, sans-serif', category: 'Sans' },
  { label: 'Montserrat', value: '"Montserrat Variable", sans-serif', category: 'Sans' },
  { label: 'Poppins', value: 'Poppins, sans-serif', category: 'Sans' },
  { label: 'DM Sans', value: '"DM Sans Variable", sans-serif', category: 'Sans' },
  { label: 'Outfit', value: '"Outfit Variable", sans-serif', category: 'Sans' },
  { label: 'Space Grotesk', value: '"Space Grotesk Variable", sans-serif', category: 'Sans' },
  { label: 'Bebas Neue', value: '"Bebas Neue", Impact, sans-serif', category: 'Titrage' },
  { label: 'Oswald', value: '"Oswald Variable", Impact, sans-serif', category: 'Titrage' },
  { label: 'Archivo Black', value: '"Archivo Black", sans-serif', category: 'Titrage' },
  { label: 'Press Start 2P', value: '"Press Start 2P", monospace', category: 'Titrage' },
  { label: 'Playfair Display', value: '"Playfair Display Variable", Georgia, serif', category: 'Serif' },
  { label: 'Fraunces', value: '"Fraunces Variable", Georgia, serif', category: 'Serif' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono Variable", Menlo, monospace', category: 'Code' },
  { label: 'Caveat', value: '"Caveat Variable", cursive', category: 'Manuscrite' },
  { label: 'Permanent Marker', value: '"Permanent Marker", cursive', category: 'Manuscrite' },
  { label: 'Pacifico', value: 'Pacifico, cursive', category: 'Manuscrite' },
  { label: 'Système', value: 'system-ui, -apple-system, sans-serif', category: 'Système' },
  { label: 'Helvetica Neue', value: '"Helvetica Neue", Helvetica, Arial, sans-serif', category: 'Système' },
  { label: 'Georgia', value: 'Georgia, serif', category: 'Système' },
  { label: 'Menlo', value: 'Menlo, Monaco, "Courier New", monospace', category: 'Système' },
]

export const DEFAULT_FONT = FONTS[0].value

export function fontLabel(value: string): string {
  return FONTS.find((f) => f.value === value)?.label ?? value.split(',')[0].replace(/"/g, '')
}

/** Raccourci pour les modèles : `font('Bebas Neue')`. */
export function font(label: string): string {
  return FONTS.find((f) => f.label === label)?.value ?? DEFAULT_FONT
}
