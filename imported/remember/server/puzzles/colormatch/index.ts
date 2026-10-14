import { checkTime, clamp01, numIn } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  showMs: number
}
export interface Hsl { h: number; s: number; l: number }
export interface Study { color: Hsl; shape: number }
export interface Test { start: Hsl; shape: number }
export type Key = Hsl
export type Answer = Hsl

/** Color difference (CIE76 in Lab) at or under FULL is full marks; at ZERO or more it scores nothing. */
const FULL = 4
const ZERO = 28

export function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const S = s / 100, L = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

export function deltaE(a: Hsl, b: Hsl): number {
  const [l1, a1, b1] = rgbToLab(hslToRgb(a))
  const [l2, a2, b2] = rgbToLab(hslToRgb(b))
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'colormatch',
    name: 'Color Match',
    family: 'BUILD',
    tier: 'quick',
    skins: [
      { id: 'paint', name: 'Paint chips', tokens: { kind: 'chip' } },
      { id: 'balloons', name: 'Balloons', tokens: { kind: 'balloon' } },
    ],
    ruleText: 'Remember a color, then mix it again with the sliders.',
    explainer: [
      { label: 'Look', text: 'A color shows for a few seconds.' },
      { label: 'Mix', text: 'Use the hue, strength and lightness sliders to make it again.' },
      { label: 'Close counts', text: 'The nearer your mix, the higher the score.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 4, showMs: 4000 },
        { trials: 4, showMs: 3000 },
        { trials: 5, showMs: 2200 },
      ],
      defaultLevel: 1,
      practice: { trials: 1, showMs: 4000 },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p) {
    const rng = new Rng(seed)
    let lastHue = -999
    return {
      trials: Array.from({ length: p.trials }, () => {
        let h = rng.int(360)
        // Consecutive colors sit at least 60 degrees apart so one round does not prime the next.
        while (Math.abs(((h - lastHue + 540) % 360) - 180) < 60) h = rng.int(360)
        lastHue = h
        const color = { h, s: rng.range(40, 85), l: rng.range(38, 66) }
        return {
          study: { color, shape: rng.int(4) },
          test: { start: { h: (h + rng.range(120, 240)) % 360, s: 50, l: 50 }, shape: rng.int(4) },
          key: color,
          studyMs: p.showMs,
          answerMs: 13000,
        }
      }),
    }
  },

  parseAnswer(raw) {
    const r = raw as Hsl
    const h = numIn(r?.h, 0, 360), s = numIn(r?.s, 0, 100), l = numIn(r?.l, 0, 100)
    return h === null || s === null || l === null ? null : { h, s, l }
  },

  scoreTrial(t, a) {
    if (!a) return { score: 0, summary: 'No mix' }
    const d = deltaE(t.key, a)
    const score = clamp01((ZERO - d) / (ZERO - FULL))
    const words = d <= FULL ? 'Spot on' : d <= 12 ? 'Very close' : d <= 20 ? 'Close' : d <= 30 ? 'In the area' : 'Way off'
    return { score, summary: `${words} (off by ${Math.round(d)})` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (deltaE(t.key, t.test.start) < 25) return { ok: false, reason: 'slider start too close to the target' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => ({ ...t.key }),
  spam: (t) => [{ ...t.test.start }, { h: 0, s: 0, l: 50 }],
  simulate(t, rng, skill) {
    const k = 1.4 - skill
    return {
      h: (t.key.h + rng.normal(0, 9 * k) + 360) % 360,
      s: Math.max(0, Math.min(100, t.key.s + rng.normal(0, 9 * k))),
      l: Math.max(0, Math.min(100, t.key.l + rng.normal(0, 6 * k))),
    }
  },
}

export default mod
