import { checkTime, intArray, of, positional, spanOf, spanRecall } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule, Trial } from '../types.js'

export interface Params {
  trials: number
  pads: number
  /** Sequence length per sub-trial. */
  lengths: number[]
  flashMs: number
  gapMs: number
}
export interface Study { seq: number[]; flashMs: number; gapMs: number; leadMs: number }
export interface Test { pads: number; length: number }
export type Key = number[]
export type Answer = number[]

const LEAD_MS = 700

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'sequence',
    name: 'Sequence',
    family: 'SEQUENCE',
    tier: 'quick',
    skins: [
      { id: 'lights', name: 'Lights', tokens: { kind: 'lights' } },
      { id: 'piano', name: 'Piano', tokens: { kind: 'piano', notes: ['C', 'E', 'G', 'C'] } },
      { id: 'fireworks', name: 'Fireworks', tokens: { kind: 'fireworks' } },
      { id: 'arrows', name: 'Dance arrows', tokens: { kind: 'arrows' } },
      { id: 'spooky', name: 'Spooky lights', tokens: { kind: 'spooky' }, season: { from: '10-01', to: '10-31', tag: 'halloween' } },
      { id: 'holiday', name: 'Holiday lights', tokens: { kind: 'holiday' }, season: { from: '12-01', to: '12-31', tag: 'holiday' } },
    ],
    ruleText: 'Watch the pads light up, then tap them in the same order.',
    explainer: [
      { label: 'Watch', text: 'The pads flash one at a time.' },
      { label: 'Repeat', text: 'Tap them back in the same order.' },
      { label: 'Grow', text: 'Each round adds a step.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 5, pads: 4, lengths: [4, 5, 6, 7, 8], flashMs: 560, gapMs: 200 },
        { trials: 5, pads: 4, lengths: [5, 6, 7, 8, 9], flashMs: 500, gapMs: 170 },
        { trials: 5, pads: 4, lengths: [6, 7, 8, 9, 10], flashMs: 450, gapMs: 150 },
      ],
      defaultLevel: 1,
      practice: { trials: 2, pads: 4, lengths: [3, 4], flashMs: 600, gapMs: 220 },
      targetMedian: 65,
    },
    needs: ['audio'],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    return {
      trials: p.lengths.slice(0, p.trials).map((len) => {
        // No pad more than twice in a row, so a run of taps on one pad never scores much by accident.
        const seq: number[] = []
        while (seq.length < len) {
          const x = rng.int(p.pads)
          if (seq.length >= 2 && seq[seq.length - 1] === x && seq[seq.length - 2] === x) continue
          seq.push(x)
        }
        return {
          study: { seq, flashMs: p.flashMs, gapMs: p.gapMs, leadMs: LEAD_MS },
          test: { pads: p.pads, length: len },
          key: seq,
          studyMs: LEAD_MS + len * (p.flashMs + p.gapMs),
          answerMs: 2500 + len * 900,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    return intArray(raw, { max: t.test.pads, maxLen: t.test.length })
  },

  scoreTrial(t, a) {
    if (!a || a.length === 0) return { score: 0, summary: 'No answer' }
    const s = positional(t.key, a)
    const right = t.key.filter((x, i) => a[i] === x).length
    return { score: s, summary: of(right, t.key.length, 'steps') }
  },

  validate(inst, p) {
    if (inst.trials.length !== p.trials) return { ok: false, reason: 'trial count' }
    for (const t of inst.trials) {
      if (t.key.some((x) => x < 0 || x >= p.pads)) return { ok: false, reason: 'pad out of range' }
      if (t.key.length !== t.test.length) return { ok: false, reason: 'length' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t: Trial<Study, Test, Key>) => [Array(t.test.length).fill(0), Array.from({ length: t.test.length }, (_, i) => i % t.test.pads)],
  simulate(t, rng, skill) {
    const span = spanOf(skill, 6) - (t.study.flashMs < 500 ? 0.5 : 0)
    return spanRecall(t.key, span, rng, () => rng.int(t.test.pads))
  },
}

export default mod
