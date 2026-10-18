/**
 * Petit synthétiseur pour fabriquer musiques et bruitages sans fichier ni licence : tout est
 * calculé par Web Audio dans un OfflineAudioContext. Le hasard est « graine fixe » pour que
 * le même son soit identique à chaque génération (aperçu = export).
 */

export type Ctx = BaseAudioContext

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const midi = (note: number) => 440 * 2 ** ((note - 69) / 12)

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** 'A3', 'C#4', 'Bb2' → numéro MIDI. */
export function note(name: string): number {
  const m = name.match(/^([A-G])([#b]?)(-?\d)$/)
  if (!m) throw new Error(`Note inconnue : ${name}`)
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + accidental
}

const noiseCache = new WeakMap<Ctx, AudioBuffer>()

function noise(ctx: Ctx): AudioBuffer {
  let buf = noiseCache.get(ctx)
  if (!buf) {
    const random = rng(7)
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1
    noiseCache.set(ctx, buf)
  }
  return buf
}

function noiseSource(ctx: Ctx, t: number, duration: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  src.loop = true
  // Point de départ dans le bruit dérivé de l'instant : varié, mais identique à chaque génération.
  src.start(t, (t * 7.31) % 1.5)
  src.stop(t + duration + 0.05)
  return src
}

/** Enveloppe attaque / déclin exponentiel sur un gain. */
function envelope(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.001, attack))
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function gainNode(ctx: Ctx, out: AudioNode, value = 1): GainNode {
  const g = ctx.createGain()
  g.gain.value = value
  g.connect(out)
  return g
}

function filter(ctx: Ctx, out: AudioNode, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = q
  f.connect(out)
  return f
}

function panner(ctx: Ctx, out: AudioNode, pan: number): StereoPannerNode {
  const p = ctx.createStereoPanner()
  p.pan.value = pan
  p.connect(out)
  return p
}

// --- Effets ------------------------------------------------------------------

/** Réverbération : réponse impulsionnelle de bruit qui décroît. */
export function reverb(ctx: Ctx, out: AudioNode, seconds = 2.5, wet = 0.3): AudioNode {
  const random = rng(42)
  const length = Math.floor(ctx.sampleRate * seconds)
  const ir = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c)
    for (let i = 0; i < length; i++) data[i] = (random() * 2 - 1) * (1 - i / length) ** 3
  }
  const input = ctx.createGain()
  const conv = ctx.createConvolver()
  conv.buffer = ir
  input.connect(gainNode(ctx, out, 1 - wet * 0.5))
  input.connect(conv)
  conv.connect(gainNode(ctx, out, wet))
  return input
}

/** Écho stéréo avec réinjection. */
export function delay(ctx: Ctx, out: AudioNode, time: number, feedback = 0.35, wet = 0.3): AudioNode {
  const input = ctx.createGain()
  input.connect(out)
  const d = ctx.createDelay(2)
  d.delayTime.value = time
  const fb = gainNode(ctx, d, feedback)
  d.connect(fb)
  input.connect(d)
  d.connect(panner(ctx, gainNode(ctx, out, wet), 0.4))
  return input
}

/** Sortie maîtresse : compresseur doux pour un niveau homogène. */
export function master(ctx: Ctx, volume = 0.8): AudioNode {
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 3
  comp.attack.value = 0.005
  comp.release.value = 0.2
  comp.connect(gainNode(ctx, ctx.destination, volume))
  return comp
}

// --- Batterie ------------------------------------------------------------------

export function kick(ctx: Ctx, out: AudioNode, t: number, level = 1, tone = 1): void {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(150 * tone, t)
  o.frequency.exponentialRampToValueAtTime(42 * tone, t + 0.13)
  const g = gainNode(ctx, out)
  envelope(g, t, level, 0.002, 0.42)
  o.connect(g)
  o.start(t)
  o.stop(t + 0.5)
  // Attaque (clic) pour qu'il passe sur de petits haut-parleurs.
  const click = gainNode(ctx, filter(ctx, out, 'highpass', 2500))
  envelope(click, t, level * 0.25, 0.001, 0.015)
  noiseSource(ctx, t, 0.03).connect(click)
}

