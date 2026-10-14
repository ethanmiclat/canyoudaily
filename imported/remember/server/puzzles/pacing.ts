/**
 * Shared pacing, on top of each type's own timing formulas. Two questions decide how a type's clock stretches:
 *
 *   still  Does the study phase show a still picture? Then more looking time helps. If it plays an animation
 *          (a sequence, a shuffle, dots moving), its length is the animation and stretching it only adds a pause.
 *   grows  Does the content get bigger round by round (longer sequences, more cells, more targets)? Then the time
 *          already grows with it, and tapering the clock on top would make the last rounds near impossible.
 *          If the content stays about the same size, early rounds are relaxed and the clock tightens later.
 *
 * Types left out of the table keep their own timing: N-back's answer phase is the rest of the stream, in real time.
 */
import type { Instance, PuzzleModule } from './types.js'

export interface Pacing { still: boolean; grows: boolean }

export const PACING: Record<string, Pacing> = {
  sequence: { still: false, grows: true },
  grid: { still: true, grows: true },
  missing: { still: true, grows: true },
  pairs: { still: true, grows: true },
  spot: { still: true, grows: false },
  orderup: { still: true, grows: true },
  cipher: { still: true, grows: true },
  nametags: { still: true, grows: true },
  mines: { still: true, grows: true },
  shell: { still: false, grows: true },
  location: { still: true, grows: true },
  oddback: { still: true, grows: true },
  reorder: { still: true, grows: true },
  constellation: { still: false, grows: true },
  colormatch: { still: true, grows: false },
  numberspan: { still: false, grows: true },
  echo: { still: false, grows: true },
  pixel: { still: true, grows: true },
  dots: { still: false, grows: true },
  trail: { still: false, grows: true },
  witness: { still: false, grows: false },
  seating: { still: true, grows: true },
  laser: { still: true, grows: true },
  room: { still: true, grows: true },
  jigsaw: { still: true, grows: true },
  face: { still: true, grows: true },
  cube: { still: true, grows: true },
  scene: { still: true, grows: false },
}

/**
 * Multipliers: growing content gets a flat boost; steady content starts generous and tightens by the last round.
 * The boost is capped per round, so the extra time lands on the short, rushed windows rather than on types that
 * already gave plenty.
 */
const GROWS = { study: 1.35, answer: 1.6 }
const STEADY = { study: [1.6, 1.1], answer: [1.9, 1.25] }
const MAX_EXTRA = { study: 2500, answer: 8000 }

const lerp = ([a, b]: number[], t: number) => a + (b - a) * t
const round100 = (ms: number) => Math.round(ms / 100) * 100
const stretch = (ms: number, by: number, max: number) => round100(ms + Math.min(ms * (by - 1), max))

export function pace<I extends Instance>(inst: I, p: Pacing): I {
  const n = inst.trials.length
  return {
    ...inst,
    trials: inst.trials.map((t, i) => {
      const at = n > 1 ? i / (n - 1) : 0
      const study = p.still ? (p.grows ? GROWS.study : lerp(STEADY.study, at)) : 1
      const answer = p.grows ? GROWS.answer : lerp(STEADY.answer, at)
      return { ...t, studyMs: stretch(t.studyMs, study, MAX_EXTRA.study), answerMs: stretch(t.answerMs, answer, MAX_EXTRA.answer) }
    }),
  }
}

/** The module with pacing applied to everything it generates. */
export function paced<M extends PuzzleModule>(mod: M): M {
  const p = PACING[mod.manifest.id]
  if (!p) return mod
  return { ...mod, generate: (seed, params, skin) => pace(mod.generate(seed, params, skin), p) }
}
