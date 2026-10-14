import { useState } from 'react'
import { useDraft, useElapsed, type PlayProps } from '../../web/src/play/kit'
import { tone } from '../../web/src/lib/sound'
import type { Answer, Key, Params, Star, Study, Test } from './index'

const THEMES: Record<string, { sky: string; star: string; lit: string; line: string }> = {
  night: { sky: '#151a36', star: '#c9cfee', lit: '#ffd45c', line: '#ffd45c' },
  harbor: { sky: '#0f2a3a', star: '#9fc3d6', lit: '#ff9f5a', line: '#ff9f5a' },
}

function Path({ stars, route, color, dashed }: { stars: Star[]; route: number[]; color: string; dashed?: boolean }) {
  if (route.length < 2) return null
  const d = route.map((s, i) => `${i ? 'L' : 'M'}${stars[s].x} ${stars[s].y}`).join(' ')
  return <path d={d} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed ? '2.5 1.8' : undefined} />
}

export default function ConstellationPlay({ trial, phase, offsetMs, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const th = THEMES[String(skin.tokens.kind)] ?? THEMES.night
  const { stars } = trial.test
  const t = useElapsed(phase === 'study', offsetMs)
  const [taps, setTaps] = useState<number[]>([])
  useDraft(taps, onDraft, phase)

  let litRoute: number[] = []
  if (phase === 'study') {
    const n = Math.floor((t - trial.study.leadMs) / trial.study.stepMs) + 1
    litRoute = trial.study.route.slice(0, Math.max(0, n))
  }
  const current = litRoute[litRoute.length - 1]

  const tap = (i: number) => {
    if (phase !== 'answer' || taps.length >= trial.test.length) return
    tone(taps.length)
    const next = [...taps, i]
    setTaps(next)
    if (next.length === trial.test.length) onSubmit(next)
  }

  const yours = review ? review.answer ?? [] : taps
  return (
    <>
      <svg viewBox="0 0 100 100" className="board block rounded-2xl" style={{ background: th.sky }} role="img" aria-label={phase === 'study' ? 'Stars lighting up in order' : 'Stars. Tap them in order.'}>
        {phase === 'study' && <Path stars={stars} route={litRoute} color={th.line} />}
        {phase === 'review' && review && <Path stars={stars} route={review.key} color={th.line} dashed />}
        {phase !== 'study' && <Path stars={stars} route={yours} color="#b394ee" />}
        {stars.map((s, i) => {
          const lit = phase === 'study' && litRoute.includes(i)
          const order = yours.indexOf(i)
          return (
            <g key={i} onPointerDown={() => tap(i)} style={{ cursor: phase === 'answer' ? 'pointer' : 'default' }}>
              <circle cx={s.x} cy={s.y} r="7" fill="transparent" />
              <circle cx={s.x} cy={s.y} r={i === current ? s.size + 2.4 : lit ? s.size + 1 : s.size * 0.7} fill={lit ? th.lit : th.star} opacity={lit || phase !== 'study' ? 1 : 0.7} />
              {phase !== 'study' && order >= 0 && (
                <text x={s.x + 3.4} y={s.y - 2.6} fontSize="4" fontWeight="800" fill="#e6dcff">
                  {order + 1}
                </text>
              )}
              {phase === 'review' && review && review.key.indexOf(i) >= 0 && (
                <text x={s.x - 3.4} y={s.y + 6} fontSize="3.6" fontWeight="800" fill={th.lit} textAnchor="end">
                  {review.key.indexOf(i) + 1}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {/* Keyboard and screen-reader route: the same stars as buttons. */}
      {phase === 'answer' && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Stars by number">
          {stars.map((_, i) => (
            <button key={i} className="sr-only" onClick={() => tap(i)}>
              Star {i + 1}
            </button>
          ))}
        </div>
      )}
      {phase === 'answer' && (
        <div className="actions">
          <button className="btn btn-ghost" onClick={() => setTaps((ts) => ts.slice(0, -1))} disabled={!taps.length}>
            Undo
          </button>
        </div>
      )}
      <p className="counter mt-2">
        {phase === 'study' ? `Star ${Math.min(litRoute.length, trial.study.route.length)} of ${trial.study.route.length}` : phase === 'answer' ? `${taps.length} of ${trial.test.length} stars` : 'Gold, dashed: the route. Purple: yours.'}
      </p>
    </>
  )
}
