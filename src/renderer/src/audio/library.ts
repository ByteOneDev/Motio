import {
  bass,
  bell,
  clap,
  crackle,
  delay,
  drone,
  hat,
  keys,
  kick,
  master,
  note,
  pad,
  pluck,
  reverb,
  rng,
  snare,
  sweep,
  tom,
  type Ctx,
} from './synth'

/**
 * Musiques et bruitages générés par Motio. Ils sont calculés à la demande : aucun fichier,
 * aucune licence à respecter, utilisables librement (y compris commercialement).
 */
export interface SoundDef {
  id: string
  kind: 'music' | 'sfx'
  label: string
  /** Ambiance, affichée dans la bibliothèque. */
  mood: string
  /** Durée du son généré, en secondes. */
  duration: number
  /** Une musique en boucle peut couvrir une séquence plus longue qu'elle. */
  loop: boolean
  /** Tempo des musiques (pour caler les animations sur les temps). */
  bpm?: number
  build: (ctx: Ctx) => void
}

const chord = (...names: string[]) => names.map(note)

/** Grille musicale : appelle `fn` pour chaque temps de `bars` mesures à 4 temps. */
function beats(bpm: number, bars: number, fn: (t: number, beat: number, bar: number) => void): void {
  const b = 60 / bpm
  for (let i = 0; i < bars * 4; i++) fn(i * b, i % 4, Math.floor(i / 4))
}

const loopLength = (bpm: number, bars: number) => (bars * 4 * 60) / bpm

// --- Musiques ------------------------------------------------------------------

const LOFI_BPM = 80
const SYNTH_BPM = 100
const TECH_BPM = 112
const ELECTRO_BPM = 124
const AMBIENT_BPM = 70
const CINE_BPM = 90

