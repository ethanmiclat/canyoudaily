import { useCallback, useRef, useState } from 'react'
import { Done, Keypad, useDraft, type PlayProps } from '../../web/src/play/kit'
import { Glyph } from '../../web/src/play/Glyph'
import type { Answer, Key, Params, Study, Test } from './index'

export default function CipherPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const style = String(skin.tokens.style ?? 'ink')
  const [digits, setDigits] = useState<number[]>([])
  useDraft(digits, onDraft, phase)
  const msg = trial.test.message

  const ref = useRef<number[]>([])
  const update = (next: number[]) => {
    ref.current = next
    setDigits(next)
  }
  const onDigit = useCallback(
    (d: number) => {
      if (ref.current.length >= msg.length) return
      const next = [...ref.current, d]
      update(next)
      if (next.length === msg.length) setTimeout(() => onSubmit(next), 250)
    },
    [msg.length, onSubmit],
  )
  const onBack = useCallback(() => update(ref.current.slice(0, -1)), [])

  if (phase === 'study') {
    return (
      <div className="board grid grid-cols-2 gap-3 sm:grid-cols-3">
        {trial.study.key.map((k) => (
          <div key={k.glyph} className="flex items-center justify-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <Glyph id={k.glyph} size={52} style={style} />
            <span className="text-2xl font-black">=</span>
            <span className="display text-4xl font-extrabold">{k.digit}</span>
          </div>
        ))}
      </div>
    )
  }

  const shown = review ? review.answer ?? [] : digits
  return (
    <>
      <div className="slots" aria-label="Message">
        {msg.map((g, i) => {
          const cls = review ? (shown[i] === review.key[i] ? 'is-right' : 'is-wrong') : i === digits.length ? 'is-current' : ''
          return (
            <div key={i} className="grid justify-items-center gap-1">
              <Glyph id={g} size={42} style={style} />
              <span className={`slot ${cls}`}>
                <span>
                  {shown[i] ?? ''}
                  {review && shown[i] !== review.key[i] && <small>{review.key[i]}</small>}
                </span>
              </span>
            </div>
          )
        })}
      </div>
      {phase === 'answer' && (
        <>
          <Keypad onDigit={onDigit} onBack={onBack} />
          <Done onClick={() => onSubmit(digits)} disabled={digits.length === 0}>
            Decode
          </Done>
        </>
      )}
      {phase === 'review' && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {trial.study.key.map((k) => (
            <span key={k.glyph} className="flex items-center gap-1 rounded-lg bg-[var(--panel-2)] px-2 py-1">
              <Glyph id={k.glyph} size={26} style={style} /> = <b>{k.digit}</b>
            </span>
          ))}
        </div>
      )}
    </>
  )
}
