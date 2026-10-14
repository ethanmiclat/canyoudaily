// Daily clock. Every game resets at midnight America/Chicago.
// DST is handled by asking Intl for the zone's wall time, never by fixed offsets.

export const TIMEZONE = 'America/Chicago';

const DAY_MS = 86_400_000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

type WallTime = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function wallTime(instant: Date, timeZone: string): WallTime {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Offset of the zone from UTC at an instant, in ms (Chicago is negative). */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const w = wallTime(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseDateKey(key: string): [number, number, number] {
  if (!DATE_KEY_RE.test(key)) throw new Error(`Invalid date key: ${key}`);
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}

/** Today's date key (`YYYY-MM-DD`) in the daily timezone. */
export function dateKey(now: Date = new Date(), timeZone: string = TIMEZONE): string {
  const w = wallTime(now, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** Shift a date key by whole calendar days. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = parseDateKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parseDateKey(from);
  const [y2, m2, d2] = parseDateKey(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

/** The instant the given date key starts (midnight in the daily timezone). */
export function startOfDay(key: string, timeZone: string = TIMEZONE): Date {
  const [y, m, d] = parseDateKey(key);
  const naive = Date.UTC(y, m - 1, d);
  // Guess with the offset at naive midnight, then correct once in case DST changed in between.
  let instant = naive - zoneOffsetMs(new Date(naive), timeZone);
  instant = naive - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** The instant of the next daily reset. */
export function nextReset(now: Date = new Date(), timeZone: string = TIMEZONE): Date {
  return startOfDay(addDays(dateKey(now, timeZone), 1), timeZone);
}

/** Whole seconds until the next daily reset. */
export function secondsToReset(now: Date = new Date(), timeZone: string = TIMEZONE): number {
  return Math.max(0, Math.ceil((nextReset(now, timeZone).getTime() - now.getTime()) / 1000));
}

/** Puzzle number for a game: #1 on its launch date. Returns 0 or less before launch. */
export function puzzleNumber(launchDate: string, key: string): number {
  return daysBetween(launchDate, key) + 1;
}

/** Format seconds as `HH:MM:SS`. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
