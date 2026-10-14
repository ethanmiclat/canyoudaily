import { checkTime, intArray, of, setScore } from '../kit.js'
import { ITEM_SETS } from '../assets.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Items shown per sub-trial. */
  shown: number[]
  /** New items mixed in, per sub-trial. */
  extra: number[]
}
export interface Study { items: string[] }
export interface Test { grid: string[]; count: number }
/** Indexes into grid. */
export type Key = number[]
export type Answer = number[]

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'oddback',
    name: 'Odd One Back',
    family: 'ITEMS',
    tier: 'quick',
    skins: [
      { id: 'zoo', name: 'Zoo', tokens: { set: 'animals' } },
      { id: 'pantry', name: 'Pantry', tokens: { set: 'pantry' } },
      { id: 'kit', name: 'Kit bag', tokens: { set: 'sports' } },
      { id: 'garden', name: 'Garden', tokens: { set: 'bugs' } },
    ],
    ruleText: 'Remember a handful of pictures, then find them in a bigger grid.',
    explainer: [
      { label: 'Remember', text: 'A few pictures show for a moment.' },
      { label: 'Find', text: 'They hide in a bigger grid. Tap each one you saw.' },
      { label: 'Careful', text: 'Tapping a new one costs points.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, shown: [3, 4, 4, 5, 5], extra: [5, 5, 6, 6, 7] },
        { trials: 5, shown: [4, 5, 5, 6, 7], extra: [5, 6, 7, 7, 8] },
        { trials: 5, shown: [5, 6, 7, 7, 8], extra: [7, 8, 8, 9, 8] },
      ],
      defaultLevel: 1,
      practice: { trials: 2, shown: [3, 4], extra: [5, 5] },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const all = ITEM_SETS[String(skin.tokens.set)].items
    return {
      trials: p.shown.slice(0, p.trials).map((k, i) => {
        const picked = rng.sample(all, k + p.extra[i])
        const items = picked.slice(0, k)
        const grid = rng.shuffle(picked)
        return {
          study: { items },
          test: { grid, count: k },
          key: items.map((x) => grid.indexOf(x)).sort((a, b) => a - b),
          studyMs: 1000 + k * 650,
          answerMs: 3500 + grid.length * 450,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: t.test.grid.length, maxLen: t.test.grid.length, unique: true }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No picks' }
    const s = setScore(t.key, a)
    return { score: s.score, summary: `${of(s.hits, t.key.length, 'found')}${s.wrong ? `, ${s.wrong} wrong` : ''}` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (new Set(t.test.grid).size !== t.test.grid.length) return { ok: false, reason: 'duplicate picture' }
      if (t.test.grid.length > 16) return { ok: false, reason: 'grid too big for a phone' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [t.test.grid.map((_, i) => i)],
  simulate(t, rng, skill) {
    const p = Math.min(0.98, 0.5 + skill * 0.45 - (t.key.length - 4) * 0.04)
    const hits = t.key.filter(() => rng.chance(p))
    const others = t.test.grid.map((_, i) => i).filter((i) => !t.key.includes(i))
    const falseAlarms = others.filter(() => rng.chance(0.12 - skill * 0.08))
    return [...hits, ...falseAlarms]
  },
}

export default mod
