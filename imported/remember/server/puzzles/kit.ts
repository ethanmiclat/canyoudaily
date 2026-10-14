/** Shared helpers for puzzle modules: scoring measures, answer parsing, timing. */

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Share of positions that match. Length differences count as misses. */
export function positional<T>(target: readonly T[], answer: readonly T[]): number {
  if (target.length === 0) return 1
  let hits = 0
  for (let i = 0; i < target.length; i++) if (answer[i] === target[i]) hits++
  const extra = Math.max(0, answer.length - target.length)
  return clamp01((hits - extra) / target.length)
}

/** Longest common subsequence length. */
export function lcs<T>(a: readonly T[], b: readonly T[]): number {
  const dp = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    let prev = 0
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[b.length]
}

/** Order similarity that forgives one slip in the middle: LCS over the longer of the two. */
export function orderScore<T>(target: readonly T[], answer: readonly T[]): number {
  const n = Math.max(target.length, answer.length)
  return n === 0 ? 1 : lcs(target, answer) / n
}

/** Set recall with symmetric cost: (hits - wrong picks) / target size. */
export function setScore<T>(target: readonly T[], answer: readonly T[]): { score: number; hits: number; wrong: number } {
  const t = new Set(target)
  const a = new Set(answer)
  let hits = 0, wrong = 0
  for (const x of a) (t.has(x) ? hits++ : wrong++)
  return { score: t.size === 0 ? 1 : clamp01((hits - wrong) / t.size), hits, wrong }
}

/** Normalised Kendall agreement between two orderings of the same items, mapped so a random order scores ~0. */
export function kendall<T>(target: readonly T[], answer: readonly T[]): number {
  const pos = new Map(answer.map((x, i) => [x, i]))
  if (target.length < 2) return 1
  let conc = 0, disc = 0
  for (let i = 0; i < target.length; i++) {
    for (let j = i + 1; j < target.length; j++) {
      const pi = pos.get(target[i]), pj = pos.get(target[j])
      if (pi === undefined || pj === undefined) { disc++; continue }
      if (pi < pj) conc++
      else disc++
    }
  }
  return clamp01((conc - disc) / (conc + disc))
}

// ---------- answer parsing (untrusted input) ----------

export function intArray(raw: unknown, opts: { max: number; maxLen: number; unique?: boolean }): number[] | null {
  if (!Array.isArray(raw) || raw.length > opts.maxLen) return null
  const out: number[] = []
  for (const x of raw) {
    if (!Number.isInteger(x) || (x as number) < 0 || (x as number) >= opts.max) return null
    out.push(x as number)
  }
  if (opts.unique && new Set(out).size !== out.length) return null
  return out
}

export function intIn(raw: unknown, max: number): number | null {
  return Number.isInteger(raw) && (raw as number) >= 0 && (raw as number) < max ? (raw as number) : null
}

export function numIn(raw: unknown, min: number, max: number): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= min && raw <= max ? raw : null
}

export function stringIn<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : null
}

/** "3 of 5" style summaries. */
export const of = (a: number, b: number, noun = '') => `${a} of ${b}${noun ? ` ${noun}` : ''}`

/** Total play time of an instance in ms. */
export function playMs(trials: { studyMs: number; answerMs: number }[]): number {
  return trials.reduce((s, t) => s + t.studyMs + t.answerMs, 0)
}

export function checkTime(trials: { studyMs: number; answerMs: number }[], maxSeconds: number): string | null {
  const ms = playMs(trials)
  return ms > maxSeconds * 1000 ? `play time ${Math.round(ms / 1000)}s over the ${maxSeconds}s cap` : null
}

// ---------- calibration bots ----------

/**
 * A rough human span model for calibration bots. Typical adult spans: about 7 digits forward, 5 backward, 6 for
 * visual sequences (Corsi-style). Items inside the span are almost always right; past it, recall collapses.
 * `skill` 0..1 moves the span about two items either side of `typical`.
 */
export function spanOf(skill: number, typical: number): number {
  return typical - 2 + skill * 4
}

export function spanRecall<T>(key: readonly T[], span: number, rng: { chance(p: number): boolean }, wrong: () => T): T[] {
  return key.map((x, i) => {
    const p = i + 1 <= span ? 0.97 : i < span ? 0.6 : 0.3
    return rng.chance(p) ? x : wrong()
  })
}
