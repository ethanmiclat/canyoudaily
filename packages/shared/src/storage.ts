// Safe localStorage wrapper. Never throws: private windows, blocked storage and
// quota errors all degrade to "nothing stored".

export const STORAGE_VERSION = 'v1';
const PREFIX = `cy:${STORAGE_VERSION}`;

export const META_KEY = `${PREFIX}:meta`;

/** Per-day state key for a game, e.g. `cy:v1:survive:2026-10-12`. */
export function dayKey(gameId: string, date: string): string {
  return `${PREFIX}:${gameId}:${date}`;
}

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readString(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    // ignore
  }
}

/** Series data shared across games (section 7 of the hub plan). */
export type Meta = {
  streak: number;
  bestStreak: number;
  lastPlayedDate: string | null;
  gameStreaks: Record<string, { streak: number; bestStreak: number; lastPlayedDate: string | null }>;
};

export const EMPTY_META: Meta = { streak: 0, bestStreak: 0, lastPlayedDate: null, gameStreaks: {} };

export function readMeta(): Meta {
  return { ...EMPTY_META, ...readJSON<Partial<Meta>>(META_KEY) };
}

export function writeMeta(meta: Meta): boolean {
  return writeJSON(META_KEY, meta);
}
