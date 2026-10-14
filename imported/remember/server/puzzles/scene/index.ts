import { checkTime, clamp01 } from '../kit.js'
import type { ShapeId } from '../assets.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** Objects in each scene. */
  objects: number[]
  /** Changes in a "what changed" round. */
  changes: number
  /** Objects asked about in a "where was it" round. */
  asks: number
}
export interface Pt { x: number; y: number }
/**
 * A thing in the scene. `s` scales the drawing (farther back is smaller). Older runs also hold colored shapes,
 * which can still be drawn in review.
 */
export interface Obj extends Pt { glyph?: string; s?: number; shape?: ShapeId; color?: string }
export type Kind = 'change' | 'where'
/** `color` is only in older runs; new scenes swap one thing for another instead. */
export type ChangeKind = 'moved' | 'gone' | 'new' | 'swapped' | 'color'
export interface Study { objects: Obj[] }
/**
 * change: the scene again with some changes; tap each one.
 * where: the scene with some objects lifted out; put each back where it was.
 */
export interface Test { kind: Kind; objects: Obj[]; count: number; asks: Obj[] }
/** Per change (or asked object), the spots that count as finding it, and what happened. */
export interface Key { kind: Kind; spots: Pt[][]; what: ChangeKind[] }
/** change: tapped points. where: one point per asked object, in order (null if not placed). */
export type Answer = (Pt | null)[]

export const W = 100
export const H = 75
const HIT_R = 9
const MIN_GAP = 13

/**
 * Where things can be in each setting. Every thing belongs to one area and only ever appears there (ducks on the
 * pond, boats on the sea, clocks on the wall), and each area lines up with the fixed backdrop in EnvironmentArt.
 * `y` is a range of centres; `scale` sizes things in that area (on top of the depth scaling).
 */
export interface Zone { items: string[]; x: [number, number]; y: [number, number]; max: number; scale?: number; avoid?: [number, number, number, number][] }
export const SETTINGS: Record<string, Record<string, Zone>> = {
  park: {
    sky: { items: ['🐦', '🦋', '🪁'], x: [8, 92], y: [6, 11], max: 2, scale: 0.8 },
    trees: { items: ['🌳', '🌲'], x: [8, 92], y: [19, 21], max: 2, scale: 1.45 },
    pond: { items: ['🦆'], x: [70, 84], y: [55, 57], max: 1 },
    lawn: { items: ['🐕', '🐈', '🚲', '🪑', '⛲', '🛝', '🧺', '⚽', '🐿️', '🌷', '🌻', '🍄', '🐌', '🍦'], x: [8, 92], y: [32, 68], max: 11, avoid: [[54, 38, 100, 70]] },
  },
  beach: {
    sky: { items: ['🐦', '🪁'], x: [8, 92], y: [5, 8], max: 1, scale: 0.75 },
    sea: { items: ['🐬', '⛵', '🐟', '🐙', '🦭', '🪸'], x: [8, 92], y: [19, 29], max: 4, scale: 0.85 },
    shore: { items: ['🐚', '🦀', '🩴'], x: [8, 92], y: [38, 40], max: 2, scale: 0.85 },
    sand: { items: ['⛱️', '🪣', '🍉', '🏐', '🧴', '🕶️', '🍹', '🛟', '🦩', '🌴'], x: [8, 92], y: [50, 68], max: 9 },
  },
  room: {
    wall: { items: ['🖼️', '🕰️', '🪞'], x: [10, 90], y: [11, 15], max: 3, scale: 0.9 },
    shelf: { items: ['☕', '📷', '🎧', '📚', '🕯️', '🧩'], x: [26, 74], y: [25, 25], max: 3, scale: 0.75 },
    floor: { items: ['🛋️', '📺', '🪴', '💡', '🧸', '🎸', '🧺', '🎮', '🐈', '🧦', '🪑'], x: [9, 91], y: [46, 67], max: 10 },
  },
}
/** Every thing a setting can hold. */
export const THEMES: Record<string, string[]> = Object.fromEntries(Object.entries(SETTINGS).map(([k, zones]) => [k, Object.values(zones).flatMap((z) => z.items)]))

/** Things farther back (higher up) are drawn smaller. */
const depth = (y: number) => 0.72 + 0.4 * Math.max(0, Math.min(1, (y - 10) / 58))

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

function freeSpot(rng: Rng, zone: Zone, taken: Pt[], gap = MIN_GAP): Pt | null {
  for (let i = 0; i < 300; i++) {
    const p = { x: Math.round(rng.range(zone.x[0], zone.x[1]) * 10) / 10, y: Math.round(rng.range(zone.y[0], zone.y[1]) * 10) / 10 }
    if (zone.avoid?.some(([x0, y0, x1, y1]) => p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1)) continue
    if (taken.every((q) => dist(p, q) >= gap)) return p
  }
  return null
}

