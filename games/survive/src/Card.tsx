// Hub preview card for Can You Survive (hub v2 hand-off): the game's pixel look on the white hub.
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/pixelify-sans/400.css';
import './card.css';
import type { CSSProperties } from 'react';
import type { GameCardProps } from '@cyd/shared';
import { Sprite } from './Sprite';

export default function SurviveCard({ game, puzzle, action, statusLabel, href }: GameCardProps) {
  // The wasteland art ships with the imported game, so the card uses the game's own copy.
  const style = { '--cys-art': `url(${href}art/pixel-wasteland.png)` } as CSSProperties;

  return (
    <article className="cys-card" style={style}>
      <div className="cys-land" aria-hidden="true" />

      <div className="cys-head">
        <div className="cys-top">
          <span className="cys-eyebrow">{puzzle > 0 ? `#${String(puzzle).padStart(3, '0')} · ` : ''}Daily</span>
          <Sprite name="skull" size={30} className="cys-skull" />
        </div>
        <h2 className="cys-title">
          Can you
          <br />
          <span className="cys-blood">survive</span>
          <span className="cys-amber">?</span>
        </h2>
        <p className="cys-tagline">{game.tagline}</p>
      </div>

      <div className="cys-foot">
        <span className="cys-status">{statusLabel}</span>
        <a href={href} className="cys-button" aria-label={`${action}: ${game.name}`}>
          {action} <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}
