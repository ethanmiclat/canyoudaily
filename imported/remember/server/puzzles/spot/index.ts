import { checkTime, intIn } from '../kit.js'
import { SHAPES, SWATCHES, type ShapeId } from '../assets.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  cols: number
  rows: number
  /** Objects in the scene per sub-trial. */
  objects: number[]
  studyMs: number
}
/** One object in a slot. Color ids come paired with a pattern, so a color change is never color alone. */
export interface Obj { shape: ShapeId; color: (typeof SWATCHES)[number]['id'] }
/** Slots, row-major; null is empty. */
export type Scene = (Obj | null)[]
export interface Study { cols: number; rows: number; scene: Scene }
export interface Test { cols: number; rows: number; scene: Scene }
export interface Key { slot: number; change: 'color' | 'shape' | 'gone' | 'added' }
export type Answer = number

const COLOR_IDS = SWATCHES.map((s) => s.id)

function randomObj(rng: Rng, shapes: readonly ShapeId[]): Obj {
  return { shape: rng.pick(shapes), color: rng.pick(COLOR_IDS) }
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'spot',
    name: 'Spot the Change',
    family: 'ITEMS',
    tier: 'quick',
    skins: [
      { id: 'shelf', name: 'Toy shelf', tokens: { kind: 'shelf', shapes: ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'] } },
      { id: 'garden', name: 'Flower bed', tokens: { kind: 'garden', shapes: ['circle', 'star', 'heart', 'drop', 'hexagon', 'diamond'] } },
    ],
    ruleText: 'Study the scene. It comes back with one thing different. Tap it.',
    explainer: [
      { label: 'Study', text: 'Look over the scene.' },
      { label: 'Compare', text: 'It returns with one change: a new color, a new shape, or something added or gone.' },
      { label: 'Tap', text: 'Tap the spot that changed.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, cols: 4, rows: 3, objects: [5, 6, 6, 7, 7], studyMs: 4000 },
        { trials: 5, cols: 4, rows: 4, objects: [7, 8, 8, 9, 10], studyMs: 3800 },
        { trials: 5, cols: 4, rows: 4, objects: [9, 10, 11, 11, 12], studyMs: 3500 },
      ],
      defaultLevel: 1,
      practice: { trials: 2, cols: 4, rows: 3, objects: [5, 6], studyMs: 4000 },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const shapes = (skin.tokens.shapes as ShapeId[]) ?? SHAPES
    const n = p.cols * p.rows
    return {
      trials: p.objects.slice(0, p.trials).map((k) => {
        const scene: Scene = new Array(n).fill(null)
        for (const slot of rng.sample(Array.from({ length: n }, (_, i) => i), k)) scene[slot] = randomObj(rng, shapes)
        const next: Scene = scene.map((o) => (o ? { ...o } : null))
        const filled = scene.flatMap((o, i) => (o ? [i] : []))
        const empty = scene.flatMap((o, i) => (o ? [] : [i]))
        const change = rng.pick(['color', 'shape', 'gone', ...(empty.length ? (['added'] as const) : [])] as const)
        let slot: number
        if (change === 'added') {
          slot = rng.pick(empty)
          next[slot] = randomObj(rng, shapes)
        } else {
          slot = rng.pick(filled)
          const o = next[slot]!
          if (change === 'gone') next[slot] = null
          else if (change === 'color') o.color = rng.pick(COLOR_IDS.filter((c) => c !== o.color))
          else o.shape = rng.pick(shapes.filter((s) => s !== o.shape))
        }
        return {
          study: { cols: p.cols, rows: p.rows, scene },
          test: { cols: p.cols, rows: p.rows, scene: next },
          key: { slot, change },
          studyMs: p.studyMs,
          answerMs: 9000,
        }
      }),
    }
  },

  parseAnswer: (raw, t) => intIn(raw, t.test.cols * t.test.rows),

  scoreTrial(t, a) {
    if (a === null) return { score: 0, summary: 'No tap' }
    const what = { color: 'a new color', shape: 'a new shape', gone: 'something gone', added: 'something new' }[t.key.change]
    return a === t.key.slot ? { score: 1, summary: `Found it: ${what}` } : { score: 0, summary: `Missed ${what}` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      const diffs = t.study.scene.flatMap((o, i) => (JSON.stringify(o) === JSON.stringify(t.test.scene[i]) ? [] : [i]))
      if (diffs.length !== 1 || diffs[0] !== t.key.slot) return { ok: false, reason: 'exactly one slot must change' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => t.key.slot,
  spam: () => [0, 5],
  simulate(t, rng, skill) {
    const objects = t.study.scene.filter(Boolean).length
    const p = Math.min(0.97, 0.32 + skill * 0.5 - (objects - 7) * 0.04 - (t.key.change === 'color' ? 0.05 : 0))
    return rng.chance(p) ? t.key.slot : rng.int(t.test.cols * t.test.rows)
  },
}

export default mod
