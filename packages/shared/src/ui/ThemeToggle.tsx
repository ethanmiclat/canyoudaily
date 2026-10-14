import { useEffect, useState } from 'react';
import { applyTheme, getThemeChoice, resolvedTheme, type ThemeChoice } from '../theme/theme';

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => getThemeChoice());
  const [current, setCurrent] = useState<'light' | 'dark'>(() => resolvedTheme(choice));

  useEffect(() => {
    if (choice !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setCurrent(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [choice]);

  const toggle = () => {
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setChoice(next);
    setCurrent(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${current === 'dark' ? 'light' : 'dark'} theme`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-strong text-text transition-colors hover:bg-surface"
    >
      {current === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 1.5v2.5M12 20v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M1.5 12H4M20 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
          </g>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
