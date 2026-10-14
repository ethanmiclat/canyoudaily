import { checkTime } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Board size per sub-trial, as [cols, rows]. */
  grids: [number, number][]
}
/** A picture drawn by Play.tsx: sky, a rolling hill line, and one object per piece so no two pieces look alike. */
export interface Picture {
  cols: number
  rows: number
  /** Hill height (picture units, 0 at the top) at each piece edge, cols + 1 points. */
  hill: number[]
  objects: { glyph: string; x: number; y: number; size: number }[]
}
export interface Study { picture: Picture }
/** pieces[k] is the board cell piece k was cut from. */
export interface Test { picture: Picture; pieces: number[] }
/** For each board cell, the piece that belongs there. */
export type Key = number[]
/** For each board cell, the piece put there, or -1. */
export type Answer = number[]

export const CELL = 100

export const SETS: Record<string, { sky: string[]; ground: string[] }> = {
  country: { sky: ['☁️', '🐦', '☀️', '🎈', '🦅', '🌈', '🪁', '🦋'], ground: ['🌳', '🏠', '🐄', '🌻', '🐑', '🚜', '🌲', '🐓', '🏡', '🐴', '🌾', '🍄', '🐖', '🪵'] },
  seaside: { sky: ['☁️', '🐦', '☀️', '🪁', '✈️', '🦅', '🎈', '🌈'], ground: ['⛵', '🐚', '🦀', '🌴', '🐟', '🐬', '🏖️', '🪣', '🐙', '🦭', '⚓', '🛟', '🐠', '🏄'] },
  town: { sky: ['☁️', '🐦', '☀️', '✈️', '🎈', '🚁', '🌈', '🪁'], ground: ['🏢', '🚗', '🚌', '🌳', '🚲', '🏪', '🚦', '🏠', '⛲', '🛴', '🏫', '🚕', '🌷', '🐕'] },
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'jigsaw',
    name: 'Jigsaw Recall',
    family: 'BUILD',
    tier: 'medium',
    skins: [
      { id: 'country', name: 'Countryside', tokens: { set: 'country', sky: '#bfe3f7', land: '#8fcf7a' } },
      { id: 'seaside', name: 'Seaside', tokens: { set: 'seaside', sky: '#ffe0b8', land: '#5fb4dc' } },
      { id: 'town', name: 'Little town', tokens: { set: 'town', sky: '#d6defa', land: '#b7c0a8' } },
    ],
    ruleText: 'Study the picture. It gets cut into pieces and mixed up. Put it back together.',
    explainer: [
      { label: 'Study', text: 'Look at the whole picture.' },
      { label: 'Cut', text: 'It is cut into square pieces and mixed up.' },
      { label: 'Rebuild', text: 'Tap a piece, then where it goes.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, grids: [[3, 2], [3, 3], [3, 3]] },
        { trials: 3, grids: [[3, 3], [4, 3], [4, 3]] },
        { trials: 3, grids: [[4, 3], [4, 3], [4, 3]] },
      ],
      defaultLevel: 1,
      practice: { trials: 1, grids: [[2, 2]] },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-11-18',
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const set = SETS[String(skin.tokens.set)] ?? SETS.country
    return {
      trials: p.grids.slice(0, p.trials).map(([cols, rows]) => {
        // The hill sits inside the second row from the top, so the top row is sky.
        const hill = Array.from({ length: cols + 1 }, () => CELL * (rows === 2 ? 1 : 1.2) + rng.range(-25, 25))
        const sky = rng.sample(set.sky, cols)
        const ground = rng.sample(set.ground, cols * (rows - 1))
        const objects: Picture['objects'] = []
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++)
            objects.push({ glyph: r === 0 ? sky[c] : ground[(r - 1) * cols + c], x: c * CELL + 50 + rng.range(-16, 16), y: r * CELL + 50 + rng.range(-14, 14), size: rng.range(40, 54) })
        const n = cols * rows
        // Mix the pieces so at most one sits in its own place.
        let pieces = rng.shuffle([...Array(n).keys()])
        for (let i = 0; i < 50 && pieces.filter((x, k) => x === k).length > 1; i++) pieces = rng.shuffle([...Array(n).keys()])
        return {
          study: { picture: { cols, rows, hill, objects } },
          test: { picture: { cols, rows, hill, objects }, pieces },
          key: [...Array(n).keys()].map((cell) => pieces.indexOf(cell)),
          studyMs: 3000 + n * 450,
          answerMs: 5000 + n * 1300,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    const n = t.test.pieces.length
    if (!Array.isArray(raw) || raw.length !== n) return null
    if (!raw.every((x) => Number.isInteger(x) && x >= -1 && x < n)) return null
    const used = (raw as number[]).filter((x) => x >= 0)
    return new Set(used).size === used.length ? (raw as number[]) : null
  },

  scoreTrial(t, a) {
    if (!a || a.every((x) => x < 0)) return { score: 0, summary: 'No pieces placed' }
    const right = t.key.filter((k, i) => a[i] === k).length
    return { score: right / t.key.length, summary: `${right} of ${t.key.length} pieces in place` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (t.test.pieces.filter((x, k) => x === k).length > 1) return { ok: false, reason: 'pieces barely mixed' }
      if (new Set(t.test.picture.objects.map((o) => o.glyph)).size !== t.test.pieces.length) return { ok: false, reason: 'two pieces look alike' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [t.key.map((_, i) => i), t.key.map((_, i) => t.key.length - 1 - i)],
  simulate(t, rng, skill) {
    // The sky and the hill line give the rows away, so even a fuzzy memory gets the row right; columns are harder.
    const { cols } = t.test.picture
    const n = t.key.length
    const p = Math.max(0.15, Math.min(0.97, 0.22 + skill * 0.55 - (n - 9) * 0.04))
    const out: number[] = t.key.map((k) => (rng.chance(p) ? k : -1))
    const used = new Set(out.filter((x) => x >= 0))
    for (let cell = 0; cell < n; cell++) {
      if (out[cell] >= 0) continue
      const row = Math.floor(cell / cols)
      const free = [...Array(n).keys()].filter((k) => !used.has(k))
      const sameRow = free.filter((k) => Math.floor(t.test.pieces[k] / cols) === row)
      const k = sameRow.length && rng.chance(0.6) ? rng.pick(sameRow) : rng.pick(free)
      out[cell] = k
      used.add(k)
    }
    return out
  },
}

export default mod
