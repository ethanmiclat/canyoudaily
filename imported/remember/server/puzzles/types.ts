/**
 * The puzzle module contract (plan section 4). Every puzzle type is a folder in puzzles/<id>/ with:
 *   index.ts   the module below: manifest, generator, scorer, validator, calibration bot. Pure, no DOM, no React,
 *              so the server, scripts and the browser (practice rounds) all run the same code.
 *   Play.tsx   the React component that plays one sub-trial (study, answer and review phases). Lazy loaded.
 * and one line in puzzles/registry.ts. The engine never knows type-specific details.
 */
import type { Rng } from '../lib/rng.js'

export type Family = 'SEQUENCE' | 'GRID' | 'ITEMS' | 'ASSOC' | 'BUILD' | 'TRACK' | 'ROUTE' | 'SCENE' | 'CUBE'
export type Tier = 'quick' | 'medium' | 'feature'
export type Need = 'audio' | '3d' | 'drag' | 'keyboard'

export interface Skin {
  id: string
  name: string
  /** Art tokens the Play component reads (palettes, item sets, glyphs). The mechanic never depends on them. */
  tokens: Record<string, unknown>
  /** Seasonal skins are only scheduled inside this window (inclusive, MM-DD, may wrap the new year). */
  season?: { from: string; to: string; tag: string }
}

/** Every difficulty level carries at least the number of sub-trials. */
export interface BaseParams {
  trials: number
}

export interface Difficulty<P extends BaseParams> {
  /** Easiest first. The scheduler picks one per day and records it. */
  levels: P[]
  defaultLevel: number
  /** Practice: easier and shorter (one or two sub-trials). */
  practice: P
  /** Median score the levels are tuned for. */
  targetMedian: number
}

export interface ExplainerStep {
  /** Short verb shown big: "Watch", "Wait", "Repeat". */
  label: string
  text: string
}

export interface Manifest<P extends BaseParams = BaseParams> {
  id: string
  name: string
  family: Family
  tier: Tier
  skins: Skin[]
  /** One line on the landing screen. */
  ruleText: string
  /** Optional rule that depends on the day's parameters (e.g. "in reverse"). Falls back to ruleText. */
  ruleFor?: (params: P, skin: Skin) => string
  explainer: ExplainerStep[]
  /** Hard cap on play time (study + answer windows of every sub-trial). At most 90. */
  maxSeconds: number
  difficulty: Difficulty<P>
  needs: Need[]
  enabled: boolean
  /** YYYY-MM-DD. The scheduler never uses a type before this date and debuts it on this date. */
  introducedOn: string
  /** A longer type cooldown than the default, for types that should be rare (N-back). */
  cooldownDays?: number
  /** Scheduled days of this type are marked as hard days. */
  hardDay?: boolean
}

/** One sub-trial. `key` never leaves the server during a real attempt. */
export interface Trial<S = unknown, T = unknown, K = unknown> {
  study: S
  test: T
  key: K
  /** How long the study phase lasts. The answer phase cannot start earlier. */
  studyMs: number
  /** Time allowed for answering after the study phase. */
  answerMs: number
}

export interface Instance<S = unknown, T = unknown, K = unknown> {
  trials: Trial<S, T, K>[]
}

export interface TrialScore {
  /** 0..1 */
  score: number
  /** Short human line for the result screen: "4 of 5 cells". */
  summary: string
}

export interface ScoreResult {
  score0to100: number
  subScores: number[]
  detail: TrialScore[]
}

export interface ShareVisual {
  lines: string[]
  imageSpec?: unknown
}

export interface PuzzleModule<P extends BaseParams = any, S = any, T = any, K = any, A = any> {
  manifest: Manifest<P>
  /** Deterministic: the same seed, params and skin always give the same instance. */
  generate(seed: string, params: P, skin: Skin): Instance<S, T, K>
  /** Turn an untrusted submission into a well-formed answer, or null if it is malformed. */
  parseAnswer(raw: unknown, trial: Trial<S, T, K>): A | null
  /** Score one sub-trial, 0..1. Extra wrong taps cost points so spamming the board does not pay. */
  scoreTrial(trial: Trial<S, T, K>, answer: A | null): TrialScore
  /** Overall score. Defaults to the mean of the sub-trial scores (see lib/engine.ts). */
  score?(instance: Instance<S, T, K>, answers: (A | null)[]): ScoreResult
  /** Extra share lines or an image spec, for puzzles with a visual result. */
  shareVisual?(instance: Instance<S, T, K>, answers: (A | null)[]): ShareVisual
  /** Generator sanity check: unsolvable, ambiguous or over the time cap is a failure. */
  validate(instance: Instance<S, T, K>, params: P): { ok: boolean; reason?: string }
  /** The perfect answer. Must score 1. */
  solve(trial: Trial<S, T, K>): A
  /** Board-spamming answers. Each must score at most 0.35. */
  spam(trial: Trial<S, T, K>): A[]
  /** Calibration bot. `skill` is about 0..1; higher remembers more. */
  simulate(trial: Trial<S, T, K>, rng: Rng, skill: number): A
}
