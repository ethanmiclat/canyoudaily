/**
 * Generator checks for a puzzle type (plan sections 7 and 14): across many random seeds and every difficulty level
 * (plus practice), every instance must validate, fit the time cap, have a perfect answer that scores 1, and give
 * board-spamming answers a low score. Pure: used by tests, scripts/validate.ts and the new-type checklist.
 */
import { generateValid, inSeason } from './engine.js'
import { Rng } from './rng.js'
import { playMs } from '../puzzles/kit.js'
import type { BaseParams, PuzzleModule } from '../puzzles/types.js'

/** Average score a spam strategy may reach. 1-in-3 picks (Shell Game with three cups) sit just under it. */
export const SPAM_CEILING = 0.4
export const HARD_CAP_SECONDS = 120

export interface ValidationReport {
  id: string
  seeds: number
  failures: string[]
  rerolls: number
  maxPlaySeconds: number
  spamMean: number
}

export function validateModule(mod: PuzzleModule, seeds: number, label = 'v'): ValidationReport {
  const m = mod.manifest
  const failures: string[] = []
  const fail = (msg: string) => failures.length < 20 && failures.push(msg)
  let rerolls = 0, maxMs = 0, spamTotal = 0, spamCount = 0

  if (m.maxSeconds > HARD_CAP_SECONDS) fail(`maxSeconds ${m.maxSeconds} is over the ${HARD_CAP_SECONDS}s hard cap`)
  if (!m.skins.length) fail('no skins')
  if (m.skins.every((s) => s.season)) fail('every skin is seasonal: some days would have no skin')
  if (m.difficulty.practice.trials > 2) fail('practice should have one or two sub-trials')
  const { levels, defaultLevel } = m.difficulty
  if (defaultLevel < 0 || defaultLevel >= levels.length) fail('defaultLevel out of range')

  const variants: { name: string; params: BaseParams }[] = [
    ...levels.map((params, i) => ({ name: `level ${i}`, params })),
    { name: 'practice', params: m.difficulty.practice },
  ]
  const perVariant = Math.max(1, Math.ceil(seeds / variants.length))
  for (const v of variants) {
    for (const skin of m.skins) {
      for (let i = 0; i < Math.ceil(perVariant / m.skins.length); i++) {
        const seed = `${label}:${m.id}:${v.name}:${skin.id}:${i}`
        let inst
        try {
          const first = mod.generate(seed, v.params, skin)
          if (!mod.validate(first, v.params).ok) rerolls++
          inst = generateValid(mod, seed, v.params, skin)
        } catch (e) {
          fail(`${v.name}/${skin.id} seed ${i}: ${(e as Error).message}`)
          continue
        }
        if (inst.trials.length !== v.params.trials) fail(`${v.name}: ${inst.trials.length} trials, expected ${v.params.trials}`)
        const ms = playMs(inst.trials)
        maxMs = Math.max(maxMs, ms)
        if (ms > m.maxSeconds * 1000) fail(`${v.name}/${skin.id} seed ${i}: play time ${ms}ms over cap`)
        for (const [ti, t] of inst.trials.entries()) {
          const perfect = mod.scoreTrial(t, mod.parseAnswer(JSON.parse(JSON.stringify(mod.solve(t))), t))
          if (perfect.score < 0.999) fail(`${v.name}/${skin.id} seed ${i} trial ${ti}: perfect answer scored ${perfect.score}`)
          const none = mod.scoreTrial(t, null)
          if (none.score !== 0) fail(`${v.name}: no answer scored ${none.score}`)
          for (const s of mod.spam(t)) {
            const parsed = mod.parseAnswer(JSON.parse(JSON.stringify(s)), t)
            spamTotal += mod.scoreTrial(t, parsed).score
            spamCount++
          }
          if (t.studyMs < 500) fail(`${v.name}: study phase under half a second`)
          if (t.answerMs < 3000) fail(`${v.name}: answer phase under three seconds`)
        }
      }
    }
  }
  const spamMean = spamCount ? spamTotal / spamCount : 0
  if (spamMean > SPAM_CEILING) fail(`spamming the board averages ${spamMean.toFixed(2)} (ceiling ${SPAM_CEILING})`)

  // Determinism: the same seed gives the same instance.
  const p = levels[defaultLevel]
  const a = JSON.stringify(mod.generate('determinism', p, m.skins[0]))
  const b = JSON.stringify(mod.generate('determinism', p, m.skins[0]))
  if (a !== b) fail('generate is not deterministic')

  return { id: m.id, seeds, failures, rerolls, maxPlaySeconds: Math.round(maxMs / 100) / 10, spamMean: Math.round(spamMean * 1000) / 1000 }
}

export interface CalibrationRow {
  level: number
  median: number
  p25: number
  p75: number
  perfectShare: number
}

/**
 * Simulated score distribution per level, from the module's calibration bot with skill ~ Normal(0.6, 0.18).
 * A starting point only: real play data (scripts/calibrate.ts --data) replaces it.
 */
export function simulateModule(mod: PuzzleModule, players = 2000): CalibrationRow[] {
  const m = mod.manifest
  return m.difficulty.levels.map((params, level) => {
    const scores: number[] = []
    const rng = new Rng(`calibrate:${m.id}:${level}`)
    for (let i = 0; i < players; i++) {
      const skin = m.skins.filter((s) => inSeason(s, '2026-06-01'))[i % m.skins.filter((s) => inSeason(s, '2026-06-01')).length]
      const inst = generateValid(mod, `cal:${m.id}:${level}:${i}`, params, skin)
      const skill = Math.max(0, Math.min(1, rng.normal(0.6, 0.18)))
      const subs = inst.trials.map((t) => mod.scoreTrial(t, mod.parseAnswer(JSON.parse(JSON.stringify(mod.simulate(t, rng, skill))), t)).score)
      scores.push(Math.round((subs.reduce((a, b) => a + b, 0) / subs.length) * 100))
    }
    scores.sort((a, b) => a - b)
    const q = (f: number) => scores[Math.floor(f * (scores.length - 1))]
    return { level, median: q(0.5), p25: q(0.25), p75: q(0.75), perfectShare: scores.filter((s) => s === 100).length / scores.length }
  })
}
