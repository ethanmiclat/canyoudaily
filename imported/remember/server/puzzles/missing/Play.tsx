import { useState } from 'react'
import { Done, Item, useDraft, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'

function Tray({ items }: { items: string[] }) {
  return (
    <div className="board rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="grid grid-cols-4 gap-2">
        {items.map((x) => (
          <div key={x} className="grid aspect-square place-items-center rounded-xl bg-[var(--panel-2)]">
            <Item id={x} size={34} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MissingPlay({ trial, phase, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const [picked, setPicked] = useState<number[]>([])
  useDraft(picked, onDraft, phase)
  const { options, remaining, pick } = trial.test
  const answer = new Set(review ? review.answer ?? [] : picked)
  const key = new Set(review?.key ?? [])

  if (phase === 'study') return <Tray items={trial.study.items} />

  const toggle = (i: number) => phase === 'answer' && setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))
  return (
    <>
      <Tray items={remaining} />
      <p className="mt-4 font-semibold">{pick > 1 ? `${pick} things are gone. Which?` : 'What is gone?'}</p>
      <div className="mt-2 grid w-full max-w-[420px] grid-cols-4 gap-2">
        {options.map((o, i) => {
          let cls = 'cell'
          if (phase === 'answer' && answer.has(i)) cls += ' is-picked'
          if (phase === 'review') {
            if (key.has(i) && answer.has(i)) cls += ' is-hit'
            else if (key.has(i)) cls += ' is-miss'
            else if (answer.has(i)) cls += ' is-wrong'
          }
          return (
            <button key={o} className={cls} disabled={phase !== 'answer'} aria-pressed={phase === 'answer' ? answer.has(i) : undefined} onClick={() => toggle(i)}>
              <Item id={o} size={30} />
            </button>
          )
        })}
      </div>
      {phase === 'answer' && <Done onClick={() => onSubmit(picked)} disabled={picked.length === 0} />}
      {phase === 'review' && <p className="counter mt-3">Green: gone and picked. Outlined: gone but missed. Red: was still there.</p>}
    </>
  )
}
