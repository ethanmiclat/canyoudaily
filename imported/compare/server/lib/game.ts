import { loadConfig, loadImages, loadPokemonTypes, loadPool, type Format, type ScheduleDay, type SchedulePair } from './content.js'
import { dateInZone, nextMidnight } from './dates.js'
import { randomToken } from './rng.js'
import { getSchedule } from './schedule.js'
import { getStore } from './store.js'

const RUN_TTL = 3 * 86_400
const LOG_TTL = 400 * 86_400
const LOCK_TTL = 5

export type Choice = 'a' | 'b'

export interface Answer {
  index: number
  pairId: string
  /** null when the clock ran out. */
  choice: Choice | null
  correct: boolean
  timedOut: boolean
  /** Server-measured time from serving the pair to the answer. */
  ms: number
}

export interface Run {
  id: string
  date: string
  createdAt: number
  status: 'playing' | 'done'
  /** The next pair to play, 0-based. */
  index: number
  /** When the current pair was served (epoch ms). Null until the client asks for it. */
  servedAt: number | null
  answers: Answer[]
  reported: string[]
}

export class GameError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function today(now = new Date()): string {
  const override = process.env.CYC_DATE
  if (override && process.env.NODE_ENV !== 'production' && !process.env.VERCEL) return override
  return dateInZone(now, loadConfig().timezone)
}

/* ---------- public shapes ---------- */

export function publicToday(date: string) {
  const config = loadConfig()
  const day = getSchedule(date)
  return {
    date,
    puzzle: day.puzzle,
    pairs: day.pairs.length,
    pairSeconds: config.pairSeconds,
    revealMs: config.revealMs,
    nextResetAt: nextMidnight(date, config.timezone).toISOString(),
    categories: config.categories,
  }
}

/** The picture and its credit for a card, if the item has a free-licensed one; else a Pokémon's types, if it is one. */
function cardImage(id: string): { image?: { src: string; w: number; h: number; file: string; artist: string; license: string; about?: string }; types?: string[] } {
  const img = loadImages()[id]
  if (img) return { image: { src: img.src, w: img.w, h: img.h, file: img.file, artist: img.artist, license: img.license, ...(img.about ? { about: img.about } : {}) } }
  const types = loadPokemonTypes()[id]
  return types ? { types } : {}
}

/** The name on a card: a crossover's label ("Chile's coastline"), else the item's name. */
function cardName(pool: ReturnType<typeof loadPool>, metric: string, id: string): string {
  return pool.values[metric]?.[id]?.label ?? pool.items[id]?.name ?? id
}

/** What the client sees while a pair is live: names, question and ids only. Values stay on the server. */
export function publicPair(day: ScheduleDay, run: Run) {
  const pair = day.pairs[run.index]
  const pool = loadPool()
  const deadline = (run.servedAt ?? Date.now()) + loadConfig().pairSeconds * 1000
  const card = (id: string) => ({ id, name: cardName(pool, pair.metric, id), ...cardImage(id) })
  return {
    index: run.index,
    pairId: pair.id,
    category: pair.category,
    question: pair.question,
    a: card(pair.a),
    b: card(pair.b),
    timeLeftMs: Math.max(0, deadline - Date.now()),
  }
}

interface RevealSide {
  id: string
  name: string
  value: number
  note?: string
  image?: ReturnType<typeof cardImage>['image']
  types?: string[]
}

export interface Reveal {
  index: number
  pairId: string
  category: string
  question: string
  format: Format
  gapDisplay: 'pct' | 'abs' | 'both'
  a: RevealSide
  b: RevealSide
  answer: Choice
  /** Fraction of the larger value, as in plan section 4. */
  gap: number
  fact: string
  /** Shown when the metric's definition matters to the answer. */
  scopeNote: string | null
  void: boolean
}

export function reveal(day: ScheduleDay, index: number): Reveal {
  const pair = day.pairs[index]
  const pool = loadPool()
  const metric = pool.metrics[pair.metric]
  const side = (id: string, value: number) => {
    const note = pool.values[pair.metric]?.[id]?.note
    return { id, name: cardName(pool, pair.metric, id), value, ...(note ? { note } : {}), ...cardImage(id) }
  }
  return {
    index,
    pairId: pair.id,
    category: pair.category,
    question: pair.question,
    format: metric.format,
    gapDisplay: metric.gap_display,
    a: side(pair.a, pair.va),
    b: side(pair.b, pair.vb),
    answer: pair.answer,
    gap: pair.gap,
    fact: pair.fact,
    scopeNote: metric.show_note ? metric.scope_note : null,
    void: !!pair.void,
  }
}

