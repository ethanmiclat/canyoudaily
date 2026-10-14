import { useRef, useState } from 'react'
import { Done, useDraft, type PlayProps } from '../../web/src/play/kit'
import { PART_IDS, SIZES, VARIANTS, type Answer, type Head, type Key, type Params, type Part, type PartId, type Study, type Test } from './index'
import { I } from '../../web/src/play/IllustrationPrimitives'

const SKIN = ['#f2c6a0', '#dfab86', '#c58b64', '#ad7354', '#825846', '#edc29c']
const HAIR = ['#493b37', '#68483b', '#b66f42', '#d5b572', '#b3aea4', '#995845']
const LABEL: Record<PartId, string> = { brows: 'Brows', eyes: 'Eyes', nose: 'Nose', mouth: 'Mouth' }

interface Look {
  paper: string
  ink: string
  robot: boolean
  pumpkin: boolean
}

function Pair({ children }: { children: React.ReactNode }) {
  return (
    <>
      <g transform="translate(-12 0)">{children}</g>
      <g transform="translate(12 0) scale(-1 1)">{children}</g>
    </>
  )
}

/** One feature drawn around (0, 0). */
function PartArt({ id, v, ink, fill }: { id: PartId; v: number; ink: string; fill: string }) {
  const line = { stroke: ink, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (id === 'brows')
    return (
      <Pair>
        {v === 0 && <path d="M-6 0h12" {...line} />}
        {v === 1 && <path d="M-6 2q6-6 12 0" {...line} />}
        {v === 2 && <path d="M-6-2 6 2" {...line} />}
        {v === 3 && <rect x="-6.5" y="-2" width="13" height="4" rx="2" fill={ink} />}
      </Pair>
    )
  if (id === 'eyes')
    return (
      <Pair>
        {v === 0 && <circle r="2.4" fill={ink} />}
        {v === 1 && (
          <>
            <ellipse rx="3.6" ry="4.6" fill="#fff" stroke={ink} strokeWidth="1.4" />
            <circle cy=".8" r="1.9" fill={ink} />
          </>
        )}
        {v === 2 && <path d="M-4 1.5q4-6 8 0" {...line} />}
        {v === 3 && (
          <>
            <circle r="4.2" fill="#fff" stroke={ink} strokeWidth="1.4" />
            <circle r="2" fill={ink} />
            <path d="M-3.4-3.6-5-6M0-4.4v-2.6M3.4-3.6 5-6" {...line} strokeWidth="1.2" />
          </>
        )}
        {v === 4 && (
          <>
            <path d="M-4.4 0a4.4 4.4 0 0 0 8.8 0Z" fill="#fff" stroke={ink} strokeWidth="1.4" />
            <circle cy="1.4" r="1.6" fill={ink} />
            <path d="M-5 0h10" {...line} />
          </>
        )}
      </Pair>
    )
  if (id === 'nose')
    return (
      <>
        {v === 0 && (
          <>
            <circle cx="-2.4" r="1.3" fill={ink} />
            <circle cx="2.4" r="1.3" fill={ink} />
          </>
        )}
        {v === 1 && <path d="M0-6-3.4 2h6.8" {...line} />}
        {v === 2 && <circle r="3.4" fill={fill} stroke={ink} strokeWidth="1.4" />}
        {v === 3 && <path d="M1-7v8h-4" {...line} />}
      </>
    )
  return (
    <>
      {v === 0 && <path d="M-8-1q8 8 16 0" {...line} />}
      {v === 1 && <path d="M-7 0h14" {...line} />}
      {v === 2 && <ellipse rx="3.6" ry="4.2" fill={ink} />}
      {v === 3 && <path d="M-9-2q9 12 18 0Z" fill={ink} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />}
      {v === 4 && <path d="M-8 3q8-7 16 0" {...line} />}
    </>
  )
}

function HeadArt({ head, look }: { head: Head; look: Look }) {
  if (look.robot)
    return (
      <>
        <rect x="18" y="14" width="64" height="76" rx="12" fill="#b9c6d2" stroke={look.ink} strokeWidth="2" />
        <path d="M70 18h8v67H70Z" fill={I.blue} opacity=".6"/>
        <path d="M25 22h25M25 22v20" stroke={I.paper} strokeWidth="2" strokeLinecap="round" fill="none"/>
        <path d="M22 65v14m56-14v14" stroke={I.blueDark} strokeWidth="1.2"/>
        <path d="M50 14V5" stroke={look.ink} strokeWidth="2" />
        <circle cx="50" cy="4.5" r="3" fill={I.coral} />
        <circle cx="16" cy="52" r="4" fill="#8a9aa8" stroke={look.ink} strokeWidth="1.5" />
        <circle cx="84" cy="52" r="4" fill="#8a9aa8" stroke={look.ink} strokeWidth="1.5" />
      </>
    )
  if (look.pumpkin)
    return (
      <>
        <path d="M50 10c4-6 10-6 10-6" stroke="#3f7a32" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="50" cy="54" rx="40" ry="38" fill={I.peach} stroke={I.ochre} strokeWidth="1.5"/>
        <path d="M50 16v76M30 20q-10 34 0 70M70 20q10 34 0 70" stroke={I.ochre} strokeWidth="2" fill="none" />
        <path d="M22 37q-5 16-1 25" stroke={I.sandLight} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </>
    )
  const hair = HAIR[head.hairColor]
  return (
    <>
      {head.hair >= 3 && <path d="M18 50c0-40 64-40 64 0v36H18Z" fill={hair} />}
      <ellipse cx="19" cy="51" rx="4" ry="7" fill={SKIN[head.skin]} stroke={I.ink} strokeWidth="1"/>
      <ellipse cx="81" cy="51" rx="4" ry="7" fill={SKIN[head.skin]} stroke={I.ink} strokeWidth="1"/>
      <ellipse cx="50" cy="54" rx="31" ry="38" fill={SKIN[head.skin]} stroke={I.ink} strokeWidth="1.3" />
      <path d="M73 32q13 43-18 57-19 6-30-14 20 21 38-3 14-15 10-40Z" fill="#895847" opacity=".13"/>
      {head.hair % 3 === 0 && <path d="M19 44c0-26 14-32 31-32s31 6 31 32c-10-10-20-13-31-13s-21 3-31 13Z" fill={hair} />}
      {head.hair % 3 === 1 && <path d="M20 40c2-20 15-26 30-26s28 6 30 26l-7-5-7 5-8-6-8 6-8-6-7 5Z" fill={hair} />}
      {head.hair % 3 === 2 && (
        <>
          <path d="M21 40c0-18 13-25 29-25s29 7 29 25c-9-7-21-9-29-9s-20 2-29 9Z" fill={hair} />
          <circle cx="50" cy="13" r="8" fill={hair} />
        </>
      )}
      <path d="M29 26q9-9 24-8" stroke={I.paper} strokeWidth="1.5" opacity=".3" fill="none" strokeLinecap="round"/>
    </>
  )
}

function FaceArt({ head, parts, look, size = '100%', guide }: { head: Head; parts: Partial<Record<PartId, Part>>; look: Look; size?: number | string; guide?: number }) {
  const fill = look.robot ? I.blue : look.pumpkin ? I.ochre : SKIN[head.skin]
  return (
    <svg viewBox="0 0 100 100" width={size} className="block" aria-hidden style={{ background: look.paper }}>
      <HeadArt head={head} look={look} />
      {guide !== undefined && <path d={`M14 ${guide}h72`} stroke="var(--accent)" strokeWidth=".6" strokeDasharray="2 1.5" />}
      {PART_IDS.map((id) => {
        const p = parts[id]
        if (!p) return null
        return (
          <g key={id} transform={`translate(50 ${p.y}) scale(${SIZES[p.s] * 1.15})`}>
            <PartArt id={id} v={p.v} ink={look.pumpkin ? '#3a1d08' : look.ink} fill={fill} />
          </g>
        )
      })}
    </svg>
  )
}

export default function FacePlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { head, parts, fixed } = trial.test
  const look: Look = { paper: String(skin.tokens.paper ?? '#fbf6ea'), ink: String(skin.tokens.ink ?? '#2a2438'), robot: !!skin.tokens.robot, pumpkin: !!skin.tokens.pumpkin }
  const [built, setBuilt] = useState<Answer>({})
  const [active, setActive] = useState<PartId>(parts[0])
  const [styleOf, setStyleOf] = useState<Partial<Record<PartId, { v: number; s: number }>>>({})
  const svgBox = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  useDraft(built, onDraft, phase)

  if (phase === 'study')
    return (
      <div className="board overflow-hidden rounded-2xl border border-[var(--line)]" style={{ maxWidth: 340 }}>
        <FaceArt head={head} parts={trial.study.face} look={look} />
      </div>
    )
  if (phase === 'review' && review)
    return (
      <div className="grid w-full grid-cols-2 gap-3" style={{ maxWidth: 440 }}>
        <div>
          <div className="label mb-1 text-center">Yours</div>
          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            <FaceArt head={head} parts={{ ...fixed, ...(review.answer ?? {}) }} look={look} />
          </div>
        </div>
        <div>
          <div className="label mb-1 text-center">The face</div>
          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            <FaceArt head={head} parts={{ ...fixed, ...review.key }} look={look} />
          </div>
        </div>
      </div>
    )

  const cur = styleOf[active] ?? { v: built[active]?.v ?? 0, s: built[active]?.s ?? 1 }
  const update = (id: PartId, patch: Partial<Part>) => {
    const base = built[id] ?? { v: cur.v, s: cur.s, y: 0 }
    setBuilt((b) => ({ ...b, [id]: { ...base, ...patch } }))
  }
  const setStyle = (patch: Partial<{ v: number; s: number }>) => {
    const next = { ...cur, ...patch }
    setStyleOf((st) => ({ ...st, [active]: next }))
    if (built[active]) update(active, next)
  }
  const placeAt = (clientY: number) => {
    const r = svgBox.current!.getBoundingClientRect()
    const y = Math.max(4, Math.min(96, Math.round(((clientY - r.top) / r.height) * 1000) / 10))
    setBuilt((b) => ({ ...b, [active]: { v: cur.v, s: cur.s, y } }))
  }
  const nudge = (d: number) => built[active] && update(active, { y: Math.max(4, Math.min(96, built[active]!.y + d)) })

  return (
    <>
      <div
        ref={svgBox}
        className="board touch-none overflow-hidden rounded-2xl border border-[var(--line)]"
        style={{ maxWidth: 300, cursor: 'ns-resize' }}
        onPointerDown={(e) => {
          dragging.current = true
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          placeAt(e.clientY)
        }}
        onPointerMove={(e) => dragging.current && placeAt(e.clientY)}
        onPointerUp={() => (dragging.current = false)}
        role="img"
        aria-label={`Face. Tap or drag to set the height of the ${LABEL[active].toLowerCase()}.`}
      >
        <FaceArt head={head} parts={{ ...fixed, ...built }} look={look} guide={built[active]?.y} />
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Features">
        {parts.map((id) => (
          <button key={id} role="tab" aria-selected={active === id} className={`btn ${active === id ? 'btn-primary' : 'btn-ghost'} px-3`} onClick={() => setActive(id)}>
            {LABEL[id]} {built[id] ? '✓' : ''}
          </button>
        ))}
      </div>

      <div className="mt-2 grid w-full max-w-[420px] grid-cols-[auto_1fr_auto] items-center gap-2">
        <button className="btn btn-ghost px-3" aria-label="Previous style" onClick={() => setStyle({ v: (cur.v + VARIANTS[active] - 1) % VARIANTS[active] })}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="grid place-items-center rounded-xl bg-[var(--panel)] py-1" aria-live="polite" aria-label={`${LABEL[active]} style ${cur.v + 1} of ${VARIANTS[active]}`}>
          <svg viewBox="-20 -10 40 20" width="120" height="60" aria-hidden>
            <g transform={`scale(${SIZES[cur.s]})`}>
              <PartArt id={active} v={cur.v} ink={look.pumpkin ? '#3a1d08' : look.ink} fill="#ddd" />
            </g>
          </svg>
          <span className="counter">
            Style {cur.v + 1} of {VARIANTS[active]}
          </span>
        </div>
        <button className="btn btn-ghost px-3" aria-label="Next style" onClick={() => setStyle({ v: (cur.v + 1) % VARIANTS[active] })}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div className="actions mt-2">
        <button className="btn btn-ghost px-3" disabled={cur.s === 0} onClick={() => setStyle({ s: cur.s - 1 })}>
          Smaller
        </button>
        <button className="btn btn-ghost px-3" disabled={cur.s === 2} onClick={() => setStyle({ s: cur.s + 1 })}>
          Bigger
        </button>
        <button className="btn btn-ghost px-3" disabled={!built[active]} onClick={() => nudge(-1)} aria-label="Move up">
          ↑
        </button>
        <button className="btn btn-ghost px-3" disabled={!built[active]} onClick={() => nudge(1)} aria-label="Move down">
          ↓
        </button>
        {!built[active] && (
          <button className="btn btn-ghost px-3" onClick={() => setBuilt((b) => ({ ...b, [active]: { v: cur.v, s: cur.s, y: 50 } }))}>
            Place
          </button>
        )}
      </div>
      <p className="counter mt-1">Pick a style and size, then tap the face where the {LABEL[active].toLowerCase()} go.</p>
      <Done onClick={() => onSubmit(built)} disabled={!Object.keys(built).length} />
    </>
  )
}