export function snare(ctx: Ctx, out: AudioNode, t: number, level = 1): void {
  const n = gainNode(ctx, filter(ctx, filter(ctx, out, 'highpass', 900), 'bandpass', 2200, 0.6))
  envelope(n, t, level * 0.8, 0.001, 0.2)
  noiseSource(ctx, t, 0.25).connect(n)
  const body = ctx.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime(220, t)
  body.frequency.exponentialRampToValueAtTime(160, t + 0.08)
  const bg = gainNode(ctx, out)
  envelope(bg, t, level * 0.5, 0.001, 0.12)
  body.connect(bg)
  body.start(t)
  body.stop(t + 0.2)
}

export function clap(ctx: Ctx, out: AudioNode, t: number, level = 1): void {
  const f = filter(ctx, out, 'bandpass', 1300, 0.9)
  for (const dt of [0, 0.011, 0.022]) {
    const g = gainNode(ctx, f)
    envelope(g, t + dt, level * (dt === 0.022 ? 1 : 0.6), 0.001, dt === 0.022 ? 0.18 : 0.01)
    noiseSource(ctx, t + dt, 0.2).connect(g)
  }
}

export function hat(ctx: Ctx, out: AudioNode, t: number, level = 1, open = false): void {
  const g = gainNode(ctx, filter(ctx, out, 'highpass', 7500))
  envelope(g, t, level * 0.35, 0.001, open ? 0.28 : 0.045)
  noiseSource(ctx, t, open ? 0.35 : 0.08).connect(g)
}

/** Tom grave (montée cinématique). */
export function tom(ctx: Ctx, out: AudioNode, t: number, level = 1, freq = 90): void {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(freq * 1.6, t)
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.2)
  const g = gainNode(ctx, out)
  envelope(g, t, level, 0.003, 0.7)
  o.connect(g)
  o.start(t)
  o.stop(t + 0.8)
}

// --- Instruments mélodiques -------------------------------------------------------

export function bass(ctx: Ctx, out: AudioNode, t: number, n: number, dur: number, level = 1, cutoff = 700): void {
  const f = filter(ctx, out, 'lowpass', cutoff, 2)
  f.frequency.setValueAtTime(cutoff * 2.2, t)
  f.frequency.exponentialRampToValueAtTime(cutoff * 0.6, t + Math.min(dur, 0.3))
  const g = gainNode(ctx, f)
  envelope(g, t, level * 0.5, 0.005, Math.max(0.08, dur))
  for (const [type, detune, freq] of [
    ['sawtooth', 0, midi(n)],
    ['sine', 0, midi(n - 12)],
  ] as const) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = detune
    o.connect(g)
    o.start(t)
    o.stop(t + dur + 0.1)
  }
}

/** Nappe : oscillateurs désaccordés, attaque et relâchement lents. */
export function pad(ctx: Ctx, out: AudioNode, t: number, notes: number[], dur: number, level = 1, cutoff = 1400, type: OscillatorType = 'sawtooth'): void {
  const f = filter(ctx, out, 'lowpass', cutoff, 0.5)
  const g = gainNode(ctx, f)
  const attack = Math.min(0.8, dur * 0.35)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(level * 0.12, t + attack)
  g.gain.setValueAtTime(level * 0.12, t + dur - 0.05)
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.9)
  for (const n of notes) {
    for (const detune of [-9, 9]) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = midi(n)
      o.detune.value = detune
      o.connect(g)
      o.start(t)
      o.stop(t + dur + 1)
    }
  }
}

/** Corde pincée / synthé « pluck » pour les arpèges. */
export function pluck(ctx: Ctx, out: AudioNode, t: number, n: number, level = 1, type: OscillatorType = 'square', decay = 0.35): void {
  const f = filter(ctx, out, 'lowpass', 3000, 3)
  f.frequency.setValueAtTime(5000, t)
  f.frequency.exponentialRampToValueAtTime(500, t + decay)
  const g = gainNode(ctx, f)
  envelope(g, t, level * 0.22, 0.002, decay)
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = midi(n)
  o.connect(g)
  o.start(t)
  o.stop(t + decay + 0.1)
}

