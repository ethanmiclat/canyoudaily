import { useEffect, useRef, useState } from 'react'
import { Item, useDraft, useElapsed, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'

function Tile({ id, size }: { id: string; size: number }) {
  return /^[A-Z]$/.test(id) ? <span style={{ font: `800 ${size}px/1 var(--font-display)` }}>{id}</span> : <Item id={id} size={size} />
}

export default function NBackPlay({ trial, phase, offsetMs, onDraft, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { n, stream, stepMs } = trial.test
  const leadMs = trial.study.leadMs
  const t = useElapsed(phase !== 'review', offsetMs)
  const [taps, setTaps] = useState<number[]>([])
  const [flash, setFlash] = useState(false)
  useDraft(taps, onDraft, phase)

  // Which stream item is up, and whether it is still showing (items blink off for the last 30% of their step).
  let index = -1
  let showing = false
  if (phase === 'study' && t >= leadMs) {
    index = Math.floor((t - leadMs) / stepMs)
    showing = (t - leadMs) % stepMs < stepMs * 0.7
  } else if (phase === 'answer') {
    index = n + Math.floor(t / stepMs)
    showing = t % stepMs < stepMs * 0.7
  }
  const live = phase === 'answer' && index < stream.length
  const tapped = taps.includes(index)

  const tapRef = useRef<() => void>(() => {})
  tapRef.current = () => {
    if (!live || tapped) return
    setTaps((ts) => [...ts, index])
    setFlash(true)
    setTimeout(() => setFlash(false), 160)
  }
  useEffect(() => {
    if (phase !== 'answer') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'm') {
        e.preventDefault()
        tapRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  if (phase === 'review' && review) {
    const keys = new Set(review.key)
    const mine = new Set(review.answer ?? [])
    return (
      <div className="board">
        <p className="label mb-2 text-center">{n}-back. Outlined: matches. Ticks: your taps.</p>
        <ol className="flex flex-wrap justify-center gap-1.5">
          {stream.map((x, i) => {
            const isKey = keys.has(i), isMine = mine.has(i)
            const color = isKey && isMine ? 'var(--right)' : isMine ? 'var(--wrong)' : isKey ? 'var(--accent)' : 'var(--line)'
            return (
              <li
                key={i}
                className="relative grid h-12 w-11 place-items-center rounded-lg bg-[var(--panel)]"
                style={{ outline: `2px ${isKey && !isMine ? 'dashed' : 'solid'} ${color}`, opacity: i < n ? 0.5 : 1 }}
              >
                <span className="tile-label">{i + 1}</span>
                <Tile id={x} size={22} />
                {isMine && <span className="mark" style={{ color }}>{isKey ? '✓' : '✗'}</span>}
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  return (
    <div className="board grid justify-items-center gap-4">
      <div className="phase-tag is-study">{n}-back</div>
      <div className="big-flash" aria-live="off" style={{ boxShadow: flash ? '0 0 0 4px var(--accent)' : undefined }}>
        {index >= 0 && index < stream.length && showing ? <Tile id={stream[index]} size={88} /> : <span className="text-mute text-2xl">·</span>}
      </div>
      <p className="counter" aria-live="polite">
        {phase === 'study'
          ? index < 0
            ? `Compare each item with the one ${n} back.`
            : `Item ${index + 1}: nothing to compare yet`
          : index < stream.length
            ? `Item ${index + 1} of ${stream.length}`
            : 'Done'}
      </p>
      <button
        className="btn btn-primary done-btn"
        style={{ minHeight: 64, minWidth: 220, fontSize: 20 }}
        disabled={!live || tapped}
        onPointerDown={(e) => {
          e.preventDefault()
          tapRef.current()
        }}
        onClick={(e) => e.detail === 0 && tapRef.current()}
      >
        {tapped ? 'Tapped' : 'Match'}
      </button>
      <p className="label">Space or M also taps Match.</p>
    </div>
  )
}
