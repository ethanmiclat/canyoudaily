import crypto from 'node:crypto'

export function randomToken(bytes = 18): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

const DEV_SECRET = 'cyr-dev-secret-not-for-production'

function secret(): string {
  const s = process.env.CYR_SECRET
  if (s) return s
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new Error('CYR_SECRET is not set. Daily seeds would be predictable.')
  }
  return DEV_SECRET
}

/**
 * Daily seed: HMAC(server secret, version | date | type | seedRef). Schedule files are public in the repo but only
 * name a seedRef, so future puzzles cannot be predicted. Bumping seedRef in a schedule file re-rolls that day.
 */
export function dailySeed(version: string, date: string, type: string, seedRef: string): string {
  return crypto.createHmac('sha256', secret()).update(`${version}|${date}|${type}|${seedRef}`).digest('hex')
}
