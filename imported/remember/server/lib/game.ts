/**
 * Runs: one real attempt per day per token, one optional practice round, sub-trials served one at a time with a
 * server clock. The answer key never leaves the server until that sub-trial is answered.
 */
import { config } from './config.js'
import { addDays, dateInZone, nextMidnight, puzzleNumber } from './dates.js'
import { generateValid, grade, paramsFor, ruleFor, scoreInstance, shareText, skinOf, squares } from './engine.js'
import { scheduleFor } from './schedule.js'
import type { ScheduleDay } from './scheduler.js'
import { dailySeed, randomToken } from './seed.js'
import { getStore } from './store.js'
import { getPuzzle, PUZZLES } from '../puzzles/registry.js'
import type { BaseParams, Instance, PuzzleModule, Skin } from '../puzzles/types.js'

export class GameError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const RUN_TTL = 3 * 86_400
const STATS_TTL = 400 * 86_400
/** Score distributions are shown once this many players have finished. */
export const CROWD_MIN = 20

export function today(now = new Date()): string {
  return dateInZone(now, config().timezone)
}

// ---------- the day --------------------------------------------------------------

export interface DayContext {
  date: string
  number: number
  schedule: ScheduleDay
  mod: PuzzleModule
  skin: Skin
  params: BaseParams
  /** Non-empty when a dev override picked the type; keeps those runs apart from the real day. */
  override: string
}

export function resolveDay(o: { date?: string; type?: string; skin?: string; level?: string }): DayContext {
  const date = o.date && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : today()
  let schedule = scheduleFor(date)
  let override = ''
  if (o.type && getPuzzle(o.type)) {
    const mod = getPuzzle(o.type)!
    const level = o.level !== undefined && /^\d+$/.test(o.level) ? Number(o.level) : mod.manifest.difficulty.defaultLevel
    const skin = skinOf(mod, o.skin ?? mod.manifest.skins[0].id)
    schedule = { ...schedule, type: o.type, skin: skin.id, level, params: { ...paramsFor(mod, level) }, seedRef: 'dev', debut: false, feature: mod.manifest.tier === 'feature', hard: !!mod.manifest.hardDay }
    override = `${o.type}/${skin.id}/${level}`
  }
  const mod = getPuzzle(schedule.type)
  if (!mod) throw new GameError(500, `Unknown puzzle type ${schedule.type}`)
  return {
    date,
    number: puzzleNumber(date, config().launchDate),
    schedule,
    mod,
    skin: skinOf(mod, schedule.skin),
    params: schedule.params as unknown as BaseParams,
    override,
  }
}

const instances = new Map<string, Instance>()

/** The day's instance. Deterministic from the secret seed, so it is rebuilt on demand rather than stored. */
export function instanceFor(day: DayContext): Instance {
  const s = day.schedule
  const key = `${day.date}|${s.type}|${s.skin}|${s.seedRef}|${JSON.stringify(s.params)}`
  let inst = instances.get(key)
  if (!inst) {
    inst = generateValid(day.mod, dailySeed(config().seedVersion, day.date, s.type, s.seedRef), day.params, day.skin)
    if (instances.size > 50) instances.clear()
    instances.set(key, inst)
  }
  return inst
}

// ---------- runs -----------------------------------------------------------------

export type PracticeState = 'available' | 'used' | 'skipped'

export interface TrialRecord {
  startedAt: number
  status: 'open' | 'done' | 'timeout'
  submittedAt?: number
  answer?: unknown
  score?: number
  summary?: string
}

export interface Run {
  token: string
  date: string
  createdAt: number
  practice: PracticeState
  trials: TrialRecord[]
  finishedAt?: number
  score?: number
}

const runKey = (day: DayContext, token: string) => `run:${day.date}${day.override ? `:${day.override}` : ''}:${token}`

async function loadRun(day: DayContext, token: string | undefined): Promise<Run | null> {
  if (!token) return null
  return getStore().getJson<Run>(runKey(day, token))
}

async function saveRun(day: DayContext, run: Run) {
  await getStore().setJson(runKey(day, run.token), run, RUN_TTL)
}

async function withLock<T>(day: DayContext, token: string, fn: () => Promise<T>): Promise<T> {
  const store = getStore()
  const lock = `lock:${runKey(day, token)}`
  if (!(await store.acquire(lock, 5))) throw new GameError(409, 'Busy, try again.')
  try {
    return await fn()
  } finally {
    await store.release(lock)
  }
}

async function requireRun(day: DayContext, token: string | undefined): Promise<Run> {
  const run = await loadRun(day, token)
  if (!run) throw new GameError(400, 'No run for today. Start one first.')
  return run
}

