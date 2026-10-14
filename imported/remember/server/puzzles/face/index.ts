import { checkTime, clamp01 } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Features to rebuild per sub-trial (2: eyes and mouth; 3: plus brows or nose; 4: all). */
  parts: number[]
}
export type PartId = 'brows' | 'eyes' | 'nose' | 'mouth'
export const PART_IDS: PartId[] = ['brows', 'eyes', 'nose', 'mouth']
export const VARIANTS: Record<PartId, number> = { brows: 4, eyes: 5, nose: 4, mouth: 5 }
/** Height ranges on the face (0 top, 100 bottom). Features are always centered left to right. */
export const RANGES: Record<PartId, [number, number]> = { brows: [27, 39], eyes: [37, 50], nose: [50, 62], mouth: [64, 80] }
export const SIZES = [0.8, 1, 1.25]

export interface Part { v: number; y: number; s: number }
/** The parts of the face that are not scored: they frame it so both faces look like the same person. */
export interface Head { skin: number; hair: number; hairColor: number }
export interface Study { head: Head; face: Partial<Record<PartId, Part>> }
/** `fixed` are the features not asked for, drawn the same on both faces. */
export interface Test { head: Head; parts: PartId[]; fixed: Partial<Record<PartId, Part>> }
export type Key = Partial<Record<PartId, Part>>
export type Answer = Partial<Record<PartId, Part>>

/**
 * One part: the right variant is worth most. Height and size count too, at full value with the right variant and
 * at half with the wrong one, so a well-placed wrong nose still earns something. Generous on height: full marks
 * within 2.5 units, nothing past 9.
 */
export function partScore(want: Part, got: Part | undefined): number {
  if (!got) return 0
  const dy = Math.abs(want.y - got.y)
  const pos = clamp01(1 - (dy - 2.5) / 6.5)
  const size = want.s === got.s ? 1 : Math.abs(want.s - got.s) === 1 ? 0.3 : 0
  const extra = 0.35 * pos + 0.2 * size
  return want.v === got.v ? 0.45 + extra : 0.5 * extra
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'face',
    name: 'Build-a-Face',
    family: 'BUILD',
    tier: 'feature',
    skins: [
      { id: 'sketch', name: 'Sketchbook', tokens: { paper: '#fbf6ea', ink: '#2a2438' } },
      { id: 'robot', name: 'Robot workshop', tokens: { paper: '#e3e9ef', ink: '#1f3a4d', robot: true } },
      { id: 'pumpkin', name: 'Pumpkin carving', tokens: { paper: '#2a1d14', ink: '#ffb347', pumpkin: true }, season: { from: '10-01', to: '10-31', tag: 'halloween' } },
    ],
    ruleText: 'Study the face. Then rebuild it: pick each feature, its size, and how high it sits.',
    explainer: [
      { label: 'Study', text: 'Eyes, mouth and more, each a certain style, size and height.' },
      { label: 'Pick', text: 'Choose a feature and flip through its styles.' },
      { label: 'Place', text: 'Tap or drag on the face to set its height. Close counts.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, parts: [2, 2, 3] },
        { trials: 3, parts: [2, 3, 4] },
        { trials: 3, parts: [3, 4, 4] },
      ],
      defaultLevel: 1,
      practice: { trials: 1, parts: [2] },
      targetMedian: 65,
    },
    needs: ['drag'],
    enabled: true,
    introducedOn: '2026-11-28',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.parts.slice(0, p.trials).map((k) => {
        const head: Head = { skin: rng.int(6), hair: rng.int(6), hairColor: rng.int(6) }
        const parts: PartId[] = k >= 4 ? [...PART_IDS] : k === 3 ? PART_IDS.filter((x) => x !== rng.pick<PartId>(['brows', 'nose'])) : ['eyes', 'mouth']
        const face: Partial<Record<PartId, Part>> = {}
        for (const id of PART_IDS) {
          const [lo, hi] = RANGES[id]
          face[id] = { v: rng.int(VARIANTS[id]), y: rng.range(lo, hi), s: rng.int(3) }
        }
        // Keep the brows above the eyes, and the nose clear of both.
        face.brows!.y = Math.min(face.brows!.y, face.eyes!.y - 8)
        face.nose!.y = Math.max(face.nose!.y, face.eyes!.y + 7)
        face.mouth!.y = Math.max(face.mouth!.y, face.nose!.y + 9)
        const key: Key = Object.fromEntries(parts.map((id) => [id, face[id]]))
        const fixed = Object.fromEntries(PART_IDS.filter((id) => !parts.includes(id)).map((id) => [id, face[id]]))
        return {
          study: { head, face },
          test: { head, parts, fixed },
          key,
          studyMs: 3500 + parts.length * 700,
          answerMs: 8000 + parts.length * 4200,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const out: Answer = {}
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!t.test.parts.includes(id as PartId)) return null
      const p = v as Part
      if (!p || typeof p !== 'object') return null
      if (!Number.isInteger(p.v) || p.v < 0 || p.v >= VARIANTS[id as PartId]) return null
      if (typeof p.y !== 'number' || !Number.isFinite(p.y) || p.y < 0 || p.y > 100) return null
      if (!Number.isInteger(p.s) || p.s < 0 || p.s > 2) return null
      out[id as PartId] = { v: p.v, y: Math.round(p.y * 10) / 10, s: p.s }
    }
    return out
  },

  scoreTrial(t, a) {
    if (!a || Object.keys(a).length === 0) return { score: 0, summary: 'No features placed' }
    const scores = t.test.parts.map((id) => partScore(t.key[id]!, a[id]))
    const styles = t.test.parts.filter((id) => a[id]?.v === t.key[id]!.v).length
    return { score: scores.reduce((x, y) => x + y, 0) / scores.length, summary: `${styles} of ${t.test.parts.length} styles right` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      const f = t.study.face
      if (f.brows!.y >= f.eyes!.y || f.nose!.y <= f.eyes!.y || f.mouth!.y <= f.nose!.y) return { ok: false, reason: 'features out of order' }
      if (f.mouth!.y > 86) return { ok: false, reason: 'mouth off the chin' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => ({ ...t.key }),
  spam: (t) => [0, 1].map((v) => Object.fromEntries(t.test.parts.map((id) => [id, { v, y: (RANGES[id][0] + RANGES[id][1]) / 2, s: 1 }]))),
  simulate(t, rng, skill) {
    const n = t.test.parts.length
    return Object.fromEntries(
      t.test.parts.map((id) => {
        const want = t.key[id]!
        const pv = Math.max(0.2, Math.min(0.95, 0.35 + skill * 0.5 - (n - 2) * 0.06))
        return [
          id,
          {
            v: rng.chance(pv) ? want.v : rng.int(VARIANTS[id]),
            y: Math.max(0, Math.min(100, want.y + rng.normal(0, 2 + (1 - skill) * 6))),
            s: rng.chance(0.4 + skill * 0.4) ? want.s : rng.int(3),
          },
        ]
      }),
    )
  },
}

export default mod