export const MUSIC: SoundDef[] = [
  {
    id: 'music:lofi',
    kind: 'music',
    bpm: LOFI_BPM,
    label: 'Lo-fi détente',
    mood: 'Calme, idéal sous une voix off',
    duration: loopLength(LOFI_BPM, 8),
    loop: true,
    build(ctx) {
      const out = master(ctx, 0.85)
      const warm = ctx.createBiquadFilter()
      warm.type = 'lowpass'
      warm.frequency.value = 3800
      warm.connect(out)
      const room = reverb(ctx, warm, 2, 0.25)
      const random = rng(11)
      const b = 60 / LOFI_BPM
      const swing = b * 0.08
      const progression = [chord('A3', 'C4', 'E4', 'G4'), chord('D3', 'F3', 'A3', 'C4'), chord('G3', 'B3', 'D4', 'F4'), chord('C3', 'E3', 'G3', 'B3')]
      beats(LOFI_BPM, 8, (t, beat, bar) => {
        const c = progression[bar % 4]
        if (beat === 0) c.forEach((n, i) => keys(ctx, room, t + i * 0.012, n, b * 1.8, 0.9))
        if (beat === 1) c.slice(1).forEach((n) => keys(ctx, room, t + b * 0.5 + swing, n + 12, b * 0.6, 0.45))
        if (beat === 0 || beat === 2) bass(ctx, warm, t, c[0] - 12, b * 1.4, 0.8, 380)
        if (beat === 0) kick(ctx, warm, t, 0.75)
        if (beat === 1) kick(ctx, warm, t + b * 0.5 + swing, 0.55)
        if (beat === 2 && bar % 2 === 1) kick(ctx, warm, t + b * 0.5 + swing, 0.5)
        if (beat === 1 || beat === 3) snare(ctx, room, t, 0.45)
        hat(ctx, warm, t, 0.35)
        hat(ctx, warm, t + b * 0.5 + swing, 0.22)
      })
      crackle(ctx, out, 0, loopLength(LOFI_BPM, 8), random)
    },
  },
  {
    id: 'music:tech',
    kind: 'music',
    bpm: TECH_BPM,
    label: 'Tech positive',
    mood: 'Entraînant, pour une démo produit',
    duration: loopLength(TECH_BPM, 8),
    loop: true,
    build(ctx) {
      const out = master(ctx, 0.8)
      const echo = delay(ctx, out, (60 / TECH_BPM) * 0.75, 0.3, 0.25)
      const room = reverb(ctx, out, 1.6, 0.2)
      const b = 60 / TECH_BPM
      const progression = [chord('C4', 'E4', 'G4'), chord('G3', 'B3', 'D4'), chord('A3', 'C4', 'E4'), chord('F3', 'A3', 'C4')]
      beats(TECH_BPM, 8, (t, beat, bar) => {
        const c = progression[bar % 4]
        if (beat === 0) pad(ctx, room, t, c, b * 4, 0.7, 1800)
        kick(ctx, out, t, 0.8)
        if (beat === 1 || beat === 3) clap(ctx, room, t, 0.5)
        hat(ctx, out, t + b / 2, 0.45, bar >= 4 && beat % 2 === 1)
        for (let i = 0; i < 2; i++) bass(ctx, out, t + (i * b) / 2, c[0] - 24, b * 0.4, 0.75, 600)
        const arp = [c[0], c[1], c[2], c[0] + 12]
        for (let i = 0; i < 4; i++) pluck(ctx, echo, t + (i * b) / 4, arp[(beat * 4 + i) % 4] + 12, 0.7, 'triangle', 0.25)
      })
    },
  },
  {
    id: 'music:ambient',
    kind: 'music',
    bpm: AMBIENT_BPM,
    label: 'Ambiance douce',
    mood: 'Planant, pour une intro ou une citation',
    duration: loopLength(AMBIENT_BPM, 8),
    loop: true,
    build(ctx) {
      const out = master(ctx, 0.9)
      const hall = reverb(ctx, out, 4, 0.5)
      const random = rng(5)
      const b = 60 / AMBIENT_BPM
      const progression = [chord('F3', 'A3', 'C4', 'E4'), chord('E3', 'G3', 'B3', 'C4'), chord('D3', 'F3', 'A3', 'E4'), chord('Bb2', 'D3', 'F3', 'A3')]
      const pentatonic = ['C5', 'D5', 'F5', 'G5', 'A5', 'C6'].map(note)
      beats(AMBIENT_BPM, 8, (t, beat, bar) => {
        if (beat === 0 && bar % 2 === 0) pad(ctx, hall, t, progression[(bar / 2) % 4], b * 8, 1, 900)
        if (beat % 2 === 0 && random() > 0.35) bell(ctx, hall, t + random() * 0.2, pentatonic[Math.floor(random() * pentatonic.length)], 0.35, 2.4)
        if (beat === 0 && bar % 2 === 0) bass(ctx, hall, t, progression[(bar / 2) % 4][0] - 12, b * 7, 0.35, 220)
      })
    },
  },
  {
    id: 'music:electro',
    kind: 'music',
    bpm: ELECTRO_BPM,
    label: 'Électro énergique',
    mood: 'Rythmé, pour un trailer',
    duration: loopLength(ELECTRO_BPM, 8),
    loop: true,
    build(ctx) {
      const out = master(ctx, 0.78)
      const b = 60 / ELECTRO_BPM
      // Effet « pompe » : la nappe s'efface à chaque temps de grosse caisse.
      const pump = ctx.createGain()
      pump.connect(reverb(ctx, out, 1.5, 0.25))
      const echo = delay(ctx, out, b * 0.75, 0.35, 0.22)
      const progression = [chord('A3', 'C4', 'E4'), chord('F3', 'A3', 'C4'), chord('C4', 'E4', 'G4'), chord('G3', 'B3', 'D4')]
      beats(ELECTRO_BPM, 8, (t, beat, bar) => {
        const c = progression[bar % 4]
        pump.gain.setValueAtTime(0.15, t)
        pump.gain.linearRampToValueAtTime(1, t + b * 0.7)
        if (beat === 0) pad(ctx, pump, t, c, b * 4, 1.1, 2200)
        kick(ctx, out, t, 1)
        if (beat === 1 || beat === 3) clap(ctx, out, t, 0.55)
        hat(ctx, out, t + b / 2, 0.5, true)
        for (let i = 0; i < 4; i++) {
          if (i % 2 === 1) bass(ctx, out, t + (i * b) / 4, c[0] - 24 + (i === 3 ? 12 : 0), b * 0.22, 0.85, 900)
          if (bar >= 2) pluck(ctx, echo, t + (i * b) / 4, [c[0], c[2], c[1] + 12, c[2]][i] + 12, 0.55, 'sawtooth', 0.18)
        }
      })
    },
  },
  {
    id: 'music:synthwave',
    kind: 'music',
    bpm: SYNTH_BPM,
    label: 'Synthwave rétro',
    mood: 'Années 80, néons et jeux vidéo',
    duration: loopLength(SYNTH_BPM, 8),
    loop: true,
    build(ctx) {
      const out = master(ctx, 0.8)
      const big = reverb(ctx, out, 2.8, 0.45)
      const echo = delay(ctx, out, (60 / SYNTH_BPM) * 0.5, 0.4, 0.25)
      const b = 60 / SYNTH_BPM
      const progression = [chord('A3', 'C4', 'E4'), chord('F3', 'A3', 'C4'), chord('C4', 'E4', 'G4'), chord('G3', 'B3', 'D4')]
      beats(SYNTH_BPM, 8, (t, beat, bar) => {
        const c = progression[bar % 4]
        if (beat === 0) pad(ctx, big, t, c, b * 4, 0.9, 1500)
        if (beat === 0 || beat === 2) kick(ctx, out, t, 0.85)
        if (beat === 1 || beat === 3) snare(ctx, big, t, 0.7)
        hat(ctx, out, t, 0.3)
        hat(ctx, out, t + b / 2, 0.3)
        for (let i = 0; i < 2; i++) pluck(ctx, out, t + (i * b) / 2, c[0] - 12, 0.9, 'sawtooth', 0.22)
        for (let i = 0; i < 4; i++) pluck(ctx, echo, t + (i * b) / 4, [c[0], c[1], c[2], c[1]][i] + 12, 0.4, 'square', 0.15)
      })
    },
  },
  {
    id: 'music:cinematic',
    kind: 'music',
    bpm: CINE_BPM,
    label: 'Montée cinématique',
    mood: 'Tension qui monte puis impact final',
    duration: loopLength(CINE_BPM, 8) + 3,
    loop: false,
    build(ctx) {
      const out = master(ctx, 0.85)
      const hall = reverb(ctx, out, 3.5, 0.45)
      const b = 60 / CINE_BPM
      const length = loopLength(CINE_BPM, 8)
      drone(ctx, hall, 0, note('D2'), length + 0.5, 1)
      const progression = [chord('D3', 'F3', 'A3'), chord('Bb2', 'D3', 'F3'), chord('F3', 'A3', 'C4'), chord('C3', 'E3', 'G3')]
      beats(CINE_BPM, 8, (t, beat, bar) => {
        if (beat === 0 && bar % 2 === 0) pad(ctx, hall, t, progression[(bar / 2) % 4], b * 8, 0.9, 700 + bar * 180)
        // Les percussions se densifient au fil des mesures.
        if (bar >= 2 && beat === 0) tom(ctx, hall, t, 0.7, 70)
        if (bar >= 4 && beat === 2) tom(ctx, hall, t, 0.6, 85)
        if (bar >= 6) tom(ctx, hall, t + b / 2, 0.5, 110)
      })
      sweep(ctx, hall, length - b * 8, b * 8, 300, 6000, 0.35)
      kick(ctx, hall, length, 1.2, 0.6)
      tom(ctx, hall, length, 1, 45)
      sweep(ctx, hall, length, 1.5, 3000, 200, 0.5)
    },
  },
]

