import { useCallback, useRef, useState } from 'react'
import { Done, Keypad, useDraft, useElapsed, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'

const FRAMES: Record<string, { title: string; bg: string; fg: string }> = {
  vault: { title: 'VAULT', bg: '#34324b', fg: '#a8daca' },
  phone: { title: 'INCOMING NUMBER', bg: '#25263d', fg: '#efc34c' },
  locker: { title: 'COMBO', bg: '#45576c', fg: '#fbf8f1' },
}

export default function NumberSpanPlay({ trial, phase, offsetMs, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const f = FRAMES[String(skin.tokens.kind)] ?? FRAMES.vault
  const { digits, flashMs, gapMs, leadMs } = trial.study
  const { length, reversed } = trial.test
  const t = useElapsed(phase === 'study', offsetMs)
  const [entry, setEntry] = useState<number[]>([])
  const ref = useRef<number[]>([])
  useDraft(entry, onDraft, phase)
  const update = (next: number[]) => {
    ref.current = next
    setEntry(next)
  }
  const onDigit = useCallback(
    (d: number) => {
      if (ref.current.length >= length) return
      const next = [...ref.current, d]
      update(next)
      if (next.length === length) setTimeout(() => onSubmit(next), 250)
    },
    [length, onSubmit],
  )
  const onBack = useCallback(() => update(ref.current.slice(0, -1)), [])

  if (phase === 'study') {
    const step = Math.floor((t - leadMs) / (flashMs + gapMs))
    const within = (t - leadMs) % (flashMs + gapMs)
    const show = t >= leadMs && step < digits.length && within < flashMs ? digits[step] : null
    return (
      <div className="grid justify-items-center gap-2">
        <div className="big-flash" style={{ background: f.bg, color: f.fg }} aria-live="off">
          <span className="sr-only">{f.title}</span>
          {show ?? <span style={{ opacity: 0.25 }}>·</span>}
        </div>
        <p className="counter">{t < leadMs ? 'Get ready…' : `Digit ${Math.min(step + 1, digits.length)} of ${digits.length}`}</p>
      </div>
    )
  }

  const shown = review ? review.answer ?? [] : entry
  return (
    <>
      <p className="mb-2 font-semibold">{reversed ? 'Enter it backwards: last digit first.' : 'Enter the code.'}</p>
      <div className="slots" style={{ background: f.bg, padding: 10, borderRadius: 14 }}>
        {Array.from({ length }, (_, i) => {
          const cls = review ? (shown[i] === review.key[i] ? 'is-right' : 'is-wrong') : i === entry.length ? 'is-current' : ''
          return (
            <span key={i} className={`slot ${cls}`} style={{ width: 36 }}>
              <span>
                {shown[i] ?? ''}
                {review && shown[i] !== review.key[i] && <small>{review.key[i]}</small>}
              </span>
            </span>
          )
        })}
      </div>
      {phase === 'answer' && (
        <>
          <Keypad onDigit={onDigit} onBack={onBack} />
          <Done onClick={() => onSubmit(entry)} disabled={!entry.length}>
            Enter
          </Done>
        </>
      )}
    </>
  )
}
