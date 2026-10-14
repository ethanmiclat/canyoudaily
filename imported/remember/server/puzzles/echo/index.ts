import { checkTime } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Beats per sub-trial. */
  beats: number[]
  /** Length of one rhythm unit (the shortest gap). */
  unitMs: number
}
/** Beat times in ms from the first beat (the first is always 0). */
export interface Study { onsets: number[]; unitMs: number; leadMs: number }
export interface Test { beats: number; unitMs: number }
export type Key = number[]
/** Tap times in ms from the player's first tap. */
export type Answer = number[]

const LEAD_MS = 1000
const PULSE_MS = 150

/** Credit for one gap: full within 18% of a unit, nothing past 45%. */
function credit(err: number, unit: number): number {
  const full = unit * 0.18, zero = unit * 0.45
  return err <= full ? 1 : err >= zero ? 0 : 1 - (err - full) / (zero - full)
}

const gapsOf = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i])

/**
 * Scores the gaps between beats, not the beat times, so a slip early on does not throw off every later beat. The
 * player's tempo may run up to a fifth fast or slow (the rhythm matters, not the metronome): their gaps are scaled
 * to the rhythm's total length first. Taps past the last beat cancel one gap's credit each.
 */
export function gapScore(key: number[], taps: number[], unit: number): { total: number; good: number; scale: number } {
  const kg = gapsOf(key), tg = gapsOf(taps).slice(0, kg.length)
  if (!tg.length) return { total: 0, good: 0, scale: 1 }
  const tapSum = tg.reduce((a, b) => a + b, 0)
  const keySum = kg.slice(0, tg.length).reduce((a, b) => a + b, 0)
  const scale = tapSum > 0 ? Math.max(0.8, Math.min(1.25, keySum / tapSum)) : 1.25
  let total = 0, good = 0
  tg.forEach((g, i) => {
    const c = credit(Math.abs(g * scale - kg[i]), unit)
    total += c
    if (c >= 0.5) good++
  })
  return { total: total - Math.max(0, taps.length - key.length), good, scale }
}

const STEADY_MAX = 0.4

function steadyBeats(onsets: number[], unit: number): number[][] {
  const n = onsets.length, total = onsets[n - 1]
  return [Array.from({ length: n }, (_, i) => Math.round((i * total) / (n - 1))), Array.from({ length: n }, (_, i) => i * unit)]
}

/** Would a steady beat (over the same span, or one tap per unit) pass for this rhythm? */
function tooSteady(onsets: number[], unit: number): boolean {
  return steadyBeats(onsets, unit).some((taps) => gapScore(onsets, taps, unit).total / (onsets.length - 1) > STEADY_MAX)
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'echo',
    name: 'Rhythm Echo',
    family: 'SEQUENCE',
    tier: 'medium',
    skins: [
      { id: 'drum', name: 'Drum', tokens: { icon: '🥁', tone: 0 } },
      { id: 'claps', name: 'Hand claps', tokens: { icon: '👏', tone: 2 } },
      { id: 'heart', name: 'Heartbeat', tokens: { icon: '💓', tone: 4 } },
    ],
    ruleText: 'Watch the pulse beat out a rhythm, then tap it back with the same timing.',
    explainer: [
      { label: 'Watch', text: 'The pad pulses a rhythm. Sound is optional.' },
      { label: 'Echo', text: 'Tap the pad with the same gaps between beats.' },
      { label: 'Feel', text: 'The gaps between beats matter. Your speed can drift a little.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, beats: [4, 5, 6, 7, 8], unitMs: 320 },
        { trials: 5, beats: [5, 6, 7, 8, 9], unitMs: 290 },
        { trials: 5, beats: [6, 7, 8, 9, 10], unitMs: 260 },
      ],
      defaultLevel: 1,
      practice: { trials: 2, beats: [4, 4], unitMs: 360 },
      targetMedian: 65,
    },
    needs: ['audio'],
    enabled: true,
    introducedOn: '2026-10-21',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.beats.slice(0, p.trials).map((beats) => {
        // Gaps of 1, 2 or 3 units, uneven enough that steady tapping never fits.
        let onsets: number[] = []
        for (let tries = 0; tries < 200; tries++) {
          const gaps = Array.from({ length: beats - 1 }, () => rng.pick([1, 1, 1, 2, 2, 2, 3]))
          if (gaps.reduce((a, b) => a + b, 0) > 2 * (beats - 1)) continue
          onsets = [0]
          for (const g of gaps) onsets.push(onsets[onsets.length - 1] + g * p.unitMs)
          if (!tooSteady(onsets, p.unitMs)) break
        }
        const total = onsets[onsets.length - 1]
        return {
          study: { onsets, unitMs: p.unitMs, leadMs: LEAD_MS },
          test: { beats, unitMs: p.unitMs },
          key: onsets,
          studyMs: LEAD_MS + total + PULSE_MS + 500,
          answerMs: total + 4500,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    if (!Array.isArray(raw) || raw.length > t.test.beats + 4) return null
    const out: number[] = []
    for (const x of raw) {
      if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 30_000) return null
      if (out.length && x < out[out.length - 1]) return null
      out.push(Math.round(x))
    }
    return out
  },

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No taps' }
    const gaps = t.key.length - 1
    const { total, good } = gapScore(t.key, a, t.test.unitMs)
    const score = Math.max(0, Math.min(1, total / gaps))
    return { score, summary: a.length < t.key.length ? `${a.length} of ${t.key.length} beats tapped` : `${good} of ${gaps} gaps right` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (t.key[0] !== 0 || t.key.some((x, i) => i > 0 && x <= t.key[i - 1])) return { ok: false, reason: 'onsets out of order' }
      if (tooSteady(t.key, t.test.unitMs)) return { ok: false, reason: 'rhythm too close to a steady beat' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [...steadyBeats(t.key, t.test.unitMs), Array.from({ length: t.key.length + 4 }, (_, i) => i * 120)],
  simulate(t, rng, skill) {
    const unit = t.test.unitMs
    // Rhythms past about 3-6 gaps get fuzzy: later gaps are often guessed. Timing noise grows with the gap.
    const span = 3 + skill * 3
    const out = [0]
    for (let i = 1; i < t.key.length; i++) {
      const gap = i <= span || rng.chance(0.4) ? t.key[i] - t.key[i - 1] : rng.pick([1, 2, 3]) * unit
      out.push(out[i - 1] + Math.max(60, gap + rng.normal(0, gap * (0.05 + (1 - skill) * 0.12) + 15)))
    }
    return out.map(Math.round)
  },
}

export default mod
