import { useRef, useState, type ReactNode } from 'react'
import { Done, Item, Shape, useDraft, type PlayProps } from '../../web/src/play/kit'
import { H, W, type Answer, type ChangeKind, type Key, type Obj, type Params, type Pt, type Study, type Test } from './index'
import { ItemArt, itemName } from '../../web/src/play/ItemArt'
import { SceneBackdrop } from '../../web/src/play/EnvironmentArt'

const SIZE = 12.5

function ObjArt({ o }: { o: Obj }) {
  if (o.glyph) {
    const size = SIZE * (o.s ?? 1)
    return <ItemArt id={o.glyph} x={o.x - size / 2} y={o.y - size / 2} size={size} />
  }
  return (
    <g transform={`translate(${o.x - SIZE / 2} ${o.y - SIZE / 2})`}>
      <ellipse cx={SIZE/2} cy={SIZE*.89} rx={SIZE*.35} ry={SIZE*.045} fill="#40394f" opacity=".12"/>
      <Shape shape={o.shape!} color={o.color!} size={SIZE} />
    </g>
  )
}

function Canvas({ objects, top, bottom, kind, onTap, children, label }: { objects: Obj[]; top: string; bottom: string; kind: string; onTap?(p: Pt): void; children?: ReactNode; label: string }) {
  const svg = useRef<SVGSVGElement>(null)
  return (
    <div className="board illustrated-board scene-board">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full touch-none"
        style={{ cursor: onTap ? 'crosshair' : 'default' }}
        role="img"
        aria-label={label}
        onPointerDown={(e) => {
          if (!onTap) return
          const r = svg.current!.getBoundingClientRect()
          onTap({ x: Math.round(((e.clientX - r.left) / r.width) * W * 10) / 10, y: Math.round(((e.clientY - r.top) / r.height) * H * 10) / 10 })
        }}
      >
        <SceneBackdrop kind={kind} top={top} bottom={bottom}/>
        {/* Back to front, so nearer things overlap farther ones. */}
        {[...objects].sort((a, b) => a.y - b.y).map((o, i) => (
          <ObjArt key={i} o={o} />
        ))}
        {children}
      </svg>
    </div>
  )
}

