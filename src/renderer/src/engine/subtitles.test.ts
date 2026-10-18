import { describe, expect, it } from 'vitest'
import { parseSrt, scriptToCues, spokenWords, toSrt } from './subtitles'

describe('sous-titres', () => {
  it('découpe un script en phrases, chacune le temps de la lire', () => {
    const cues = scriptToCues('Bonjour à tous. Aujourd’hui on découvre Motio !\nC’est parti.', 1)
    expect(cues.map((c) => c.text)).toEqual(['Bonjour à tous.', 'Aujourd’hui on découvre Motio !', 'C’est parti.'])
    expect(cues[0].start).toBe(1)
    expect(cues[1].start).toBeCloseTo(cues[0].end)
    expect(cues[1].end - cues[1].start).toBeCloseTo(31 / 15, 1)
  })

  it('coupe une phrase trop longue entre deux mots', () => {
    const long = 'un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize dix-sept'
    const cues = scriptToCues(long, 0, 40)
    expect(cues.length).toBeGreaterThan(1)
    expect(cues.every((c) => c.text.length <= 40)).toBe(true)
    expect(cues.map((c) => c.text).join(' ')).toBe(long)
  })

  it('aller-retour SRT', () => {
    const cues = [
      { id: 'a', start: 1.5, end: 3.25, text: 'Première ligne' },
      { id: 'b', start: 3.5, end: 61, text: 'Deuxième\nsur deux lignes' },
    ]
    const srt = toSrt(cues)
    expect(srt).toContain('00:00:01,500 --> 00:00:03,250')
    expect(srt).toContain('00:00:03,500 --> 00:01:01,000')
    expect(parseSrt(srt)).toEqual(cues.map(({ start, end, text }) => ({ start, end, text })))
  })

  it('le karaoké avance mot par mot selon leur longueur', () => {
    const words = ['Un', 'mot', 'interminable']
    expect(spokenWords(words, 0)).toBe(0)
    expect(spokenWords(words, 0.2)).toBe(1)
    expect(spokenWords(words, 1)).toBe(3)
  })
})
