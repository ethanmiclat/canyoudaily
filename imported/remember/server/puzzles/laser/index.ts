import { checkTime } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  lanes: number
  /** Columns of lasers per sub-trial. */
  cols: number[]
}
/** safe[c] lists the lanes with no laser in column c. A route moving at most one lane per column always exists. */
export interface Study { lanes: number; safe: number[][] }
export interface Test { lanes: number; cols: number }
export type Key = number[][]
/** The lane the thief takes in each column, in order. */
export type Answer = number[]

/** Walking straight down any one lane must not get far. */
function crowdedLane(safe: number[][], lanes: number): boolean {
  for (let l = 0; l < lanes; l++) if (safe.filter((s) => s.includes(l)).length / safe.length > 0.4) return true
  return false
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'laser',
    name: 'Laser Hallway',
    family: 'ROUTE',
    tier: 'medium',
    skins: [
      { id: 'museum', name: 'Museum heist', tokens: { beam: '#e0342b', floor: '#2a2438', thief: '🦹', prize: '💎' } },
      { id: 'vault', name: 'Bank vault', tokens: { beam: '#2fbf5b', floor: '#1f2b2a', thief: '🕵️', prize: '💰' } },
      { id: 'cat', name: 'Cat burglar', tokens: { beam: '#3a8bff', floor: '#24283a', thief: '🐈‍⬛', prize: '🐟' } },
    ],
    ruleText: 'The lasers flash on, then go dark. Guide the thief through the gaps from memory.',
    explainer: [
      { label: 'Flash', text: 'See where the lasers are in each column.' },
      { label: 'Dark', text: 'The lasers turn invisible.' },
      { label: 'Sneak', text: 'Step column by column, one lane up or down at most.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 4, lanes: 4, cols: [5, 6, 7, 7] },
        { trials: 4, lanes: 4, cols: [6, 7, 8, 9] },
        { trials: 4, lanes: 5, cols: [7, 8, 9, 10] },
      ],
      defaultLevel: 1,
      practice: { trials: 2, lanes: 4, cols: [4, 5] },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-11-11',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.cols.slice(0, p.trials).map((cols) => {
        // A route that changes lane often, plus the odd extra gap, until no single lane is safe too often.
        let safe: number[][] = []
        for (let tries = 0; tries < 200; tries++) {
          const route = [rng.int(p.lanes)]
          while (route.length < cols) {
            const at = route[route.length - 1]
            const moves = [at - 1, at + 1].filter((l) => l >= 0 && l < p.lanes)
            route.push(rng.chance(0.75) ? rng.pick(moves) : at)
          }
          safe = route.map((l) => {
            const extra = rng.int(p.lanes)
            return rng.chance(0.25) && extra !== l ? [l, extra].sort((a, b) => a - b) : [l]
          })
          if (!crowdedLane(safe, p.lanes)) break
        }
        return {
          study: { lanes: p.lanes, safe },
          test: { lanes: p.lanes, cols },
          key: safe,
          studyMs: 1200 + cols * 420,
          answerMs: 4000 + cols * 800,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    if (!Array.isArray(raw) || raw.length > t.test.cols) return null
    if (!raw.every((x) => Number.isInteger(x) && x >= 0 && x < t.test.lanes)) return null
    // One lane at most per step: anything else is not a walkable answer.
    if (raw.some((x, i) => i > 0 && Math.abs(x - raw[i - 1]) > 1)) return null
    return raw as number[]
  },

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'The thief stayed put' }
    const safe = a.filter((l, c) => t.key[c].includes(l)).length
    return { score: safe / t.key.length, summary: safe === t.key.length ? 'Clean getaway' : `${safe} of ${t.key.length} columns safe` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (crowdedLane(t.key, t.test.lanes)) return { ok: false, reason: 'one lane is safe too often' }
      // A walkable route exists.
      let reach = new Set(t.key[0])
      for (let c = 1; c < t.key.length; c++) reach = new Set(t.key[c].filter((l) => [...reach].some((r) => Math.abs(r - l) <= 1)))
      if (!reach.size) return { ok: false, reason: 'no way through' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve(t) {
    // Walk backwards from a reachable lane in the last column.
    const reach: Set<number>[] = [new Set(t.key[0])]
    for (let c = 1; c < t.key.length; c++) reach.push(new Set(t.key[c].filter((l) => [...reach[c - 1]].some((r) => Math.abs(r - l) <= 1))))
    const out = [[...reach[t.key.length - 1]][0]]
    for (let c = t.key.length - 2; c >= 0; c--) out.unshift([...reach[c]].find((l) => Math.abs(l - out[0]) <= 1)!)
    return out
  },
  spam: (t) => Array.from({ length: t.test.lanes }, (_, l) => new Array(t.test.cols).fill(l)),
  simulate(t, rng, skill) {
    // About 2 to 6 columns of gaps are held; past that, steps are guesses.
    const span = 2 + skill * 4
    const out: number[] = []
    const route = mod.solve(t)
    for (let c = 0; c < t.key.length; c++) {
      const prev = out[c - 1]
      const ok = (l: number) => prev === undefined || Math.abs(l - prev) <= 1
      if ((c + 1 <= span || rng.chance(0.35)) && ok(route[c])) out.push(route[c])
      else out.push(rng.pick([...Array(t.test.lanes).keys()].filter(ok)))
    }
    return out
  },
}

export default mod
