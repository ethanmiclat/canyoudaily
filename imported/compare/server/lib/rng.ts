import crypto from 'node:crypto'

export function randomToken(bytes = 18): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

/**
 * Deterministic seeded RNG used by the schedule generator. Mirrors `SeededRng` in scripts/content_lib.py
 * so the server fallback produces the same day as the Python generator.
 */
export class SeededRng {
  private counter = 0
  constructor(private readonly seed: string) {}

  below(n: number): number {
    const hex = crypto.createHash('sha256').update(`${this.seed}:${this.counter++}`).digest('hex')
    return parseInt(hex.slice(0, 13), 16) % n
  }

  /** In-place Fisher-Yates, same call order as the Python version. */
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = this.below(i + 1)
      ;[xs[i], xs[j]] = [xs[j], xs[i]]
    }
    return xs
  }
}
