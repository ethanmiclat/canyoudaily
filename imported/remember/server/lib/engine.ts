/**
 * Type-agnostic engine pieces shared by the server, scripts and the browser: scoring, share text, skins and
 * difficulty lookups, and generation with validation. Pure (no node: imports).
 */
import type { BaseParams, Instance, PuzzleModule, ScoreResult, Skin, TrialScore } from '../puzzles/types.js'

export function scoreInstance(mod: PuzzleModule, instance: Instance, answers: (unknown | null)[]): ScoreResult {
  if (mod.score) return mod.score(instance, answers)
  const detail: TrialScore[] = instance.trials.map((t, i) => mod.scoreTrial(t, answers[i] ?? null))
  return fromDetail(detail)
}

export function fromDetail(detail: TrialScore[]): ScoreResult {
  const subScores = detail.map((d) => round3(d.score))
  const mean = subScores.length ? subScores.reduce((a, b) => a + b, 0) / subScores.length : 0
  return { score0to100: Math.round(mean * 100), subScores, detail }
}

export const round3 = (x: number) => Math.round(x * 1000) / 1000

/** Green is full marks, red is a miss, yellow is anything in between. */
export type Grade = 'full' | 'partial' | 'miss'
export function grade(score: number): Grade {
  if (score >= 0.995) return 'full'
  if (score < 0.2) return 'miss'
  return 'partial'
}
export const SQUARE: Record<Grade, string> = { full: '[+]', partial: '[/]', miss: '[x]' }

export function squares(subScores: number[]): string {
  return subScores.map((s) => SQUARE[grade(s)]).join('')
}

/** The share card text, without the link (the client adds the page URL). */
export function shareText(number: number, puzzleName: string, subScores: number[], score: number, extra: string[] = []): string {
  return [`Can You Remember #${number} · ${puzzleName}`, `${squares(subScores)}  ${score}/100`, ...extra].join('\n')
}

export function skinOf(mod: PuzzleModule, skinId: string): Skin {
  return mod.manifest.skins.find((s) => s.id === skinId) ?? mod.manifest.skins[0]
}

export function paramsFor<P extends BaseParams>(mod: PuzzleModule<P>, level: number): P {
  const levels = mod.manifest.difficulty.levels
  return levels[Math.max(0, Math.min(levels.length - 1, level))]
}

export function ruleFor(mod: PuzzleModule, params: BaseParams, skin: Skin): string {
  return mod.manifest.ruleFor?.(params, skin) ?? mod.manifest.ruleText
}

/**
 * Generate an instance and run the module's validator. A seed whose instance fails validation is re-rolled
 * deterministically (seed:1, seed:2, ...), so every player still gets the same puzzle.
 */
export function generateValid(mod: PuzzleModule, seed: string, params: BaseParams, skin: Skin): Instance {
  let lastReason = ''
  for (let attempt = 0; attempt < 25; attempt++) {
    const instance = mod.generate(attempt === 0 ? seed : `${seed}:${attempt}`, params, skin)
    const v = mod.validate(instance, params)
    if (v.ok) return instance
    lastReason = v.reason ?? 'invalid'
  }
  throw new Error(`${mod.manifest.id}: no valid instance after 25 attempts (${lastReason})`)
}

/** Season windows are MM-DD pairs and may wrap the new year. */
export function inSeason(skin: Skin, date: string): boolean {
  if (!skin.season) return true
  const md = date.slice(5)
  const { from, to } = skin.season
  return from <= to ? md >= from && md <= to : md >= from || md <= to
}
