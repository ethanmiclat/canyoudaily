import { ItemArt } from '../../web/src/play/ItemArt'
import { useState } from 'react'
import { Done, useDraft, useElapsed, type PlayProps } from '../../web/src/play/kit'
import { neighbors, type Answer, type Key, type Params, type Study, type Test } from './index'

interface FieldProps {
  size: number
  blocked: Set<number>
  block: string
  ground: string
  trail: string
  walker: string
  start: number
  end?: number
  /** Cells in walking order (after the start). */
  steps: number[]
  /** Second trail drawn dashed (review: the real one). */
  ghost?: number[]
  onCell?(c: number): void
  canStep?(c: number): boolean
  marks?: Map<number, boolean>
}

function Field({ size, blocked, block, ground, trail, walker, start, end, steps, ghost, onCell, canStep, marks }: FieldProps) {
  const order = new Map(steps.map((c, i) => [c, i + 1]))
  const head = steps.length ? steps[steps.length - 1] : start
  const center = (c: number) => ({ x: (c % size) + 0.5, y: Math.floor(c / size) + 0.5 })
  const line = (cells: number[]) => [start, ...cells].map((c, i) => `${i ? 'L' : 'M'}${center(c).x} ${center(c).y}`).join(' ')
  return (
    <div className="board relative overflow-hidden rounded-xl" style={{ background: ground }}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {Array.from({ length: size * size }, (_, c) => {
          const isBlock = blocked.has(c)
          const step = order.get(c)
          const m = marks?.get(c)
          const can = canStep?.(c) ?? false
          return (
            <button
              key={c}
              className="relative grid aspect-square min-h-11 place-items-center p-0"
              disabled={!onCell || isBlock || !(can || c === head)}
              onClick={() => onCell?.(c)}
              aria-label={isBlock ? 'Blocked' : c === start ? 'Start' : c === end ? 'End' : step ? `Step ${step}` : can ? 'Step here' : 'Square'}
              style={{
                background: step || c === start ? `color-mix(in srgb, ${trail} ${c === head ? 80 : 45}%, transparent)` : can ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : undefined,
                boxShadow: m === false ? 'inset 0 0 0 3px var(--wrong)' : 'inset 0 0 0 .5px rgba(0,0,0,.08)',
                fontSize: 'clamp(18px, 5.5vw, 28px)',
              }}
            >
              {isBlock || c === head || c === end ? <ItemArt id={isBlock ? block : c === head ? walker : '🏁'} size={28} /> : c === start ? '●' : null}
              {step && c !== head && <span className="tile-label" style={{ color: 'inherit', opacity: 0.7 }}>{step}</span>}
            </button>
          )
        })}
      </div>
      {ghost && (
        <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <path d={line(ghost)} fill="none" stroke="var(--right)" strokeWidth=".12" strokeDasharray=".22 .14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

export default function TrailPlay({ trial, phase, offsetMs, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { size, start, end, blocked: blockedList } = trial.test
  const blocked = new Set(blockedList)
  const tok = { block: String(skin.tokens.block), ground: String(skin.tokens.ground), trail: String(skin.tokens.trail), walker: String(skin.tokens.walker) }
  const t = useElapsed(phase === 'study', offsetMs)
  const [steps, setSteps] = useState<number[]>([])
  useDraft(steps, onDraft, phase)

  if (phase === 'study') {
    const { path, stepMs, leadMs } = trial.study
    const shown = Math.max(0, Math.min(path.length - 1, Math.floor((t - leadMs) / stepMs)))
    return (
      <>
        <Field size={size} blocked={blocked} {...tok} start={start} steps={t < leadMs ? [] : path.slice(1, shown + 1)} />
        <p className="counter mt-2">{t < leadMs ? 'Watch the trail…' : `Step ${shown} of ${path.length - 1}`}</p>
      </>
    )
  }
  if (phase === 'review' && review) {
    const ans = review.answer ?? []
    const onTrail = new Set(review.key)
    return (
      <>
        <Field size={size} blocked={blocked} {...tok} start={start} end={end} steps={ans} ghost={review.key} marks={new Map(ans.map((c) => [c, onTrail.has(c)]))} />
        <p className="counter mt-2">Dashed line: the trail. Red outline: off the trail.</p>
      </>
    )
  }

  const head = steps.length ? steps[steps.length - 1] : start
  const canStep = (c: number) => !blocked.has(c) && c !== start && !steps.includes(c) && neighbors(head, size).includes(c)
  const tap = (c: number) => {
    if (c === head && steps.length) return setSteps((s) => s.slice(0, -1)) // tap the walker to step back
    if (!canStep(c)) return
    const next = [...steps, c]
    setSteps(next)
    if (c === end && next.length >= trial.test.length) onSubmit(next)
  }
  return (
    <>
      <Field size={size} blocked={blocked} {...tok} start={start} end={end} steps={steps} onCell={tap} canStep={canStep} />
      <div className="actions">
        <button className="btn btn-ghost" disabled={!steps.length} onClick={() => setSteps((s) => s.slice(0, -1))}>
          Step back
        </button>
      </div>
      <p className="counter">Tap a square next to the walker. The trail is {trial.test.length} steps.</p>
      <Done onClick={() => onSubmit(steps)} disabled={!steps.length} />
    </>
  )
}
