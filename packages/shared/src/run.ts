// Anonymous run token: identifies a browser to the game APIs so the server can
// hold today's progress. Kept in both a cookie (sent to /api) and localStorage
// (survives cookie clearing on some browsers); whichever exists wins.

import { readString, writeString } from './storage';

export const RUN_TOKEN_KEY = 'cy:v1:run';
export const RUN_COOKIE = 'cy_run';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // browsers cap cookies at ~400 days

function readCookie(name: string): string | null {
  try {
    const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string): void {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {
    // ignore
  }
}

function newToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Get or create this browser's run token, keeping cookie and storage in sync. */
export function getRunToken(): string {
  const token = readCookie(RUN_COOKIE) ?? readString(RUN_TOKEN_KEY) ?? newToken();
  writeCookie(RUN_COOKIE, token);
  writeString(RUN_TOKEN_KEY, token);
  return token;
}