/** A voided pair (its stored answer was wrong when played) counts as correct for everyone. */
export function credited(day: ScheduleDay, a: Answer): boolean {
  return a.correct || !!day.pairs[a.index]?.void
}

export function scoreOf(day: ScheduleDay, run: Run): number {
  return run.answers.filter((a) => credited(day, a)).length
}

export function publicRun(run: Run) {
  const day = getSchedule(run.date)
  return {
    date: run.date,
    status: run.status,
    index: run.index,
    total: day.pairs.length,
    score: scoreOf(day, run),
    answers: run.answers.map((a) => ({ ...a, credited: credited(day, a), reveal: reveal(day, a.index) })),
    /** The pair in progress after a refresh: its clock kept running. */
    current: run.status === 'playing' && run.servedAt !== null ? publicPair(day, run) : null,
    reported: run.reported,
  }
}

export function shareText(day: ScheduleDay, run: Run): string {
  const squares = day.pairs.map((_, i) => {
    const a = run.answers.find((x) => x.index === i)
    return a ? (credited(day, a) ? '✅' : '❌') : '⬜'
  })
  return [`Can You Compare #${day.puzzle} 🥊`, `Scorecard ${scoreOf(day, run)}/${day.pairs.length}`, squares.join('')].join('\n')
}

/* ---------- runs ---------- */

const runKey = (date: string, token: string) => `run:${date}:${token}`

export function validToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(token)
}

export async function startOrResume(token: string | undefined, date: string) {
  const store = getStore()
  if (!validToken(token)) token = randomToken()
  const existing = await store.getJson<Run>(runKey(date, token))
  if (existing) return { token, run: await settleExpired(existing, token) }
  const run: Run = {
    id: randomToken(12),
    date,
    createdAt: Date.now(),
    status: 'playing',
    index: 0,
    servedAt: null,
    answers: [],
    reported: [],
  }
  await store.setJson(runKey(date, token), run, RUN_TTL)
  await store.hincr(`stats:${date}`, 'started', LOG_TTL)
  return { token, run }
}

/** Load the run under a short lock so two tabs can't answer the same pair twice. */
export async function withRun<T>(token: string | undefined, date: string, fn: (run: Run) => Promise<T> | T): Promise<T> {
  if (!validToken(token)) throw new GameError(401, 'No run. Refresh to start.')
  const store = getStore()
  const key = runKey(date, token)
  if (!(await store.acquire(`lock:${key}`, LOCK_TTL))) throw new GameError(409, 'Busy. Try again.')
  try {
    const run = await store.getJson<Run>(key)
    if (!run) throw new GameError(404, 'No run for today. Refresh to start.')
    const out = await fn(run)
    await store.setJson(key, run, RUN_TTL)
    return out
  } finally {
    await store.release(`lock:${key}`)
  }
}

/** A pair whose clock ran out while the player was away is recorded as a timeout on the next load. */
async function settleExpired(run: Run, token: string): Promise<Run> {
  if (run.status !== 'playing' || run.servedAt === null) return run
  const config = loadConfig()
  if (Date.now() - run.servedAt <= config.pairSeconds * 1000 + config.graceMs) return run
  return withRun(token, run.date, async (fresh) => {
    if (fresh.status === 'playing' && fresh.servedAt !== null && fresh.index === run.index) await record(fresh, null)
    return fresh
  })
}

/** Serve pair `index` and start its clock. Only the next unanswered pair can be served; asking again resumes it. */
export function servePair(run: Run, index: number) {
  if (run.status === 'done') throw new GameError(409, 'Today’s run is finished.')
  if (index !== run.index) throw new GameError(409, 'Out of sync. Refresh.')
  const config = loadConfig()
  if (run.servedAt !== null && Date.now() - run.servedAt > config.pairSeconds * 1000 + config.graceMs) {
    throw new GameError(409, 'Time is up for this pair. Refresh.')
  }
  run.servedAt ??= Date.now()
  return publicPair(getSchedule(run.date), run)
}

export function parseChoice(input: unknown): Choice | null {
  if (input === 'a' || input === 'b') return input
  if (input === null || input === 'none' || input === undefined) return null
  throw new GameError(400, 'Choice must be a, b or none.')
}

