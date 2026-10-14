import { ItemArt } from '../../web/src/play/ItemArt'
import { useState } from 'react'
import { Cells, Done, useDraft, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Study, Test } from './index'

export default function MinesPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { size, mineCount } = trial.test
  const hazard = String(skin.tokens.hazard ?? '💣')
  const safe = String(skin.tokens.safe ?? '🌱')
  const [cleared, setCleared] = useState<number[]>([])
  useDraft(cleared, onDraft, phase)
  const mines = new Set(phase === 'study' ? trial.study.mines : review?.key ?? [])
  const answer = new Set(review ? review.answer ?? [] : cleared)
  const toggle = (i: number) => phase === 'answer' && setCleared((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))

  return (
    <>
      <Cells cols={size}>
        {Array.from({ length: size * size }, (_, i) => {
          const isMine = mines.has(i)
          const isCleared = answer.has(i)
          let bg = 'var(--panel-2)'
          let content = ''
          let label = 'Tile'
          if (phase === 'study') {
            if (isMine) (bg = 'var(--wrong-soft)'), (content = hazard), (label = 'Mine')
          } else if (phase === 'answer') {
            if (isCleared) (bg = 'var(--right-soft)'), (content = safe), (label = 'Cleared')
          } else {
            if (isMine && isCleared) (bg = 'var(--wrong)'), (content = '💥'), (label = 'Mine cleared: boom')
            else if (isMine) (bg = 'var(--wrong-soft)'), (content = hazard), (label = 'Mine, avoided')
            else if (isCleared) (bg = 'var(--right-soft)'), (content = safe), (label = 'Safe, cleared')
            else (bg = 'var(--panel)'), (content = '·'), (label = 'Safe, not cleared')
          }
          return (
            <button key={i} className="cell" style={{ background: bg }} disabled={phase !== 'answer'} aria-pressed={phase === 'answer' ? isCleared : undefined} aria-label={`${label}, row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}`} onClick={() => toggle(i)}>
              {content && <ItemArt id={content} size={30} />}
            </button>
          )
        })}
      </Cells>
      {phase === 'answer' && (
        <>
          <p className="counter mt-3">
            {cleared.length} cleared · {size * size - mineCount} safe tiles · {mineCount} mines
          </p>
          <Done onClick={() => onSubmit(cleared)} />
        </>
      )}
      {phase === 'study' && <p className="counter mt-3">{mineCount} mines. Remember where they are.</p>}
    </>
  )
}
