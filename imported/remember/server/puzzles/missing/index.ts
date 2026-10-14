import { checkTime, intArray, of, setScore } from '../kit.js'
import { CARDS, ITEM_SETS } from '../assets.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule, Skin } from '../types.js'

export interface Params {
  trials: number
  /** Items on the tray per sub-trial. */
  items: number[]
  /** How many vanish per sub-trial. */
  missing: number[]
  /** Wrong options offered next to the missing ones. */
  decoys: number
}
/** Items are ids from the skin's set: emoji, or card ids like "Q♥". */
export interface Study { items: string[] }
export interface Test { remaining: string[]; options: string[]; pick: number }
/** Indexes into options. */
export type Key = number[]
export type Answer = number[]

const pool = (skin: Skin) => (skin.tokens.set === 'cards' ? CARDS : ITEM_SETS[String(skin.tokens.set)].items)

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'missing',
    name: 'Missing Item',
    family: 'ITEMS',
    tier: 'quick',
    skins: [
      { id: 'tray', name: 'Tray of things', tokens: { set: 'tray' } },
      { id: 'cards', name: 'Missing cards', tokens: { set: 'cards' } },
      { id: 'picnic', name: 'Picnic basket', tokens: { set: 'pantry' } },
    ],
    ruleText: 'Study the tray. Something disappears. Pick what is gone.',
    ruleFor: (p) => (p.missing.some((m) => m > 1) ? 'Study the tray. Things disappear. Pick everything that is gone.' : 'Study the tray. Something disappears. Pick what is gone.'),
    explainer: [
      { label: 'Study', text: 'Look over everything on the tray.' },
      { label: 'Gone', text: 'The tray comes back with something missing.' },
      { label: 'Pick', text: 'Tap what vanished. Wrong picks cost points.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, items: [5, 6, 6, 7, 7], missing: [1, 1, 1, 1, 1], decoys: 4 },
        { trials: 5, items: [6, 7, 8, 8, 9], missing: [1, 1, 2, 1, 2], decoys: 4 },
        { trials: 5, items: [8, 9, 10, 10, 11], missing: [1, 2, 2, 2, 3], decoys: 4 },
      ],
      defaultLevel: 1,
      practice: { trials: 2, items: [5, 6], missing: [1, 1], decoys: 4 },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const all = pool(skin)
    return {
      trials: p.items.slice(0, p.trials).map((k, i) => {
        const m = p.missing[i]
        const picked = rng.sample(all, k + p.decoys)
        const items = picked.slice(0, k)
        const gone = rng.sample(items, m)
        const decoys = picked.slice(k)
        const options = rng.shuffle([...gone, ...decoys])
        return {
          study: { items },
          test: { remaining: rng.shuffle(items.filter((x) => !gone.includes(x))), options, pick: m },
          key: gone.map((g) => options.indexOf(g)).sort((a, b) => a - b),
          studyMs: 1200 + k * 450,
          answerMs: 7000 + m * 1500,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: t.test.options.length, maxLen: t.test.options.length, unique: true }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No pick' }
    const s = setScore(t.key, a)
    return { score: s.score, summary: `${of(s.hits, t.key.length, 'found')}${s.wrong ? `, ${s.wrong} wrong` : ''}` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (new Set(t.test.options).size !== t.test.options.length) return { ok: false, reason: 'duplicate option' }
      if (t.key.some((i) => t.test.remaining.includes(t.test.options[i]))) return { ok: false, reason: 'missing item still on tray' }
      if (t.test.options.some((o, i) => !t.key.includes(i) && t.study.items.includes(o))) return { ok: false, reason: 'decoy was on the tray' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [t.test.options.map((_, i) => i)],
  simulate(t, rng, skill) {
    const p = Math.min(0.97, 0.45 + skill * 0.5 - (t.study.items.length - 6) * 0.04)
    return t.key.map((k) => (rng.chance(p) ? k : rng.int(t.test.options.length))).filter((x, i, xs) => xs.indexOf(x) === i)
  },
}

export default mod