/** Resolve the current pair. A missing choice or a late answer is a timeout, which counts as wrong. */
export async function answerPair(run: Run, index: number, choice: Choice | null) {
  if (run.status === 'done') throw new GameError(409, 'Today’s run is finished.')
  if (index !== run.index) throw new GameError(409, 'Out of sync. Refresh.')
  if (run.servedAt === null) throw new GameError(409, 'That pair hasn’t started yet.')
  const answer = await record(run, choice)
  const day = getSchedule(run.date)
  return { answer: { ...answer, credited: credited(day, answer) }, reveal: reveal(day, answer.index), crowd: await crowdFor(run.date, answer.pairId) }
}

async function record(run: Run, choice: Choice | null): Promise<Answer> {
  const config = loadConfig()
  const day = getSchedule(run.date)
  const pair: SchedulePair = day.pairs[run.index]
  const ms = Date.now() - (run.servedAt ?? Date.now())
  const timedOut = choice === null || ms > config.pairSeconds * 1000 + config.graceMs
  const answer: Answer = {
    index: run.index,
    pairId: pair.id,
    choice: timedOut ? null : choice,
    correct: !timedOut && choice === pair.answer,
    timedOut,
    ms: Math.min(ms, config.pairSeconds * 1000),
  }
  run.answers.push(answer)
  run.index += 1
  run.servedAt = null
  if (run.index >= day.pairs.length) run.status = 'done'

  const store = getStore()
  await store.push(
    `log:${run.date}`,
    { runId: run.id, date: run.date, pairId: pair.id, band: pair.band, index: answer.index, choice: answer.choice, correct: answer.correct, timedOut, ms: answer.ms, ts: Date.now() },
    LOG_TTL,
  )
  await store.hincr(`pairstats:${run.date}`, `${pair.id}|n`, LOG_TTL)
  if (answer.correct) await store.hincr(`pairstats:${run.date}`, `${pair.id}|c`, LOG_TTL)
  if (run.status === 'done') {
    await store.hincr(`stats:${run.date}`, 'finished', LOG_TTL)
    await store.hincr(`stats:${run.date}`, `score_${scoreOf(day, run)}`, LOG_TTL)
  }
  return answer
}

/** "X% got this right", once enough players have answered the pair. */
async function crowdFor(date: string, pairId: string) {
  const min = loadConfig().crowdMinAnswers ?? 50
  const h = await getStore().hgetall(`pairstats:${date}`)
  const n = h[`${pairId}|n`] ?? 0
  if (n < min) return null
  return { pct: Math.round(((h[`${pairId}|c`] ?? 0) / n) * 100), n }
}

/** The day's score distribution, once enough runs have finished. */
export async function distributionFor(date: string) {
  const min = loadConfig().crowdMinAnswers ?? 50
  const h = await getStore().hgetall(`stats:${date}`)
  const finished = h.finished ?? 0
  if (finished < min) return null
  const total = getSchedule(date).pairs.length
  return { finished, scores: Array.from({ length: total + 1 }, (_, s) => h[`score_${s}`] ?? 0) }
}

export async function resultFor(run: Run) {
  if (run.status !== 'done') throw new GameError(409, 'Finish today’s pairs first.')
  const day = getSchedule(run.date)
  return {
    puzzle: day.puzzle,
    score: scoreOf(day, run),
    total: day.pairs.length,
    shareText: shareText(day, run),
    answers: publicRun(run).answers,
    distribution: await distributionFor(run.date),
  }
}

export const REPORT_REASONS = ['wrong_value', 'unclear_question', 'outdated', 'other'] as const

/** Report a pair the player has already answered (plan section 7). One report per pair per run. */
export async function reportPair(run: Run, pairId: unknown, reason: unknown, note: unknown) {
  if (typeof pairId !== 'string' || !run.answers.some((a) => a.pairId === pairId)) {
    throw new GameError(400, 'You can only report a pair you have played.')
  }
  if (typeof reason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(reason)) throw new GameError(400, 'Pick a reason.')
  if (run.reported.includes(pairId)) return { ok: true, duplicate: true }
  const text = typeof note === 'string' ? note.trim().slice(0, 280) : ''
  run.reported.push(pairId)
  await getStore().push('reports', { date: run.date, pairId, reason, note: text || null, runId: run.id, ts: Date.now() }, LOG_TTL)
  return { ok: true }
}

/** Local dev only: forget today's run for this token. */
export async function resetRun(token: string | undefined, date: string) {
  if (!validToken(token)) return
  await getStore().setJson(runKey(date, token), null, 1)
}