/** Piano électrique (type Rhodes) : sinus + harmonique, léger trémolo. */
export function keys(ctx: Ctx, out: AudioNode, t: number, n: number, dur: number, level = 1): void {
  const g = gainNode(ctx, out)
  envelope(g, t, level * 0.18, 0.004, Math.max(0.4, dur * 1.4))
  const trem = ctx.createOscillator()
  trem.frequency.value = 4.5
  const tremDepth = ctx.createGain()
  tremDepth.gain.value = level * 0.03
  tremDepth.connect(g.gain)
  trem.connect(tremDepth)
  trem.start(t)
  trem.stop(t + dur * 1.5 + 0.2)
  for (const [ratio, amp] of [
    [1, 1],
    [2, 0.25],
    [3, 0.08],
  ]) {
    const o = ctx.createOscillator()
    o.type = ratio === 1 ? 'sine' : 'triangle'
    o.frequency.value = midi(n) * ratio
    const og = gainNode(ctx, g, amp)
    o.connect(og)
    o.start(t)
    o.stop(t + dur * 1.5 + 0.2)
  }
}

/** Cloche FM (carillons, notifications). */
export function bell(ctx: Ctx, out: AudioNode, t: number, n: number, level = 1, decay = 1.6): void {
  const carrier = ctx.createOscillator()
  carrier.frequency.value = midi(n)
  const mod = ctx.createOscillator()
  mod.frequency.value = midi(n) * 3.5
  const index = ctx.createGain()
  index.gain.setValueAtTime(midi(n) * 2, t)
  index.gain.exponentialRampToValueAtTime(1, t + decay)
  mod.connect(index)
  index.connect(carrier.frequency)
  const g = gainNode(ctx, out)
  envelope(g, t, level * 0.25, 0.002, decay)
  carrier.connect(g)
  for (const o of [carrier, mod]) {
    o.start(t)
    o.stop(t + decay + 0.1)
  }
}

/** Souffle filtré qui balaie le spectre (whoosh). */
export function sweep(ctx: Ctx, out: AudioNode, t: number, dur: number, from: number, to: number, level = 1, pan: [number, number] = [0, 0]): void {
  const p = ctx.createStereoPanner()
  p.pan.setValueAtTime(pan[0], t)
  p.pan.linearRampToValueAtTime(pan[1], t + dur)
  p.connect(out)
  const f = filter(ctx, p, 'bandpass', from, 1.4)
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6)
  f.frequency.exponentialRampToValueAtTime(from, t + dur)
  const g = gainNode(ctx, f)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(level, t + dur * 0.55)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  noiseSource(ctx, t, dur).connect(g)
}

/** Bourdonnement grave tenu (cinématique). */
export function drone(ctx: Ctx, out: AudioNode, t: number, n: number, dur: number, level = 1): void {
  const f = filter(ctx, out, 'lowpass', 300, 1)
  f.frequency.setValueAtTime(200, t)
  f.frequency.linearRampToValueAtTime(900, t + dur)
  const g = gainNode(ctx, f)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(level * 0.25, t + dur * 0.4)
  g.gain.linearRampToValueAtTime(0.0001, t + dur)
  for (const [m, d] of [
    [n, -6],
    [n, 6],
    [n + 7, 0],
  ]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = midi(m)
    o.detune.value = d
    o.connect(g)
    o.start(t)
    o.stop(t + dur)
  }
}

/** Grésillement de vinyle (lo-fi). */
export function crackle(ctx: Ctx, out: AudioNode, start: number, dur: number, random: () => number): void {
  const f = filter(ctx, out, 'highpass', 2000)
  for (let t = start; t < start + dur; t += 0.03 + random() * 0.25) {
    const g = gainNode(ctx, f)
    envelope(g, t, 0.04 + random() * 0.06, 0.0005, 0.004)
    noiseSource(ctx, t, 0.01).connect(g)
  }
}
