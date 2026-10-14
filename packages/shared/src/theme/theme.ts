import { readString, writeString, removeKey } from '../storage';

export type ThemeChoice = 'light' | 'dark' | 'system';
const THEME_KEY = 'cy:v1:theme';

export function getThemeChoice(): ThemeChoice {
  const v = readString(THEME_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function resolvedTheme(choice: ThemeChoice = getThemeChoice()): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Apply a choice to <html data-theme>. "system" removes the attribute so CSS follows the OS. */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === 'system') {
    removeKey(THEME_KEY);
    document.documentElement.removeAttribute('data-theme');
  } else {
    writeString(THEME_KEY, choice);
    document.documentElement.setAttribute('data-theme', choice);
  }
}
