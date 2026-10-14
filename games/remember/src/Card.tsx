// Hub preview card for Can You Remember: the game's Memory Path look (cream paper, winding road, shape tokens).
import '@fontsource-variable/bricolage-grotesque/wght.css';
import './card.css';
import type { GameCardProps } from '@cyd/shared';

/** Road and scenery adapted from Can You Remember (web/src/components/MemoryPath.tsx, PathScenery). */
function Path() {
  const road = 'M-60 262C70 292 150 196 250 214S400 290 470 214 560 92 680 104';
  return (
    <svg className="cyr-path" viewBox="0 0 640 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path className="cyr-road" d={road} />
      <path className="cyr-dash" d={road} />
      <g fill="var(--seafoam)">
        <path d="M-20 300q70-150 150 0Z" />
        <path d="m410 260 22-22 22 22-22 22Z" />
      </g>
      <g fill="var(--scenery-plant)">
        <path d="M600 300v-74q-34-6-28 20t28 22q38-38 42-10t-42 36Z" />
      </g>
      <circle cx="122" cy="214" r="20" fill="var(--lavender)" />
      <path d="m252 158 26 44h-52Z" fill="var(--gold)" />
      <rect x="512" y="104" width="34" height="34" rx="8" fill="var(--coral)" transform="rotate(18 529 121)" />
      <path d="M318 132q8-18 16-6t16-6" stroke="var(--lavender)" strokeWidth="7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function RememberCard({ game, puzzle, action, statusLabel, href }: GameCardProps) {
  return (
    <article className="cyr-card">
      <Path />

      <div className="cyr-head">
        <span className="cyr-eyebrow">{puzzle > 0 ? `#${String(puzzle).padStart(3, '0')} · ` : ''}Daily</span>
        <h2 className="cyr-title">
          Can you <span className="cyr-accent">remember</span>
          <span className="cyr-gold">?</span>
        </h2>
        <p className="cyr-tagline">{game.tagline}</p>
      </div>

      <div className="cyr-foot">
        <span className="cyr-status">{statusLabel}</span>
        <a href={href} className="cyr-button" aria-label={`${action}: ${game.name}`}>
          {action} <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}
