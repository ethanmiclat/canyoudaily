import { checkTime, clamp01, intIn } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Grid side per sub-trial. */
  sizes: number[]
  /** Paint colors (not counting blank). */
  colors: number
  /** Share of cells painted. */
  fill: number
}
/** Cells row by row: 0 is blank, 1..colors index the skin palette. */
export interface Study { size: number; cells: number[] }
export interface Test { size: number; colors: number }
export type Key = number[]
export type Answer = number[]

function badPicture(cells: number[], colors: number): string | null {
  const painted = cells.filter(Boolean).length
  if (painted < cells.length * 0.25 || painted > cells.length * 0.6) return 'too empty or too full'
  if (new Set(cells.filter(Boolean)).size < colors) return 'a color is missing'
  return null
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'pixel',
    name: 'Pixel Repaint',
    family: 'BUILD',
    tier: 'medium',
    skins: [
      { id: 'arcade', name: 'Arcade sprites', tokens: { palette: ['red', 'blue', 'yellow'], bg: '#1d1b2b' } },
      { id: 'quilt', name: 'Patchwork quilt', tokens: { palette: ['green', 'purple', 'orange'], bg: '#f3ead8' } },
      { id: 'mosaic', name: 'Tile mosaic', tokens: { palette: ['blue', 'yellow', 'green'], bg: '#e9eef4' } },
    ],
    ruleText: 'Study the little pixel picture. Then paint it again from memory.',
    explainer: [
      { label: 'Study', text: 'A small picture made of colored squares.' },
      { label: 'Pick', text: 'Choose a paint, or the eraser.' },
      { label: 'Paint', text: 'Tap or drag over squares. Wrong paint costs points.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, sizes: [5, 5, 6], colors: 2, fill: 0.42 },
        { trials: 3, sizes: [5, 6, 6], colors: 2, fill: 0.46 },
        { trials: 3, sizes: [6, 6, 7], colors: 3, fill: 0.46 },
      ],
      defaultLevel: 1,
      practice: { trials: 1, sizes: [4], colors: 2, fill: 0.45 },
      targetMedian: 65,
    },
    needs: ['drag'],
    enabled: true,
    introducedOn: '2026-10-25',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.sizes.slice(0, p.trials).map((size) => {
        // Mirror the left half so pictures look like sprites (symmetry is what makes them memorable). Redraw
        // pictures that are nearly empty, nearly full, or missing a color.
        const half = Math.ceil(size / 2)
        let cells: number[] = []
        for (let tries = 0; tries < 100; tries++) {
          cells = new Array(size * size).fill(0)
          for (let r = 0; r < size; r++) {
            for (let c = 0; c < half; c++) {
              if (!rng.chance(p.fill)) continue
              // Colors come in clumps: often the same as the neighbor above or to the left.
              const above = r > 0 ? cells[(r - 1) * size + c] : 0
              const left = c > 0 ? cells[r * size + c - 1] : 0
              const v = above && rng.chance(0.45) ? above : left && rng.chance(0.4) ? left : 1 + rng.int(p.colors)
              cells[r * size + c] = v
              cells[r * size + (size - 1 - c)] = v
            }
          }
          if (!badPicture(cells, p.colors)) break
        }
        const painted = cells.filter(Boolean).length
        return {
          study: { size, cells },
          test: { size, colors: p.colors },
          key: cells,
          studyMs: 2500 + painted * 150,
          answerMs: 9000 + painted * 600,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    const n = t.test.size * t.test.size
    if (!Array.isArray(raw) || raw.length !== n) return null
    const out: number[] = []
    for (const x of raw) {
      const v = intIn(x, t.test.colors + 1)
      if (v === null) return null
      out.push(v)
    }
    return out
  },

  scoreTrial(t, a) {
    const painted = t.key.filter(Boolean).length
    if (!a || a.every((x) => x === 0)) return { score: 0, summary: `0 of ${painted} squares` }
    let hits = 0, wrong = 0
    a.forEach((x, i) => {
      if (x && x === t.key[i]) hits++
      else if (x) wrong++
    })
    return { score: clamp01((hits - wrong) / painted), summary: `${hits} of ${painted} squares${wrong ? `, ${wrong} wrong` : ''}` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      const bad = badPicture(t.key, t.test.colors)
      if (bad) return { ok: false, reason: bad }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => Array.from({ length: t.test.colors }, (_, c) => t.key.map(() => c + 1)),
  simulate(t, rng, skill) {
    // Each painted square is remembered with a chance that drops with the picture size; a few strays get painted.
    const painted = t.key.filter(Boolean).length
    const p = Math.max(0.3, Math.min(0.98, 0.45 + skill * 0.5 - (painted - 12) * 0.012))
    return t.key.map((x) => {
      if (x) return rng.chance(p) ? x : rng.chance(0.5) ? 0 : 1 + rng.int(t.test.colors)
      return rng.chance(0.06 * (1.2 - skill)) ? 1 + rng.int(t.test.colors) : 0
    })
  },
}

export default mod
