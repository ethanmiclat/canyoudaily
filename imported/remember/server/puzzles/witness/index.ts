import { checkTime } from '../kit.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** People and animals passing through per scene. */
  events: number[]
  /** Questions per scene. */
  questions: number
  /** Gap between arrivals. */
  gapMs: number
}
export type Side = 'left' | 'right'
/** Someone walks in from a side, stops at a place, then leaves by a side (or stays). */
export interface Event {
  actor: string
  held: string
  from: Side
  place: number
  exit: Side | 'stay'
  enterAt: number
}
export interface Study { places: string[]; events: Event[]; walkMs: number; stayMs: number; durationMs: number }
export interface Question { text: string; options: string[] }
export interface Test { questions: Question[] }
/** The right option per question. */
export type Key = number[]
/** The chosen option per question, or -1. */
export type Answer = number[]

const WALK_MS = 1300
const STAY_MS = 1500
const LEAD_MS = 600

export const STREETS: Record<string, { places: string[]; placeNames: string[]; actors: string[]; held: string[] }> = {
  town: { places: ['🏪', '🏦', '🏫', '🏤', '⛲'], placeNames: ['the shop', 'the bank', 'the school', 'the post office', 'the fountain'], actors: ['🧑‍🦰', '🧓', '👩‍🦱', '🧑‍🍳', '👮', '🧒', '🐕', '🐈'], held: ['🎈', '☂️', '🍦', '🎁', '📦', '🥖', '💐', '📚'] },
  farm: { places: ['🏡', '🛖', '🌳', '🌾', '🚜'], placeNames: ['the house', 'the hut', 'the tree', 'the field', 'the tractor'], actors: ['🧑‍🌾', '🐄', '🐖', '🐑', '🐓', '🐕', '🐴', '🦆'], held: ['🥕', '🪣', '🌽', '🥚', '🍎', '🌻', '🧺', '🪵'] },
  park: { places: ['🎠', '⛲', '🌳', '🛝', '🍦'], placeNames: ['the carousel', 'the fountain', 'the big tree', 'the slide', 'the ice cream stand'], actors: ['🧒', '👧', '🧓', '🐕', '🐿️', '🦆', '🧑‍🦯', '🛴'], held: ['🎈', '🪁', '⚽', '🍦', '📷', '🧸', '🥏', '🍿'] },
}

export function actorPos(e: Event, t: number, walkMs: number, stayMs: number): { x: number; on: boolean } {
  const target = 12.5 + 25 * e.place
  const start = e.from === 'left' ? -8 : 108
  const local = t - e.enterAt
  if (local < 0) return { x: start, on: false }
  if (local < walkMs) return { x: start + (target - start) * (local / walkMs), on: true }
  if (e.exit === 'stay' || local < walkMs + stayMs) return { x: target, on: true }
  const out = e.exit === 'left' ? -8 : 108
  const p = (local - walkMs - stayMs) / walkMs
  return p >= 1 ? { x: out, on: false } : { x: target + (out - target) * p, on: true }
}

