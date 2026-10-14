import { useState } from 'react'
import { Item, useDraft, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'
import { itemName } from '../../web/src/play/ItemArt'

function Row({ items, marks, label }: { items: (string | null)[]; marks?: (boolean | null)[]; label?: string }) {
  return (
    <div className="grid w-full justify-items-center gap-1">
      {label && <span className="label">{label}</span>}
      <ol className="flex flex-wrap justify-center gap-1.5">
        {items.map((x, i) => (
          <li
            key={i}
            className="relative grid h-[58px] w-[50px] place-items-center rounded-xl border-2 bg-[var(--panel)]"
            style={{ borderColor: marks?.[i] === true ? 'var(--right)' : marks?.[i] === false ? 'var(--wrong)' : 'var(--line)', borderStyle: x ? 'solid' : 'dashed' }}
          >
            <span className="tile-label">{i + 1}</span>
            {marks?.[i] !== undefined && marks[i] !== null && <span className="mark absolute bottom-0 right-1 text-xs">{marks[i] ? '✓' : '×'}</span>}
            {x && <Item id={x} size={28} />}
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function ReorderPlay({ trial, phase, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const items = trial.test.items
  const [order, setOrder] = useState<number[]>([])
  useDraft(order, onDraft, phase)

  if (phase === 'study') return <Row items={trial.study.items} label="First → last" />
  if (phase === 'review' && review) {
    const ans = review.answer ?? []
    return (
      <div className="grid w-full gap-4">
        <Row items={review.key.map((i) => items[i])} label="The line-up" />
        <Row items={review.key.map((_, i) => (ans[i] !== undefined ? items[ans[i]] : null))} marks={review.key.map((k, i) => (ans[i] === undefined ? null : ans[i] === k))} label="Yours" />
      </div>
    )
  }

  const tap = (i: number) => {
    if (order.includes(i)) return
    const next = [...order, i]
    setOrder(next)
    if (next.length === items.length) onSubmit(next)
  }
  return (
    <>
      <Row items={items.map((_, i) => (order[i] !== undefined ? items[order[i]] : null))} label="Your line-up" />
      <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Shuffled items">
        {items.map((x, i) => (
          <button key={x} className="cell" style={{ width: 58, opacity: order.includes(i) ? 0.25 : 1 }} disabled={order.includes(i)} onClick={() => tap(i)} aria-label={itemName(x)}>
            <Item id={x} size={30} />
          </button>
        ))}
      </div>
      <div className="actions">
        <button className="btn btn-ghost" onClick={() => setOrder((o) => o.slice(0, -1))} disabled={!order.length}>
          Undo
        </button>
      </div>
      <p className="counter">Tap them in the original order, first to last.</p>
    </>
  )
}
