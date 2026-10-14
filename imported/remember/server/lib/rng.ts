/**
 * Deterministic seeded RNG for puzzle generation. Pure JS (no node:crypto) so the same code runs on the server,
 * in scripts and in the browser. The same seed string always gives the same sequence.
 */

/** 128-bit string hash (cyrb128), used to seed sfc32. */
function hash128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

export class Rng {
  private a: number
  private b: number
  private c: number
  private d: number

  constructor(seed: string) {
    ;[this.a, this.b, this.c, this.d] = hash128(seed)
    for (let i = 0; i < 12; i++) this.next()
  }

  /** Uniform in [0, 1). sfc32. */
  next(): number {
    let { a, b, c, d } = this
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    this.a = a; this.b = b; this.c = c; this.d = d
    return (t >>> 0) / 4294967296
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n)
  }

  /** Integer in [min, max], inclusive. */
  range(min: number, max: number): number {
    return min + this.int(max - min + 1)
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(xs: readonly T[]): T {
    if (xs.length === 0) throw new Error('pick from empty list')
    return xs[this.int(xs.length)]
  }

  /** Fisher-Yates on a copy. */
  shuffle<T>(xs: readonly T[]): T[] {
    const out = [...xs]
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  /** k distinct items. */
  sample<T>(xs: readonly T[], k: number): T[] {
    if (k > xs.length) throw new Error(`sample ${k} from ${xs.length}`)
    return this.shuffle(xs).slice(0, k)
  }

  /** A child RNG with an independent stream, so adding draws in one place does not shift another. */
  fork(label: string | number): Rng {
    return new Rng(`${this.a}:${this.b}:${this.c}:${this.d}:${label}`)
  }

  /** Normal(mean, sd) via Box-Muller. For calibration bots. */
  normal(mean = 0, sd = 1): number {
    const u = 1 - this.next()
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
}
