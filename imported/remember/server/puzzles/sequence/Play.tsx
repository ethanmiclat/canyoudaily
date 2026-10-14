import { ItemArt } from '../../web/src/play/ItemArt'
import { useEffect, useRef, useState } from 'react'
import { Shape, useDraft, useElapsed, type PlayProps } from '../../web/src/play/kit'
import { tone } from '../../web/src/lib/sound'
import type { ShapeId } from '../assets'
import type { Answer, Key, Params, Study, Test } from './index'

interface Pad { color: string; shape?: ShapeId; glyph?: string; name: string }

const PADS: Record<string, Pad[]> = {
  lights: [
    { color: 'red', shape: 'circle', name: 'red circle' },
    { color: 'blue', shape: 'square', name: 'blue square' },
    { color: 'yellow', shape: 'triangle', name: 'yellow triangle' },
    { color: 'green', shape: 'diamond', name: 'green diamond' },
  ],
  fireworks: [
    { color: 'purple', shape: 'star', name: 'purple star' },
    { color: 'orange', shape: 'drop', name: 'orange drop' },
    { color: 'blue', shape: 'hexagon', name: 'blue hexagon' },
    { color: 'green', shape: 'heart', name: 'green heart' },
  ],
  holiday: [
    { color: 'red', shape: 'drop', name: 'red bulb' },
    { color: 'green', shape: 'star', name: 'green star' },
    { color: 'yellow', shape: 'circle', name: 'gold bauble' },
    { color: 'blue', shape: 'diamond', name: 'blue diamond' },
  ],
  piano: [
    { color: 'red', glyph: 'C', name: 'note C' },
    { color: 'blue', glyph: 'E', name: 'note E' },
    { color: 'yellow', glyph: 'G', name: 'note G' },
    { color: 'green', glyph: 'C²', name: 'high C' },
  ],
  arrows: [
    { color: 'red', glyph: '←', name: 'left' },
    { color: 'blue', glyph: '↑', name: 'up' },
    { color: 'yellow', glyph: '↓', name: 'down' },
    { color: 'green', glyph: '→', name: 'right' },
  ],
  spooky: [
    { color: 'orange', glyph: '🎃', name: 'pumpkin' },
    { color: 'purple', glyph: '👻', name: 'ghost' },
    { color: 'green', glyph: '🦇', name: 'bat' },
    { color: 'yellow', glyph: '🌙', name: 'moon' },
  ],
}

function PadFace({ pad, size }: { pad: Pad; size: number }) {
  if (pad.shape) return <Shape shape={pad.shape} color={pad.color} size={size} />
  return <ItemArt id={pad.glyph ?? ''} size={size} />
}

export default function SequencePlay({ trial, phase, offsetMs, skin, onDraft, onSubmit, review, reducedMotion }: PlayProps<Study, Test, Key, Answer, Params>) {
  const pads = PADS[String(skin.tokens.kind)] ?? PADS.lights
  const { seq, flashMs, gapMs, leadMs } = trial.study
  const t = useElapsed(phase === 'study', offsetMs)
  const [taps, setTaps] = useState<number[]>([])
  const [pressed, setPressed] = useState<number | null>(null)
  useDraft(taps, onDraft, phase)

  // Which pad is lit during the study phase.
  let lit: number | null = null
  let step = -1
  if (phase === 'study' && t >= leadMs) {
    step = Math.floor((t - leadMs) / (flashMs + gapMs))
    const within = (t - leadMs) % (flashMs + gapMs)
    if (step < seq.length && within < flashMs) lit = seq[step]
  }
  const lastTone = useRef(-1)
  useEffect(() => {
    if (lit !== null && lastTone.current !== step) {
      lastTone.current = step
      tone(lit)
    }
  }, [lit, step])

  const tap = (i: number) => {
    if (phase !== 'answer' || taps.length >= seq.length) return
    tone(i)
    setPressed(i)
    setTimeout(() => setPressed((p) => (p === i ? null : p)), 180)
    const next = [...taps, i]
    setTaps(next)
    if (next.length === seq.length) onSubmit(next)
  }

  if (phase === 'review' && review) {
    const ans = review.answer ?? []
    return (
      <div className="board grid gap-3">
        <SeqRow label="Sequence" items={review.key} pads={pads} />
        <SeqRow label="You" items={ans} pads={pads} marks={review.key.map((k, i) => ans[i] === k)} length={review.key.length} />
      </div>
    )
  }

  return (
    <div className="board">
      <div className="cells" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {pads.map((pad, i) => {
          const on = lit === i || pressed === i
          return (
            <button
              key={i}
              className="cell"
              aria-label={pad.name}
              disabled={phase !== 'answer'}
              onClick={() => tap(i)}
              style={{
                borderRadius: 20,
                background: on ? 'var(--lit)' : 'var(--panel)',
                boxShadow: on ? '0 0 0 4px var(--lit)' : 'inset 0 0 0 2px var(--line)',
                transform: on && !reducedMotion ? 'scale(1.02)' : undefined,
                opacity: phase === 'study' && !on ? 0.55 : 1,
              }}
            >
              <PadFace pad={pad} size={on ? 70 : 60} />
            </button>
          )
        })}
      </div>
      <p className="counter mt-3 text-center" aria-live="polite">
        {phase === 'study' ? (step < 0 ? 'Get ready…' : `Step ${Math.min(step + 1, seq.length)} of ${seq.length}`) : `${taps.length} of ${seq.length} tapped`}
      </p>
    </div>
  )
}

function SeqRow({ label, items, pads, marks, length }: { label: string; items: number[]; pads: Pad[]; marks?: boolean[]; length?: number }) {
  const n = length ?? items.length
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            className="inline-grid h-11 w-11 place-items-center rounded-lg"
            style={{ background: marks ? (marks[i] ? 'var(--right-soft)' : 'var(--wrong-soft)') : 'var(--panel-2)', outline: marks ? `2px solid ${marks[i] ? 'var(--right)' : 'var(--wrong)'}` : undefined }}
          >
            {items[i] !== undefined ? <PadFace pad={pads[items[i]]} size={28} /> : <span className="text-mute">–</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