function Marker({ p, label, color, onTap }: { p: Pt; label: string; color: string; onTap?(): void }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`} onPointerDown={(e) => onTap && (e.stopPropagation(), onTap())} style={{ cursor: onTap ? 'pointer' : 'default' }}>
      <circle r="6.5" fill="transparent" />
      <circle r="4.6" fill="none" stroke={color} strokeWidth="1.4" />
      <text y="-6.4" fontSize="4" fontWeight="800" textAnchor="middle" fill={color}>
        {label}
      </text>
    </g>
  )
}

const WHAT: Record<ChangeKind, string> = { moved: 'moved', gone: 'gone', new: 'new', swapped: 'swapped', color: 'color' }

export default function ScenePlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { kind, objects, count, asks } = trial.test
  const top = String(skin.tokens.top ?? '#cfe8c4')
  const bottom = String(skin.tokens.bottom ?? '#a9d69a')
  const setting = String(skin.tokens.theme ?? 'park')
  const [taps, setTaps] = useState<Pt[]>([])
  const [placed, setPlaced] = useState<(Pt | null)[]>(() => asks.map(() => null))
  const [current, setCurrent] = useState(0)
  const answer: Answer = kind === 'change' ? taps : placed
  useDraft(answer, onDraft, phase)

  if (phase === 'study')
    return (
      <>
        <Canvas objects={trial.study.objects} top={top} bottom={bottom} kind={setting} label="The scene" />
        <p className="counter mt-2">Take in everything: what is there, and where.</p>
      </>
    )

  if (phase === 'review' && review) {
    const ans = (review.answer ?? []).filter((x): x is Pt => !!x)
    if (kind === 'where') {
      const mine = review.answer ?? []
      return (
        <>
          <Canvas objects={objects} top={top} bottom={bottom} kind={setting} label="Where things were">
            {review.key.spots.map((s, i) => (
              <g key={i}>
                {mine[i] && <line x1={s[0].x} y1={s[0].y} x2={mine[i]!.x} y2={mine[i]!.y} stroke="var(--ink)" strokeWidth=".5" strokeDasharray="1.4 1" />}
                <ObjArt o={{ ...s[0], glyph: asks[i].glyph, s: asks[i].s }} />
                <Marker p={s[0]} label="" color="var(--right)" />
                {mine[i] && <Marker p={mine[i]!} label={String(i + 1)} color="var(--accent)" />}
              </g>
            ))}
          </Canvas>
          <p className="counter mt-2">Green rings: where they were. Numbered: where you put them.</p>
        </>
      )
    }
    return (
      <>
        <Canvas objects={objects} top={top} bottom={bottom} kind={setting} label="What changed">
          {review.key.spots.map((ss, i) => (
            <g key={i}>
              {ss.length === 2 && <line x1={ss[0].x} y1={ss[0].y} x2={ss[1].x} y2={ss[1].y} stroke="var(--right)" strokeWidth=".6" strokeDasharray="1.4 1" />}
              {ss.map((s, j) => (
                <Marker key={j} p={s} label={j === 0 ? WHAT[review.key.what[i]] : ''} color="var(--right)" />
              ))}
            </g>
          ))}
          {ans.map((p, i) => (
            <g key={`t${i}`} transform={`translate(${p.x} ${p.y})`}>
              <path d="M-2-2 2 2M2-2-2 2" stroke="var(--ink)" strokeWidth="1" />
            </g>
          ))}
        </Canvas>
        <p className="counter mt-2">Green rings: the changes. Crosses: your taps.</p>
      </>
    )
  }

  if (kind === 'where') {
    const place = (p: Pt) => {
      const next = placed.map((x, i) => (i === current ? p : x))
      setPlaced(next)
      const empty = next.findIndex((x) => !x)
      if (empty >= 0) setCurrent(empty)
    }
    return (
      <>
        <div className="mb-2 flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Things to put back">
          {asks.map((a, i) => (
            <button
              key={i}
              role="radio"
              aria-checked={current === i}
              className="cell"
              style={{ width: 58, boxShadow: current === i ? '0 0 0 3px var(--accent)' : placed[i] ? 'inset 0 0 0 2px var(--right)' : undefined }}
              onClick={() => setCurrent(i)}
            >
              <Item id={a.glyph!} size={28} />
              {placed[i] && <span className="mark">✓</span>}
            </button>
          ))}
        </div>
        <Canvas objects={objects} top={top} bottom={bottom} kind={setting} onTap={place} label={`Scene. Tap where the ${itemName(asks[current]?.glyph ?? 'object')} was.`}>
          {placed.map((p, i) => p && (
            <g key={i}>
              <ObjArt o={{ ...p, glyph: asks[i].glyph, s: asks[i].s }} />
              <Marker p={p} label={String(i + 1)} color="var(--accent)" onTap={() => setCurrent(i)} />
            </g>
          ))}
        </Canvas>
        <p className="counter mt-2">Pick a thing, then tap where it was. Tap again to move it.</p>
        <Done onClick={() => onSubmit(placed)} disabled={placed.every((x) => !x)} />
      </>
    )
  }

  const max = count + 2
  return (
    <>
      <Canvas objects={objects} top={top} bottom={bottom} kind={setting} onTap={(p) => taps.length < max && setTaps((t) => [...t, p])} label={`Scene. Tap the ${count} changes.`}>
        {taps.map((p, i) => (
          <Marker key={i} p={p} label={String(i + 1)} color="var(--accent)" onTap={() => setTaps((t) => t.filter((_, j) => j !== i))} />
        ))}
      </Canvas>
      <p className="counter mt-2" aria-live="polite">
        {count} things changed: moved, gone, new or swapped for something else. {taps.length} tapped · tap a ring to remove it. Wrong taps cost points.
      </p>
      <Done onClick={() => onSubmit(taps)} disabled={!taps.length} />
    </>
  )
}
