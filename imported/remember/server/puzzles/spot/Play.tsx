import { useState } from 'react'
import { Shape, type PlayProps } from '../../web/src/play/kit'
import type { Answer, Key, Params, Scene, Study, Test } from './index'

function SceneGrid({ scene, cols, onTap, picked, keySlot, disabled, ground }: { scene: Scene; cols: number; onTap?(i: number): void; picked?: number | null; keySlot?: number; disabled: boolean; ground: string }) {
  return (
    <div className="board rounded-2xl p-2" style={{ background: ground }}>
      <div className="cells" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 6 }}>
        {scene.map((o, i) => {
          const isKey = keySlot === i
          const isPick = picked === i
          return (
            <button
              key={i}
              className="cell"
              disabled={disabled}
              onClick={() => onTap?.(i)}
              aria-label={o ? `${o.color} ${o.shape}` : 'empty spot'}
              style={{
                background: 'color-mix(in srgb, var(--panel) 70%, transparent)',
                boxShadow: isKey ? 'inset 0 0 0 3px var(--right)' : isPick ? `inset 0 0 0 3px ${keySlot === undefined ? 'var(--accent)' : 'var(--wrong)'}` : undefined,
              }}
            >
              {o && <Shape shape={o.shape} color={o.color} size={40} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function SpotPlay({ trial, phase, skin, onSubmit, review }: PlayProps<Study, Test, Key, Answer, Params>) {
  const [picked, setPicked] = useState<number | null>(null)
  const ground = skin.tokens.kind === 'garden' ? 'color-mix(in srgb, #6aa84f 30%, var(--panel))' : 'color-mix(in srgb, #b98a5a 25%, var(--panel))'
  const { cols } = trial.test
  if (phase === 'study') return <SceneGrid scene={trial.study.scene} cols={cols} disabled ground={ground} />
  if (phase === 'review' && review) {
    return (
      <div className="grid w-full justify-items-center gap-3">
        <div className="label">Before</div>
        <SceneGrid scene={trial.study.scene} cols={cols} disabled keySlot={review.key.slot} ground={ground} />
        <div className="label">After (your tap {review.answer === null ? 'none' : 'outlined'})</div>
        <SceneGrid scene={trial.test.scene} cols={cols} disabled keySlot={review.key.slot} picked={review.answer} ground={ground} />
      </div>
    )
  }
  return (
    <>
      <SceneGrid
        scene={trial.test.scene}
        cols={cols}
        disabled={phase !== 'answer' || picked !== null}
        picked={picked}
        ground={ground}
        onTap={(i) => {
          setPicked(i)
          onSubmit(i)
        }}
      />
      <p className="counter mt-3">One thing changed. Tap it (or where it was).</p>
    </>
  )
}
