import { useRef, useState } from 'react'
import { Done, SwatchFill, useDraft, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'

function Canvas({ size, cells, palette, bg, marks, onPaint }: { size: number; cells: number[]; palette: string[]; bg: string; marks?: (boolean | null)[]; onPaint?(i: number): void }) {
  const painting = useRef(false)
  const paintAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const i = el?.closest<HTMLElement>('[data-px]')?.dataset.px
    if (i !== undefined) onPaint?.(Number(i))
  }
  return (
    <div
      className="board pixel-canvas touch-none rounded-xl p-1.5"
      style={{ background: bg }}
      onPointerDown={(e) => {
        if (!onPaint) return
        painting.current = true
        ;(e.target as Element).releasePointerCapture?.(e.pointerId)
        paintAt(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => painting.current && paintAt(e.clientX, e.clientY)}
      onPointerUp={() => (painting.current = false)}
      onPointerLeave={() => (painting.current = false)}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${size}, minmax(44px, 1fr))`, gap: 3 }}>
        {cells.map((v, i) => (
          <button
            key={i}
            data-px={i}
            className="relative aspect-square min-h-11 rounded-md p-0"
            disabled={!onPaint}
            aria-label={`Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}: ${v ? palette[v - 1] : 'blank'}`}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPaint?.(i))}
            style={{
              background: 'color-mix(in srgb, var(--panel) 18%, transparent)',
              outline: marks?.[i] === false ? '3px solid var(--wrong)' : marks?.[i] === true ? '2px solid var(--right)' : undefined,
              outlineOffset: -2,
            }}
          >
            {v > 0 && <SwatchFill color={palette[v - 1]} size="100%" />}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PixelPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { size, colors } = trial.test
  const palette = (skin.tokens.palette as string[]).slice(0, colors)
  const bg = String(skin.tokens.bg ?? '#1d1b2b')
  const [cells, setCells] = useState<number[]>(() => new Array(size * size).fill(0))
  const [brush, setBrush] = useState(1)
  useDraft(cells, onDraft, phase)

  if (phase === 'study') return <Canvas size={size} cells={trial.study.cells} palette={palette} bg={bg} />
  if (phase === 'review' && review) {
    const ans = review.answer ?? new Array(size * size).fill(0)
    return (
      <div className="grid w-full justify-items-center gap-3">
        <div className="label">The picture</div>
        <Canvas size={size} cells={review.key} palette={palette} bg={bg} />
        <div className="label">Yours (red outline: wrong paint)</div>
        <Canvas size={size} cells={ans} palette={palette} bg={bg} marks={ans.map((x, i) => (x ? x === review.key[i] : null))} />
      </div>
    )
  }

  const paint = (i: number) => setCells((cs) => (cs[i] === brush ? cs : cs.map((v, j) => (j === i ? brush : v))))
  return (
    <>
      <Canvas size={size} cells={cells} palette={palette} bg={bg} onPaint={paint} />
      <div className="actions" role="radiogroup" aria-label="Paint">
        {palette.map((c, k) => (
          <button
            key={c}
            role="radio"
            aria-checked={brush === k + 1}
            aria-label={`${c} paint`}
            className="btn btn-ghost px-3"
            style={{ boxShadow: brush === k + 1 ? 'inset 0 0 0 3px var(--accent)' : undefined }}
            onClick={() => setBrush(k + 1)}
          >
            <SwatchFill color={c} size={28} />
          </button>
        ))}
        <button role="radio" aria-checked={brush === 0} className="btn btn-ghost" style={{ boxShadow: brush === 0 ? 'inset 0 0 0 3px var(--accent)' : undefined }} onClick={() => setBrush(0)}>
          Eraser
        </button>
      </div>
      <Done onClick={() => onSubmit(cells)} disabled={cells.every((x) => x === 0)} />
    </>
  )
}
