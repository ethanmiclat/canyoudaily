import { useState } from 'react'
import { Done, useDraft, type PlayProps } from '../../web/src/play/kit'
import { CELL, type Answer, type Key, type Params, type Picture, type Study, type Test } from './index'
import { ItemArt } from '../../web/src/play/ItemArt'

/** The whole picture, or (with `cell`) one square piece of it. */
function Art({ pic, sky, land, cell, size }: { pic: Picture; sky: string; land: string; cell?: number; size?: number | string }) {
  const W = pic.cols * CELL, H = pic.rows * CELL
  const vb = cell === undefined ? `0 0 ${W} ${H}` : `${(cell % pic.cols) * CELL} ${Math.floor(cell / pic.cols) * CELL} ${CELL} ${CELL}`
  const hill = pic.hill.map((y, i) => `${i ? 'L' : 'M'}${i * CELL} ${y}`).join(' ')
  return (
    <svg viewBox={vb} width={size} height={size} className="block" style={cell === undefined ? { width: '100%' } : undefined} aria-hidden>
      <rect width={W} height={H} fill={sky} />
      <path d={`${hill} L${W} ${H} L0 ${H}Z`} fill={land} />
      <path d={hill} fill="none" stroke="rgba(0,0,0,.15)" strokeWidth="3" />
      {pic.objects.map((o, i) => (
        <ItemArt key={i} id={o.glyph} x={o.x - o.size / 2} y={o.y - o.size / 2} size={o.size} />
      ))}
    </svg>
  )
}

export default function JigsawPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { picture: pic, pieces } = trial.test
  const sky = String(skin.tokens.sky ?? '#bfe3f7')
  const land = String(skin.tokens.land ?? '#8fcf7a')
  const n = pieces.length
  const [board, setBoard] = useState<number[]>(() => new Array(n).fill(-1))
  const [held, setHeld] = useState<number | null>(null)
  useDraft(board, onDraft, phase)

  if (phase === 'study')
    return (
      <div className="board overflow-hidden rounded-xl border border-[var(--line)]">
        <Art pic={trial.study.picture} sky={sky} land={land} />
      </div>
    )

  const grid = (cells: number[], opts: { onCell?(c: number): void; marks?: boolean }) => (
    <div className="board grid rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-1" style={{ gridTemplateColumns: `repeat(${pic.cols}, minmax(0, 1fr))`, gap: 3 }}>
      {cells.map((k, c) => (
        <button
          key={c}
          className="relative aspect-square min-h-11 overflow-hidden rounded-md p-0"
          disabled={!opts.onCell}
          onClick={() => opts.onCell?.(c)}
          aria-label={`Board square ${c + 1}${k >= 0 ? ', filled' : ', empty'}`}
          style={{
            background: 'var(--panel)',
            outline: opts.marks && k >= 0 ? `3px solid ${review?.key[c] === k ? 'var(--right)' : 'var(--wrong)'}` : held !== null && k < 0 ? '2px dashed var(--accent)' : undefined,
            outlineOffset: -3,
          }}
        >
          {k >= 0 && <Art pic={pic} sky={sky} land={land} cell={pieces[k]} size="100%" />}
        </button>
      ))}
    </div>
  )

  if (phase === 'review' && review)
    return (
      <div className="grid w-full justify-items-center gap-2">
        <div className="label">Yours</div>
        {grid(review.answer ?? new Array(n).fill(-1), { marks: true })}
        <div className="label">The picture</div>
        <div className="board overflow-hidden rounded-xl border border-[var(--line)]">
          <Art pic={pic} sky={sky} land={land} />
        </div>
      </div>
    )

  const tapCell = (c: number) => {
    const there = board[c]
    if (held === null) {
      if (there >= 0) {
        setBoard((b) => b.map((x, i) => (i === c ? -1 : x)))
        setHeld(there)
      }
      return
    }
    setBoard((b) => b.map((x, i) => (i === c ? held : x === held ? -1 : x)))
    setHeld(there >= 0 && there !== held ? there : null)
  }
  const loose = pieces.map((_, k) => k).filter((k) => !board.includes(k))
  return (
    <>
      {grid(board, { onCell: tapCell })}
      <div className="mt-3 flex min-h-[70px] flex-wrap justify-center gap-2" role="group" aria-label="Loose pieces">
        {loose.map((k) => (
          <button
            key={k}
            className="overflow-hidden rounded-md p-0"
            style={{ width: 64, height: 64, boxShadow: held === k ? '0 0 0 3px var(--accent)' : '0 1px 3px var(--shadow)' }}
            aria-pressed={held === k}
            aria-label={`Piece ${k + 1}`}
            onClick={() => setHeld(held === k ? null : k)}
          >
            <Art pic={pic} sky={sky} land={land} cell={pieces[k]} size={64} />
          </button>
        ))}
      </div>
      <p className="counter mt-2">{held !== null ? 'Now tap where it goes.' : 'Tap a piece, then a square. Tap a placed piece to move it.'}</p>
      <Done onClick={() => onSubmit(board)} disabled={board.every((x) => x < 0)} />
    </>
  )
}
