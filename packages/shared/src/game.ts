// Game plug-in contract (section 9). The hub renders a card from the manifest
// plus getTodayState, so it never loads a game's UI code to show status.

import type { ComponentType, LazyExoticComponent } from 'react';
import { dayKey, readJSON } from './storage';

export type GameKind = 'luck' | 'skill' | 'crowd' | 'knowledge';
export type GameStatus = 'not_started' | 'in_progress' | 'done';

export type TodayState = {
  status: GameStatus;
  summary: string; // short line for the hub card, e.g. "Round 3 of 5"
  score?: string | number;
};

export type GameManifest = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  accent: string; // design token name, maps to --accent-<accent>
  accentColor?: string; // fallback when the hub has no token for the accent
  launchDate: string; // puzzle #1
  kind: GameKind;
  /** In-hub game: a lazy route component. */
  component?: LazyExoticComponent<ComponentType>;
  /** Imported game: its own page on the same origin (full page load). */
  href?: string;
  api: string;
  getTodayState: (dateKey: string) => TodayState;
  buildShareText: (state: TodayState) => string[];
  getTeaser?: (dateKey: string) => string | null;
};

/**
 * Props for a game's own preview card on the hub, so the card can look like the game.
 * The hub works out the state and wording; the card only draws it. It must render a link to `href`.
 */
export type GameCardProps = {
  game: GameManifest;
  state: TodayState | null;
  puzzle: number; // 0 or less before launch
  action: string; // "Play", "Resume", "View result"
  statusLabel: string; // "Not started", "Done · 5 of 9"
  href: string;
};

/** A game pulled in from its own project by `npm run games:import` (apps/web/src/games.generated.ts). */
export type ImportedGame = {
  id: string;
  name: string;
  tagline: string;
  kind: GameKind;
  accentColor: string;
  launchDate: string;
  href: string;
};

/** Shape every game stores under `cy:v1:<game>:<date>`; games add their own fields. */
export type StoredDayState = {
  status?: 'in_progress' | 'done';
  score?: string | number;
  finishedAt?: string;
};

/** Default getTodayState: reads the game's own day key. Games may override for richer summaries. */
export function readTodayState(gameId: string, date: string): TodayState {
  const s = readJSON<StoredDayState>(dayKey(gameId, date));
  if (s?.status === 'done') return { status: 'done', summary: 'Done', score: s.score };
  if (s?.status === 'in_progress') return { status: 'in_progress', summary: 'In progress' };
  return { status: 'not_started', summary: 'Not started' };
}
