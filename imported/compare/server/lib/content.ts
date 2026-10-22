import fs from 'node:fs'
import path from 'node:path'

// CYC_CONTENT_DIR is set when the game runs inside the Can You Daily hub.
const CONTENT_DIR = process.env.CYC_CONTENT_DIR || path.join(process.cwd(), 'content')

export const BANDS = ['easy', 'medium', 'hard'] as const
export type Band = (typeof BANDS)[number]

export interface Config {
  launchDate: string
  timezone: string
  pairsPerDay: number
  /** Time limit per pair, from the moment the server serves it. */
  pairSeconds: number
  /** Network slack before a late answer counts as a timeout. */
  graceMs: number
  /** How long the client shows each reveal before moving on (tap to skip). */
  revealMs: number
  bands: Record<Band, [number, number]>
  bandMix: Record<Band, number>
  minCategories: number
  maxPerCategory: number
  itemCooldownDays: number
  /** Days a question family sits out after it is asked (1 = never on back-to-back days). */
  familyCooldownDays?: number
  /** A question type's weight in the draw is the days since it was last asked, up to this many. */
  metricRestDays?: number
  pairCooldownDays: number
  toleranceMargin: number
  /** Share of pairs asked the "lower" way round (shorter, fewer...) when the metric has that wording. */
  lowQuestionShare: number
  aheadDays: number
  generatorSeed: string
  requireVerified: boolean
  /** Answers a pair needs before the reveal shows "X% got this right". */
  crowdMinAnswers?: number
  categories: Record<string, { label: string; icon: string }>
  /** Days whose runs were reset, with when: everyone starts that day over (see runKey and web/src/lib/hub.ts). */
  resets?: Record<string, string>
}

export interface Format {
  kind: 'number' | 'year' | 'duration'
  decimals?: number
  /** Show this many significant figures instead of fixed decimals (for values spanning grams to tonnes). */
  sig?: number
  prefix?: string
  suffix?: string
}

export interface PoolMetric {
  /** Set on crossover bouts (content/crossovers.json), which ask one question across two metrics. */
  crossover?: boolean
  /** Look-alike metrics share a family; a day asks at most one per family. */
  family?: string
  /** What the question is about (film, country, coaster...); a day asks about each subject once. */
  subject?: string
  category: string
  question: string
  question_low?: string
  unit: string
  format: Format
  scale: 'ratio' | 'years_before' | 'kelvin'
  reference_year?: number
  gap_display: 'pct' | 'abs' | 'both'
  scope_note: string
  show_note: boolean
  definition_note: string
  fact_default?: string
}

export interface PoolValue {
  v: number
  /** Verified (two agreeing sources). */
  ok: boolean
  fact?: string
  note?: string
  /** Crossover bouts: what the card says, e.g. "Chile's coastline" (content/crossovers.json). */
  label?: string
}

/** [metric, itemA, itemB, gap, band index], itemA < itemB, sorted by metric then items. */
export type PoolPair = [string, string, string, number, number]

export interface Pool {
  version: number
  contentHash: string
  metrics: Record<string, PoolMetric>
  items: Record<string, { name: string; familiarity: 'low' | 'medium' | 'high' }>
  values: Record<string, Record<string, PoolValue>>
  facts: Record<string, string>
  pairs: PoolPair[]
}

export interface SchedulePair {
  id: string
  metric: string
  category: string
  band: Band
  gap: number
  ask: 'high' | 'low'
  question: string
  /** Left card, as displayed. */
  a: string
  /** Right card. */
  b: string
  va: number
  vb: number
  answer: 'a' | 'b'
  fact: string
  /** Set by review.py correct: the stored answer was wrong when played, so everyone gets the point. */
  void?: boolean
  corrected?: { at: string; reason: string }
}

export interface ScheduleDay {
  date: string
  puzzle: number
  contentHash: string
  reviewed: boolean
  relaxed?: number
  /** Set when the family cooldown had to be dropped to fill the day. */
  familyRepeat?: boolean
  unverified_allowed?: boolean
  generated_at?: string
  pairs: SchedulePair[]
  source?: 'file' | 'fallback'
}

function readJson<T>(...parts: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, ...parts), 'utf8')) as T
}

let config: Config | undefined
export function loadConfig(): Config {
  return (config ??= readJson<Config>('config.json'))
}

let pool: Pool | undefined
export function loadPool(): Pool {
  return (pool ??= readJson<Pool>('pool.json'))
}

/** A free-licensed picture for an item, from scripts/fetch_images.py. Credit is shown under the cards. */
export interface ItemImage {
  src: string
  w: number
  h: number
  /** Wikipedia article the picture leads. */
  page: string
  /** File description page (author, license, original). */
  file: string
  artist: string
  license: string
  license_url: string | null
  /** What a related photo shows (a film's cast, a song's performer). Absent when the photo is the item itself. */
  about?: string
}

let images: Record<string, ItemImage | null> | undefined
export function loadImages(): Record<string, ItemImage | null> {
  if (!images) {
    const file = path.join(CONTENT_DIR, 'images.json')
    images = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, ItemImage | null>) : {}
  }
  return images
}

/** Each Pokémon's types, from scripts/fetch_pokemon_types.py. Pokémon have no free pictures; the card is styled by type. */
let pokemonTypes: Record<string, string[]> | undefined
export function loadPokemonTypes(): Record<string, string[]> {
  if (!pokemonTypes) {
    const file = path.join(CONTENT_DIR, 'pokemon_types.json')
    pokemonTypes = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string[]>) : {}
  }
  return pokemonTypes
}

const scheduleFiles = new Map<string, ScheduleDay | null>()
export function readScheduleFile(date: string): ScheduleDay | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Bad date ${date}`)
  if (!scheduleFiles.has(date)) {
    const file = path.join(CONTENT_DIR, 'schedule', `${date}.json`)
    const day = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as ScheduleDay) : null
    scheduleFiles.set(date, day)
  }
  return scheduleFiles.get(date) ?? null
}

/** The number gaps and answers are measured on. Mirrors `effective` in scripts/content_lib.py. */
export function effective(metric: Pick<PoolMetric, 'scale' | 'reference_year'>, value: number): number {
  if (metric.scale === 'years_before') return (metric.reference_year ?? 0) - value
  if (metric.scale === 'kelvin') return value + 273.15
  return value
}
