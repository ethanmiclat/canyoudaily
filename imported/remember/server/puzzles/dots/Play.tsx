import { useMemo, useState } from 'react'
import { useElapsed, type PlayProps } from '../../web/src/play/kit'
import { FPS, frames, R, type Answer, type Key, type Params, type Pt, type Study, type Test } from './index'
import { ItemArt } from '../../web/src/play/ItemArt'

function at(fs: Pt[][], ms: number): Pt[] {
  const f = Math.max(0, (ms / 1000) * FPS)
  const i = Math.min(fs.length - 1, Math.floor(f))
  const j = Math.min(fs.length - 1, i + 1)
  const u = f - Math.floor(f)
  return fs[i].map((p, d) => ({ x: p.x + (fs[j][d].x - p.x) * u, y: p.y + (fs[j][d].y - p.y) * u }))
}

/** Direction of travel in degrees, from the frames either side of `ms`. */
function headingAt(fs: Pt[][], ms: number): number[] {
  const a = at(fs, Math.max(0, ms - 60)), b = at(fs, ms + 60)
  return a.map((p, d) => (Math.atan2(b[d].y - p.y, b[d].x - p.x) * 180) / Math.PI)
}

/** Shared gradients for the drawn skins. Every dot looks the same, so the eye has nothing but motion to go on. */
function SkinDefs({ look }: { look: string }) {
  return (
    <defs>
      <radialGradient id="firefly-glow">
        <stop offset="0" stopColor={look} stopOpacity=".75" />
        <stop offset="1" stopColor={look} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="marble-glass" cx=".35" cy=".3" r=".75">
        <stop offset="0" stopColor="#fff" stopOpacity=".9" />
        <stop offset=".35" stopColor={look} />
        <stop offset="1" stopColor="#4a3a7a" />
      </radialGradient>
    </defs>
  )
}

/** A firefly flying toward `heading`: a soft glow, a lit tail, a dark head and two pale wings. */
function Firefly({ look, heading }: { look: string; heading: number }) {
  return (
    <g>
      <circle r={R * 1.5} fill="url(#firefly-glow)" />
      <g transform={`rotate(${heading})`}>
        <ellipse cx={-R * 0.25} cy={-R * 0.55} rx={R * 0.55} ry={R * 0.28} fill="#fff" opacity=".55" transform={`rotate(-25 ${-R * 0.25} ${-R * 0.55})`} />
        <ellipse cx={-R * 0.25} cy={R * 0.55} rx={R * 0.55} ry={R * 0.28} fill="#fff" opacity=".55" transform={`rotate(25 ${-R * 0.25} ${R * 0.55})`} />
        <ellipse cx={-R * 0.45} rx={R * 0.55} ry={R * 0.42} fill={look} />
        <ellipse cx={R * 0.25} rx={R * 0.38} ry={R * 0.32} fill="#3a2f22" />
        <circle cx={R * 0.62} r={R * 0.22} fill="#3a2f22" />
      </g>
    </g>
  )
}

/** A glass marble with a twist of color inside and a highlight; it spins as it rolls. */
function Marble({ heading }: { heading: number }) {
  return (
    <g>
      <circle r={R} fill="url(#marble-glass)" stroke="#40394f" strokeWidth=".5" />
      <path d={`M${-R * 0.6} ${R * 0.1}q${R * 0.5} ${-R * 0.9} ${R * 1.2} ${-R * 0.2}`} transform={`rotate(${heading * 2})`} stroke="#f0b394" strokeWidth=".9" fill="none" strokeLinecap="round" opacity=".85" />
      <ellipse cx={-R * 0.35} cy={-R * 0.4} rx={R * 0.3} ry={R * 0.18} fill="#fff" opacity=".85" transform={`rotate(-35 ${-R * 0.35} ${-R * 0.4})`} />
    </g>
  )
}

