import { checkTime } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  cols: number
  rows: number
  /** Pieces of furniture per sub-trial. */
  items: number[]
}
/** Floor plan, row by row; null is empty floor. */
export interface Study { cols: number; rows: number; slots: (string | null)[] }
/** The furniture, shuffled into a pile. */
export interface Test { cols: number; rows: number; items: string[] }
/** For each item in test order, the slot it belongs in. */
export type Key = number[]
/** For each item in test order, the slot it was put in, or -1. */
export type Answer = number[]

export const ROOMS: Record<string, string[]> = {
  lounge: ['🛋️', '📺', '🪴', '🪑', '🖼️', '💡', '🕰️', '🧸', '📚', '🎸', '🪞', '🧺', '🎮', '☕'],
  kitchen: ['🍳', '🫖', '🧊', '🍞', '🥣', '🧂', '🔪', '🍽️', '🧺', '🪴', '🍎', '🥛', '🧁', '🫙'],
  bedroom: ['🛏️', '🧸', '👟', '🎒', '💡', '⏰', '📚', '🪞', '🧦', '👕', '🎧', '🪴', '🖼️', '🕯️'],
}

const near = (a: number, b: number, cols: number) => Math.max(Math.abs((a % cols) - (b % cols)), Math.abs(Math.floor(a / cols) - Math.floor(b / cols))) <= 1

/** Exact spot 1, a neighboring spot 0.3. */
export function placeCredit(want: number, got: number, cols: number): number {
  return got === want ? 1 : got >= 0 && near(want, got, cols) ? 0.3 : 0
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'room',
    name: 'Room Rebuild',
    family: 'BUILD',
    tier: 'medium',
    skins: [
      { id: 'lounge', name: 'Living room', tokens: { room: 'lounge', floor: '#d9b98c', wall: '#8a6a4a' } },
      { id: 'kitchen', name: 'Kitchen', tokens: { room: 'kitchen', floor: '#cfd8dc', wall: '#5f7480' } },
      { id: 'bedroom', name: 'Bedroom', tokens: { room: 'bedroom', floor: '#c9b8d8', wall: '#6a5a85' } },
    ],
    ruleText: 'Look around the room. Everything gets piled up. Put each thing back where it was.',
    explainer: [
      { label: 'Look', text: 'Each thing has its spot in the room.' },
      { label: 'Pile', text: 'Everything gets moved into a pile.' },
      { label: 'Rebuild', text: 'Tap a thing, then its spot. Close counts a little.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, cols: 3, rows: 3, items: [4, 5, 6] },
        { trials: 3, cols: 4, rows: 3, items: [6, 7, 8] },
        { trials: 3, cols: 4, rows: 4, items: [7, 8, 9] },
      ],
      defaultLevel: 1,
      practice: { trials: 1, cols: 3, rows: 3, items: [3] },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-11-15',
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const pool = ROOMS[String(skin.tokens.room)] ?? ROOMS.lounge
    const n = p.cols * p.rows
    return {
      trials: p.items.slice(0, p.trials).map((k) => {
        const items = rng.sample(pool, k)
        const spots = rng.sample([...Array(n).keys()], k)
        const slots: (string | null)[] = new Array(n).fill(null)
        items.forEach((x, i) => (slots[spots[i]] = x))
        const pile = rng.shuffle(items)
        return {
          study: { cols: p.cols, rows: p.rows, slots },
          test: { cols: p.cols, rows: p.rows, items: pile },
          key: pile.map((x) => slots.indexOf(x)),
          studyMs: 2500 + k * 600,
          answerMs: 7000 + k * 1600,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    const n = t.test.cols * t.test.rows
    if (!Array.isArray(raw) || raw.length !== t.test.items.length) return null
    if (!raw.every((x) => Number.isInteger(x) && x >= -1 && x < n)) return null
    const used = (raw as number[]).filter((x) => x >= 0)
    return new Set(used).size === used.length ? (raw as number[]) : null
  },

  scoreTrial(t, a) {
    if (!a || a.every((x) => x < 0)) return { score: 0, summary: 'Nothing put back' }
    const exact = t.key.filter((k, i) => a[i] === k).length
    const total = t.key.reduce((s, k, i) => s + placeCredit(k, a[i], t.test.cols), 0)
    return { score: total / t.key.length, summary: `${exact} of ${t.key.length} in the right spot` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      // Dropping the pile into the first spots in order must not score well.
      if (mod.scoreTrial(t, t.key.map((_, i) => i)).score > 0.4) return { ok: false, reason: 'pile order gives the layout away' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => {
    const n = t.test.cols * t.test.rows
    return [t.key.map((_, i) => i), t.key.map((_, i) => n - 1 - i)]
  },
  simulate(t, rng, skill) {
    const n = t.test.cols * t.test.rows
    // Spots are remembered for about 3 to 7 things; past that, recall drops fast.
    const p = Math.max(0.15, Math.min(0.97, 0.3 + skill * 0.55 - (t.key.length - 5) * 0.07))
    const out: number[] = new Array(t.key.length).fill(-1)
    const used = new Set<number>()
    t.key.forEach((k, i) => {
      if (rng.chance(p)) (out[i] = k), used.add(k)
    })
    // The rest go somewhere free, often near the right spot.
    t.key.forEach((k, i) => {
      if (out[i] >= 0) return
      const free = [...Array(n).keys()].filter((s) => !used.has(s))
      const close = free.filter((s) => near(s, k, t.test.cols))
      const s = close.length && rng.chance(0.5) ? rng.pick(close) : rng.pick(free)
      out[i] = s
      used.add(s)
    })
    return out
  },
}

export default mod
