import { checkTime, of } from '../kit.js'
import { ITEM_SETS } from '../assets.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Pairs on the board per sub-trial. */
  pairs: number[]
}
export interface Study { cards: string[] }
export interface Test { count: number }
/** For each card, the index of its twin. */
export type Key = number[]
/** Pairs the player linked, as [cardA, cardB]. */
export type Answer = [number, number][]

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'pairs',
    name: 'Pairs',
    family: 'ITEMS',
    tier: 'quick',
    skins: [
      { id: 'fruit', name: 'Fruit stand', tokens: { set: 'pantry' } },
      { id: 'critters', name: 'Critters', tokens: { set: 'animals' } },
      { id: 'travel', name: 'Postcards', tokens: { set: 'travel' } },
    ],
    ruleText: 'See every card face up, then match the pairs with the cards face down.',
    explainer: [
      { label: 'Memorize', text: 'All the cards show face up for a moment.' },
      { label: 'Flip', text: 'They turn face down.' },
      { label: 'Match', text: 'Tap two cards to pair them. Tap a pair to undo.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, pairs: [4, 5, 6] },
        { trials: 3, pairs: [5, 6, 8] },
        { trials: 3, pairs: [6, 8, 9] },
      ],
      defaultLevel: 1,
      practice: { trials: 1, pairs: [4] },
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
      trials: p.pairs.slice(0, p.trials).map((k) => {
        const faces = rng.sample(all, k)
        const cards = rng.shuffle([...faces, ...faces])
        return {
          study: { cards },
          test: { count: cards.length },
          key: cards.map((c, i) => cards.findIndex((d, j) => j !== i && d === c)),
          studyMs: 2000 + k * 900,
          answerMs: 5000 + k * 2000,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    if (!Array.isArray(raw) || raw.length > t.test.count / 2) return null
    const seen = new Set<number>()
    const out: Answer = []
    for (const pr of raw) {
      if (!Array.isArray(pr) || pr.length !== 2) return null
      const [a, b] = pr
      for (const x of [a, b]) {
        if (!Number.isInteger(x) || x < 0 || x >= t.test.count || seen.has(x)) return null
        seen.add(x)
      }
      out.push([a, b])
    }
    return out
  },

  scoreTrial(t, a) {
    const total = t.test.count / 2
    if (!a || a.length === 0) return { score: 0, summary: 'No pairs' }
    const right = a.filter(([x, y]) => t.key[x] === y).length
    return { score: right / total, summary: of(right, total, 'pairs') }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (t.key.some((j, i) => j < 0 || t.key[j] !== i)) return { ok: false, reason: 'every card needs exactly one twin' }
      if (t.test.count > 20) return { ok: false, reason: 'too many cards for a phone' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => t.key.flatMap((j, i) => (i < j ? [[i, j] as [number, number]] : [])),
  spam: (t) => [Array.from({ length: t.test.count / 2 }, (_, i) => [2 * i, 2 * i + 1] as [number, number])],
  simulate(t, rng, skill) {
    const p = Math.min(0.97, 0.5 + skill * 0.5 - (t.test.count / 2 - 5) * 0.06)
    const free = new Set(t.key.map((_, i) => i))
    const out: Answer = []
    for (let i = 0; i < t.key.length; i++) {
      if (!free.has(i)) continue
      free.delete(i)
      let j = t.key[i]
      if (!free.has(j) || !rng.chance(p)) j = rng.pick([...free])
      if (j === undefined) break
      free.delete(j)
      out.push([i, j])
    }
    return out
  },
}

export default mod
