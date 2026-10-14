import { useRef, useState } from 'react'
import { Done, useDraft, type PlayProps } from '../../web/src/play/kit'
import { bestMatch, type Answer, type Key, type MapArt, type Params, type Pt, type Study, type Test } from './index'

const THEMES: Record<string, { land: string; water: string; tree: string; path: string; pin: string }> = {
  park: { land: '#dce8cc', water: '#a8ccd9', tree: '#6e9e7c', path: '#efe2c0', pin: '#ac4862' },
  island: { land: '#efdfbc', water: '#91bcc9', tree: '#3f8a4a', path: '#c9a96e', pin: '#b3261e' },
  night: { land: '#333550', water: '#1b2342', tree: '#3e6b5a', path: '#4b5585', pin: '#ffd45c' },
}

function MapSvg({ map, theme }: { map: MapArt; theme: (typeof THEMES)[string] }) {
  const line = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  return (
    <>
      <rect width="100" height="100" fill={theme.land} />
      {map.paths.map((p, i) => (
        <path key={i} d={line(p)} stroke={theme.path} strokeWidth="3" fill="none" strokeLinecap="round" />
      ))}
      <path d={line(map.river)} stroke={theme.water} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {map.ponds.map((p, i) => (
        <ellipse key={i} cx={p.x} cy={p.y} rx={p.r * 1.3} ry={p.r} fill={theme.water} />
      ))}
      {/* Trees are small triangles so they never read as pins. */}
      {map.trees.map((t, i) => (
        <path key={i} d={`M${t.x} ${t.y - 2.6}l2.2 4h-4.4Z`} fill={theme.tree} opacity=".8" />
      ))}
    </>
  )
}

function Pin({ p, color, label, ring }: { p: Pt; color: string; label?: string; ring?: boolean }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      {ring ? (
        <circle r="3.6" fill="none" stroke={color} strokeWidth="1.6" strokeDasharray="2 1.4" />
      ) : (
        <>
          <circle r="3.4" fill={color} stroke="#fff" strokeWidth="1.1" />
          {label && (
            <text y="1.4" textAnchor="middle" fontSize="3.6" fontWeight="800" fill="#fff">
              {label}
            </text>
          )}
        </>
      )}
    </g>
  )
}

export default function LocationPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const theme = THEMES[String(skin.tokens.kind)] ?? THEMES.park
  const [pins, setPins] = useState<Pt[]>([])
  const svg = useRef<SVGSVGElement>(null)
  useDraft(pins, onDraft, phase)
  const count = trial.test.count

  const place = (e: React.PointerEvent) => {
    if (phase !== 'answer' || pins.length >= count) return
    const r = svg.current!.getBoundingClientRect()
    const p = { x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 }
    setPins((ps) => [...ps, p])
  }
  const remove = (i: number) => phase === 'answer' && setPins((ps) => ps.filter((_, j) => j !== i))

  const shown = review ? review.answer ?? [] : pins
  const match = review ? bestMatch(review.key, shown) : null

  return (
    <>
      <div className="board overflow-hidden rounded-2xl border border-[var(--line)]">
        <svg
          ref={svg}
          viewBox="0 0 100 100"
          className="block w-full touch-none"
          style={{ cursor: phase === 'answer' && pins.length < count ? 'crosshair' : 'default' }}
          onPointerDown={place}
          role="img"
          aria-label={phase === 'study' ? `Map with ${trial.study.dots.length} pins` : 'Map. Tap to place a pin.'}
        >
          <MapSvg map={trial.test.map} theme={theme} />
          {phase === 'study' && trial.study.dots.map((d, i) => <Pin key={i} p={d} color={theme.pin} />)}
          {phase === 'review' && match && (
            <>
              {match.pairs.map(([i, j]) => (
                <line key={`l${i}`} x1={review!.key[i].x} y1={review!.key[i].y} x2={shown[j].x} y2={shown[j].y} stroke="var(--ink)" strokeWidth=".7" strokeDasharray="1.5 1" />
              ))}
              {review!.key.map((d, i) => (
                <Pin key={`k${i}`} p={d} color={theme.pin} ring />
              ))}
            </>
          )}
          {phase !== 'study' &&
            shown.map((p, i) => (
              <g key={i} onPointerDown={(e) => (e.stopPropagation(), remove(i))} style={{ cursor: phase === 'answer' ? 'pointer' : 'default' }}>
                <circle cx={p.x} cy={p.y} r="7" fill="transparent" />
                <Pin p={p} color="var(--accent)" label={String(i + 1)} />
              </g>
            ))}
        </svg>
      </div>
      {phase === 'answer' && (
        <>
          <p className="counter mt-3">
            {pins.length} of {count} pins placed{pins.length ? ' · tap a pin to lift it' : ''}
          </p>
          <Done onClick={() => onSubmit(pins)} disabled={pins.length === 0} />
        </>
      )}
      {phase === 'review' && <p className="counter mt-3">Dashed rings: where the pins were. Numbered: yours.</p>}
    </>
  )
}
