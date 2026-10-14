import { useState } from 'react'
import { Done, useDraft, useElapsed, type PlayProps } from '../../web/src/play/kit'
import { actorPos, type Answer, type Key, type Params, type Study, type Test } from './index'
import { ItemArt, hasItemArt, itemName, readableText } from '../../web/src/play/ItemArt'
import { StreetBackdrop } from '../../web/src/play/EnvironmentArt'
import { handOf } from '../../web/src/play/CharacterArt'

function Street({ study, t, sky, road, kind }: { study: Study; t: number; sky: string; road: string; kind: string }) {
  return (
    <svg viewBox="0 0 100 78" className="block w-full" role="img" aria-label="The street">
      <StreetBackdrop kind={kind} sky={sky} road={road}/>
      {study.places.map((p, k) => (
        <g key={k}>
          <ellipse cx={12.5+25*k} cy="36" rx="10" ry="1" fill="#40394f" opacity=".1"/>
          <ItemArt id={p} x={1.5 + 25 * k} y={13.5} size={22} />
          <text x={12.5+25*k} y="41" textAnchor="middle" fontSize="2.8" fontWeight="600" fill="#514954">{({ '🏪':'Shop', '🏦':'Bank', '🏫':'School', '🏤':'Post office', '🏡':'House', '🛖':'Hut', '🌳':'Tree', '🌾':'Field', '🎠':'Carousel', '⛲':'Fountain', '🛝':'Slide' } as Record<string,string>)[p] ?? itemName(p)}</text>
        </g>
      ))}
      {study.events.map((e, i) => {
        const { x, on } = actorPos(e, t, study.walkMs, study.stayMs)
        if (!on) return null
        const y = i % 2 ? 59 : 43
        // The figure is drawn at 17 units on its 64 grid; the item hangs from its hand with the fingers over it.
        const s = 17 / 64
        const hand = handOf(e.actor)
        const hx = -8 + (hand?.x ?? 46) * s, hy = -1 + (hand?.y ?? 47) * s
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <ItemArt id={e.actor} x={-8} y={-1} size={17} />
            <ItemArt id={e.held} x={hx - 3.2} y={hy - 4.6} size={8.5} />
            {hand && <ellipse cx={hx} cy={hy - 0.4} rx="0.95" ry="1.1" fill={hand.skin} stroke="#40394f" strokeWidth=".25" />}
          </g>
        )
      })}
    </svg>
  )
}

export default function WitnessPlay({ trial, phase, offsetMs, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { questions } = trial.test
  const sky = String(skin.tokens.sky ?? '#cfe3f5')
  const road = String(skin.tokens.road ?? '#b9b2a6')
  const kind = String(skin.tokens.street ?? 'town')
  const t = useElapsed(phase === 'study', offsetMs)
  const [picks, setPicks] = useState<number[]>(() => questions.map(() => -1))
  useDraft(picks, onDraft, phase)

  if (phase === 'study')
    return (
      <>
        <div className="board illustrated-board witness-board">
          <Street study={trial.study} t={t} sky={sky} road={road} kind={kind} />
        </div>
        <p className="counter mt-2">Watch who comes, where they stop, what they carry and where they go.</p>
      </>
    )

  const shown = review ? review.answer ?? questions.map(() => -1) : picks
  return (
    <div className="board witness-questions">
      {questions.map((q, i) => (
        <fieldset key={i} className="witness-question">
          <legend>
            <span className="question-number">{i + 1}</span> {readableText(q.text)}
          </legend>
          <div className="witness-options" style={{ gridTemplateColumns: `repeat(${q.options.length}, minmax(0, 1fr))` }}>
            {q.options.map((o, k) => {
              const chosen = shown[i] === k
              const right = review && review.key[i] === k
              return (
                <button
                  key={k}
                  className={`witness-option${chosen ? ' is-chosen' : ''}${right ? ' is-right' : review && chosen ? ' is-wrong' : ''}`}
                  aria-label={`${itemName(o)}${right ? ', correct answer' : review && chosen ? ', your incorrect answer' : ''}`}
                  aria-pressed={chosen}
                  disabled={phase !== 'answer'}
                  onClick={() => setPicks((p) => p.map((x, j) => (j === i ? k : x)))}
                >
                  {hasItemArt(o) ? <><ItemArt id={o} size={44} /><span>{itemName(o)}</span></> : <span className="text-option">{readableText(o)}</span>}
                  {(right || chosen) && <b className="option-mark" aria-hidden>{review && !right ? '×' : '✓'}</b>}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}
      {phase === 'answer' && <Done onClick={() => onSubmit(picks)} disabled={picks.every((x) => x < 0)} />}
    </div>
  )
}
