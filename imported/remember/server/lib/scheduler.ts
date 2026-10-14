/**
 * The rotation scheduler (plan section 9). Pure: the generator script and the server fallback both call planDay,
 * so a day without a schedule file is generated exactly as the script would have written it.
 *
 * Rules:
 *   - a type does not repeat within `typeCooldownDays`
 *   - no two puzzles of the same family on consecutive days
 *   - a skin does not repeat within `skinCooldownDays`; seasonal skins only inside their window
 *   - feature days: Saturdays, once `minFeatureTypesForFeatureDays` feature types are built (enabled). A Saturday
 *     uses a feature type introduced by then, falling back to a medium type if none is free; feature types never
 *     run on other days. Until then feature types are not scheduled and weekend days prefer medium types.
 *   - a type is never used before its `introducedOn` date and always debuts on that date (the lookahead steers the
 *     days before it so the debut stays possible)
 *   - a type may set a longer cooldown (`cooldownDays`) to stay rare; `hardDay` types mark the day as hard
 *
 * planDay picks the first candidate, in a seeded order, that still leaves a valid schedule for the next
 * `LOOKAHEAD` days (depth-first search with backtracking), so the rotation never walks into a dead end.
 */
import { addDays } from './dates.js'
import { inSeason } from './engine.js'
import { Rng } from './rng.js'
import type { Manifest } from '../puzzles/types.js'

export interface ScheduleDay {
  date: string
  type: string
  skin: string
  level: number
  /** The difficulty parameters, recorded so later tuning only affects future days. */
  params: Record<string, unknown>
  /** Seed reference. The real seed is HMAC(secret, version|date|type|seedRef). Bump it to re-roll a day. */
  seedRef: string
  feature: boolean
  debut: boolean
  /** A marked hard day (N-back). */
  hard?: boolean
  generated_at: string
  reviewed: boolean
}

export interface SchedulerRules {
  typeCooldownDays: number
  familyGapDays: number
  skinCooldownDays: number
  minFeatureTypesForFeatureDays: number
  seedVersion: string
}

export const LOOKAHEAD = 14
const SEARCH_BUDGET = 50_000


interface DayPick {
  date: string
  type: string
  skin: string
  family: string
  tier: string
}

function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

/** Saturday is the feature day; Saturday and Sunday are weekend days. */
const isFeatureDay = (date: string) => weekday(date) === 6
const isWeekend = (date: string) => weekday(date) === 0 || weekday(date) === 6

export class Scheduler {
  private byId: Map<string, Manifest>

  constructor(private readonly manifests: Manifest[], private readonly rules: SchedulerRules) {
    this.byId = new Map(manifests.map((m) => [m.id, m]))
  }

  private usable(date: string): Manifest[] {
    return this.manifests.filter((m) => m.enabled && m.introducedOn <= date && m.skins.length > 0)
  }

  /** Feature days start once enough feature types are built, so they can debut one Saturday at a time. */
  private get featureDays(): boolean {
    return this.manifests.filter((m) => m.enabled && m.tier === 'feature' && m.skins.length > 0).length >= this.rules.minFeatureTypesForFeatureDays
  }

  /** Types that must debut on `date`. */
  private debutsOn(date: string): Set<string> {
    return new Set(this.manifests.filter((m) => m.enabled && m.introducedOn === date && m.skins.length > 0).map((m) => m.id))
  }

  private toPick(d: { date: string; type: string; skin: string }): DayPick | null {
    const m = this.byId.get(d.type)
    return m ? { date: d.date, type: d.type, skin: d.skin, family: m.family, tier: m.tier } : null
  }

