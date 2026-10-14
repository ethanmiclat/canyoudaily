import { useState } from 'react'
import { Done, Item, useDraft, type PlayProps } from '../../web/src/play/kit'
import { ItemArt, itemName } from '../../web/src/play/ItemArt'
import { ROOM_VIEW, RoomBackdrop, roomSpot } from '../../web/src/play/EnvironmentArt'
import type { Answer, Key, Params, Study, Test } from './index'

interface FloorProps {
  cols: number
  rows: number
  room: string
  slots: (string | null)[]
  floor: string
  onSlot?(i: number): void
  /** Per slot outline in review: right, close, wrong. */
  marks?: ('right' | 'close' | 'wrong' | null)[]
  ghosts?: (string | null)[]
}

/** The room in perspective. Each spot is a button standing on the floor; empty spots only show while placing. */
function Floor({ cols, rows, room, slots, floor, onSlot, marks, ghosts }: FloorProps) {
  const spots = slots.map((_, i) => roomSpot(i, cols, rows))
  return (
    <div className="board illustrated-board room-view">
      <svg viewBox={`0 0 ${ROOM_VIEW.w} ${ROOM_VIEW.h}`} className="block w-full" aria-hidden>
        <RoomBackdrop room={room} floor={floor} />
        {spots.map(({ x, y, size }, i) =>
          slots[i] || ghosts?.[i] ? (
            <ellipse key={i} cx={x} cy={y} rx={size * 0.36} ry={size * 0.09} fill="#40394f" opacity=".14" />
          ) : onSlot ? (
            <ellipse key={i} cx={x} cy={y} rx={size * 0.34} ry={size * 0.1} fill="none" stroke="#40394f" strokeWidth=".35" strokeDasharray="1.2 1" opacity=".35" />
          ) : null,
        )}
      </svg>
      {spots.map(({ x, y, size }, i) => {
        const x0 = slots[i], m = marks?.[i]
        const ghost = !x0 && ghosts?.[i]
        if (!x0 && !ghost && !onSlot) return null
        return (
          <button
            key={i}
            className={`room-spot${m ? ` is-${m}` : ''}`}
            disabled={!onSlot}
            onClick={() => onSlot?.(i)}
            aria-label={x0 ? `${itemName(x0)}, spot ${i + 1}` : `Empty spot ${i + 1}`}
            style={{
              left: `${x - size / 2}%`,
              top: `${((y - size * 0.92) / ROOM_VIEW.h) * 100}%`,
              width: `${size}%`,
              height: `${(size / ROOM_VIEW.h) * 100}%`,
            }}
          >
            {m && <span className="mark" aria-hidden>{m === 'right' ? '✓' : m === 'close' ? '≈' : '×'}</span>}
            {x0 ? <ItemArt id={x0} size={100} /> : ghost ? <span style={{ opacity: 0.35 }}><ItemArt id={ghost} size={100} /></span> : null}
          </button>
        )
      })}
    </div>
  )
}

export default function RoomPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { cols, rows, items } = trial.test
  const n = cols * rows
  const floor = String(skin.tokens.floor ?? '#d9b98c')
  const room = String(skin.tokens.room ?? 'lounge')
  const [placed, setPlaced] = useState<number[]>(() => items.map(() => -1))
  const [held, setHeld] = useState<number | null>(null)
  useDraft(placed, onDraft, phase)

  if (phase === 'study') return <Floor cols={cols} rows={rows} room={room} slots={trial.study.slots} floor={floor} />
  if (phase === 'review' && review) {
    const ans = review.answer ?? items.map(() => -1)
    const slots: (string | null)[] = new Array(n).fill(null)
    const marks: ('right' | 'close' | 'wrong' | null)[] = new Array(n).fill(null)
    const ghosts: (string | null)[] = new Array(n).fill(null)
    ans.forEach((s, i) => {
      if (s < 0) return
      slots[s] = items[i]
      const k = review.key[i]
      const close = Math.max(Math.abs((k % cols) - (s % cols)), Math.abs(Math.floor(k / cols) - Math.floor(s / cols))) <= 1
      marks[s] = s === k ? 'right' : close ? 'close' : 'wrong'
    })
    review.key.forEach((k, i) => ans[i] !== k && !slots[k] && (ghosts[k] = items[i]))
    return (
      <div className="grid w-full justify-items-center gap-2">
        <Floor cols={cols} rows={rows} room={room} slots={slots} floor={floor} marks={marks} ghosts={ghosts} />
        <p className="counter">Green: right spot. Purple: nearby. Red: wrong spot. Faded: where it really went.</p>
      </div>
    )
  }

  const slots: (string | null)[] = new Array(n).fill(null)
  placed.forEach((s, i) => s >= 0 && (slots[s] = items[i]))
  const tapSlot = (s: number) => {
    const occupant = placed.indexOf(s)
    if (held === null) {
      // Pick a placed thing back up.
      if (occupant >= 0) {
        setPlaced((p) => p.map((x, i) => (i === occupant ? -1 : x)))
        setHeld(occupant)
      }
      return
    }
    setPlaced((p) => p.map((x, i) => (i === held ? s : i === occupant ? -1 : x)))
    setHeld(occupant >= 0 && occupant !== held ? occupant : null)
  }
  const pile = items.map((_, i) => i).filter((i) => placed[i] < 0)
  return (
    <>
      <Floor cols={cols} rows={rows} room={room} slots={slots} floor={floor} onSlot={tapSlot} />
      <div className="mt-3 flex min-h-[58px] flex-wrap justify-center gap-2" role="group" aria-label="Pile">
        {pile.map((i) => (
          <button
            key={i}
            className="cell"
            style={{ width: 56, boxShadow: held === i ? '0 0 0 3px var(--accent)' : undefined }}
            aria-pressed={held === i}
            aria-label={`Pick up ${itemName(items[i])}`}
            onClick={() => setHeld(held === i ? null : i)}
          >
            <Item id={items[i]} size={36} />
          </button>
        ))}
        {pile.length === 0 && <span className="counter self-center">Everything is placed. Tap a thing in the room to move it.</span>}
      </div>
      <p className="counter mt-2">{held !== null ? `Now tap the spot for ${itemName(items[held])}` : 'Tap a thing, then its spot.'}</p>
      <Done onClick={() => onSubmit(placed)} disabled={placed.every((x) => x < 0)} />
    </>
  )
}
