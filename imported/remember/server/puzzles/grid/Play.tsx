import { ItemArt } from '../../web/src/play/ItemArt'
import { useState } from 'react'
import { Cells, Done, useDraft, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'

const LOOK: Record<string, { on: string; off: string; glyph: string }> = {
  tiles: { on: 'var(--lit)', off: 'var(--panel-2)', glyph: '' },
  windows: { on: '#efc34c', off: '#3d3c57', glyph: '' },
  garden: { on: '#a8ceaa', off: '#b19b7c', glyph: '🌼' },
}

export default function GridPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { size } = trial.test
  const look = LOOK[String(skin.tokens.kind)] ?? LOOK.tiles
  const [picked, setPicked] = useState<number[]>([])
  useDraft(picked, onDraft, phase)
  const lit = new Set(trial.study.lit)
  const answer = new Set(review ? review.answer ?? [] : picked)
  const key = new Set(review?.key ?? [])

  const toggle = (i: number) => {
    if (phase !== 'answer') return
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))
  }

  return (
    <>
      <Cells cols={size}>
        {Array.from({ length: size * size }, (_, i) => {
          let cls = 'cell'
          let mark = ''
          if (phase === 'study' && lit.has(i)) cls += ' is-lit'
          if (phase === 'answer' && answer.has(i)) cls += ' is-picked'
          if (phase === 'review') {
            if (key.has(i) && answer.has(i)) (cls += ' is-hit'), (mark = '✓')
            else if (key.has(i)) (cls += ' is-miss'), (mark = 'missed')
            else if (answer.has(i)) (cls += ' is-wrong'), (mark = '✗')
          }
          const on = (phase === 'study' && lit.has(i)) || (phase === 'answer' && answer.has(i))
          return (
            <button
              key={i}
              className={cls}
              disabled={phase !== 'answer'}
              aria-pressed={phase === 'answer' ? answer.has(i) : undefined}
              aria-label={`Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}${phase === 'study' && lit.has(i) ? ', lit' : ''}`}
              onClick={() => toggle(i)}
              style={phase !== 'review' && !on ? { background: look.off } : phase === 'study' && on ? { background: look.on } : undefined}
            >
              {on && look.glyph && <ItemArt id={look.glyph} size={30} />}
              {phase === 'study' && on && !look.glyph && <span aria-hidden>●</span>}
              {mark && <span className="mark">{mark === 'missed' ? '○' : mark}</span>}
            </button>
          )
        })}
      </Cells>
      {phase === 'answer' && (
        <>
          <p className="counter mt-3">
            {picked.length} picked · {trial.test.count} were lit
          </p>
          <Done onClick={() => onSubmit(picked)} />
        </>
      )}
      {phase === 'review' && <Legend />}
    </>
  )
}

export function Legend() {
  return (
    <p className="counter mt-3 text-center">
      <span className="font-bold text-[var(--right)]">✓</span> right · <span className="font-bold text-[var(--right)]">○</span> missed ·{' '}
      <span className="font-bold text-[var(--wrong)]">✗</span> wrong
    </p>
  )
}
