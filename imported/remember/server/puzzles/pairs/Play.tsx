import { useState } from 'react'
import { Done, Item, useDraft, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'
import { itemName } from '../../web/src/play/ItemArt'

const LINK_COLORS = ['#6a3fb5', '#1f7a8c', '#c0572b', '#2b7a3d', '#a8326e', '#5d6b1f', '#30519c', '#8a5a3b', '#4b4b4b', '#b08a12']

export default function PairsPlay({ trial, phase, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const [pairs, setPairs] = useState<Answer>([])
  const [open, setOpen] = useState<number | null>(null)
  useDraft(pairs, onDraft, phase)
  const cards = trial.study.cards
  const shown = review ? review.answer ?? [] : pairs
  const pairOf = new Map<number, number>()
  shown.forEach(([a, b], i) => (pairOf.set(a, i), pairOf.set(b, i)))
  const cols = cards.length > 12 ? 5 : 4

  const tap = (i: number) => {
    if (phase !== 'answer') return
    if (pairOf.has(i)) {
      const pi = pairOf.get(i)!
      setPairs((ps) => ps.filter((_, j) => j !== pi))
      return
    }
    if (open === null) setOpen(i)
    else if (open === i) setOpen(null)
    else {
      setPairs((ps) => [...ps, [open, i]])
      setOpen(null)
    }
  }

  return (
    <>
      <div className="board grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cards.map((c, i) => {
          const pi = pairOf.get(i)
          const right = review && pi !== undefined ? review.key[shown[pi][0]] === shown[pi][1] : null
          const faceUp = phase === 'study' || phase === 'review'
          return (
            <button
              key={i}
              className="cell"
              disabled={phase !== 'answer'}
              onClick={() => tap(i)}
              aria-label={faceUp ? itemName(c) : pi !== undefined ? `Card ${i + 1}, in pair ${pi + 1}` : open === i ? `Card ${i + 1}, selected` : `Card ${i + 1}`}
              style={{
                aspectRatio: '3 / 4',
                background: faceUp ? 'var(--panel)' : open === i ? 'var(--accent-soft)' : 'var(--accent)',
                boxShadow:
                  right === true ? 'inset 0 0 0 3px var(--right)' : right === false ? 'inset 0 0 0 3px var(--wrong)' : pi !== undefined ? `inset 0 0 0 4px ${LINK_COLORS[pi % LINK_COLORS.length]}` : open === i ? 'inset 0 0 0 3px var(--accent)' : 'inset 0 0 0 1px var(--line)',
              }}
            >
              {faceUp ? <Item id={c} size={30} /> : pi !== undefined ? <span className="rounded-full bg-[var(--panel)] px-2 text-sm font-extrabold" style={{ color: LINK_COLORS[pi % LINK_COLORS.length] }}>{pi + 1}</span> : <span className="text-xl font-bold text-[var(--accent-ink)] opacity-80">?</span>}
              {review && pi !== undefined && <span className="mark">{right ? '✓' : '×'} {pi + 1}</span>}
            </button>
          )
        })}
      </div>
      {phase === 'answer' && (
        <>
          <p className="counter mt-3">
            {pairs.length} of {cards.length / 2} pairs linked · tap two cards to pair them, tap a pair to undo
          </p>
          <Done onClick={() => onSubmit(pairs)} disabled={pairs.length === 0} />
        </>
      )}
      {phase === 'review' && <p className="counter mt-3">Numbers show your pairs. Green outline: a real pair. Red: not a pair.</p>}
    </>
  )
}