export async function startOrResume(token: string | undefined, day: DayContext): Promise<{ token: string; run: Run }> {
  const existing = await loadRun(day, token)
  if (existing) return { token: existing.token, run: existing }
  const t = token && /^[\w-]{8,64}$/.test(token) ? token : randomToken()
  const run: Run = { token: t, date: day.date, createdAt: Date.now(), practice: 'available', trials: [] }
  await saveRun(day, run)
  return { token: t, run }
}

/** Dev only: forget today's run. */
export async function resetRun(token: string | undefined, day: DayContext) {
  if (token) await getStore().setJson(runKey(day, token), null, 1)
}

function deadline(trial: { studyMs: number; answerMs: number }, rec: TrialRecord) {
  return rec.startedAt + trial.studyMs + trial.answerMs + config().submitGraceMs
}

/** Close open sub-trials whose time ran out. Returns true if anything changed. */
function expireStale(day: DayContext, run: Run, instance: Instance, now: number): boolean {
  let changed = false
  run.trials.forEach((rec, i) => {
    if (rec.status === 'open' && now > deadline(instance.trials[i], rec)) {
      const s = day.mod.scoreTrial(instance.trials[i], null)
      Object.assign(rec, { status: 'timeout', submittedAt: now, answer: null, score: s.score, summary: 'Out of time' })
      changed = true
    }
  })
  if (changed) maybeFinish(day, run, instance)
  return changed
}

function maybeFinish(day: DayContext, run: Run, instance: Instance) {
  if (run.finishedAt || run.trials.length < instance.trials.length || run.trials.some((t) => t.status === 'open')) return false
  const result = scoreInstance(day.mod, instance, run.trials.map((t) => t.answer ?? null))
  run.score = result.score0to100
  run.finishedAt = Date.now()
  return true
}

async function recordFinish(day: DayContext, run: Run) {
  if (day.override) return
  const store = getStore()
  await store.hincr(`dist:${day.date}`, String(Math.min(9, Math.floor((run.score ?? 0) / 10))), STATS_TTL)
  await store.push(
    `scores:${day.schedule.type}`,
    { date: day.date, skin: day.skin.id, level: day.schedule.level, score: run.score, sub: run.trials.map((t) => t.score ?? 0), timeouts: run.trials.filter((t) => t.status === 'timeout').length },
    STATS_TTL,
  )
}

export function statusOf(run: Run | null): 'not_started' | 'in_progress' | 'done' {
  if (!run || run.trials.length === 0) return 'not_started'
  return run.finishedAt ? 'done' : 'in_progress'
}

// ---------- public shapes ------------------------------------------------------------

export function publicToday(day: DayContext, run: Run | null) {
  const m = day.mod.manifest
  return {
    date: day.date,
    number: day.number,
    nextResetAt: nextMidnight(day.date, config().timezone).toISOString(),
    puzzle: {
      id: m.id,
      name: m.name,
      family: m.family,
      tier: m.tier,
      skin: day.skin,
      rule: ruleFor(day.mod, day.params, day.skin),
      explainer: m.explainer,
      trials: day.params.trials,
      maxSeconds: m.maxSeconds,
      needs: m.needs,
      params: day.params,
      level: day.schedule.level,
    },
    debut: day.schedule.debut,
    feature: day.schedule.feature,
    hard: !!day.schedule.hard,
    /** Tomorrow's puzzle name only (never its content), for a hub teaser. */
    tomorrow: teaser(addDays(day.date, 1)),
    practice: run?.practice ?? 'available',
    status: statusOf(run),
    dev: day.override || undefined,
  }
}

export function publicRun(run: Run) {
  return {
    practice: run.practice,
    status: statusOf(run),
    trials: run.trials.map((t, index) => ({ index, status: t.status, score: t.score, summary: t.summary })),
    nextIndex: run.trials.length,
    score: run.score,
  }
}

// ---------- actions ----------------------------------------------------------------

export async function runState(token: string | undefined, day: DayContext) {
  const run = await loadRun(day, token)
  if (run && !run.finishedAt && expireStale(day, run, instanceFor(day), Date.now())) {
    await saveRun(day, run)
    if (run.finishedAt) await recordFinish(day, run)
  }
  return run
}

export async function practice(token: string | undefined, day: DayContext, skip: boolean) {
  const run = await requireRun(day, token)
  return withLock(day, run.token, async () => {
    const fresh = (await loadRun(day, run.token))!
    if (fresh.practice !== 'available' || fresh.trials.length > 0) throw new GameError(409, 'The practice round is gone for today.')
    fresh.practice = skip ? 'skipped' : 'used'
    await saveRun(day, fresh)
    if (skip) return { practice: fresh.practice }
    // A fresh random seed: practice can never leak the real puzzle. Unscored, so the keys can go to the client.
    const params = day.mod.manifest.difficulty.practice
    const instance = generateValid(day.mod, `practice:${randomToken()}`, params, day.skin)
    return { practice: fresh.practice, params, instance }
  })
}

