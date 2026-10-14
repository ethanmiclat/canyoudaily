import { BANDS, effective, type Band, type Config, type Pool, type PoolMetric, type PoolPair, type ScheduleDay, type SchedulePair } from './content.js'
import { daysBetween, puzzleNumber } from './dates.js'
import { SeededRng } from './rng.js'

/**
 * Line-for-line port of `assemble_day` in scripts/content_lib.py, used when a day has no schedule file.
 * Same seed, same RNG call order, same iteration order, so it produces the same day as the Python generator.
 * tests/scheduler.test.ts runs both and compares.
 */

export class GenerateError extends Error {}

export interface HistoryDay {
  date: string
  pairs: Pick<SchedulePair, 'id' | 'a' | 'b' | 'metric'>[]
}

type Groups = Record<Band, Record<string, Record<string, PoolPair[]>>>

export function cooldownLevels(config: Config): [number, number][] {
  const item = config.itemCooldownDays
  const pair = config.pairCooldownDays
  return [[item, pair], [14, pair], [7, pair], [0, pair], [0, 0]]
}

const sorted = (xs: Iterable<string>) => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

export function assembleDay(day: string, pool: Pool, config: Config, history: HistoryDay[], allowUnverified = false): ScheduleDay {
  const rng = new SeededRng(`${config.generatorSeed}:${day}`)
  const mix: Band[] = []
  for (const band of BANDS) for (let i = 0; i < config.bandMix[band]; i++) mix.push(band)
  const levels = cooldownLevels(config)
  const families = new Map(Object.entries(pool.metrics).map(([mid, m]) => [mid, metricKeys(mid, m)]))
  // Families and subjects asked in the last familyCooldownDays days sit out today, so no type of question repeats on
  // back-to-back days. Only if no day can be built that way (every item cooldown level tried) is the rule dropped.
  const famCd = config.familyCooldownDays ?? 0
  const recentFamilies = new Set<string>()
  for (const h of history) {
    const age = daysBetween(h.date, day)
    if (age >= 1 && age <= famCd) for (const p of h.pairs) for (const k of families.get(p.metric) ?? [p.metric]) recentFamilies.add(k)
  }
  for (const strict of recentFamilies.size ? [true, false] : [false]) {
    for (let relaxed = 0; relaxed < levels.length; relaxed++) {
      const [itemCd, pairCd] = levels[relaxed]
      const blockedItems = new Set<string>()
      const blockedPairs = new Set<string>()
      for (const h of history) {
        const age = daysBetween(h.date, day)
        if (age < 1) continue
        for (const p of h.pairs) {
          if (age < itemCd) {
            blockedItems.add(p.a)
            blockedItems.add(p.b)
          }
          if (age < pairCd) blockedPairs.add(p.id)
        }
      }
      const groups = { easy: {}, medium: {}, hard: {} } as Groups
      for (const p of pool.pairs) {
        const [mid, a, b, , bandIdx] = p
        const vals = pool.values[mid]
        if (!allowUnverified && !(vals[a].ok && vals[b].ok)) continue
        if (strict && families.get(mid)!.some((k) => recentFamilies.has(k))) continue
        if (blockedItems.has(a) || blockedItems.has(b) || blockedPairs.has(`${mid}:${a}:${b}`)) continue
        const cat = pool.metrics[mid].category
        const byCat = (groups[BANDS[bandIdx]][cat] ??= {})
        ;(byCat[mid] ??= []).push(p)
      }
      for (let attempt = 0; attempt < 40; attempt++) {
        const picked = tryAssemble(rng, groups, mix, config, families)
        if (picked) {
          const out = finishDay(day, picked, pool, config, rng, relaxed)
          if (recentFamilies.size && !strict) out.familyRepeat = true
          return out
        }
      }
    }
  }
  throw new GenerateError(`could not fill ${day}: not enough eligible pairs`)
}

/** What a metric uses up for the day: its question family (or itself) and its subject, e.g. ["height", "s:coaster"]. */
export function metricKeys(mid: string, m: PoolMetric): string[] {
  const keys = [m.family ?? mid]
  return m.subject ? [...keys, `s:${m.subject}`] : keys
}

/** `families` maps metric id to its keys (family and subject, see metricKeys); a day uses each key once. */
function tryAssemble(rng: SeededRng, groups: Groups, mix: Band[], config: Config, families = new Map<string, string[]>()): PoolPair[] | null {
  const slots = rng.shuffle([...mix])
  const chosen: PoolPair[] = []
  const usedItems = new Set<string>()
  const usedMetrics = new Set<string>()
  const catCount = new Map<string, number>()
  for (let k = 0; k < slots.length; k++) {
    const band = slots[k]
    const remaining = slots.length - k
    const needNew = config.minCategories - catCount.size >= remaining
    const cats = sorted(Object.keys(groups[band])).filter(
      (c) => (catCount.get(c) ?? 0) < config.maxPerCategory && !(needNew && catCount.has(c)),
    )
    let pick: PoolPair | null = null
    let pickCat: string | null = null
    while (cats.length && pick === null) {
      const cat = cats.splice(rng.below(cats.length), 1)[0]
      pickCat = cat
      // One metric per family a day, so no question type repeats (state and city census count as one).
      const mids = sorted(Object.keys(groups[band][cat])).filter((m) => !(families.get(m) ?? [m]).some((k) => usedMetrics.has(k)))
      while (mids.length && pick === null) {
        const mid = mids.splice(rng.below(mids.length), 1)[0]
        const options = groups[band][cat][mid].filter((p) => !usedItems.has(p[1]) && !usedItems.has(p[2]))
        if (options.length) pick = options[rng.below(options.length)]
      }
    }
    if (pick === null || pickCat === null) return null
    chosen.push(pick)
    usedItems.add(pick[1])
    usedItems.add(pick[2])
    for (const k of families.get(pick[0]) ?? [pick[0]]) usedMetrics.add(k)
    catCount.set(pickCat, (catCount.get(pickCat) ?? 0) + 1)
  }
  return chosen
}

export function finishDay(day: string, picked: PoolPair[], pool: Pool, config: Config, rng: SeededRng, relaxed: number): ScheduleDay {
  const pairs: SchedulePair[] = picked.map(([mid, a, b, gap, bandIdx]) => {
    const metric = pool.metrics[mid]
    const low = metric.question_low !== undefined && rng.below(1000) < Math.round(config.lowQuestionShare * 1000)
    const flip = rng.below(2) === 1
    const [left, right] = flip ? [b, a] : [a, b]
    const vals = pool.values[mid]
    const ask = low ? 'low' : 'high'
    const el = effective(metric, vals[left].v)
    const er = effective(metric, vals[right].v)
    const answer: 'a' | 'b' = ask === 'high' ? (el > er ? 'a' : 'b') : el < er ? 'a' : 'b'
    const [correctId, otherId] = answer === 'a' ? [left, right] : [right, left]
    const id = `${mid}:${a}:${b}`
    const fact = pool.facts[id] || vals[correctId].fact || vals[otherId].fact || metric.fact_default || ''
    return {
      id,
      metric: mid,
      category: metric.category,
      band: BANDS[bandIdx],
      gap,
      ask,
      question: low ? metric.question_low! : metric.question,
      a: left,
      b: right,
      va: vals[left].v,
      vb: vals[right].v,
      answer,
      fact,
    }
  })
  const out: ScheduleDay = {
    date: day,
    puzzle: puzzleNumber(day, config.launchDate),
    contentHash: pool.contentHash,
    reviewed: false,
    pairs,
  }
  if (relaxed) out.relaxed = relaxed
  return out
}
