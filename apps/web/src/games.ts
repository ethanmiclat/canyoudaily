// Game registry. Games are imported from their own projects with `npm run games:import`
// (see docs/GAME_CONTRACT.md); this file only adds hub-side extras such as custom preview cards.
import type { ComponentType } from 'react';
import { readTodayState, type GameCardProps, type GameManifest } from '@cyd/shared';
import CompareCard from '@cyd/compare/card';
import RememberCard from '@cyd/remember/card';
import SurviveCard from '@cyd/survive/card';
import { importedGames } from './games.generated';

/** Games with their own preview card. Others get the neutral placeholder card until theirs is designed. */
export const cards: Record<string, ComponentType<GameCardProps>> = {
  survive: SurviveCard,
  remember: RememberCard,
  compare: CompareCard,
};

export const games: GameManifest[] = importedGames.map((g) => ({
  ...g,
  slug: g.id,
  accent: g.id,
  api: `/api/${g.id}`,
  getTodayState: (date) => readTodayState(g.id, date, g.resets?.[date]),
  buildShareText: () => [],
}));


export function findGame(slug: string): GameManifest | undefined {
  return games.find((g) => g.slug === slug);
}
