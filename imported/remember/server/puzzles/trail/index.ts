import { checkTime, intArray, orderScore } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  size: number
  /** Steps in the trail per sub-trial (not counting the start). */
  lengths: number[]
  stepMs: number
}
/** Cells are row * size + col. */
export interface Study { size: number; blocked: number[]; path: number[]; stepMs: number; leadMs: number }
export interface Test { size: number; blocked: number[]; start: number; end: number; length: number }
/** The trail after the start cell. */
export type Key = number[]
export type Answer = number[]

const LEAD_MS = 800
/** How much of the trail the shortest way may share. */
const SHORTCUT_MAX = 0.45

export function neighbors(c: number, size: number): number[] {
  const r = Math.floor(c / size), k = c % size
  return [r > 0 && c - size, r < size - 1 && c + size, k > 0 && c - 1, k < size - 1 && c + 1].filter((x): x is number => x !== false)
}

/** Shortest open route from start to end (what a player who forgot would try). */
export function shortest(size: number, blocked: number[], start: number, end: number): number[] {
  const bad = new Set(blocked)
  const prev = new Map<number, number>([[start, -1]])
  const queue = [start]
  while (queue.length) {
    const c = queue.shift()!
    if (c === end) break
    for (const n of neighbors(c, size)) if (!bad.has(n) && !prev.has(n)) prev.set(n, c), queue.push(n)
  }
  const out: number[] = []
  for (let c = end; c !== start && c !== undefined; c = prev.get(c)!) out.unshift(c)
  return out
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'trail',
    name: 'Trail',
    family: 'ROUTE',
    tier: 'medium',
    skins: [
      { id: 'garden', name: 'Hedge garden', tokens: { block: '🌳', ground: '#cfe8c4', trail: '#e8b923', walker: '🐾' } },
      { id: 'snow', name: 'Snowy field', tokens: { block: '🪨', ground: '#eef3f8', trail: '#3567d4', walker: '🐧' } },
      { id: 'space', name: 'Asteroid belt', tokens: { block: '☄️', ground: '#232a4a', trail: '#ec7f22', walker: '🚀' } },
    ],
    ruleText: 'A trail lights up step by step. Then walk it again from memory.',
    explainer: [
      { label: 'Watch', text: 'The trail lights up from the start.' },
      { label: 'Walk', text: 'Tap the squares in the same order.' },
      { label: 'Finish', text: 'The shortest way is not the trail. Stick to what you saw.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 4, size: 5, lengths: [7, 8, 9, 10], stepMs: 400 },
        { trials: 4, size: 6, lengths: [8, 10, 12, 13], stepMs: 360 },
        { trials: 4, size: 6, lengths: [10, 12, 13, 15], stepMs: 330 },
      ],
      defaultLevel: 1,
      practice: { trials: 2, size: 5, lengths: [4, 5], stepMs: 450 },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-11-01',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    const size = p.size
    return {
      trials: p.lengths.slice(0, p.trials).map((len) => {
        let path: number[] = [], blocked: number[] = []
        // A wandering walk from the left edge that turns often, with rocks around it, until the shortest way from
        // start to end is clearly not the trail.
        for (let tries = 0; tries < 400; tries++) {
          path = [rng.int(size) * size]
          let dir = 1
          while (path.length < len + 1) {
            const here = path[path.length - 1]
            const open = neighbors(here, size).filter((n) => !path.includes(n) && neighbors(n, size).filter((m) => path.includes(m)).length === 1)
            if (!open.length) break
            const straight = open.find((n) => n - here === dir)
            const next = straight !== undefined && rng.chance(0.35) ? straight : rng.pick(open)
            dir = next - here
            path.push(next)
          }
          if (path.length !== len + 1) continue
          const free = [...Array(size * size).keys()].filter((c) => !path.includes(c))
          blocked = rng.sample(free, Math.round(free.length * 0.3)).sort((a, b) => a - b)
          if (orderScore(path.slice(1), shortest(size, blocked, path[0], path[len])) <= SHORTCUT_MAX) break
        }
        const start = path[0], end = path[path.length - 1]
        return {
          study: { size, blocked, path, stepMs: p.stepMs, leadMs: LEAD_MS },
          test: { size, blocked, start, end, length: len },
          key: path.slice(1),
          studyMs: LEAD_MS + (len + 1) * p.stepMs + 700,
          answerMs: 4000 + len * 900,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: t.test.size * t.test.size, maxLen: t.test.size * t.test.size, unique: true }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No steps' }
    const s = orderScore(t.key, a)
    let right = 0
    while (right < a.length && a[right] === t.key[right]) right++
    return { score: s, summary: right === t.key.length && a.length === t.key.length ? 'Exact trail' : `${right} of ${t.key.length} steps before going off the trail` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (t.key.length !== t.test.length) return { ok: false, reason: 'trail too short' }
      const route = shortest(t.test.size, t.test.blocked, t.test.start, t.test.end)
      if (!route.length) return { ok: false, reason: 'end not reachable' }
      if (orderScore(t.key, route) > SHORTCUT_MAX) return { ok: false, reason: 'the shortest way is too close to the trail' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [shortest(t.test.size, t.test.blocked, t.test.start, t.test.end)],
  simulate(t, rng, skill) {
    // About 3 to 9 steps are remembered; past that, the walker heads for the end the short way.
    const span = 3 + skill * 6 - (t.study.stepMs < 380 ? 0.5 : 0)
    const out: number[] = []
    for (let i = 0; i < t.key.length; i++) {
      if (i + 1 <= span || rng.chance(0.2)) out.push(t.key[i])
      else if (rng.chance(0.5)) {
        // Head for the end the short way.
        const rest = shortest(t.test.size, t.test.blocked, out.at(-1) ?? t.test.start, t.test.end).filter((c) => !out.includes(c))
        return [...out, ...rest]
      } else {
        // Wander on a guess.
        const blocked = new Set(t.test.blocked)
        const open = neighbors(out.at(-1) ?? t.test.start, t.test.size).filter((c) => !blocked.has(c) && !out.includes(c) && c !== t.test.start)
        if (!open.length) return out
        out.push(rng.pick(open))
      }
    }
    return out
  },
}

export default mod
