import { checkTime, intArray, of, positional, spanOf, spanRecall } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  lengths: number[]
  reversed: boolean
  flashMs: number
}
export interface Study { digits: number[]; flashMs: number; gapMs: number; leadMs: number }
export interface Test { length: number; reversed: boolean }
export type Key = number[]
export type Answer = number[]

const LEAD_MS = 600
const GAP_MS = 200

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'numberspan',
    name: 'Number Span',
    family: 'ASSOC',
    tier: 'quick',
    skins: [
      { id: 'vault', name: 'Vault code', tokens: { kind: 'vault' } },
      { id: 'phone', name: 'Spy phone number', tokens: { kind: 'phone' } },
      { id: 'locker', name: 'Locker combo', tokens: { kind: 'locker' } },
    ],
    ruleText: 'Digits flash one at a time. Punch them in, in the same order.',
    ruleFor: (p) => (p.reversed ? 'Digits flash one at a time. Punch them in backwards: last digit first.' : 'Digits flash one at a time. Punch them in, in the same order.'),
    explainer: [
      { label: 'Watch', text: 'Digits flash one at a time.' },
      { label: 'Enter', text: 'Type them on the keypad.' },
      { label: 'Longer', text: 'Each code is a little longer.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, lengths: [5, 6, 7, 8, 8], reversed: false, flashMs: 750 },
        { trials: 5, lengths: [6, 7, 8, 9, 9], reversed: false, flashMs: 650 },
        { trials: 5, lengths: [4, 5, 6, 7, 7], reversed: true, flashMs: 700 },
      ],
      defaultLevel: 1,
      practice: { trials: 2, lengths: [4, 5], reversed: false, flashMs: 800 },
      targetMedian: 65,
    },
    needs: ['keyboard'],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.lengths.slice(0, p.trials).map((len) => {
        const digits: number[] = []
        while (digits.length < len) {
          const d = rng.int(10)
          if (digits[digits.length - 1] === d) continue // a repeat reads as one long flash
          digits.push(d)
        }
        return {
          study: { digits, flashMs: p.flashMs, gapMs: GAP_MS, leadMs: LEAD_MS },
          test: { length: len, reversed: p.reversed },
          key: p.reversed ? [...digits].reverse() : digits,
          studyMs: LEAD_MS + len * (p.flashMs + GAP_MS),
          answerMs: 3000 + len * 800,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: 10, maxLen: t.test.length }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No code entered' }
    const right = t.key.filter((d, i) => a[i] === d).length
    return { score: positional(t.key, a), summary: of(right, t.key.length, 'digits') }
  },

  validate(inst) {
    for (const t of inst.trials) if (t.study.digits.some((d, i) => i > 0 && t.study.digits[i - 1] === d)) return { ok: false, reason: 'repeated digit' }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [Array(t.test.length).fill(0), Array.from({ length: t.test.length }, (_, i) => i % 10)],
  simulate(t, rng, skill) {
    const span = spanOf(skill, t.test.reversed ? 5 : 7)
    return spanRecall(t.key, span, rng, () => rng.int(10))
  },
}

export default mod