const place = (glyph: string, zone: Zone, at: Pt): Obj => ({ ...at, glyph, s: Math.round((zone.scale ?? 1) * depth(at.y) * 100) / 100 })

/** One tap per change: each tap goes to the nearest change it is close to and not already claimed. */
export function matchTaps(spots: Pt[][], taps: Pt[]): { hits: number; wrong: number; found: boolean[] } {
  const found = spots.map(() => false)
  let hits = 0, wrong = 0
  for (const t of taps) {
    let best = -1, bestD = Infinity
    spots.forEach((ss, i) => {
      if (found[i]) return
      const d = Math.min(...ss.map((s) => dist(s, t)))
      if (d <= HIT_R && d < bestD) (best = i), (bestD = d)
    })
    if (best >= 0) (found[best] = true), hits++
    else wrong++
  }
  return { hits, wrong, found }
}

/** Putting an object back: full marks within 6 units, nothing past 22. */
export const placeCredit = (d: number) => clamp01(1 - (d - 6) / 16)

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'scene',
    name: 'Full Scene',
    family: 'SCENE',
    tier: 'feature',
    skins: [
      { id: 'park', name: 'Busy park', tokens: { theme: 'park', top: '#cfe8c4', bottom: '#a9d69a' } },
      { id: 'beach', name: 'Beach day', tokens: { theme: 'beach', top: '#9fd4ec', bottom: '#f0dca6' } },
      { id: 'room', name: 'Messy room', tokens: { theme: 'room', top: '#efe3d0', bottom: '#d6b98f' } },
    ],
    ruleText: 'Take in the whole scene. Then spot what changed, or put things back where they were.',
    explainer: [
      { label: 'Scan', text: 'A scene full of things. Take it all in.' },
      { label: 'Change', text: 'Some rounds, things move, vanish, appear or get swapped for something else. Tap each change.' },
      { label: 'Place', text: 'Other rounds, things are lifted out. Put each one back.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, objects: [9, 10, 11], changes: 2, asks: 2 },
        { trials: 3, objects: [10, 11, 12], changes: 3, asks: 2 },
        { trials: 3, objects: [12, 13, 14], changes: 3, asks: 3 },
      ],
      defaultLevel: 1,
      practice: { trials: 1, objects: [8], changes: 1, asks: 1 },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-12-12',
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const setting = SETTINGS[String(skin.tokens.theme)] ?? SETTINGS.park
    const zoneOf = new Map(Object.values(setting).flatMap((z) => z.items.map((g) => [g, z] as const)))
    return {
      trials: p.objects.slice(0, p.trials).map((n, ti) => {
        const kind: Kind = ti % 2 === 0 ? 'change' : 'where'
        // Things go in a random order, each into its own area, until the scene is full or the areas are.
        const objects: Obj[] = []
        const inZone = new Map<Zone, number>()
        for (const glyph of rng.shuffle([...zoneOf.keys()])) {
          if (objects.length >= n) break
          const zone = zoneOf.get(glyph)!
          if ((inZone.get(zone) ?? 0) >= zone.max) continue
          const at = freeSpot(rng, zone, objects)
          if (!at) continue
          objects.push(place(glyph, zone, at))
          inZone.set(zone, (inZone.get(zone) ?? 0) + 1)
        }
        const studyMs = 5500 + n * 150

        if (kind === 'where') {
          const pick = rng.sample(objects, p.asks)
          return {
            study: { objects },
            test: { kind, objects: objects.filter((o) => !pick.includes(o)), count: pick.length, asks: pick.map((o) => ({ x: 0, y: 0, glyph: o.glyph, s: o.s })) },
            key: { kind, spots: pick.map((o) => [{ x: o.x, y: o.y }]), what: pick.map((): ChangeKind => 'moved') },
            studyMs,
            answerMs: 7000 + p.asks * 3000,
          }
        }

        const after = objects.map((o) => ({ ...o }))
        const spots: Pt[][] = [], what: ChangeKind[] = []
        const used = new Set<number>()
        const unused = (zone: Zone) => zone.items.filter((g) => !after.some((o) => o.glyph === g) && !objects.some((o) => o.glyph === g))
        const clear = (pts: Pt[]) => pts.every((q) => spots.every((ss) => ss.every((s) => dist(s, q) >= 2 * HIT_R)))
        for (let c = 0, guard = 0; c < p.changes && guard < 300; guard++) {
          const k = rng.pick<ChangeKind>(['moved', 'gone', 'new', 'swapped'])
          const i = rng.int(objects.length)
          if (k !== 'new' && used.has(i)) continue
          const zone = zoneOf.get(objects[i].glyph!)!
          if (k === 'moved') {
            const to = freeSpot(rng, zone, [...after, ...spots.flat()], MIN_GAP + 3)
            if (!to || dist(to, objects[i]) < 22 || !clear([objects[i], to])) continue
            after[i] = place(objects[i].glyph!, zone, to)
            spots.push([{ x: objects[i].x, y: objects[i].y }, to])
          } else if (k === 'gone') {
            if (!clear([objects[i]])) continue
            after[i] = { ...after[i], x: -100, y: -100 }
            spots.push([{ x: objects[i].x, y: objects[i].y }])
          } else if (k === 'swapped') {
            const glyph = unused(zone)[0]
            if (!glyph || !clear([objects[i]])) continue
            after[i] = place(glyph, zone, objects[i])
            spots.push([{ x: objects[i].x, y: objects[i].y }])
          } else {
            const options = Object.values(setting).filter((z) => unused(z).length && after.filter((o) => o.x >= 0 && zoneOf.get(o.glyph!) === z).length < z.max)
            if (!options.length) continue
            const z = rng.pick(options)
            const at = freeSpot(rng, z, [...after, ...spots.flat()], MIN_GAP + 3)
            if (!at || !clear([at])) continue
            after.push(place(rng.pick(unused(z)), z, at))
            spots.push([at])
          }
          if (k !== 'new') used.add(i)
          what.push(k)
          c++
        }
        return {
          study: { objects },
          test: { kind, objects: after.filter((o) => o.x >= 0), count: spots.length, asks: [] },
          key: { kind, spots, what },
          studyMs,
          answerMs: 8000 + p.changes * 2500,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    const max = t.test.kind === 'change' ? t.test.count + 2 : t.test.count
    if (!Array.isArray(raw) || raw.length > max) return null
    const out: (Pt | null)[] = []
    for (const p of raw) {
      if (p === null && t.test.kind === 'where') {
        out.push(null)
        continue
      }
      if (!p || typeof p !== 'object') return null
      const { x, y } = p as Pt
      if (typeof x !== 'number' || typeof y !== 'number' || !(x >= 0 && x <= W && y >= 0 && y <= H)) return null
      out.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
    }
    return out
  },

  scoreTrial(t, a) {
    if (!a || a.every((x) => x === null)) return { score: 0, summary: t.key.kind === 'change' ? 'No changes tapped' : 'Nothing put back' }
    if (t.key.kind === 'where') {
      const credits = t.key.spots.map((s, i) => (a[i] ? placeCredit(dist(s[0], a[i])) : 0))
      const close = credits.filter((c) => c >= 0.5).length
      return { score: credits.reduce((x, y) => x + y, 0) / credits.length, summary: `${close} of ${credits.length} put back close` }
    }
    const { hits, wrong } = matchTaps(t.key.spots, a.filter((x): x is Pt => x !== null))
    return { score: clamp01((hits - wrong) / t.key.spots.length), summary: `${hits} of ${t.key.spots.length} changes${wrong ? `, ${wrong} wrong tap${wrong > 1 ? 's' : ''}` : ''}` }
  },

  validate(inst, p) {
    for (const t of inst.trials) {
      if (t.study.objects.length < Math.min(...p.objects) - 1) return { ok: false, reason: 'scene too sparse' }
      if (t.key.kind === 'change' && t.key.spots.length !== p.changes) return { ok: false, reason: 'not enough changes' }
      if (t.key.kind === 'where' && t.test.asks.length !== p.asks) return { ok: false, reason: 'not enough objects to ask about' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => t.key.spots.map((s) => ({ ...s[0] })),
  spam: (t) => {
    if (t.test.kind === 'where') return [t.key.spots.map(() => ({ x: W / 2, y: H / 2 }))]
    // A grid of taps across the scene.
    const n = t.test.count + 2
    return [Array.from({ length: n }, (_, i) => ({ x: ((i + 0.5) / n) * W, y: H / 2 })), Array.from({ length: n }, (_, i) => ({ x: W / 2, y: ((i + 0.5) / n) * H }))]
  },
  simulate(t, rng, skill) {
    const n = t.study.objects.length
    if (t.key.kind === 'where')
      return t.key.spots.map((s) => ({ x: Math.max(0, Math.min(W, s[0].x + rng.normal(0, 3 + (1 - skill) * 14 + (n - 12)))), y: Math.max(0, Math.min(H, s[0].y + rng.normal(0, 3 + (1 - skill) * 10 + (n - 12) * 0.7))) }))
    const p = Math.max(0.2, Math.min(0.95, 0.4 + skill * 0.5 - (n - 12) * 0.03))
    const taps = t.key.spots.filter(() => rng.chance(p)).map((ss) => ({ ...rng.pick(ss) }))
    if (rng.chance(0.4 * (1.1 - skill))) taps.push({ x: rng.range(5, W - 5), y: rng.range(5, H - 5) })
    return taps
  },
}

export default mod
