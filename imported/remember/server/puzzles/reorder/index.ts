import { checkTime, intArray, kendall } from '../kit.js'
import { ITEM_SETS } from '../assets.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Items per sub-trial. */
  items: number[]
}
export interface Study { items: string[] }
/** The same items, shuffled. */
export interface Test { items: string[] }
/** Indexes into test.items, in the original order. */
export type Key = number[]
export type Answer = number[]

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'reorder',
    name: 'Reorder',
    family: 'BUILD',
    tier: 'quick',
    skins: [
      { id: 'parade', name: 'Parade', tokens: { set: 'animals' } },
      { id: 'traffic', name: 'Traffic jam', tokens: { set: 'travel' } },
      { id: 'shelf', name: 'Shop shelf', tokens: { set: 'tray' } },
    ],
    ruleText: 'Remember the line-up. It gets shuffled. Put it back in order.',
    explainer: [
      { label: 'Line up', text: 'A row of things, left to right.' },
      { label: 'Shuffle', text: 'They get mixed up.' },
      { label: 'Restore', text: 'Tap them in the original order, first to last.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, items: [4, 4, 5, 5, 6] },
        { trials: 5, items: [4, 5, 6, 6, 7] },
        { trials: 5, items: [5, 6, 7, 7, 8] },
      ],
      defaultLevel: 1,
      practice: { trials: 2, items: [4, 4] },
      targetMedian: 65,
    },
    needs: ['drag'],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const all = ITEM_SETS[String(skin.tokens.set)].items
    return {
      trials: p.items.slice(0, p.trials).map((k) => {
        const items = rng.sample(all, k)
        // Shuffle until the shown order gives nothing away (no better than reversed-ish).
        let shown = rng.shuffle(items)
        for (let i = 0; i < 50 && kendall(items, shown) > 0; i++) shown = rng.shuffle(items)
        return {
          study: { items },
          test: { items: shown },
          key: items.map((x) => shown.indexOf(x)),
          studyMs: 1200 + k * 650,
          answerMs: 3500 + k * 1000,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: t.test.items.length, maxLen: t.test.items.length, unique: true }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No order' }
    const exact = t.key.filter((x, i) => a[i] === x).length
    // Missing items go to the end in their shown order, so a partial answer still scores what it got right.
    const full = [...a, ...t.key.map((_, i) => i).filter((i) => !a.includes(i))]
    const s = kendall(t.key, full)
    return { score: s, summary: exact === t.key.length ? 'Perfect order' : `${exact} of ${t.key.length} in the right spot` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (kendall(t.key, t.key.map((_, i) => i)) > 0) return { ok: false, reason: 'shuffled order is too close to the answer' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [t.key.map((_, i) => i)],
  simulate(t, rng, skill) {
    // Remembered items keep their place; forgotten ones are dropped in at random.
    const p = Math.min(0.98, 0.5 + skill * 0.5 - (t.key.length - 5) * 0.06)
    const kept = t.key.filter(() => rng.chance(p))
    const rest = rng.shuffle(t.key.filter((x) => !kept.includes(x)))
    const out = [...kept]
    for (const x of rest) out.splice(rng.int(out.length + 1), 0, x)
    return out
  },
}

export default mod
