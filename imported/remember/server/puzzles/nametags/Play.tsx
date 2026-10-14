import { useState } from 'react'
import { Done, useDraft, type PlayProps } from '../../web/src/play/kit'
import { Avatar } from '../../web/src/play/Avatar'
import { TAG_COLORS } from '../assets'
import type { Answer, Key, Params, Study, Test } from './index'

function Tag({ text, colors }: { text: string; colors: boolean }) {
  const c = colors ? TAG_COLORS.find((x) => x.name === text) : undefined
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[15px] font-bold">
      {c && <span className="inline-block h-3.5 w-3.5 rounded-full border border-[var(--ink)]/30" style={{ background: c.hex }} />}
      {text}
    </span>
  )
}

export default function NameTagsPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const colors = skin.tokens.tags === 'colors'
  const k = trial.test.avatars.length
  const [assign, setAssign] = useState<number[]>(() => Array(k).fill(-1))
  const [heldTag, setHeldTag] = useState<number | null>(null)
  useDraft(assign, onDraft, phase)

  if (phase === 'study') {
    return (
      <div className="board nametag-grid grid grid-cols-2 gap-3 sm:grid-cols-3">
        {trial.study.people.map((p, i) => (
          <div key={i} className="nametag-person grid justify-items-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2">
            <Avatar a={p.avatar} size={78} />
            <Tag text={p.tag} colors={colors} />
          </div>
        ))}
      </div>
    )
  }

  const shown = review ? review.answer ?? Array(k).fill(-1) : assign
  const used = new Set(shown.filter((x) => x >= 0))
  const giveTo = (person: number) => {
    if (phase !== 'answer') return
    setAssign((as) => {
      const next = [...as]
      if (heldTag === null) {
        next[person] = -1 // tap a tagged person to take the tag back
        return next
      }
      for (let i = 0; i < next.length; i++) if (next[i] === heldTag) next[i] = -1
      next[person] = heldTag
      return next
    })
    setHeldTag(null)
  }

  return (
    <>
      {phase === 'answer' && (
        <div className="board mb-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Tags">
          {trial.test.tags.map((t, i) => (
            <button
              key={t}
              className="min-h-11 rounded-xl p-0.5"
              style={{ outline: heldTag === i ? '3px solid var(--accent)' : undefined, opacity: used.has(i) && heldTag !== i ? 0.35 : 1 }}
              aria-pressed={heldTag === i}
              onClick={() => setHeldTag(heldTag === i ? null : i)}
            >
              <Tag text={t} colors={colors} />
            </button>
          ))}
        </div>
      )}
      <div className="board nametag-grid grid grid-cols-2 gap-3 sm:grid-cols-3">
        {trial.test.avatars.map((a, i) => {
          const tag = shown[i]
          const ok = review ? tag === review.key[i] : null
          return (
            <button
              key={i}
              disabled={phase !== 'answer'}
              onClick={() => giveTo(i)}
              className="nametag-person grid min-h-[132px] justify-items-center gap-1.5 rounded-2xl border bg-[var(--panel)] p-2"
              style={{ borderColor: ok === true ? 'var(--right)' : ok === false ? 'var(--wrong)' : heldTag !== null ? 'var(--accent)' : 'var(--line)', borderWidth: ok === null ? 1 : 3 }}
              aria-label={`Person ${i + 1}${tag >= 0 ? `, tagged ${trial.test.tags[tag]}` : ', no tag'}`}
            >
              <Avatar a={a} size={78} />
              {tag >= 0 ? <Tag text={trial.test.tags[tag]} colors={colors} /> : <span className="text-sm text-[var(--mute)]">no tag</span>}
              {review && ok === false && <span className="text-xs font-bold text-[var(--right)]">was {trial.test.tags[review.key[i]]}</span>}
            </button>
          )
        })}
      </div>
      {phase === 'answer' && (
        <>
          <p className="counter mt-3">{heldTag === null ? 'Tap a tag, then the person it belongs to.' : `Now tap who is ${trial.test.tags[heldTag]}.`}</p>
          <Done onClick={() => onSubmit(assign)} disabled={assign.every((x) => x < 0)} />
        </>
      )}
    </>
  )
}
