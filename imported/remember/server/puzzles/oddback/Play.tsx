import { useState } from 'react'
import { Done, Item, useDraft, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'

export default function OddBackPlay({ trial, phase, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const [picked, setPicked] = useState<number[]>([])
  useDraft(picked, onDraft, phase)
  const { grid, count } = trial.test

  if (phase === 'study') {
    return (
      <div className="board flex flex-wrap justify-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
        {trial.study.items.map((x) => (
          <div key={x} className="grid h-[72px] w-[72px] place-items-center rounded-xl bg-[var(--accent-soft)]">
            <Item id={x} size={42} />
          </div>
        ))}
      </div>
    )
  }

  const answer = new Set(review ? review.answer ?? [] : picked)
  const key = new Set(review?.key ?? [])
  const toggle = (i: number) => phase === 'answer' && setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))
  return (
    <>
      <div className="board grid grid-cols-4 gap-2">
        {grid.map((x, i) => {
          let cls = 'cell'
          if (phase === 'answer' && answer.has(i)) cls += ' is-picked'
          if (phase === 'review') {
            if (key.has(i) && answer.has(i)) cls += ' is-hit'
            else if (key.has(i)) cls += ' is-miss'
            else if (answer.has(i)) cls += ' is-wrong'
          }
          return (
            <button key={x} className={cls} disabled={phase !== 'answer'} aria-pressed={phase === 'answer' ? answer.has(i) : undefined} onClick={() => toggle(i)}>
              <Item id={x} size={30} />
            </button>
          )
        })}
      </div>
      {phase === 'answer' && (
        <>
          <p className="counter mt-3">
            {picked.length} picked · you saw {count}
          </p>
          <Done onClick={() => onSubmit(picked)} disabled={picked.length === 0} />
        </>
      )}
    </>
  )
}
