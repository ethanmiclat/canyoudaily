import { loadConfig, loadPool, readScheduleFile, type ScheduleDay } from './content.js'
import { addDays } from './dates.js'
import { assembleDay, GenerateError, type HistoryDay } from './scheduler.js'

const fallbackCache = new Map<string, ScheduleDay>()

export function allowUnverified(): boolean {
  return process.env.CYC_ALLOW_UNVERIFIED === '1' || !loadConfig().requireVerified
}

/**
 * The day's pairs: the reviewed schedule file, or a seeded fallback so the game never goes down (plan section 6).
 * The fallback only sees schedule files as history, so a run of missing days is generated independently.
 */
export function getSchedule(date: string): ScheduleDay {
  const file = readScheduleFile(date)
  if (file) return { ...file, source: 'file' }

  let day = fallbackCache.get(date)
  if (!day) {
    const config = loadConfig()
    const history: HistoryDay[] = []
    for (let i = 1; i < config.pairCooldownDays; i++) {
      const h = readScheduleFile(addDays(date, -i))
      if (h) history.push(h)
    }
    try {
      day = assembleDay(date, loadPool(), config, history, allowUnverified())
    } catch (err) {
      if (!(err instanceof GenerateError)) throw err
      // Not enough verified content: better an unverified day than no game.
      console.error(`[schedule] ${err.message}; falling back to unverified values`)
      day = { ...assembleDay(date, loadPool(), config, history, true), unverified_allowed: true }
    }
    day = { ...day, source: 'fallback' }
    fallbackCache.set(date, day)
    console.warn(`[schedule] no schedule file for ${date}; using seeded fallback`)
  }
  return day
}
