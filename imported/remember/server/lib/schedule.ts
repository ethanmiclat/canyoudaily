/** Reads content/schedule/YYYY-MM-DD.json, falling back to the scheduler when a day has no file. */
import fs from 'node:fs'
import path from 'node:path'
import { config, contentDir } from './config.js'
import { addDays } from './dates.js'
import { Scheduler, type ScheduleDay } from './scheduler.js'
import { MANIFESTS } from '../puzzles/registry.js'

export function scheduleDir(): string {
  return path.join(contentDir(), 'schedule')
}

export function scheduler(): Scheduler {
  return new Scheduler(MANIFESTS, config())
}

export function readScheduleFile(date: string): ScheduleDay | null {
  const file = path.join(scheduleDir(), `${date}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ScheduleDay
}

const memo = new Map<string, ScheduleDay>()

/**
 * The schedule for `date`. Uses the file if there is one, otherwise generates the day with the same code as
 * scripts/schedule.ts, using the previous days (files or, recursively, generated) as history.
 */
export function scheduleFor(date: string): ScheduleDay {
  const fromFile = readScheduleFile(date)
  if (fromFile) return fromFile
  const hit = memo.get(date)
  if (hit) return hit
  const s = scheduler()
  const day = s.buildDay(date, historyBefore(date, s.historyDays))
  memo.set(date, day)
  return day
}

/** The `days` days before `date` (never before launch), from files or generated. */
export function historyBefore(date: string, days: number): ScheduleDay[] {
  const launch = config().launchDate
  const out: ScheduleDay[] = []
  // Generate oldest first so the recursion only ever goes one step deep per day.
  for (let d = addDays(date, -days); d < date; d = addDays(d, 1)) if (d >= launch) out.push(scheduleFor(d))
  return out
}

/** Forget generated days (after the script writes files, or in tests). */
export function clearScheduleMemo() {
  memo.clear()
}
