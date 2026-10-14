// Server helpers for game APIs (Vercel functions). Runtime-agnostic: uses Web Crypto,
// so it works in Node 18+ and edge runtimes.

export { dateKey, puzzleNumber, secondsToReset } from '../clock';

// ---- Errors --------------------------------------------------------------

export type ApiErrorCode = 'bad_request' | 'not_found' | 'rate_limited' | 'already_played' | 'server_error';

export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  rate_limited: 429,
  already_played: 409,
  server_error: 500,
};

export function errorResponse(code: ApiErrorCode, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status: STATUS[code] });
}

// ---- Daily secrets -------------------------------------------------------

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Per-game, per-day secret derived from a master secret. Use it to seed outcomes
 * or sign answers so nothing is guessable from the client before lock-in.
 */
export function dailySecret(masterSecret: string, gameId: string, date: string): Promise<string> {
  return hmacHex(masterSecret, `${gameId}:${date}`);
}

/** Sign a payload for a run so the server can verify it later without storing it. */
export function signPayload(secret: string, payload: string): Promise<string> {
  return hmacHex(secret, payload);
}

export async function verifyPayload(secret: string, payload: string, signature: string): Promise<boolean> {
  const expected = await hmacHex(secret, payload);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// ---- Key-value store -----------------------------------------------------
// Backend (Upstash Redis or Supabase) is not chosen yet; games code against this
// interface. Keys are prefixed per game, e.g. `survive:run:<date>:<token>`.

export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  incr(key: string, ttlSeconds: number): Promise<number>;
}

/** In-memory store for local dev and tests. Not shared across serverless instances. */
export function memoryStore(): KVStore {
  const data = new Map<string, { value: unknown; expires: number }>();
  const live = (key: string) => {
    const e = data.get(key);
    if (e && e.expires && e.expires < Date.now()) {
      data.delete(key);
      return undefined;
    }
    return e;
  };
  return {
    async get<T>(key: string) {
      return (live(key)?.value as T) ?? null;
    },
    async set(key, value, ttlSeconds) {
      data.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
    },
    async incr(key, ttlSeconds) {
      const e = live(key);
      const next = ((e?.value as number) ?? 0) + 1;
      data.set(key, { value: next, expires: e?.expires || Date.now() + ttlSeconds * 1000 });
      return next;
    },
  };
}

// ---- Rate limiting -------------------------------------------------------

/** Fixed-window limiter. Returns true if the request is allowed. */
export async function rateLimit(
  store: KVStore,
  bucket: string, // e.g. `ip:1.2.3.4` or `run:<token>`
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const count = await store.incr(`rl:${bucket}:${window}`, windowSeconds);
  return count <= limit;
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

// ---- Runs ----------------------------------------------------------------

export const RUN_COOKIE = 'cy_run';

export function runTokenFrom(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${RUN_COOKIE}=`));
  const token = match ? decodeURIComponent(match.slice(RUN_COOKIE.length + 1)) : req.headers.get('x-run-token');
  return token && /^[A-Za-z0-9-]{8,64}$/.test(token) ? token : null;
}

export type Run<P> = {
  token: string;
  date: string;
  status: 'in_progress' | 'done';
  progress: P;
  startedAt: string;
  finishedAt?: string;
};

/**
 * Start or resume today's run for a token. One run per game per day: a finished
 * run is returned as-is so the client shows the result instead of replaying.
 */
export async function startOrResumeRun<P>(
  store: KVStore,
  gameId: string,
  token: string,
  date: string,
  initial: () => P,
): Promise<Run<P>> {
  const key = `${gameId}:run:${date}:${token}`;
  const existing = await store.get<Run<P>>(key);
  if (existing) return existing;
  const run: Run<P> = { token, date, status: 'in_progress', progress: initial(), startedAt: new Date().toISOString() };
  await store.set(key, run, 60 * 60 * 48);
  return run;
}

export async function saveRun<P>(store: KVStore, gameId: string, run: Run<P>): Promise<void> {
  await store.set(`${gameId}:run:${run.date}:${run.token}`, run, 60 * 60 * 48);
}
