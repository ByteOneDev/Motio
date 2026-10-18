import type { TextProps } from '@/model/schema'

/** Largeur d'une chaîne pour une police CSS donnée. Injectée pour rester testable hors navigateur. */
export type Measure = (text: string, font: string, letterSpacing: number) => number

export interface TextLine {
  text: string
  width: number
}

export interface TextLayout {
  lines: TextLine[]
  width: number
  height: number
  lineHeight: number
}

export function fontString(p: TextProps): string {
  return `${p.italic ? 'italic ' : ''}${p.fontWeight} ${p.fontSize}px ${p.fontFamily}`
}

/**
 * Découpe le texte en lignes. En largeur auto, seuls les retours à la ligne explicites
 * coupent ; sinon les mots sont répartis dans `boxWidth`.
 */
export function layoutText(p: TextProps, boxWidth: number, measure: Measure): TextLayout {
  const font = fontString(p)
  const m = (s: string) => measure(s, font, p.letterSpacing)
  const lines: TextLine[] = []

  const text = p.uppercase ? p.text.toLocaleUpperCase('fr') : p.text
  for (const paragraph of text.split('\n')) {
    if (p.autoWidth) {
      lines.push({ text: paragraph, width: m(paragraph) })
      continue
    }
    let current = ''
    for (const word of paragraph.split(' ')) {
      const candidate = current ? `${current} ${word}` : word
      if (current && m(candidate) > boxWidth) {
        lines.push({ text: current, width: m(current) })
        current = word
      } else {
        current = candidate
      }
    }
    lines.push({ text: current, width: m(current) })
  }

  const lineHeight = p.fontSize * p.lineHeight
  const contentWidth = Math.max(0, ...lines.map((l) => l.width))
  return {
    lines,
    // Un texte vide garde une largeur minimale pour rester sélectionnable.
    width: p.autoWidth ? Math.max(contentWidth, p.fontSize * 0.5) : boxWidth,
    height: lines.length * lineHeight,
    lineHeight,
  }
}
