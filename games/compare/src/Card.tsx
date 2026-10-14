// Hub preview card for Can You Compare: the game's ivory fight poster (arena engraving, Newsreader title, corner colors).
import '@fontsource-variable/newsreader/opsz.css';
import './card.css';
import type { CSSProperties } from 'react';
import type { GameCardProps } from '@cyd/shared';

/** The Compare mark from the game (web/src/components/Mark.tsx): two chevrons facing each other in a badge. */
function Mark({ size }: { size: number }) {
  return (
    <svg className="cyc-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle className="cyc-mark-disc" cx="32" cy="32" r="30" />
      <path className="cyc-mark-l" d="M27 20 15 32l12 12" />
      <path className="cyc-mark-r" d="m37 20 12 12-12 12" />
    </svg>
  );
}

export default function CompareCard({ game, puzzle, action, statusLabel, href }: GameCardProps) {
  // The arena engraving ships with the imported game, so the card uses the game's own copy.
  const style = { '--cyc-art': `url(${href}art/vintage-arena.webp)` } as CSSProperties;

  return (
    <article className="cyc-card" style={style}>
      <div className="cyc-arena" aria-hidden="true" />

      <span className="cyc-eyebrow">Tonight&apos;s card{puzzle > 0 ? ` · #${String(puzzle).padStart(3, '0')}` : ''}</span>

      <div className="cyc-head">
        <Mark size={60} />
        <h2 className="cyc-title">
          Can you <em>compare?</em>
        </h2>
        <p className="cyc-tagline">{game.tagline}</p>
      </div>

      <div className="cyc-foot">
        <a href={href} className="cyc-button" aria-label={`${action}: ${game.name}`}>
          {action} <span aria-hidden="true">→</span>
        </a>
        <span className="cyc-status">{statusLabel}</span>
      </div>
    </article>
  );
}