// --- Bruitages -----------------------------------------------------------------

function sfx(id: string, label: string, mood: string, duration: number, build: (ctx: Ctx, out: AudioNode) => void): SoundDef {
  return { id: `sfx:${id}`, kind: 'sfx', label, mood, duration, loop: false, build: (ctx) => build(ctx, master(ctx, 0.9)) }
}

function tone(ctx: Ctx, out: AudioNode, t: number, freq: number, dur: number, level: number, type: OscillatorType = 'sine', glideTo?: number): void {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.6)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(level, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function tick(ctx: Ctx, out: AudioNode, t: number, freq: number, level: number): void {
  tone(ctx, out, t, freq, 0.03, level, 'square')
  hat(ctx, out, t, level * 1.5)
}

export const SFX: SoundDef[] = [
  sfx('whoosh', 'Whoosh', 'Passage rapide, transition', 1, (ctx, out) => sweep(ctx, reverb(ctx, out, 1, 0.2), 0.02, 0.85, 350, 4500, 0.9, [-0.7, 0.7])),
  sfx('swoosh', 'Swoosh court', 'Apparition d’un élément', 0.5, (ctx, out) => sweep(ctx, out, 0.01, 0.38, 700, 7000, 0.8, [0.4, -0.4])),
  sfx('pop', 'Pop', 'Bulle qui apparaît', 0.3, (ctx, out) => {
    tone(ctx, out, 0, 320, 0.14, 0.7, 'sine', 1300)
    hat(ctx, out, 0, 0.6)
  }),
  sfx('click', 'Clic', 'Bouton, interface', 0.15, (ctx, out) => tick(ctx, out, 0.005, 2200, 0.5)),
  sfx('mouse', 'Clic de souris', 'Tutoriel logiciel', 0.3, (ctx, out) => {
    tick(ctx, out, 0.005, 1800, 0.55)
    tick(ctx, out, 0.085, 1400, 0.4)
  }),
  sfx('ding', 'Ding', 'Idée, bonne réponse', 2, (ctx, out) => bell(ctx, reverb(ctx, out, 1.5, 0.3), 0, note('E6'), 0.9, 1.6)),
  sfx('notification', 'Notification', 'Message reçu', 1.6, (ctx, out) => {
    const room = reverb(ctx, out, 1.2, 0.25)
    bell(ctx, room, 0, note('E6'), 0.7, 0.9)
    bell(ctx, room, 0.14, note('A6'), 0.7, 1.2)
  }),
  sfx('success', 'Succès', 'Validation, tâche réussie', 1.6, (ctx, out) => {
    const room = reverb(ctx, out, 1.4, 0.3)
    ;['C5', 'E5', 'G5', 'C6'].forEach((n, i) => pluck(ctx, room, i * 0.09, note(n), 1, 'triangle', 0.6))
  }),
  sfx('error', 'Erreur', 'Action refusée', 0.8, (ctx, out) => {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 1500
    f.connect(out)
    tone(ctx, f, 0, midiHz('A3'), 0.18, 0.5, 'square')
    tone(ctx, f, 0.2, midiHz('F3'), 0.35, 0.5, 'square')
  }),
  sfx('riser', 'Riser', 'Montée de tension avant un impact', 2.6, (ctx, out) => {
    sweep(ctx, out, 0, 2.5, 200, 9000, 0.7)
    tone(ctx, out, 0, 110, 2.5, 0.2, 'sawtooth', 880)
  }),
  sfx('impact', 'Impact', 'Coup sourd, révélation du titre', 2.8, (ctx, out) => {
    const hall = reverb(ctx, out, 2.5, 0.45)
    kick(ctx, hall, 0, 1.3, 0.6)
    tom(ctx, hall, 0, 1, 42)
    sweep(ctx, hall, 0, 1.2, 2500, 200, 0.6)
  }),
  sfx('glitch', 'Glitch', 'Bug numérique, effet technique', 0.7, (ctx, out) => {
    const random = rng(3)
    for (let t = 0; t < 0.55; t += 0.025 + random() * 0.04) {
      if (random() > 0.4) tone(ctx, out, t, 200 + random() * 1800, 0.03 + random() * 0.03, 0.25, 'square')
      else hat(ctx, out, t, 0.8)
    }
  }),
  sfx('typing', 'Clavier', 'Frappe au clavier (texte tapé)', 2.3, (ctx, out) => {
    const random = rng(9)
    for (let t = 0.02; t < 1.9; t += 0.07 + random() * 0.09) tick(ctx, out, t, 900 + random() * 900, 0.25 + random() * 0.2)
    bell(ctx, out, 2, note('A6'), 0.5, 0.25)
  }),
  sfx('beep', 'Bip', 'Signal court', 0.3, (ctx, out) => tone(ctx, out, 0, 880, 0.18, 0.5)),
  sfx('countdown', 'Compte à rebours', 'Trois bips puis le départ', 3.6, (ctx, out) => {
    for (const t of [0, 1, 2]) tone(ctx, out, t, 660, 0.2, 0.5)
    tone(ctx, out, 3, 1320, 0.5, 0.55)
  }),
  sfx('shutter', 'Déclencheur photo', 'Capture d’écran', 0.4, (ctx, out) => {
    hat(ctx, out, 0, 1.2)
    clap(ctx, out, 0.06, 0.4)
  }),
]

function midiHz(name: string): number {
  return 440 * 2 ** ((note(name) - 69) / 12)
}

export const SOUNDS: SoundDef[] = [...MUSIC, ...SFX]

export function findSound(id: string): SoundDef | undefined {
  return SOUNDS.find((s) => s.id === id)
}

export const SAMPLE_RATE = 48000

/** Niveau crête visé (≈ −1,4 dBFS) : pas de saturation, et des sons au même niveau. */
const TARGET_PEAK = 0.85

/** Calcule le son (moins d'une seconde pour une musique), normalisé en crête. */
export async function renderSound(def: SoundDef): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(def.duration * SAMPLE_RATE), SAMPLE_RATE)
  def.build(ctx)
  const buffer = await ctx.startRendering()
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    for (const v of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(v))
  }
  if (peak > 0) {
    const k = TARGET_PEAK / peak
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c)
      for (let i = 0; i < data.length; i++) data[i] *= k
    }
  }
  return buffer
}
