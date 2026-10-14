import { checkTime, intIn } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  cups: number
  /** Swaps per sub-trial. */
  swaps: number[]
  swapMs: number
}
/** Cups are identified by their starting slot. Each swap exchanges the cups in two slots. */
export interface Study { cups: number; ballSlot: number; swaps: [number, number][]; swapMs: number; showMs: number; dropMs: number }
export interface Test { cups: number }
/** Slot the ball ends under. */
export type Key = number
export type Answer = number

const SHOW_MS = 1400
const DROP_MS = 600

export function finalSlot(start: number, swaps: [number, number][]): number {
  let at = start
  for (const [a, b] of swaps) at = at === a ? b : at === b ? a : at
  return at
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'shell',
    name: 'Shell Game',
    family: 'TRACK',
    tier: 'quick',
    skins: [
      { id: 'cups', name: 'Cups and ball', tokens: { cover: 'cup', prize: 'ball' } },
      { id: 'chests', name: 'Treasure chests', tokens: { cover: 'chest', prize: 'coin' } },
      { id: 'hats', name: 'Magic hats', tokens: { cover: 'hat', prize: 'bunny' } },
    ],
    ruleText: 'Keep your eye on the ball while the cups shuffle. Then tap the cup it is under.',
    explainer: [
      { label: 'Watch', text: 'The ball goes under a cup.' },
      { label: 'Track', text: 'The cups swap places. Follow the right one.' },
      { label: 'Pick', text: 'Tap the cup hiding the ball.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, cups: 3, swaps: [6, 8, 10, 12, 14], swapMs: 420 },
        { trials: 5, cups: 4, swaps: [8, 10, 12, 14, 16], swapMs: 360 },
        { trials: 5, cups: 5, swaps: [10, 12, 14, 16, 18], swapMs: 320 },
      ],
      defaultLevel: 1,
      practice: { trials: 2, cups: 3, swaps: [4, 6], swapMs: 520 },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.swaps.slice(0, p.trials).map((s) => {
        const ballSlot = rng.int(p.cups)
        const swaps: [number, number][] = []
        let at = ballSlot
        for (let i = 0; i < s; i++) {
          // Most swaps move the ball's cup, so the shuffle is never trivially "it stayed put".
          let a: number, b: number
          if (rng.chance(0.65)) {
            a = at
            b = rng.pick([...Array(p.cups).keys()].filter((x) => x !== at))
          } else {
            ;[a, b] = rng.sample([...Array(p.cups).keys()], 2)
          }
          swaps.push(a < b ? [a, b] : [b, a])
          at = finalSlot(at, [[a, b]])
        }
        return {
          study: { cups: p.cups, ballSlot, swaps, swapMs: p.swapMs, showMs: SHOW_MS, dropMs: DROP_MS },
          test: { cups: p.cups },
          key: at,
          studyMs: SHOW_MS + DROP_MS + s * p.swapMs + 200,
          answerMs: 6000,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intIn(raw, t.test.cups),

  scoreTrial(t, a) {
    if (a === null) return { score: 0, summary: 'No pick' }
    return a === t.key ? { score: 1, summary: 'Found it' } : { score: 0, summary: `It was under cup ${t.key + 1}` }
  },

  validate(inst) {
    // Players read "always the middle cup" as rigged, so no cup ends up hiding the ball in most rounds.
    const ends = inst.trials.map((t) => t.key)
    if (ends.length >= 3 && ends.some((s) => ends.filter((x) => x === s).length > Math.ceil(ends.length * 0.6))) return { ok: false, reason: 'ball ends under the same cup too often' }
    for (const t of inst.trials) {
      if (finalSlot(t.study.ballSlot, t.study.swaps) !== t.key) return { ok: false, reason: 'key does not follow the swaps' }
      if (t.study.swaps.some(([a, b]) => a === b)) return { ok: false, reason: 'a cup swapped with itself' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => t.key,
  spam: () => [0],
  simulate(t, rng, skill) {
    // Each swap risks losing track; faster swaps are riskier.
    const lose = Math.max(0.004, (1.1 - skill) * 0.055 * (520 / t.study.swapMs) ** 2)
    const keep = Math.pow(1 - lose, t.study.swaps.length)
    return rng.chance(keep) ? t.key : rng.int(t.test.cups)
  },
}

export default mod
