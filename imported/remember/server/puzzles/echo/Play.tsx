import { ItemArt } from '../../web/src/play/ItemArt'
import { useEffect, useRef, useState } from 'react'
import { useDraft, useElapsed, type PlayProps } from '../../web/src/play/kit'
import { tone, unlock } from '../../web/src/lib/sound'
import type { Answer, Key, Params, Study, Test } from './index'

const PULSE_MS = 150

/** One row of beat marks on a shared time axis. */
function Timeline({ label, times, span, color }: { label: string; times: number[]; span: number; color: string }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <svg viewBox="0 0 100 14" className="block w-full" aria-hidden>
        <line x1="2" y1="7" x2="98" y2="7" stroke="var(--line)" strokeWidth="1" />
        {times.map((x, i) => (
          <circle key={i} cx={2 + (Math.min(x, span) / span) * 96} cy="7" r="3.2" fill={color} />
        ))}
      </svg>
    </div>
  )
}

export default function EchoPlay({ trial, phase, offsetMs, skin, onDraft, onSubmit, review, reducedMotion }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { onsets, leadMs } = trial.study
  const icon = String(skin.tokens.icon ?? '🥁')
  const pitch = Number(skin.tokens.tone ?? 0)
  const t = useElapsed(phase === 'study', offsetMs)
  const [taps, setTaps] = useState<number[]>([])
  const [hit, setHit] = useState(false)
  const first = useRef<number | null>(null)
  useDraft(taps, onDraft, phase)

  // Study: which beat is pulsing.
  let beat = -1
  if (phase === 'study') {
    const since = t - leadMs
    beat = onsets.findIndex((o) => since >= o && since < o + PULSE_MS)
  }
  const lastTone = useRef(-1)
  useEffect(() => {
    if (beat >= 0 && lastTone.current !== beat) {
      lastTone.current = beat
      tone(pitch, 160)
    }
  }, [beat, pitch])

  const tapRef = useRef<() => void>(() => {})
  tapRef.current = () => {
    if (phase !== 'answer' || taps.length >= onsets.length) return
    unlock()
    tone(pitch, 160)
    const now = performance.now()
    first.current ??= now
    const next = [...taps, Math.round(now - first.current)]
    setTaps(next)
    setHit(true)
    setTimeout(() => setHit(false), PULSE_MS)
    if (next.length === onsets.length) setTimeout(() => onSubmit(next), 250)
  }
  useEffect(() => {
    if (phase !== 'answer') return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return
      e.preventDefault()
      tapRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  if (phase === 'review' && review) {
    const ans = review.answer ?? []
    const span = Math.max(onsets[onsets.length - 1], ans[ans.length - 1] ?? 0) || 1
    return (
      <div className="board grid gap-3">
        <Timeline label="The rhythm" times={review.key} span={span} color="var(--accent)" />
        <Timeline label="Yours" times={ans} span={span} color={review.score >= 0.995 ? 'var(--right)' : 'var(--ink)'} />
      </div>
    )
  }

  const lit = (phase === 'study' && beat >= 0) || hit
  return (
    <div className="board grid justify-items-center gap-3">
      <button
        className="cell"
        aria-label={phase === 'answer' ? 'Tap the rhythm' : 'Rhythm pad'}
        disabled={phase !== 'answer' || taps.length >= onsets.length}
        onPointerDown={(e) => {
          e.preventDefault()
          tapRef.current()
        }}
        style={{
          width: 'min(70vw, 240px)',
          borderRadius: '50%',
          fontSize: 84,
          background: lit ? 'var(--lit)' : 'var(--panel)',
          boxShadow: lit ? '0 0 0 5px var(--lit)' : 'inset 0 0 0 3px var(--line)',
          transform: lit && !reducedMotion ? 'scale(1.03)' : undefined,
          transition: 'transform 60ms, background-color 60ms',
        }}
      >
        <ItemArt id={icon} size={88} />
      </button>
      <div className="flex gap-1.5" aria-hidden>
        {onsets.map((_, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: (phase === 'study' ? i <= beat || t - leadMs > onsets[i] : i < taps.length) ? 'var(--accent)' : 'var(--panel-2)' }} />
        ))}
      </div>
      <p className="counter" aria-live="polite">
        {phase === 'study' ? (t < leadMs ? 'Listen and watch…' : `${onsets.length} beats`) : `${taps.length} of ${onsets.length} beats · tap the pad or press Space`}
      </p>
      {phase === 'answer' && (
        <div className="actions">
          <button
            className="btn btn-ghost"
            disabled={!taps.length}
            onClick={() => {
              first.current = null
              setTaps([])
            }}
          >
            Start over
          </button>
        </div>
      )}
    </div>
  )
}
