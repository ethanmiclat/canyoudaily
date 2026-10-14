import { checkTime, intArray, lcs, orderScore, spanOf, spanRecall } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  stars: number
  /** Route length per sub-trial. */
  route: number[]
  stepMs: number
}
export interface Star { x: number; y: number; size: number }
export interface Study { stars: Star[]; route: number[]; stepMs: number; leadMs: number }
export interface Test { stars: Star[]; length: number }
export type Key = number[]
export type Answer = number[]

const LEAD_MS = 600
const MIN_GAP = 13

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'constellation',
    name: 'Constellation',
    family: 'ROUTE',
    tier: 'quick',
    skins: [
      { id: 'night', name: 'Night sky', tokens: { kind: 'night' } },
      { id: 'harbor', name: 'Harbor lights', tokens: { kind: 'harbor' } },
    ],
    ruleText: 'Stars light up one after another. Connect them in the same order.',
    explainer: [
      { label: 'Watch', text: 'Stars light up one by one, drawing a shape.' },
      { label: 'Connect', text: 'Tap the stars in the same order.' },
      { label: 'Fix', text: 'Undo takes back the last star.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, stars: 10, route: [4, 5, 6, 6, 7], stepMs: 700 },
        { trials: 5, stars: 12, route: [5, 6, 7, 7, 8], stepMs: 620 },
        { trials: 5, stars: 14, route: [6, 7, 8, 8, 9], stepMs: 560 },
      ],
      defaultLevel: 1,
      practice: { trials: 2, stars: 10, route: [3, 4], stepMs: 750 },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.route.slice(0, p.trials).map((k) => {
        const stars: Star[] = []
        let guard = 0
        while (stars.length < p.stars && guard++ < 2000) {
          const s = { x: Math.round(rng.float(7, 93)), y: Math.round(rng.float(7, 93)), size: rng.range(2, 4) }
          if (stars.every((o) => Math.hypot(o.x - s.x, o.y - s.y) >= MIN_GAP)) stars.push(s)
        }
        const route = rng.sample([...stars.keys()], Math.min(k, stars.length))
        return {
          study: { stars, route, stepMs: p.stepMs, leadMs: LEAD_MS },
          test: { stars, length: route.length },
          key: route,
          studyMs: LEAD_MS + k * p.stepMs + 500,
          answerMs: 3000 + k * 1100,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: t.test.stars.length, maxLen: t.test.length }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No stars tapped' }
    const s = orderScore(t.key, a)
    return { score: s, summary: s === 1 ? 'Perfect route' : `${lcs(t.key, a)} of ${t.key.length} stars in order` }
  },

  validate(inst, p) {
    for (const t of inst.trials) {
      if (t.test.stars.length !== p.stars) return { ok: false, reason: 'could not place stars far enough apart' }
      if (new Set(t.key).size !== t.key.length) return { ok: false, reason: 'route repeats a star' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [Array.from({ length: t.test.length }, (_, i) => i)],
  simulate(t, rng, skill) {
    return spanRecall(t.key, spanOf(skill, 5.5) - (t.test.stars.length - 12) * 0.2, rng, () => rng.int(t.test.stars.length))
  },
}

export default mod