function Dot({ p, look, kind, heading, ring, mark }: { p: Pt; look: string; kind: string; heading: number; ring?: string; mark?: string }) {
  // Swimming left means the fish art is mirrored, so it always faces where it is going.
  const left = Math.abs(heading) > 90
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      {ring && <circle r={R + 2.6} fill="none" stroke={ring} strokeWidth="1.4" />}
      {kind === 'fireflies' ? (
        <Firefly look={look} heading={heading} />
      ) : kind === 'marbles' ? (
        <Marble heading={heading} />
      ) : !look.startsWith('#') ? (
        <g transform={left ? 'scale(-1 1)' : undefined}><ItemArt id={look} x={-R * 1.3} y={-R * 1.3} size={R * 2.6} /></g>
      ) : (
        <circle r={R} fill={look} stroke="rgba(0,0,0,.35)" strokeWidth=".6" />
      )}
      {mark && (
        <text y={-R - 3.4} fontSize="5" textAnchor="middle" fontWeight="800" fill={ring ?? 'currentColor'}>
          {mark}
        </text>
      )}
    </g>
  )
}

export default function DotsPlay({ trial, phase, offsetMs, skin, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { motion, count } = trial.test
  const fs = useMemo(() => frames(motion), [motion])
  const t = useElapsed(phase === 'study', offsetMs)
  const [picks, setPicks] = useState<number[]>([])
  const look = String(skin.tokens.dot ?? '#ffd45c')
  const kind = String(skin.tokens.kind ?? '')
  const bg = String(skin.tokens.bg ?? '#1b2238')
  const dark = skin.tokens.kind === 'fireflies'

  const cueing = phase === 'study' && t < trial.study.cueMs
  const moveT = phase === 'study' ? Math.max(0, t - trial.study.cueMs) : (fs.length - 1) * (1000 / FPS)
  const pos = phase === 'study' ? at(fs, moveT) : fs[fs.length - 1]
  const heading = useMemo(() => headingAt(fs, moveT), [fs, moveT])
  const targets = new Set(cueing ? trial.study.targets : review?.key ?? [])
  const mine = new Set(review ? review.answer ?? [] : picks)

  const tap = (d: number) => {
    if (phase !== 'answer' || picks.length >= count) return
    const next = picks.includes(d) ? picks.filter((x) => x !== d) : [...picks, d]
    setPicks(next)
    if (next.length === count) onSubmit(next)
  }

  return (
    <>
      <div className="board overflow-hidden rounded-2xl border border-[var(--line)]" style={{ background: bg, color: dark ? '#fff' : '#1b1726' }}>
        <svg viewBox="0 0 100 100" className="block w-full touch-none" role="img" aria-label={phase === 'study' ? (cueing ? 'Marked dots' : 'Dots moving') : 'Dots. Tap the ones you followed.'}>
          <SkinDefs look={look} />
          {pos.map((p, d) => {
            const isT = targets.has(d), isMine = mine.has(d)
            const ring = cueing && isT ? (dark ? '#fff' : '#1b1726') : review ? (isT ? 'var(--right)' : isMine ? 'var(--wrong)' : undefined) : isMine ? 'var(--accent)' : undefined
            const mark = cueing && isT ? '★' : review && isT ? (isMine ? '✓' : '★') : review && isMine ? '✗' : undefined
            return (
              <g key={d} onPointerDown={() => tap(d)} style={{ cursor: phase === 'answer' ? 'pointer' : 'default' }}>
                <circle cx={p.x} cy={p.y} r={R + 3.5} fill="transparent" />
                <Dot p={p} look={look} kind={kind} heading={heading[d]} ring={ring} mark={mark} />
              </g>
            )
          })}
        </svg>
      </div>
      {phase === 'answer' && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Dots by number">
          {pos.map((_, d) => (
            <button key={d} className="sr-only" onClick={() => tap(d)}>
              Dot {d + 1}
            </button>
          ))}
        </div>
      )}
      <p className="counter mt-2" aria-live="polite">
        {phase === 'study' ? (cueing ? `Follow the ${count > 1 ? `${count} starred dots` : 'starred dot'}` : 'Keep following…') : phase === 'answer' ? `Tap ${count > 1 ? `the ${count} dots` : 'the dot'} you followed · ${picks.length} of ${count}` : ''}
      </p>
    </>
  )
}
