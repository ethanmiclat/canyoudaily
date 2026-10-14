import { useState } from 'react'
import { Done, useDraft, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Hsl, Key, Params, Study, Test } from './index'

const css = (c: Hsl) => `hsl(${c.h} ${c.s}% ${c.l}%)`

function Swatch({ color, kind, label }: { color: Hsl; kind: string; label: string }) {
  if (kind === 'balloon')
    return (
      <svg width="150" height="190" viewBox="0 0 100 126" role="img" aria-label={label}>
        <ellipse cx="50" cy="46" rx="38" ry="44" fill={css(color)} stroke="var(--ink)" strokeOpacity=".4" strokeWidth="2" />
        <path d="M46 90h8l-4 6Z" fill={css(color)} />
        <path d="M50 96q-6 10 2 16t-2 14" stroke="var(--mute)" strokeWidth="1.5" fill="none" />
        <ellipse cx="36" cy="30" rx="7" ry="11" fill="#fff" opacity=".35" />
      </svg>
    )
  return (
    <div role="img" aria-label={label} className="grid h-[170px] w-[150px] grid-rows-[1fr_auto] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-sm">
      <div style={{ background: css(color) }} />
      <div className="px-2 py-1.5 text-left text-[12px] font-semibold text-[var(--mute)]">{label}</div>
    </div>
  )
}

function Slider({ label, value, max, onChange, track, unit }: { label: string; value: number; max: number; onChange(v: number): void; track: string; unit: string }) {
  return (
    <label className="grid gap-1">
      <span className="flex justify-between text-[14px] font-semibold">
        {label}
        <span className="tnum text-[var(--mute)]">
          {Math.round(value)}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: track }}
      />
    </label>
  )
}

export default function ColorMatchPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const kind = String(skin.tokens.kind ?? 'chip')
  const [c, setC] = useState<Hsl>(trial.test.start)
  useDraft(c, onDraft, phase)

  if (phase === 'study') return <Swatch color={trial.study.color} kind={kind} label="Remember this color" />
  if (phase === 'review' && review) {
    return (
      <div className="flex flex-wrap justify-center gap-4">
        <Swatch color={review.key} kind={kind} label="The color" />
        <Swatch color={review.answer ?? trial.test.start} kind={kind} label="Your mix" />
      </div>
    )
  }
  const hues = Array.from({ length: 13 }, (_, i) => `hsl(${i * 30} ${c.s}% ${c.l}%)`).join(',')
  return (
    <>
      <Swatch color={c} kind={kind} label="Your mix" />
      <div className="mt-4 grid w-full max-w-[380px] gap-3">
        <Slider label="Hue" value={c.h} max={359} unit="°" onChange={(h) => setC({ ...c, h })} track={`linear-gradient(90deg, ${hues})`} />
        <Slider label="Strength" value={c.s} max={100} unit="%" onChange={(s) => setC({ ...c, s })} track={`linear-gradient(90deg, hsl(${c.h} 0% ${c.l}%), hsl(${c.h} 100% ${c.l}%))`} />
        <Slider label="Lightness" value={c.l} max={100} unit="%" onChange={(l) => setC({ ...c, l })} track={`linear-gradient(90deg, #000, hsl(${c.h} ${c.s}% 50%), #fff)`} />
      </div>
      <Done onClick={() => onSubmit(c)}>That’s it</Done>
    </>
  )
}