export async function startTrial(token: string | undefined, day: DayContext, index: number) {
  const run = await requireRun(day, token)
  return withLock(day, run.token, async () => {
    const fresh = (await loadRun(day, run.token))!
    const instance = instanceFor(day)
    const now = Date.now()
    if (expireStale(day, fresh, instance, now)) {
      await saveRun(day, fresh)
      if (fresh.finishedAt) await recordFinish(day, fresh)
    }
    if (fresh.finishedAt) throw new GameError(409, "You've finished today's puzzle.")
    if (!Number.isInteger(index) || index < 0 || index >= instance.trials.length) throw new GameError(400, 'No such trial.')

    let rec = fresh.trials[index]
    if (rec && rec.status !== 'open') throw new GameError(409, 'That trial is already answered.')
    if (!rec) {
      if (index !== fresh.trials.length) throw new GameError(409, 'Trials go in order.')
      rec = { startedAt: now, status: 'open' }
      fresh.trials.push(rec)
      if (fresh.practice === 'available') fresh.practice = 'skipped'
      await saveRun(day, fresh)
    }
    const t = instance.trials[index]
    return {
      index,
      total: instance.trials.length,
      trial: { study: t.study, test: t.test, studyMs: t.studyMs, answerMs: t.answerMs },
      // On a refresh the clock keeps running: the client resumes the study (or answer) phase where it was.
      elapsedMs: now - rec.startedAt,
      run: publicRun(fresh),
    }
  })
}

export async function submitTrial(token: string | undefined, day: DayContext, index: number, rawAnswer: unknown) {
  const run = await requireRun(day, token)
  return withLock(day, run.token, async () => {
    const fresh = (await loadRun(day, run.token))!
    const instance = instanceFor(day)
    const rec = fresh.trials[index]
    if (!rec) throw new GameError(400, 'That trial has not started.')
    const trial = instance.trials[index]
    const now = Date.now()
    if (rec.status === 'open') {
      if (now < rec.startedAt + trial.studyMs - config().studyToleranceMs) throw new GameError(400, 'Too early: the study phase is still running.')
      if (now > deadline(trial, rec)) {
        expireStale(day, fresh, instance, now)
      } else {
        const answer = day.mod.parseAnswer(rawAnswer, trial)
        if (answer === null && rawAnswer !== null) throw new GameError(400, 'That answer is not valid for this puzzle.')
        const s = day.mod.scoreTrial(trial, answer)
        Object.assign(rec, { status: 'done', submittedAt: now, answer, score: s.score, summary: s.summary })
        maybeFinish(day, fresh, instance)
      }
      await saveRun(day, fresh)
      if (fresh.finishedAt) await recordFinish(day, fresh)
    }
    return {
      index,
      status: rec.status,
      score: rec.score ?? 0,
      summary: rec.summary ?? '',
      answer: rec.answer ?? null,
      key: trial.key,
      done: !!fresh.finishedAt,
      run: publicRun(fresh),
    }
  })
}

export async function result(token: string | undefined, day: DayContext) {
  const run = await runState(token, day)
  if (!run?.finishedAt) throw new GameError(409, 'Finish the puzzle first.')
  const instance = instanceFor(day)
  const answers = run.trials.map((t) => t.answer ?? null)
  const scored = scoreInstance(day.mod, instance, answers)
  const visual = day.mod.shareVisual?.(instance, answers)
  const dist = day.override ? {} : await getStore().hgetall(`dist:${day.date}`)
  const players = Object.values(dist).reduce((a, b) => a + b, 0)
  const name = day.mod.manifest.name
  return {
    date: day.date,
    number: day.number,
    puzzle: { id: day.mod.manifest.id, name, skin: day.skin.name },
    score: run.score ?? scored.score0to100,
    subScores: scored.subScores,
    grades: scored.subScores.map(grade),
    squares: squares(scored.subScores),
    trials: run.trials.map((t, i) => ({
      status: t.status,
      score: t.score ?? 0,
      summary: t.summary ?? '',
      study: instance.trials[i].study,
      test: instance.trials[i].test,
      key: instance.trials[i].key,
      answer: t.answer ?? null,
    })),
    shareText: shareText(day.number, name, scored.subScores, run.score ?? scored.score0to100, visual?.lines),
    visual: visual ?? null,
    distribution: players >= CROWD_MIN ? { players, buckets: Array.from({ length: 10 }, (_, b) => dist[String(b)] ?? 0) } : null,
    nextResetAt: nextMidnight(day.date, config().timezone).toISOString(),
    tomorrow: teaser(addDays(day.date, 1)),
  }
}

/** Tomorrow's puzzle name for the result screen and the hub teaser. Only the name, never the content. */
export function teaser(date: string): string | null {
  try {
    const s = scheduleFor(date)
    return getPuzzle(s.type)?.manifest.name ?? null
  } catch {
    return null
  }
}

export const allTypes = () => PUZZLES.map((p) => p.manifest.id)
