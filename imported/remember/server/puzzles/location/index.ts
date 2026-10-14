import { checkTime, clamp01, numIn } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Dots per sub-trial. */
  dots: number[]
}
export interface Pt { x: number; y: number }
/** Decorative map features in 0..100 coordinates. Same map for every sub-trial of a day. */
export interface MapArt {
  river: Pt[]
  ponds: { x: number; y: number; r: number }[]
  trees: Pt[]
  paths: Pt[][]
}
export interface Study { map: MapArt; dots: Pt[] }
export interface Test { map: MapArt; count: number }
export type Key = Pt[]
export type Answer = Pt[]

/** Within FULL units of a dot is full marks; credit falls to zero at ZERO units. The board is 100 units wide. */
const FULL = 8
const ZERO = 28
const MIN_GAP = 20

export function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Credit for one placement. */
export const credit = (d: number) => clamp01((ZERO - d) / (ZERO - FULL))

/** Best one-to-one matching of guesses to dots (k <= 7, so brute force over permutations is fine). */
export function bestMatch(dots: Pt[], guesses: Pt[]): { total: number; pairs: [number, number][] } {
  let best = { total: -1, pairs: [] as [number, number][] }
  const used = new Array(guesses.length).fill(false)
  const cur: [number, number][] = []
  const go = (i: number, acc: number) => {
    if (i === dots.length) {
      if (acc > best.total) best = { total: acc, pairs: [...cur] }
      return
    }
    let any = false
    for (let j = 0; j < guesses.length; j++) {
      if (used[j]) continue
      any = true
      used[j] = true
      cur.push([i, j])
      go(i + 1, acc + credit(dist(dots[i], guesses[j])))
      cur.pop()
      used[j] = false
    }
    if (!any || guesses.length < dots.length) go(i + 1, acc) // this dot gets no guess
  }
  go(0, 0)
  return best
}

function makeMap(rng: Rng): MapArt {
  const y0 = rng.float(20, 80)
  const river: Pt[] = Array.from({ length: 6 }, (_, i) => ({ x: i * 20, y: Math.max(5, Math.min(95, y0 + rng.float(-14, 14))) }))
  const ponds = Array.from({ length: rng.range(1, 2) }, () => ({ x: rng.float(15, 85), y: rng.float(15, 85), r: rng.float(5, 9) }))
  const trees = Array.from({ length: 9 }, () => ({ x: rng.float(4, 96), y: rng.float(4, 96) }))
  const paths = [
    [{ x: rng.float(0, 30), y: 0 }, { x: rng.float(30, 70), y: rng.float(30, 70) }, { x: rng.float(60, 100), y: 100 }],
    [{ x: 0, y: rng.float(40, 100) }, { x: rng.float(40, 60), y: rng.float(20, 80) }, { x: 100, y: rng.float(0, 60) }],
  ]
  return { river, ponds, trees, paths }
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'location',
    name: 'Location',
    family: 'GRID',
    tier: 'quick',
    skins: [
      { id: 'park', name: 'Park map', tokens: { kind: 'park', pin: '📍' } },
      { id: 'island', name: 'Treasure island', tokens: { kind: 'island', pin: '✖' } },
      { id: 'night', name: 'Night patrol', tokens: { kind: 'night', pin: '🔦' } },
    ],
    ruleText: 'Pins appear on a map. When they vanish, tap where each one was.',
    explainer: [
      { label: 'Look', text: 'A few pins appear on the map.' },
      { label: 'Place', text: 'Tap the map to put each pin back.' },
      { label: 'Close counts', text: 'Nearer is better. Tap a pin to move it.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, dots: [2, 3, 3, 4, 4] },
        { trials: 5, dots: [3, 3, 4, 4, 5] },
        { trials: 5, dots: [3, 4, 5, 5, 6] },
      ],
      defaultLevel: 1,
      practice: { trials: 2, dots: [2, 3] },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    const map = makeMap(rng.fork('map'))
    return {
      trials: p.dots.slice(0, p.trials).map((k) => {
        const dots: Pt[] = []
        let tries = 0
        while (dots.length < k && tries++ < 500) {
          const d = { x: Math.round(rng.float(8, 92)), y: Math.round(rng.float(8, 92)) }
          if (dots.every((o) => dist(o, d) >= MIN_GAP)) dots.push(d)
        }
        return {
          study: { map, dots },
          test: { map, count: k },
          key: dots,
          studyMs: 1500 + k * 600,
          answerMs: 3500 + k * 1600,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    if (!Array.isArray(raw) || raw.length > t.test.count) return null
    const out: Pt[] = []
    for (const r of raw) {
      const x = numIn((r as Pt)?.x, 0, 100), y = numIn((r as Pt)?.y, 0, 100)
      if (x === null || y === null) return null
      out.push({ x, y })
    }
    return out
  },

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No pins placed' }
    const m = bestMatch(t.key, a)
    const close = m.pairs.filter(([i, j]) => dist(t.key[i], a[j]) <= FULL * 1.5).length
    return { score: m.total / t.key.length, summary: `${close} of ${t.key.length} pins spot on` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (t.key.length !== t.test.count) return { ok: false, reason: 'could not place dots far enough apart' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => t.key.map((d) => ({ ...d })),
  spam: (t) => [Array.from({ length: t.test.count }, () => ({ x: 50, y: 50 })), Array.from({ length: t.test.count }, (_, i) => ({ x: 20 + (i * 60) / t.test.count, y: 50 }))],
  simulate(t, rng, skill) {
    const sd = 4 + (1 - skill) * 10 + t.key.length * 1.2
    return t.key.map((d) =>
      rng.chance(0.85 + skill * 0.1)
        ? { x: Math.max(0, Math.min(100, d.x + rng.normal(0, sd))), y: Math.max(0, Math.min(100, d.y + rng.normal(0, sd))) }
        : { x: rng.float(5, 95), y: rng.float(5, 95) },
    )
  },
}

export default mod
