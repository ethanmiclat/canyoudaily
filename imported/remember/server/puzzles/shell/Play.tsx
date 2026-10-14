import { useState } from 'react'
import { useElapsed, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'
import { ItemArt } from '../../web/src/play/ItemArt'

const W = 100 // slot width in svg units
const H = 120

function Cover({ kind, lifted }: { kind: string; lifted: boolean }) {
  const y = lifted ? -34 : 0
  if (kind === 'chest')
    return (
      <g transform={`translate(0 ${y})`}>
        <rect x="-34" y="44" width="68" height="44" rx="6" fill="#bd9d75" stroke="#624c43" strokeWidth="3" />
        <path d="M-31 64h62m-62 12h62M-21 46v39m42-39v39" stroke="#896451" strokeWidth="1.7"/>
        <path d="M-34 52q34-26 68 0v-6q-34-24-68 0Z" fill="#d9b88b" stroke="#624c43" strokeWidth="3" />
        <rect x="-6" y="56" width="12" height="14" rx="2" fill="#efc34c" stroke="#624c43" strokeWidth="2" />
        <circle cx="0" cy="63" r="2" fill="#896451"/>
        <path d="M-27 53q15-12 30-11" stroke="#f2e3c0" strokeWidth="2" fill="none"/>
      </g>
    )
  if (kind === 'hat')
    return (
      <g transform={`translate(0 ${y})`}>
        <rect x="-26" y="30" width="52" height="54" rx="4" fill="#2a2638" stroke="#0f0d16" strokeWidth="3" />
        <path d="M-18 37v29" stroke="#b5a5cb" strokeWidth="3" opacity=".45" strokeLinecap="round"/>
        <rect x="-26" y="70" width="52" height="8" fill="#79c4b1" />
        <ellipse cx="0" cy="86" rx="40" ry="8" fill="#2a2638" stroke="#0f0d16" strokeWidth="3" />
      </g>
    )
  return (
    <g transform={`translate(0 ${y})`}>
      <path d="M-24 34h48l12 54h-72Z" fill="#8867d3" stroke="#453362" strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 36h9l11 49H19Z" fill="#7357a7"/>
      <path d="M-28 68h56v8h-56Z" fill="#d7c9e8" opacity=".7"/>
      <rect x="-38" y="84" width="76" height="8" rx="4" fill="#7150c2" stroke="#453362" strokeWidth="2" />
      <path d="M-14 46h28" stroke="#fff" strokeOpacity=".5" strokeWidth="4" strokeLinecap="round" />
    </g>
  )
}

function Prize({ kind }: { kind: string }) {
  if (kind === 'coin') return <ItemArt id="🪙" x={-15} y={58} size={30} />
  if (kind === 'bunny') return <ItemArt id="🐰" x={-15} y={58} size={30} />
  return <g><circle cx="0" cy="76" r="12" fill="#edc56f" stroke="#bd8c46" strokeWidth="2"/><path d="M-8 75q0-7 7-8" fill="none" stroke="#fff8e8" strokeWidth="2" strokeLinecap="round"/></g>
}

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)

/** Each cup's x position (in slots, fractional mid-swap) and lift, at time t of the study animation. */
function layout(study: Study, t: number, reduced: boolean) {
  const { cups, swaps, swapMs, showMs, dropMs } = study
  const slotOf = Array.from({ length: cups }, (_, c) => c)
  const pos = slotOf.map((s) => ({ x: s, y: 0 }))
  const s0 = showMs + dropMs
  const k = Math.floor((t - s0) / swapMs)
  const done = Math.max(0, Math.min(swaps.length, k))
  for (let i = 0; i < done; i++) {
    const [a, b] = swaps[i]
    const ca = slotOf.indexOf(a), cb = slotOf.indexOf(b)
    slotOf[ca] = b
    slotOf[cb] = a
  }
  slotOf.forEach((s, c) => (pos[c] = { x: s, y: 0 }))
  if (t >= s0 && k < swaps.length) {
    const [a, b] = swaps[k]
    const p = ease(((t - s0) % swapMs) / swapMs)
    const ca = slotOf.indexOf(a), cb = slotOf.indexOf(b)
    const arc = reduced ? 0 : Math.sin(p * Math.PI) * 26
    pos[ca] = { x: a + (b - a) * p, y: -arc }
    pos[cb] = { x: b + (a - b) * p, y: arc * 0.6 }
  }
  return { pos, slotOf }
}

export default function ShellPlay({ trial, phase, offsetMs, skin, onSubmit, review, reducedMotion }: PlayProps<Study, Test, Key, Answer, Params>) {
  const study = trial.study
  const cover = String(skin.tokens.cover ?? 'cup')
  const prize = String(skin.tokens.prize ?? 'ball')
  const t = useElapsed(phase === 'study', offsetMs)
  const [picked, setPicked] = useState<number | null>(null)
  const n = study.cups
  const animT = phase === 'study' ? t : Number.MAX_SAFE_INTEGER
  const { pos } = layout(study, animT, reducedMotion)
  const lifting = phase === 'study' && t < study.showMs
  const ballCup = study.ballSlot // cups are identified by starting slot

  // Final slot of each cup, for answer/review.
  const finalSlot = (c: number) => Math.round(pos[c].x)
  const answerSlot = review ? review.answer : picked

  return (
    <>
      <svg viewBox={`0 0 ${n * W} ${H + 10}`} className="board block" role="img" aria-label={phase === 'study' ? 'Cups shuffling' : 'Cups. Tap the one hiding the prize.'}>
        {Array.from({ length: n }, (_, c) => {
          const x = pos[c].x * W + W / 2
          const showPrize = (lifting || (phase === 'review' && review && finalSlot(c) === review.key)) && c === ballCup
          const lifted = lifting || (phase === 'review' && review !== undefined && (finalSlot(c) === review.key || finalSlot(c) === review.answer))
          return (
            <g key={c} transform={`translate(${x} ${pos[c].y + 10})`}>
              {showPrize && <Prize kind={prize} />}
              <Cover kind={cover} lifted={lifted} />
            </g>
          )
        })}
      </svg>
      <div className="mt-2 grid w-full max-w-[420px] gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {Array.from({ length: n }, (_, s) => {
          const right = review && s === review.key
          const wrong = review && s === answerSlot && s !== review.key
          return (
            <button
              key={s}
              className="btn btn-ghost"
              disabled={phase !== 'answer' || picked !== null}
              aria-label={`Cup ${s + 1}`}
              onClick={() => {
                setPicked(s)
                onSubmit(s)
              }}
              style={{
                background: right ? 'var(--right-soft)' : wrong ? 'var(--wrong-soft)' : picked === s ? 'var(--accent-soft)' : undefined,
                borderColor: right ? 'var(--right)' : wrong ? 'var(--wrong)' : undefined,
              }}
            >
              {phase === 'answer' ? `Cup ${s + 1}` : right ? 'Here' : wrong ? 'Your pick' : `${s + 1}`}
            </button>
          )
        })}
      </div>
      <p className="counter mt-2">{phase === 'study' ? (lifting ? 'Watch the prize…' : 'Keep your eye on it.') : phase === 'answer' ? 'Which cup?' : ''}</p>
    </>
  )
}
