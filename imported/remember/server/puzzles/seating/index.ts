import { checkTime } from '../kit.js'
import { avatar, distinct, type AvatarSpec } from '../nametags/index.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Seats around the table per sub-trial. */
  seats: number[]
}
/** Seat 0 is the head of the table (marked); seats run clockwise. */
export interface Study { seated: AvatarSpec[] }
/** Everyone in a waiting line, shuffled. */
export interface Test { seats: number; line: AvatarSpec[] }
/** For each person in the line, their seat. */
export type Key = number[]
/** For each person in the line, the seat they were given, or -1. */
export type Answer = number[]

/**
 * Half the credit is for the exact seat, half for keeping neighbors together: a table rotated by one seat still
 * gets half marks, because who sat next to whom is what people remember.
 */
export function seatingScore(key: number[], answer: number[]): { score: number; exact: number; pairs: number } {
  const n = key.length
  const byKeySeat = new Map(key.map((s, person) => [s, person]))
  let exact = 0, pairs = 0
  for (let p = 0; p < n; p++) if (answer[p] === key[p]) exact++
  for (let s = 0; s < n; s++) {
    const a = byKeySeat.get(s)!, b = byKeySeat.get((s + 1) % n)!
    if (answer[a] >= 0 && answer[b] >= 0 && answer[b] === (answer[a] + 1) % n) pairs++
  }
  return { score: 0.5 * (exact / n) + 0.5 * (pairs / n), exact, pairs }
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'seating',
    name: 'Seating Chart',
    family: 'BUILD',
    tier: 'medium',
    skins: [
      { id: 'dinner', name: 'Dinner party', tokens: { center: '🍽️', table: '#c98f5a' } },
      { id: 'campfire', name: 'Campfire', tokens: { center: '🔥', table: '#5b4a3a' } },
      { id: 'picnic', name: 'Picnic blanket', tokens: { center: '🧺', table: '#d65a5a' } },
    ],
    ruleText: 'Remember who sits where. Everyone gets up. Seat them all again.',
    explainer: [
      { label: 'Look', text: 'Everyone has a seat. The star marks the head of the table.' },
      { label: 'Up', text: 'They all get up and wait in line.' },
      { label: 'Seat', text: 'Tap a person, then their seat. Neighbors count too.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, seats: [4, 5, 6] },
        { trials: 3, seats: [5, 6, 7] },
        { trials: 3, seats: [6, 7, 8] },
      ],
      defaultLevel: 1,
      practice: { trials: 1, seats: [4] },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-11-08',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.seats.slice(0, p.trials).map((n) => {
        const seated: AvatarSpec[] = []
        let guard = 0
        while (seated.length < n && guard++ < 1000) {
          const a = avatar(rng)
          if (seated.every((b) => distinct(a, b))) seated.push(a)
        }
        // Shuffle the line until seating it in order (either way round) gives nothing away.
        const spare = (o: number[]) => [o.map((_, i) => i), o.map((_, i) => (n - i) % n)].every((a) => seatingScore(o, a).score <= 0.35)
        let order = rng.shuffle([...Array(seated.length).keys()])
        for (let i = 0; i < 100 && !spare(order); i++) order = rng.shuffle([...Array(seated.length).keys()])
        return {
          study: { seated },
          test: { seats: n, line: order.map((s) => seated[s]) },
          key: order,
          studyMs: 2000 + n * 900,
          answerMs: 6000 + n * 1800,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    const n = t.test.seats
    if (!Array.isArray(raw) || raw.length !== n) return null
    if (!raw.every((x) => Number.isInteger(x) && x >= -1 && x < n)) return null
    const used = (raw as number[]).filter((x) => x >= 0)
    return new Set(used).size === used.length ? (raw as number[]) : null
  },

  scoreTrial(t, a) {
    if (!a || a.every((x) => x < 0)) return { score: 0, summary: 'Nobody seated' }
    const { score, exact, pairs } = seatingScore(t.key, a)
    return { score, summary: `${exact} of ${t.key.length} in their seat, ${pairs} of ${t.key.length} neighbors together` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (t.test.line.length !== t.test.seats) return { ok: false, reason: 'could not draw distinct people' }
      // Seating the line in order, either way round, must not score well.
      const n = t.test.seats
      for (const a of [t.key.map((_, i) => i), t.key.map((_, i) => (n - i) % n)]) if (seatingScore(t.key, a).score > 0.35) return { ok: false, reason: 'line order gives the seating away' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [t.key.map((_, i) => i), t.key.map((_, i) => (t.test.seats - i) % t.test.seats)],
  simulate(t, rng, skill) {
    const n = t.test.seats
    const p = Math.max(0.15, Math.min(0.97, 0.3 + skill * 0.6 - (n - 5) * 0.07))
    // Remembered people keep their seat; a lapse sometimes rotates the whole table by one.
    const shift = rng.chance(0.12 * (1.2 - skill)) ? 1 : 0
    const out: number[] = t.key.map((s) => (rng.chance(p) ? (s + shift) % n : -1))
    const free = rng.shuffle([...Array(n).keys()].filter((s) => !out.includes(s)))
    return out.map((s) => (s >= 0 ? s : free.pop()!))
  },
}

export default mod
