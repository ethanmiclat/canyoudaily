import { ItemArt } from '../../web/src/play/ItemArt'
import { useState } from 'react'
import { Done, useDraft, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'

interface HallProps {
  lanes: number
  cols: number
  /** Lasers to draw: safe lanes per column (null hides them). */
  safe: number[][] | null
  path: number[]
  beam: string
  floor: string
  thief: string
  prize: string
  onCell?(col: number, lane: number): void
  canStep?(col: number, lane: number): boolean
  hits?: boolean[]
}

function Hall({ lanes, cols, safe, path, beam, floor, thief, prize, onCell, canStep, hits }: HallProps) {
  const head = path.length - 1
  return (
    <div className="board overflow-x-auto rounded-xl p-1.5" style={{ background: floor }}>
      <div className="grid" style={{ gridTemplateColumns: `minmax(26px, .7fr) repeat(${cols}, minmax(44px, 1fr)) minmax(26px, .7fr)`, gap: 2 }}>
        {Array.from({ length: lanes }, (_, lane) => (
          <div key={lane} className="contents">
            <div className="grid place-items-center text-xl" aria-hidden>
              {path.length === 0 && lane === Math.floor(lanes / 2) && <ItemArt id={thief} size={26} />}
            </div>
            {Array.from({ length: cols }, (_, c) => {
              const laser = safe && !safe[c].includes(lane)
              const here = path[c] === lane
              const can = canStep?.(c, lane) ?? false
              const hit = hits && here ? hits[c] === false : false
              return (
                <button
                  key={c}
                  className="relative grid min-h-11 place-items-center rounded-md p-0"
                  disabled={!onCell || !(can || (here && c === head))}
                  onClick={() => onCell?.(c, lane)}
                  aria-label={`Column ${c + 1}, lane ${lane + 1}${laser ? ', laser' : ''}${here ? ', thief went here' : ''}`}
                  style={{
                    aspectRatio: '1 / 1.1',
                    background: can ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.05)',
                    outline: can ? '2px dashed rgba(255,255,255,.5)' : undefined,
                    outlineOffset: -3,
                  }}
                >
                  {laser && <span className="absolute inset-y-0 left-1/2 w-[5px] -translate-x-1/2 rounded-full" style={{ background: beam, boxShadow: undefined }} />}
                  {here && <span className="relative text-xl"><ItemArt id={hit ? '💥' : c === head && !hits ? thief : '👣'} size={26} /></span>}
                </button>
              )
            })}
            <div className="grid place-items-center text-xl" aria-hidden>
              {lane === Math.floor(lanes / 2) && <ItemArt id={prize} size={26} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LaserPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { lanes, cols } = trial.test
  const tok = { beam: String(skin.tokens.beam), floor: String(skin.tokens.floor), thief: String(skin.tokens.thief), prize: String(skin.tokens.prize) }
  const [path, setPath] = useState<number[]>([])
  useDraft(path, onDraft, phase)

  if (phase === 'study')
    return (
      <>
        <Hall lanes={lanes} cols={cols} safe={trial.study.safe} path={[]} {...tok} />
        <p className="counter mt-2">Find the gaps. Moving one lane per column at most.</p>
      </>
    )
  if (phase === 'review' && review) {
    const ans = review.answer ?? []
    return (
      <>
        <Hall lanes={lanes} cols={cols} safe={review.key} path={ans} hits={ans.map((l, c) => review.key[c].includes(l))} {...tok} />
        <p className="counter mt-2">The burst marks a laser the explorer walked into.</p>
      </>
    )
  }

  const canStep = (c: number, lane: number) => c === path.length && (c === 0 || Math.abs(lane - path[c - 1]) <= 1)
  const tap = (c: number, lane: number) => {
    if (c === path.length - 1 && path[c] === lane) return setPath((p) => p.slice(0, -1))
    if (!canStep(c, lane)) return
    const next = [...path, lane]
    setPath(next)
    if (next.length === cols) onSubmit(next)
  }
  return (
    <>
      <Hall lanes={lanes} cols={cols} safe={null} path={path} onCell={tap} canStep={canStep} {...tok} />
      <div className="actions">
        <button className="btn btn-ghost" disabled={!path.length} onClick={() => setPath((p) => p.slice(0, -1))}>
          Step back
        </button>
      </div>
      <p className="counter">Tap a square in the next column. {path.length} of {cols} columns.</p>
      <Done onClick={() => onSubmit(path)} disabled={!path.length} />
    </>
  )
}
