import { checkTime, of } from '../kit.js'
import { NAMES, TAG_COLORS } from '../assets.js'
import { Rng } from '../../lib/rng.js'
import type { PuzzleModule } from '../types.js'

export interface Params {
  trials: number
  /** People per sub-trial. */
  people: number[]
}
/** A cartoon avatar, drawn procedurally by web/src/play/Avatar.tsx. */
export interface AvatarSpec {
  skin: number
  hair: number
  hairColor: number
  eyes: number
  mouth: number
  shirt: number
  extra: number
}
export interface Study { people: { avatar: AvatarSpec; tag: string }[] }
/** Avatars in a new order, and the tags shuffled. */
export interface Test { avatars: AvatarSpec[]; tags: string[] }
/** For each avatar in test order, the index of its tag in test.tags. */
export type Key = number[]
/** For each avatar, the chosen tag index or -1. */
export type Answer = number[]

export const AVATAR_RANGES = { skin: 6, hair: 6, hairColor: 6, eyes: 4, mouth: 4, shirt: 8, extra: 5 }

export function avatar(rng: Rng): AvatarSpec {
  const r = AVATAR_RANGES
  return { skin: rng.int(r.skin), hair: rng.int(r.hair), hairColor: rng.int(r.hairColor), eyes: rng.int(r.eyes), mouth: rng.int(r.mouth), shirt: rng.int(r.shirt), extra: rng.int(r.extra) }
}

/** Two avatars must differ in at least three visible features to be told apart. */
export function distinct(a: AvatarSpec, b: AvatarSpec) {
  return (Object.keys(a) as (keyof AvatarSpec)[]).filter((k) => a[k] !== b[k]).length >= 3 && (a.hair !== b.hair || a.hairColor !== b.hairColor || a.shirt !== b.shirt)
}

const mod: PuzzleModule<Params, Study, Test, Key, Answer> = {
  manifest: {
    id: 'nametags',
    name: 'Name Tags',
    family: 'ASSOC',
    tier: 'quick',
    skins: [
      { id: 'party', name: 'Party guests', tokens: { tags: 'names' } },
      { id: 'team', name: 'Team colors', tokens: { tags: 'colors' } },
    ],
    ruleText: 'Meet the guests and their name tags. Then give everyone back the right tag.',
    ruleFor: (_p, skin) =>
      skin.tokens.tags === 'colors' ? 'Meet the players and their team colors. Then give everyone back the right color.' : 'Meet the guests and their name tags. Then give everyone back the right tag.',
    explainer: [
      { label: 'Meet', text: 'Each person wears a tag.' },
      { label: 'Shuffle', text: 'The tags come off and everyone moves.' },
      { label: 'Match', text: 'Tap a tag, then the person it belongs to.' },
    ],
    maxSeconds: 120,
    difficulty: {
      levels: [
        { trials: 3, people: [3, 4, 5] },
        { trials: 3, people: [4, 5, 6] },
        { trials: 3, people: [5, 6, 7] },
      ],
      defaultLevel: 1,
      practice: { trials: 1, people: [3] },
      targetMedian: 65,
    },
    needs: ['drag'],
    enabled: true,
    introducedOn: '2026-10-01',
  },

  generate(seed, p, skin) {
    const rng = new Rng(seed)
    const labels = skin.tokens.tags === 'colors' ? TAG_COLORS.map((c) => c.name) : NAMES
    return {
      trials: p.people.slice(0, p.trials).map((k) => {
        const avatars: AvatarSpec[] = []
        let guard = 0
        while (avatars.length < k && guard++ < 1000) {
          const a = avatar(rng)
          if (avatars.every((b) => distinct(a, b))) avatars.push(a)
        }
        const tags = rng.sample(labels, k)
        const people = avatars.map((avatar, i) => ({ avatar, tag: tags[i] }))
        const shuffledPeople = rng.shuffle(people)
        const shuffledTags = rng.shuffle(tags)
        return {
          study: { people },
          test: { avatars: shuffledPeople.map((x) => x.avatar), tags: shuffledTags },
          key: shuffledPeople.map((x) => shuffledTags.indexOf(x.tag)),
          studyMs: 1500 + k * 1400,
          answerMs: 5000 + k * 2200,
        }
      }),
    }
  },

  parseAnswer(raw, t) {
    const k = t.test.avatars.length
    if (!Array.isArray(raw) || raw.length !== k) return null
    const used = new Set<number>()
    for (const x of raw) {
      if (!Number.isInteger(x) || x < -1 || x >= k) return null
      if (x >= 0) {
        if (used.has(x)) return null
        used.add(x)
      }
    }
    return raw as number[]
  },

  scoreTrial(t, a) {
    if (!a || a.every((x) => x < 0)) return { score: 0, summary: 'No tags given out' }
    const right = t.key.filter((tag, i) => a[i] === tag).length
    return { score: right / t.key.length, summary: of(right, t.key.length, 'right') }
  },

  validate(inst) {
    for (const t of inst.trials) {
      if (t.test.avatars.length !== t.study.people.length) return { ok: false, reason: 'could not draw distinct avatars' }
      if (new Set(t.key).size !== t.key.length) return { ok: false, reason: 'key is not a matching' }
    }
    const late = checkTime(inst.trials, mod.manifest.maxSeconds)
    return late ? { ok: false, reason: late } : { ok: true }
  },

  solve: (t) => [...t.key],
  spam: (t) => [t.key.map((_, i) => i)],
  simulate(t, rng, skill) {
    const p = Math.min(0.97, 0.25 + skill * 0.6 - (t.key.length - 4) * 0.08)
    const out = t.key.map((k) => (rng.chance(p) ? k : -1))
    const free = rng.shuffle(t.key.map((_, i) => i).filter((i) => !out.includes(i)))
    return out.map((x) => (x >= 0 ? x : free.pop() ?? -1))
  },
}

export default mod
