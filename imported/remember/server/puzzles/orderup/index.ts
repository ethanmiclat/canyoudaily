import { checkTime, intArray, lcs, orderScore, spanOf, spanRecall } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule, Skin } from '../types.js'

export interface Params {
  trials: number
  /** Layers per order. */
  layers: number[]
}
/** Layer ids index into the skin's ingredient list. Bottom layer first. */
export interface Study { order: number[]; customer: number }
export interface Test { bin: number; length: number }
export type Key = number[]
export type Answer = number[]

export interface Ingredient { name: string; color: string; shape: 'patty' | 'slice' | 'leaf' | 'round' | 'scoop' | 'sprinkle' | 'drizzle' }
export const INGREDIENTS: Record<string, Ingredient[]> = {
  burger: [
    { name: 'Patty', color: '#7a4425', shape: 'patty' },
    { name: 'Cheese', color: '#f1c232', shape: 'slice' },
    { name: 'Lettuce', color: '#6aa84f', shape: 'leaf' },
    { name: 'Tomato', color: '#d9413a', shape: 'round' },
    { name: 'Onion', color: '#d5a6bd', shape: 'round' },
    { name: 'Pickles', color: '#93c47d', shape: 'round' },
    { name: 'Bacon', color: '#b45f45', shape: 'slice' },
    { name: 'Egg', color: '#fff2cc', shape: 'round' },
  ],
  sundae: [
    { name: 'Vanilla', color: '#f6edd0', shape: 'scoop' },
    { name: 'Chocolate', color: '#6b3e26', shape: 'scoop' },
    { name: 'Strawberry', color: '#f4a6b8', shape: 'scoop' },
    { name: 'Mint', color: '#a8e6cf', shape: 'scoop' },
    { name: 'Mango', color: '#ffb547', shape: 'scoop' },
    { name: 'Fudge', color: '#4a2a17', shape: 'drizzle' },
    { name: 'Sprinkles', color: '#e06666', shape: 'sprinkle' },
    { name: 'Caramel', color: '#c98a2b', shape: 'drizzle' },
  ],
  sandwich: [
    { name: 'Ham', color: '#e8a0a0', shape: 'slice' },
    { name: 'Turkey', color: '#e5cfa8', shape: 'slice' },
    { name: 'Cheese', color: '#f1c232', shape: 'slice' },
    { name: 'Lettuce', color: '#6aa84f', shape: 'leaf' },
    { name: 'Tomato', color: '#d9413a', shape: 'round' },
    { name: 'Cucumber', color: '#7fb77e', shape: 'round' },
    { name: 'Avocado', color: '#a3c269', shape: 'slice' },
    { name: 'Peppers', color: '#e69138', shape: 'round' },
  ],
}

export const ingredientsFor = (skin: Skin) => INGREDIENTS[String(skin.tokens.menu)] ?? INGREDIENTS.burger

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'orderup',
    name: 'Order Up',
    family: 'BUILD',
    tier: 'quick',
    skins: [
      { id: 'burger', name: 'Burger bar', tokens: { menu: 'burger', base: 'Bun', top: 'Bun' } },
      { id: 'sundae', name: 'Sundae stand', tokens: { menu: 'sundae', base: 'Cup', top: 'Cherry' } },
      { id: 'sandwich', name: 'Deli counter', tokens: { menu: 'sandwich', base: 'Bread', top: 'Bread' } },
    ],
    ruleText: 'A customer shows their order. Rebuild it, layer by layer, from the bottom up.',
    explainer: [
      { label: 'Order', text: 'The order flashes up, bottom layer first.' },
      { label: 'Build', text: 'Tap ingredients to stack them in the same order.' },
      { label: 'Serve', text: 'Tap Serve when it looks right. Undo fixes a slip.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, layers: [4, 5, 5, 6, 7] },
        { trials: 5, layers: [5, 6, 6, 7, 8] },
        { trials: 5, layers: [6, 7, 7, 8, 9] },
      ],
      defaultLevel: 1,
      practice: { trials: 2, layers: [3, 4] },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const bin = ingredientsFor(skin).length
    return {
      trials: p.layers.slice(0, p.trials).map((len) => {
        const order: number[] = []
        while (order.length < len) {
          const x = rng.int(bin)
          if (order[order.length - 1] === x) continue // no doubled layers: they read as one
          order.push(x)
        }
        return {
          study: { order, customer: rng.int(8) },
          test: { bin, length: len },
          key: order,
          studyMs: 1000 + len * 450,
          answerMs: 3500 + len * 1000,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: t.test.bin, maxLen: t.test.length + 4 }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'Nothing served' }
    const s = orderScore(t.key, a)
    return { score: s, summary: s === 1 ? 'Perfect order' : `${lcs(t.key, a)} of ${t.key.length} layers in order` }
  },

  validate(inst) {
    for (const t of inst.trials) if (t.key.some((x, i) => i > 0 && t.key[i - 1] === x)) return { ok: false, reason: 'doubled layer' }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [Array.from({ length: t.test.bin }, (_, i) => i), Array(t.test.length).fill(0)],
  simulate(t, rng, skill) {
    return spanRecall(t.key, spanOf(skill, 5), rng, () => rng.int(t.test.bin))
  },
}

export default mod
