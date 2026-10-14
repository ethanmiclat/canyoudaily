import { checkTime, intArray, setScore } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Cube side per sub-trial. Always 3: harder rounds take out more blocks instead of growing the cube. */
  sizes: number[]
  /** Missing cubelets per sub-trial. */
  missing: number[]
}
/** Cells are x + n*y + n*n*z, with y = 0 the top layer and z = 0 the front. */
export interface Study { n: number; missing: number[] }
export interface Test { n: number; count: number }
export type Key = number[]
/** Cells marked as missing. */
export type Answer = number[]

export const coords = (c: number, n: number) => ({ x: c % n, y: Math.floor(c / n) % n, z: Math.floor(c / (n * n)) })
export const cellOf = (x: number, y: number, z: number, n: number) => x + n * y + n * n * z
export const onSurface = (c: number, n: number) => {
  const { x, y, z } = coords(c, n)
  return [x, y, z].some((v) => v === 0 || v === n - 1)
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'cube',
    name: 'Missing Cube',
    family: 'CUBE',
    tier: 'feature',
    skins: [
      { id: 'blocks', name: 'Toy blocks', tokens: { colors: ['#e8b923', '#d9483b', '#3567d4'], edge: '#3a2c10' } },
      { id: 'ice', name: 'Ice cubes', tokens: { colors: ['#bfe6f5', '#9fd4ec', '#d8f1fa'], edge: '#3a6f8a' } },
      { id: 'sugar', name: 'Sugar cubes', tokens: { colors: ['#f7f2e6', '#efe6d0', '#fffaf0'], edge: '#8a7a5a' } },
    ],
    ruleText: 'Turn the cube and find the gaps. Then mark every missing block on the full cube.',
    explainer: [
      { label: 'Turn', text: 'Spin the cube to see every side. Some blocks are missing.' },
      { label: 'Fill', text: 'The gaps fill in.' },
      { label: 'Mark', text: 'Tap the blocks that were missing, on the cube or layer by layer.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, sizes: [3, 3, 3], missing: [3, 4, 5] },
        { trials: 3, sizes: [3, 3, 3], missing: [4, 5, 6] },
        { trials: 3, sizes: [3, 3, 3], missing: [5, 6, 8] },
      ],
      defaultLevel: 1,
      practice: { trials: 1, sizes: [3], missing: [2] },
      targetMedian: 65,
    },
    needs: ['3d'],
    enabled: true,
    introducedOn: '2026-12-05',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.sizes.slice(0, p.trials).map((n, i) => {
        const surface = [...Array(n * n * n).keys()].filter((c) => onSurface(c, n))
        const k = p.missing[i]
        // Spread the gaps over at least two faces so one look never shows them all.
        let missing: number[] = []
        for (let tries = 0; tries < 50; tries++) {
          missing = rng.sample(surface, k).sort((a, b) => a - b)
          if (facesOf(missing, n).size >= Math.min(3, k)) break
        }
        return {
          study: { n, missing },
          test: { n, count: k },
          key: missing,
          studyMs: 5000 + n * 700 + k * 400,
          answerMs: 8000 + k * 1800,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => {
    const n = t.test.n
    const a = intArray(raw, { max: n * n * n, maxLen: n * n * n, unique: true })
    return a && a.every((c) => onSurface(c, n)) ? a : null
  },

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: `0 of ${t.key.length} gaps` }
    const { score, hits, wrong } = setScore(t.key, a)
    return { score, summary: `${hits} of ${t.key.length} gaps${wrong ? `, ${wrong} wrong` : ''}` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (!t.key.every((c) => onSurface(c, t.test.n))) return { ok: false, reason: 'a gap is hidden inside' }
      if (facesOf(t.key, t.test.n).size < Math.min(2, t.key.length)) return { ok: false, reason: 'gaps all on one face' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => {
    const n = t.test.n
    const surface = [...Array(n ** 3).keys()].filter((c) => onSurface(c, n))
    return [surface, surface.filter((c) => coords(c, n).y === 0), surface.filter((c) => coords(c, n).z === 0)]
  },
  simulate(t, rng, skill) {
    const n = t.test.n
    const p = Math.max(0.2, Math.min(0.97, 0.55 + skill * 0.45 - (n - 3) * 0.07 - (t.key.length - 3) * 0.03))
    const found = t.key.filter(() => rng.chance(p))
    const surface = [...Array(n ** 3).keys()].filter((c) => onSurface(c, n) && !t.key.includes(c))
    const wrongs = Math.round(Math.max(0, rng.normal((1 - skill) * 0.9, 0.5)))
    return [...found, ...rng.sample(surface, Math.min(wrongs, surface.length))]
  },
}

/** Which of the six faces each gap shows on (edges and corners show on several). */
function facesOf(cells: number[], n: number): Set<string> {
  const out = new Set<string>()
  for (const c of cells) {
    const { x, y, z } = coords(c, n)
    if (x === 0) out.add('L')
    if (x === n - 1) out.add('R')
    if (y === 0) out.add('T')
    if (y === n - 1) out.add('B')
    if (z === 0) out.add('F')
    if (z === n - 1) out.add('K')
  }
  return out
}

export default mod
