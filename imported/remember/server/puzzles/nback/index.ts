import { checkTime, intArray, setScore } from '../kit.js'
import { ITEM_SETS } from '../assets.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule, Skin } from '../types.js'

export interface Params {
  trials: number
  /** How far back to compare, per sub-trial. */
  n: number[]
  /** Items in each stream. */
  items: number
  /** Time per item. */
  stepMs: number
}
/**
 * N-back is the one type whose answer happens during the stream. The study phase plays the first `n` items (they
 * cannot match anything yet); the answer phase plays the rest while the player taps Match.
 */
export interface Study { n: number; stream: string[]; stepMs: number; leadMs: number }
export interface Test { n: number; stream: string[]; stepMs: number }
/** Stream indexes that match the item n steps back. */
export type Key = number[]
/** Stream indexes the player tapped Match on. */
export type Answer = number[]

const LEAD_MS = 900
const TAIL_MS = 1200
/** Small alphabets, so repeats (and near-miss lures) happen often. */
const LETTERS = ['B', 'F', 'K', 'M', 'R', 'T']

function alphabet(skin: Skin, rng: Rng): string[] {
  const set = String(skin.tokens.set)
  return set === 'letters' ? LETTERS : rng.sample(ITEM_SETS[set].items, 6)
}

export function targetsOf(stream: string[], n: number): number[] {
  const out: number[] = []
  for (let i = n; i < stream.length; i++) if (stream[i] === stream[i - n]) out.push(i)
  return out
}

const fairCount = (matches: number, open: number) => matches >= 3 && matches <= open * 0.45

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'nback',
    name: 'N-back',
    family: 'SEQUENCE',
    tier: 'medium',
    skins: [
      { id: 'letters', name: 'Letter tiles', tokens: { set: 'letters' } },
      { id: 'parade', name: 'Animal parade', tokens: { set: 'animals' } },
      { id: 'snacks', name: 'Snack conveyor', tokens: { set: 'pantry' } },
    ],
    ruleText: 'Things appear one at a time. Tap Match when one is the same as the one a few steps back.',
    ruleFor: (p) =>
      new Set(p.n).size === 1
        ? `Things appear one at a time. Tap Match when one is the same as the one ${p.n[0]} steps back.`
        : 'Things appear one at a time. Tap Match when one is the same as the one a few steps back. Each round says how far.',
    explainer: [
      { label: 'Watch', text: 'Items appear one at a time.' },
      { label: 'Compare', text: 'Is this the same as the one 2 steps back?' },
      { label: 'Match', text: 'Tap Match only then. Wrong taps cost points.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, n: [1, 2, 2], items: 16, stepMs: 1400 },
        { trials: 3, n: [2, 2, 3], items: 16, stepMs: 1300 },
        { trials: 3, n: [2, 3, 3], items: 17, stepMs: 1250 },
      ],
      defaultLevel: 1,
      practice: { trials: 1, n: [1], items: 10, stepMs: 1500 },
      targetMedian: 55,
    },
    needs: ['keyboard'],
    enabled: true,
    introducedOn: '2026-11-22',
    cooldownDays: 35,
    hardDay: true,
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const abc = alphabet(skin, rng.fork('abc'))
    return {
      trials: p.n.slice(0, p.trials).map((n) => {
        // Redraw until there are enough matches to count, but not so many that tapping often pays.
        let stream: string[] = []
        for (let tries = 0; tries < 100; tries++) {
          stream = []
          for (let i = 0; i < p.items; i++) {
            if (i < n) {
              stream.push(rng.pick(abc))
              continue
            }
            const back = stream[i - n]
            const r = rng.next()
            // Near misses (the item n-1 or n+1 back) make it a memory test, but only a few, or one letter takes over.
            const prev = stream[i - 1]
            if (r < 0.3) stream.push(back)
            else if (r < 0.38 && stream[i - n + 1] !== back) stream.push(stream[i - n + 1]) // lure: n-1 back
            else if (r < 0.46 && i - n - 1 >= 0 && stream[i - n - 1] !== back) stream.push(stream[i - n - 1]) // lure: n+1 back
            else stream.push(rng.pick(abc.filter((x) => x !== back && x !== prev)))
          }
          if (fairCount(targetsOf(stream, n).length, p.items - n)) break
        }
        return {
          study: { n, stream: stream.slice(0, n), stepMs: p.stepMs, leadMs: LEAD_MS },
          test: { n, stream, stepMs: p.stepMs },
          key: targetsOf(stream, n),
          studyMs: LEAD_MS + n * p.stepMs,
          answerMs: (p.items - n) * p.stepMs + TAIL_MS,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => {
    const a = intArray(raw, { max: t.test.stream.length, maxLen: t.test.stream.length, unique: true })
    return a && a.every((i) => i >= t.test.n) ? a : null
  },

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: `0 of ${t.key.length} matches` }
    const { score, hits, wrong } = setScore(t.key, a)
    return { score, summary: `${hits} of ${t.key.length} matches${wrong ? `, ${wrong} false alarm${wrong > 1 ? 's' : ''}` : ''}` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (!fairCount(t.key.length, t.test.stream.length - t.test.n)) return { ok: false, reason: 'too few or too many matches' }
      if (t.key.join() !== targetsOf(t.test.stream, t.test.n).join()) return { ok: false, reason: 'key does not follow the stream' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => {
    const all = t.test.stream.map((_, i) => i).filter((i) => i >= t.test.n)
    return [all, all.filter((i) => i % 2 === 0)]
  },
  simulate(t, rng, skill) {
    const n = t.test.n
    const hit = Math.max(0.2, Math.min(0.97, 0.55 + skill * 0.45 - (n - 2) * 0.2))
    const fa = Math.max(0.01, 0.03 + (1 - skill) * 0.12 + (n - 2) * 0.05)
    const keys = new Set(t.key)
    return t.test.stream.map((_, i) => i).filter((i) => i >= n && (keys.has(i) ? rng.chance(hit) : rng.chance(fa)))
  },
}

export default mod