type Kind = 'first' | 'last' | 'place' | 'held' | 'exit' | 'absent'

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'witness',
    name: 'Witness',
    family: 'SCENE',
    tier: 'medium',
    skins: [
      { id: 'town', name: 'Main street', tokens: { street: 'town', sky: '#cfe3f5', road: '#b9b2a6' } },
      { id: 'farm', name: 'Farmyard', tokens: { street: 'farm', sky: '#f6e7c1', road: '#b8d68c' } },
      { id: 'park', name: 'City park', tokens: { street: 'park', sky: '#d9f0dc', road: '#d8c9a8' } },
    ],
    ruleText: 'Watch the street for a few seconds. Then answer questions about what you saw.',
    explainer: [
      { label: 'Watch', text: 'People come and go, stop places, carry things.' },
      { label: 'Ask', text: 'Three questions about the scene.' },
      { label: 'Answer', text: 'Tap an answer for each, then Done.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, events: [4, 4, 5], questions: 3, gapMs: 1700 },
        { trials: 3, events: [4, 5, 6], questions: 3, gapMs: 1550 },
        { trials: 3, events: [5, 6, 6], questions: 3, gapMs: 1400 },
      ],
      defaultLevel: 1,
      practice: { trials: 1, events: [3], questions: 2, gapMs: 1800 },
      targetMedian: 65,
    },
    needs: [],
    enabled: true,
    introducedOn: '2026-11-04',
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const street = STREETS[String(skin.tokens.street)] ?? STREETS.town
    return {
      trials: p.events.slice(0, p.trials).map((k) => {
        const places = street.places.slice(0, 4)
        const cast = rng.sample(street.actors, k + 1)
        const absent = cast.pop()!
        const held = rng.sample(street.held, k)
        const events: Event[] = cast.map((actor, i) => ({
          actor,
          held: held[i],
          from: rng.chance(0.5) ? 'left' : 'right',
          place: rng.int(4),
          exit: rng.pick<Side | 'stay'>(['left', 'right', 'stay']),
          enterAt: LEAD_MS + i * p.gapMs + rng.range(-200, 200),
        }))
        // Two people never share a stop at the same time.
        for (let i = 1; i < events.length; i++) {
          const busy = new Set(events.slice(0, i).filter((e) => e.exit === 'stay' || e.enterAt + WALK_MS * 2 + STAY_MS > events[i].enterAt).map((e) => e.place))
          if (busy.has(events[i].place)) events[i].place = [0, 1, 2, 3].find((x) => !busy.has(x)) ?? events[i].place
        }
        const end = Math.max(...events.map((e) => e.enterAt + WALK_MS * 2 + STAY_MS))

        const kinds = rng.sample<Kind>(['first', 'last', 'place', 'held', 'exit', 'absent'], p.questions)
        const asked = rng.shuffle(events)
        const questions: Question[] = []
        const key: number[] = []
        const ask = (text: string, right: string, wrong: string[]) => {
          const others = wrong.filter((w) => w !== right)
          const options = rng.shuffle([right, ...rng.sample(others, Math.min(3, others.length))])
          questions.push({ text, options })
          key.push(options.indexOf(right))
        }
        kinds.forEach((kind, qi) => {
          const e = asked[qi % asked.length]
          if (kind === 'first') ask('Who came along first?', events[0].actor, rng.sample(cast.slice(1), Math.min(3, cast.length - 1)))
          else if (kind === 'last') ask('Who came along last?', events[events.length - 1].actor, rng.sample(cast.slice(0, -1), Math.min(3, cast.length - 1)))
          else if (kind === 'place') ask(`Where did ${e.actor} stop?`, places[e.place], places)
          else if (kind === 'held') ask(`What was ${e.actor} carrying?`, e.held, street.held)
          else if (kind === 'exit') ask(`Where did ${e.actor} go at the end?`, e.exit === 'stay' ? 'Stayed put' : e.exit === 'left' ? '← Left' : 'Right →', ['← Left', 'Right →', 'Stayed put'])
          else ask('Who was NOT there?', absent, rng.sample(cast, 3))
        })
        return {
          study: { places, events, walkMs: WALK_MS, stayMs: STAY_MS, durationMs: end },
          test: { questions },
          key,
          studyMs: end + 400,
          answerMs: 4000 + p.questions * 3800,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    const qs = t.test.questions
    if (!Array.isArray(raw) || raw.length !== qs.length) return null
    return raw.every((x, i) => Number.isInteger(x) && x >= -1 && x < qs[i].options.length) ? (raw as number[]) : null
  },

  scoreTrial(t, a) {
    if (!a || a.every((x) => x < 0)) return { score: 0, summary: 'No answers' }
    const right = t.key.filter((k, i) => a[i] === k).length
    return { score: right / t.key.length, summary: `${right} of ${t.key.length} answers right` }
  },

  validate(inst) {
    for (const t of inst.trials) {
      for (const q of t.test.questions) if (new Set(q.options).size !== q.options.length || q.options.length < 3) return { ok: false, reason: 'question options repeat' }
      const places = t.study.events.map((e) => e.place)
      // Same stop for everyone makes "where did they stop" too easy to guess.
      if (new Set(places).size < 2) return { ok: false, reason: 'everyone stopped in one place' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [0, 1, 2].map((o) => t.test.questions.map(() => o)),
  simulate(t, rng, skill) {
    const k = t.study.events.length
    const p = Math.max(0.2, Math.min(0.95, 0.33 + skill * 0.5 - (k - 4) * 0.07))
    return t.key.map((x, i) => (rng.chance(p) ? x : rng.int(t.test.questions[i].options.length)))
  },
}

export default mod
