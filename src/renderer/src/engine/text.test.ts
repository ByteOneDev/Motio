import { describe, expect, it } from 'vitest'
import { createProject, createText } from '@/model/factories'
import { layoutText, type Measure } from './text'

const measure: Measure = (s) => s.length * 10

function props(text: string, autoWidth: boolean) {
  const layer = createText(createProject(), 'body')
  return { ...layer.props, text, autoWidth, fontSize: 20, lineHeight: 1.5 }
}

describe('layoutText', () => {
  it('en largeur auto, ne coupe qu’aux retours à la ligne', () => {
    const layout = layoutText(props('abc\nabcdef', true), 10, measure)
    expect(layout.lines.map((l) => l.text)).toEqual(['abc', 'abcdef'])
    expect(layout.width).toBe(60)
    expect(layout.height).toBe(2 * 30)
  })

  it('répartit les mots dans la largeur de la boîte', () => {
    const layout = layoutText(props('aaa bbb ccc', false), 100, measure)
    expect(layout.lines.map((l) => l.text)).toEqual(['aaa bbb', 'ccc'])
    expect(layout.width).toBe(100)
  })

  it('garde une largeur minimale pour un texte vide', () => {
    expect(layoutText(props('', true), 10, measure).width).toBe(10)
  })
})
