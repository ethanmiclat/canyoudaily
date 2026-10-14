import { checkTime, intArray, setScore } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  dots: number
  /** Marked dots to follow, per sub-trial. */
  targets: number[]
  /** Field units (0..100) per second. */
  speed: number
  moveMs: number
}
/** The motion is a pure function of these numbers (see `frames`), so the browser draws exactly what was scored. */
export interface Motion { dots: number; seed: string; speed: number; moveMs: number }
export interface Study { motion: Motion; targets: number[]; cueMs: number }
export interface Test { motion: Motion; count: number }
export type Key = number[]
export type Answer = number[]

const CUE_MS = 1800
export const FPS = 30
export const R = 4.5
const LO = 8, HI = 92

export interface Pt { x: number; y: number }

/**
 * Dot positions, one array per frame at 30 fps. Dots wander (small random turns), bounce off the walls and steer
 * away from each other so they rarely sit exactly on top of one another.
 */
export function frames(m: Motion): Pt[][] {
  const rng = new Rng(`motion:${m.seed}`)
  const pos: Pt[] = []
  while (pos.length < m.dots) {
    const p = { x: rng.float(LO + 4, HI - 4), y: rng.float(LO + 4, HI - 4) }
    if (pos.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 16)) pos.push(p)
  }
  const heading = pos.map(() => rng.float(0, Math.PI * 2))
  const step = m.speed / FPS
  const out: Pt[][] = [pos.map((p) => ({ ...p }))]
  const n = Math.ceil((m.moveMs / 1000) * FPS)
  for (let f = 0; f < n; f++) {
    for (let i = 0; i < m.dots; i++) {
      heading[i] += rng.normal(0, 0.18)
      // Steer away from the nearest close dot.
      for (let j = 0; j < m.dots; j++) {
        if (j === i) continue
        const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y
        const d = Math.hypot(dx, dy)
        if (d < 11 && d > 0) {
          const away = Math.atan2(dy, dx)
          let diff = away - heading[i]
          diff = Math.atan2(Math.sin(diff), Math.cos(diff))
          heading[i] += diff * 0.25
        }
      }
      let x = pos[i].x + Math.cos(heading[i]) * step
      let y = pos[i].y + Math.sin(heading[i]) * step
      if (x < LO || x > HI) (heading[i] = Math.PI - heading[i]), (x = Math.max(LO, Math.min(HI, x)))
      if (y < LO || y > HI) (heading[i] = -heading[i]), (y = Math.max(LO, Math.min(HI, y)))
      pos[i] = { x, y }
    }
    out.push(pos.map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 })))
  }
  return out
}

/** At the end every marked dot stands clear of the others, so a tap is never a coin flip. */
function endsClear(m: Motion, targets: number[]): boolean {
  const end = frames(m).at(-1)!
  return targets.every((k) => end.every((q, j) => j === k || Math.hypot(end[k].x - q.x, end[k].y - q.y) >= 2.4 * R))
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'dots',
    name: 'Tracking',
    family: 'TRACK',
    tier: 'medium',
    skins: [
      { id: 'fireflies', name: 'Fireflies', tokens: { kind: 'fireflies', bg: '#1b2238', dot: '#ffd45c' } },
      { id: 'fish', name: 'Fish tank', tokens: { kind: 'fish', bg: '#cfe9f5', dot: '🐟' } },
      { id: 'marbles', name: 'Marbles', tokens: { kind: 'marbles', bg: '#efe6d8', dot: '#6a7bd8' } },
    ],
    ruleText: 'Some dots get marked. Then they all look the same and move around. Keep your eye on the marked ones.',
    ruleFor: (p) =>
      Math.max(...p.targets) > 1
        ? 'Some dots get marked. Then they all look the same and move around. Keep your eye on the marked ones.'
        : 'One dot gets marked. Then they all look the same and move around. Keep your eye on it.',
    explainer: [
      { label: 'Mark', text: 'A star marks the dots to follow.' },
      { label: 'Follow', text: 'The marks vanish and every dot moves.' },
      { label: 'Tap', text: 'When they stop, tap the ones you followed.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, dots: 8, targets: [2, 3, 3, 4, 4], speed: 38, moveMs: 6000 },
        { trials: 5, dots: 9, targets: [3, 3, 4, 4, 4], speed: 44, moveMs: 6000 },
        { trials: 5, dots: 10, targets: [3, 4, 4, 4, 4], speed: 50, moveMs: 6000 },
      ],
      defaultLevel: 1,
      practice: { trials: 2, dots: 7, targets: [2, 3], speed: 30, moveMs: 4500 },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-10-28',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.targets.slice(0, p.trials).map((k, i) => {
        // Re-roll this round until every marked dot ends clear of the others (see validate).
        let motion: Motion, targets: number[]
        for (let tries = 0; ; tries++) {
          motion = { dots: p.dots, seed: `${seed}:${i}:${rng.int(1e9)}`, speed: p.speed, moveMs: p.moveMs }
          targets = rng.sample([...Array(p.dots).keys()], k).sort((a, b) => a - b)
          if (endsClear(motion, targets) || tries >= 40) break
        }
        return {
          study: { motion, targets, cueMs: CUE_MS },
          test: { motion, count: k },
          key: targets,
          studyMs: CUE_MS + p.moveMs + 200,
          answerMs: 4000 + k * 1500,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intArray(raw, { max: t.test.motion.dots, maxLen: t.test.count, unique: true }),

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No pick' }
    const { score, hits } = setScore(t.key, a)
    return { score, summary: t.key.length === 1 ? (hits ? 'Followed it' : 'Lost it') : `${hits} of ${t.key.length} followed` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (!endsClear(t.test.motion, t.key)) return { ok: false, reason: 'a marked dot ends on top of another' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [Array.from({ length: t.test.count }, (_, i) => i), Array.from({ length: t.test.count }, (_, i) => t.test.motion.dots - 1 - i)],
  simulate(t, rng, skill) {
    const m = t.test.motion
    const k = t.key.length
    const keep = Math.max(0.15, Math.min(0.98, 0.7 + skill * 0.35 - (m.speed - 20) * 0.012 - (k - 1) * 0.07 - (m.dots - 6) * 0.03 - (m.moveMs - 5000) / 20000))
    const picks = t.key.filter(() => rng.chance(keep))
    const others = rng.shuffle([...Array(m.dots).keys()].filter((d) => !picks.includes(d)))
    while (picks.length < k) picks.push(others.pop()!)
    return picks
  },
}

export default mod
