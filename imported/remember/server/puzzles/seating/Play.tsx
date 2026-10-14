import { ItemArt } from '../../web/src/play/ItemArt'
import { useState } from 'react'
import { Done, useDraft, type PlayProps } from '../../web/src/play/kit'
import { Avatar } from '../../web/src/play/Avatar'
import type { AvatarSpec } from '../nametags/index'
import type { Answer, Key, Params, Study, Test } from './index'

interface TableProps {
  seats: (AvatarSpec | null)[]
  center: string
  table: string
  onSeat?(s: number): void
  marks?: ('right' | 'wrong' | null)[]
}

function Table({ seats, center, table, onSeat, marks }: TableProps) {
  const n = seats.length
  const size = n > 6 ? 62 : 70
  return (
    <div className="board relative aspect-square" style={{ maxWidth: 380 }}>
      <div className="absolute rounded-full" style={{ inset: '24%', background: table, boxShadow: 'inset 0 0 0 6px rgba(0,0,0,.15)' }}>
        <span className="absolute inset-0 grid place-items-center" style={{ fontSize: 44 }} aria-hidden>
          <ItemArt id={center} size={44} />
        </span>
      </div>
      {seats.map((a, s) => {
        const ang = -Math.PI / 2 + (2 * Math.PI * s) / n
        const x = 50 + 38 * Math.cos(ang), y = 50 + 38 * Math.sin(ang)
        const m = marks?.[s]
        return (
          <button
            key={s}
            className="absolute grid place-items-center rounded-full p-0"
            disabled={!onSeat}
            onClick={() => onSeat?.(s)}
            aria-label={`Seat ${s + 1}${s === 0 ? ' (head of the table)' : ''}${a ? ', taken' : ', empty'}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              transform: 'translate(-50%, -50%)',
              background: 'var(--panel)',
              border: `3px ${a ? 'solid' : 'dashed'} ${m === 'right' ? 'var(--right)' : m === 'wrong' ? 'var(--wrong)' : 'var(--line)'}`,
            }}
          >
            {a ? <Avatar a={a} size={size - 8} /> : <span className="text-mute text-sm font-bold">{s + 1}</span>}
            {s === 0 && (
              <span className="absolute -top-3 text-lg" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 1 19 10 10 19 1 10Z" fill="var(--gold)" stroke="var(--ink)"/><path d="M7 10h6" stroke="var(--ink)"/></svg>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function SeatingPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { seats: n, line } = trial.test
  const center = String(skin.tokens.center ?? '🍽️')
  const table = String(skin.tokens.table ?? '#c98f5a')
  const [placed, setPlaced] = useState<number[]>(() => line.map(() => -1))
  const [held, setHeld] = useState<number | null>(null)
  useDraft(placed, onDraft, phase)

  if (phase === 'study') return <Table seats={trial.study.seated} center={center} table={table} />
  if (phase === 'review' && review) {
    const ans = review.answer ?? line.map(() => -1)
    const seats: (AvatarSpec | null)[] = new Array(n).fill(null)
    const marks: ('right' | 'wrong' | null)[] = new Array(n).fill(null)
    ans.forEach((s, p) => {
      if (s < 0) return
      seats[s] = line[p]
      marks[s] = review.key[p] === s ? 'right' : 'wrong'
    })
    const right: (AvatarSpec | null)[] = new Array(n).fill(null)
    review.key.forEach((s, p) => (right[s] = line[p]))
    return (
      <div className="grid w-full justify-items-center gap-2">
        <div className="label">Yours</div>
        <Table seats={seats} center={center} table={table} marks={marks} />
        <div className="label">The seating</div>
        <Table seats={right} center={center} table={table} />
      </div>
    )
  }

  const seats: (AvatarSpec | null)[] = new Array(n).fill(null)
  placed.forEach((s, p) => s >= 0 && (seats[s] = line[p]))
  const tapSeat = (s: number) => {
    const occupant = placed.indexOf(s)
    if (held === null) {
      if (occupant >= 0) {
        setPlaced((ps) => ps.map((x, p) => (p === occupant ? -1 : x)))
        setHeld(occupant)
      }
      return
    }
    setPlaced((ps) => ps.map((x, p) => (p === held ? s : p === occupant ? -1 : x)))
    setHeld(occupant >= 0 && occupant !== held ? occupant : null)
  }
  const waiting = line.map((_, p) => p).filter((p) => placed[p] < 0)
  return (
    <>
      <Table seats={seats} center={center} table={table} onSeat={tapSeat} />
      <div className="mt-3 flex min-h-[64px] flex-wrap justify-center gap-2" role="group" aria-label="Waiting line">
        {waiting.map((p) => (
          <button
            key={p}
            className="cell p-0"
            style={{ width: 60, borderRadius: '50%', boxShadow: held === p ? '0 0 0 3px var(--accent)' : undefined }}
            aria-pressed={held === p}
            aria-label={`Person ${p + 1} in line`}
            onClick={() => setHeld(held === p ? null : p)}
          >
            <Avatar a={line[p]} size={54} />
          </button>
        ))}
      </div>
      <p className="counter mt-2">{held !== null ? 'Now tap their seat.' : 'Tap a person, then their seat. Tap a seated person to move them.'}</p>
      <Done onClick={() => onSubmit(placed)} disabled={placed.every((x) => x < 0)} />
    </>
  )
}
