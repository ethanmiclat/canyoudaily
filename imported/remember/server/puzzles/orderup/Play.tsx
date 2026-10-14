import { ItemArt } from '../../web/src/play/ItemArt'
import { FoodCap, IngredientArt } from '../../web/src/play/IngredientArt'
import { useState } from 'react'
import { useDraft, type PlayProps } from '../../web/src/play/kit'
import { ingredientsFor, type Answer, type Ingredient, type Key, type Params, type Study, type Test } from './index'

const CUSTOMERS = ['🧑‍🍳', '👩', '🧔', '👵', '🧒', '👨‍🦰', '👩‍🦱', '🧓']

function Layer({ ing, mark }: { ing: Ingredient; mark?: 'right' | 'wrong' }) {
  const h = ing.shape === 'slice' || ing.shape === 'drizzle' || ing.shape === 'sprinkle' ? 24 : ing.shape === 'scoop' ? 34 : 28
  return (
    <div
      className={`serve-layer${mark ? ` is-${mark}` : ''}`}
      role="img"
      aria-label={ing.name}
      style={{
        height: h,
        width: ing.shape === 'scoop' ? '72%' : '94%',
      }}
    >
      <IngredientArt ing={ing}/>{mark && <b className="layer-mark" aria-hidden>{mark==='right'?'✓':'×'}</b>}
    </div>
  )
}

function Stack({ layers, base, top, ings, marks }: { layers: number[]; base: string; top: string; ings: Ingredient[]; marks?: ('right' | 'wrong')[] }) {
  return (
    <div className="serving-stack">
      <div className="serving-cap"><FoodCap label={base}/></div>
      {layers.map((l, i) => (
        <Layer key={i} ing={ings[l]} mark={marks?.[i]} />
      ))}
      <div className="serving-cap"><FoodCap label={top} top/></div>
    </div>
  )
}

export default function OrderUpPlay({ trial, phase, skin, onDraft, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const ings = ingredientsFor(skin)
  const base = String(skin.tokens.base ?? 'Bun')
  const top = String(skin.tokens.top ?? 'Bun')
  const [stack, setStack] = useState<number[]>([])
  useDraft(stack, onDraft, phase)

  if (phase === 'study') {
    return (
      <div className="grid w-full justify-items-center gap-2">
        <div className="flex items-center gap-2 text-[15px]">
          <ItemArt id={CUSTOMERS[trial.study.customer % CUSTOMERS.length]} size={46} />
          <span className="rounded-xl bg-[var(--accent-soft)] px-3 py-1.5 font-semibold">“I’d like exactly this, bottom to top!”</span>
        </div>
        <Stack layers={trial.study.order} base={base} top={top} ings={ings} />
      </div>
    )
  }

  if (phase === 'review' && review) {
    const ans = review.answer ?? []
    return (
      <div className="grid w-full grid-cols-2 justify-items-center gap-3">
        <div className="grid w-full justify-items-center gap-1">
          <span className="label">Order</span>
          <Stack layers={review.key} base={base} top={top} ings={ings} />
        </div>
        <div className="grid w-full justify-items-center gap-1">
          <span className="label">You served</span>
          <Stack layers={ans} base={base} top={top} ings={ings} marks={ans.map((x, i) => (review.key[i] === x ? 'right' : 'wrong'))} />
        </div>
      </div>
    )
  }

  return (
    <>
      <Stack layers={stack} base={base} top={top} ings={ings} />
      <div className="mt-3 grid w-full max-w-[420px] grid-cols-4 gap-2" role="group" aria-label="Ingredients">
        {ings.map((ing, i) => (
          <button
            key={ing.name}
            className="ingredient-option"
            onClick={() => stack.length < trial.test.length + 4 && setStack((s) => [...s, i])}
          >
            <IngredientArt ing={ing}/><span>{ing.name}</span>
          </button>
        ))}
      </div>
      <div className="actions">
        <button className="btn btn-ghost" onClick={() => setStack((s) => s.slice(0, -1))} disabled={!stack.length}>
          Undo
        </button>
        <button className="btn btn-primary done-btn" onClick={() => onSubmit(stack)} disabled={!stack.length}>
          Serve
        </button>
      </div>
      <p className="counter mt-1">{stack.length} layers</p>
    </>
  )
}
