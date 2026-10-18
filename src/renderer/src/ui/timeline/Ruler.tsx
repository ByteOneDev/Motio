import { formatTime } from '../labels'

const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60]

/** Graduations : un libellé au moins tous les 64 px, cinq sous-graduations entre deux libellés. */
export function Ruler({ pps, duration, beats = [] }: { pps: number; duration: number; beats?: number[] }) {
  const step = STEPS.find((s) => s * pps >= 64) ?? 60
  const minor = step / 5
  const ticks: { t: number; major: boolean }[] = []
  for (let i = 0; i * minor <= duration + 1e-6; i++) ticks.push({ t: i * minor, major: i % 5 === 0 })

  // Les temps ne s'affichent que s'ils sont assez espacés pour rester lisibles.
  const showBeats = beats.length > 1 && (beats[1] - beats[0]) * pps >= 6
  return (
    <div className="relative h-full flex-1">
      {showBeats &&
        beats.map((t) => (
          <div key={t} className="absolute top-0 h-1.5 w-px bg-amber-300/80" style={{ left: t * pps }} title="Temps de la musique" />
        ))}
      {ticks.map(({ t, major }) => (
        <div key={t} className="absolute bottom-0" style={{ left: t * pps }}>
          <div className={`w-px ${major ? 'h-2.5 bg-ui-muted/70' : 'h-1.5 bg-ui-line'}`} />
          {major && (
            <span className="absolute bottom-3 left-1 text-[10px] whitespace-nowrap text-ui-faint tabular-nums">
              {step < 1 ? formatTime(t).replace(/^0:0?/, '') : formatTime(t).replace(/\.00$/, '')}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
