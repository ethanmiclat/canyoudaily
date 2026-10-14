import { checkTime, intArray, of, positional } from '../kit.js'
import { GLYPHS } from '../assets.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Symbols in the key, per sub-trial. */
  symbols: number[]
  /** Message length, per sub-trial. */
  message: number[]
}
export type Glyph = (typeof GLYPHS)[number]
export interface Study { key: { glyph: Glyph; digit: number }[] }
export interface Test { message: Glyph[] }
export type Key = number[]
export type Answer = number[]

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'cipher',
    name: 'Cipher',
    family: 'ASSOC',
    tier: 'quick',
    skins: [
      { id: 'spy', name: 'Spy code', tokens: { style: 'ink' } },
      { id: 'runes', name: 'Old runes', tokens: { style: 'stone' } },
      { id: 'stars', name: 'Star code', tokens: { style: 'neon' } },
    ],
    ruleText: 'Learn which symbol stands for which digit, then decode a message without the key.',
    explainer: [
      { label: 'Learn', text: 'A key pairs each symbol with a digit.' },
      { label: 'Hide', text: 'The key goes away.' },
      { label: 'Decode', text: 'Type the digit for each symbol in the message.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, symbols: [3, 4, 4], message: [3, 4, 5] },
        { trials: 3, symbols: [4, 5, 5], message: [4, 5, 6] },
        { trials: 3, symbols: [5, 6, 6], message: [5, 6, 7] },
      ],
      defaultLevel: 1,
      practice: { trials: 1, symbols: [3], message: [3] },
      targetMedian: 65,
    },
    needs: ['keyboard'],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.symbols.slice(0, p.trials).map((k, i) => {
        const glyphs = rng.sample(GLYPHS, k)
        const digits = rng.sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], k)
        const key = glyphs.map((glyph, j) => ({ glyph, digit: digits[j] }))
        // Every symbol appears at least once when the message is long enough.
        const len = p.message[i]
        const order = rng.shuffle(key)
        const msg = Array.from({ length: len }, (_, j) => (j < k ? order[j] : rng.pick(key)))
        const message = rng.shuffle(msg)
        return {
          study: { key },
          test: { message: message.map((m) => m.glyph) },
          key: message.map((m) => m.digit),
          studyMs: 2000 + k * 900,
          answerMs: 5000 + len * 1700,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: 10, maxLen: t.test.message.length }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No answer' }
    const right = t.key.filter((d, i) => a[i] === d).length
    return { score: positional(t.key, a), summary: of(right, t.key.length, 'digits') }
  },

  validate(inst) {
    for (const t of inst.trials) {
      const map = new Map(t.study.key.map((k) => [k.glyph, k.digit]))
      if (map.size !== t.study.key.length) return { ok: false, reason: 'duplicate glyph' }
      if (new Set(t.study.key.map((k) => k.digit)).size !== t.study.key.length) return { ok: false, reason: 'two glyphs share a digit' }
      if (t.test.message.some((g, i) => map.get(g) !== t.key[i])) return { ok: false, reason: 'message does not decode to key' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [Array(t.key.length).fill(0), Array(t.key.length).fill(t.study.key[0].digit)],
  simulate(t, rng, skill) {
    const p = Math.min(0.98, 0.35 + skill * 0.55 - (t.study.key.length - 4) * 0.08)
    const known = new Map(t.study.key.map((k) => [k.glyph, rng.chance(p) ? k.digit : rng.int(10)]))
    return t.test.message.map((g) => known.get(g)!)
  },
}

export default mod
