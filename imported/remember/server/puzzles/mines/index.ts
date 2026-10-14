import { checkTime, clamp01, intArray, of } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  size: number
  mines: number[]
}
export interface Study { size: number; mines: number[] }
export interface Test { size: number; mineCount: number }
export type Key = number[]
/** Tiles the player cleared. */
export type Answer = number[]

/** Each mine you clear costs this much of the sub-trial. */
const MINE_COST = 0.34

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'mines',
    name: 'Mines',
    family: 'GRID',
    tier: 'quick',
    skins: [
      { id: 'field', name: 'Minefield', tokens: { kind: 'field', hazard: '💣', safe: '🌱' } },
      { id: 'ice', name: 'Thin ice', tokens: { kind: 'ice', hazard: '🕳️', safe: '❄️' } },
    ],
    ruleText: 'See where the mines are, then clear every safe tile without touching one.',
    explainer: [
      { label: 'Spot', text: 'The mines show for a moment.' },
      { label: 'Clear', text: 'Tap every safe tile, then Done.' },
      { label: 'Boom', text: 'Each mine you clear costs a third of the round.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 4, size: 4, mines: [3, 4, 4, 5] },
        { trials: 4, size: 5, mines: [5, 6, 7, 8] },
        { trials: 4, size: 5, mines: [6, 7, 8, 9] },
      ],
      defaultLevel: 1,
      practice: { trials: 1, size: 4, mines: [3] },
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
      trials: p.mines.slice(0, p.trials).map((m) => {
        const mines = rng.sample(Array.from({ length: n }, (_, i) => i), m).sort((a, b) => a - b)
        return {
          study: { size: p.size, mines },
          test: { size: p.size, mineCount: m },
          key: mines,
          studyMs: 1500 + m * 300,
          answerMs: 5000 + (n - m) * 550,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: t.test.size ** 2, maxLen: t.test.size ** 2, unique: true }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'Nothing cleared' }
    const mines = new Set(t.key)
    const safeTotal = t.test.size ** 2 - t.key.length
    const boom = a.filter((x) => mines.has(x)).length
    const cleared = a.length - boom
    return {
      score: clamp01(cleared / safeTotal - boom * MINE_COST),
      summary: `${of(cleared, safeTotal, 'safe tiles')}${boom ? `, ${boom} ${boom === 1 ? 'mine' : 'mines'}` : ''}`,
    }
  },

  validate(inst) {
    for (const t of inst.trials) if (new Set(t.key).size !== t.key.length) return { ok: false, reason: 'duplicate mine' }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => Array.from({ length: t.test.size ** 2 }, (_, i) => i).filter((i) => !t.key.includes(i)),
  spam: (t) => [Array.from({ length: t.test.size ** 2 }, (_, i) => i)],
  simulate(t, rng, skill) {
    const n = t.test.size ** 2
    const mines = new Set(t.key)
    const recall = Math.min(0.99, 0.5 + skill * 0.55 - (t.key.length - 4) * 0.05)
    // Remembered mines are avoided; for forgotten ones, the player either plays safe (skips a few tiles) or risks it.
    const avoided = new Set(t.key.filter(() => rng.chance(recall)))
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      if (avoided.has(i)) continue
      if (mines.has(i)) { if (rng.chance(0.4)) out.push(i); continue }
      if (rng.chance(0.93)) out.push(i)
    }
    return out
  },
}

export default mod