  /** Every (type, skin) allowed on `date` after `history` (sorted, most recent last), best candidates first. */
  candidates(date: string, history: DayPick[]): { type: string; skin: string }[] {
    const rng = new Rng(`${this.rules.seedVersion}:schedule:${date}`)
    const daysAgo = (d: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000)
    const lastType = new Map<string, number>()
    const lastSkin = new Map<string, number>()
    for (const h of history) {
      lastType.set(h.type, daysAgo(h.date))
      lastSkin.set(`${h.type}/${h.skin}`, daysAgo(h.date))
    }
    const recentFamilies = new Set(history.filter((h) => daysAgo(h.date) <= this.rules.familyGapDays).map((h) => h.family))

    const featureDays = this.featureDays
    const out: { type: string; skin: string; rank: number }[] = []
    for (const m of rng.shuffle(this.usable(date))) {
      const ago = lastType.get(m.id)
      if (ago !== undefined && ago <= (m.cooldownDays ?? this.rules.typeCooldownDays)) continue
      if (recentFamilies.has(m.family)) continue
      if (m.tier === 'feature' && !(featureDays && isFeatureDay(date))) continue

      const skins = rng.shuffle(
        m.skins.filter((s) => {
          const sAgo = lastSkin.get(`${m.id}/${s.id}`)
          return inSeason(s, date) && !(sAgo !== undefined && sAgo <= this.rules.skinCooldownDays)
        }),
      )
      if (skins.length === 0) continue
      // In-season seasonal skins go first: they only get a short window.
      skins.sort((a, b) => Number(!!b.season) - Number(!!a.season))

      let rank = 3
      if (m.introducedOn === date) rank = 0 // debut
      else if (featureDays && isFeatureDay(date)) rank = m.tier === 'feature' ? 1 : m.tier === 'medium' ? 2 : 3
      else if (isWeekend(date) && m.tier === 'medium') rank = 2
      for (const s of skins) out.push({ type: m.id, skin: s.id, rank })
    }
    // Stable sort keeps the seeded order inside each rank. One skin per type is enough for the search; the others
    // follow so a skin conflict further ahead can still be resolved.
    return out.sort((a, b) => a.rank - b.rank)
  }

  /** Is there a valid schedule for `days` more days after `history`? Depth-first with a node budget. */
  private feasible(start: string, days: number, history: DayPick[], budget: { left: number }): boolean {
    if (days === 0) return true
    if (--budget.left <= 0) return true // out of budget: assume yes rather than stall generation
    const seenTypes = new Set<string>()
    const debuts = this.debutsOn(start)
    for (const c of this.candidates(start, history)) {
      if (debuts.size && !debuts.has(c.type)) continue // a debut day only works if the new type can run
      if (seenTypes.has(c.type)) continue // trying a second skin of the same type rarely changes feasibility
      seenTypes.add(c.type)
      const pick = this.toPick({ date: start, ...c })!
      if (this.feasible(addDays(start, 1), days - 1, [...history, pick], budget)) return true
    }
    return false
  }

  /** Choose (type, skin) for `date`. Throws if no candidate exists at all. */
  planDay(date: string, history: { date: string; type: string; skin: string }[]): { type: string; skin: string } {
    const picks = history.map((h) => this.toPick(h)).filter((p): p is DayPick => !!p && p.date < date)
    picks.sort((a, b) => a.date.localeCompare(b.date))
    const cands = this.candidates(date, picks)
    if (cands.length === 0) throw new Error(`No valid puzzle for ${date}: the library is too small for the rotation rules`)
    for (const c of cands) {
      const pick = this.toPick({ date, ...c })!
      if (this.feasible(addDays(date, 1), LOOKAHEAD, [...picks, pick], { left: SEARCH_BUDGET })) return c
    }
    // Nothing keeps the next two weeks valid. Take the best candidate for today anyway.
    return cands[0]
  }

  /** Difficulty level for a type on a date: mostly the default, sometimes one step either way. */
  levelFor(date: string, type: string): number {
    const m = this.byId.get(type)!
    const { levels, defaultLevel } = m.difficulty
    const r = new Rng(`${this.rules.seedVersion}:level:${date}:${type}`).next()
    const level = r < 0.6 ? defaultLevel : r < 0.8 ? defaultLevel - 1 : defaultLevel + 1
    return Math.max(0, Math.min(levels.length - 1, level))
  }

  /** A complete schedule record for `date`. */
  buildDay(date: string, history: { date: string; type: string; skin: string }[], now = new Date()): ScheduleDay {
    const { type, skin } = this.planDay(date, history)
    const m = this.byId.get(type)!
    const level = this.levelFor(date, type)
    return {
      date,
      type,
      skin,
      level,
      params: { ...m.difficulty.levels[level] },
      seedRef: 'r1',
      feature: m.tier === 'feature',
      debut: m.introducedOn === date,
      hard: !!m.hardDay,
      generated_at: now.toISOString(),
      reviewed: false,
    }
  }

  /** How many days of history planDay needs. */
  get historyDays(): number {
    const typeCooldown = Math.max(this.rules.typeCooldownDays, ...this.manifests.map((m) => m.cooldownDays ?? 0))
    return Math.max(typeCooldown, this.rules.skinCooldownDays, this.rules.familyGapDays) + 1
  }
}
