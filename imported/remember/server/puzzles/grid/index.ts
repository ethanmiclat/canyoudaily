import { checkTime, intArray, of, setScore } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  size: number
  /** Lit cells per sub-trial. */
  cells: number[]
}
export interface Study { size: number; lit: number[] }
export interface Test { size: number; count: number }
export type Key = number[]
export type Answer = number[]

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'grid',
    name: 'Grid Pattern',
    family: 'GRID',
    tier: 'quick',
    skins: [
      { id: 'tiles', name: 'Tiles', tokens: { kind: 'tiles' } },
      { id: 'windows', name: 'City windows', tokens: { kind: 'windows' } },
      { id: 'garden', name: 'Garden beds', tokens: { kind: 'garden' } },
    ],
    ruleText: 'A pattern of squares lights up. Tap the same squares from memory.',
    explainer: [
      { label: 'Look', text: 'Some squares light up for a moment.' },
      { label: 'Rebuild', text: 'Tap the squares that were lit, then Done.' },
      { label: 'Careful', text: 'Wrong taps cost points.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, size: 4, cells: [3, 4, 5, 5, 6] },
        { trials: 5, size: 5, cells: [4, 5, 6, 7, 8] },
        { trials: 5, size: 5, cells: [6, 7, 8, 9, 10] },
      ],
      defaultLevel: 1,
      practice: { trials: 2, size: 4, cells: [3, 4] },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    const n = p.size * p.size
    return {
      trials: p.cells.slice(0, p.trials).map((k) => {
        const lit = rng.sample(Array.from({ length: n }, (_, i) => i), k).sort((a, b) => a - b)
        return {
          study: { size: p.size, lit },
          test: { size: p.size, count: k },
          key: lit,
          studyMs: 1200 + k * 250,
          answerMs: 4500 + k * 700,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: t.test.size ** 2, maxLen: t.test.size ** 2, unique: true }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No answer' }
    const s = setScore(t.key, a)
    return { score: s.score, summary: `${of(s.hits, t.key.length, 'squares')}${s.wrong ? `, ${s.wrong} wrong` : ''}` }
  },

  validate(inst, p) {
    for (const t of inst.trials) {
      if (new Set(t.key).size !== t.key.length) return { ok: false, reason: 'duplicate cell' }
      if (t.key.length >= p.size * p.size / 2) return { ok: false, reason: 'pattern covers half the board' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [Array.from({ length: t.test.size ** 2 }, (_, i) => i)],
  simulate(t, rng, skill) {
    const p = Math.max(0.2, Math.min(0.99, 0.55 + skill * 0.5 - (t.key.length - 4) * 0.05))
    const out = t.key.filter(() => rng.chance(p))
    const n = t.test.size ** 2
    // Misses are often replaced by a neighbouring guess.
    for (let i = out.length; i < t.key.length; i++) if (rng.chance(0.6)) out.push(rng.int(n))
    return [...new Set(out)]
  },
}

export default mod
