import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { dateKey, puzzleNumber, type GameCardProps, type GameManifest, type TodayState } from '@cyd/shared';
import { Countdown } from '@cyd/shared/ui';
import { ErrorBoundary } from '../ErrorBoundary';
import { cards } from '../games';

// Hub v2: today's games as a list, with a large preview card for the selected game.

const ORDER: Record<TodayState['status'], number> = { not_started: 0, in_progress: 1, done: 2 };

const STATUS_LABEL: Record<TodayState['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};

const ACTION: Record<TodayState['status'], string> = {
  not_started: 'Play',
  in_progress: 'Resume',
  done: 'View result',
};

function safeState(game: GameManifest, date: string): TodayState | null {
  try {
    return game.getTodayState(date);
  } catch (err) {
    console.error(`getTodayState failed for ${game.id}`, err);
    return null;
  }
}

function statusLabel(state: TodayState | null): string {
  if (!state) return 'Status unavailable';
  const label = STATUS_LABEL[state.status];
  return state.status === 'done' && state.score != null ? `${label} · ${state.score}` : label;
}

function issue(puzzle: number): string {
  return puzzle > 0 ? `#${String(puzzle).padStart(3, '0')}` : 'New';
}

/** "Can You Survive" -> "Can You Survive?" */
function displayName(name: string): string {
  return name.endsWith('?') ? name : `${name}?`;
}

function todayLabel(): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' }).format(
    new Date(),
  );
}

/** Neutral card for games whose own card design isn't done yet. */
function PlaceholderCard({ game, puzzle, action, statusLabel, href }: GameCardProps) {
  return (
    <article className="flex min-h-[440px] flex-col gap-5 rounded-(--radius) border border-border bg-surface p-8">
      <p className="font-mono text-[13px] font-medium text-text-muted">{issue(puzzle)} · DAILY</p>
      <h2 className="text-[44px] leading-[1.05] font-extrabold tracking-[-0.03em]">{displayName(game.name)}</h2>
      <p className="max-w-[440px] text-[17px] leading-normal text-text-idle">{game.tagline}</p>
      <div
        aria-hidden="true"
        className="min-h-[120px] flex-1 rounded-[10px] bg-[repeating-linear-gradient(135deg,rgb(0_0_0/0.04)_0_6px,transparent_6px_12px)] dark:bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.05)_0_6px,transparent_6px_12px)]"
      />
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px] text-text-muted">{statusLabel}</span>
        <a href={href} className="btn" aria-label={`${action}: ${game.name}`}>
          {action} <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

/** Card for the single "more coming soon" row after today's games. */
function SoonCard() {
  return (
    <article className="flex min-h-[440px] flex-col gap-5 rounded-(--radius) border border-border bg-surface p-8">
      <p className="font-mono text-[13px] font-medium text-text-muted">COMING SOON</p>
      <h2 className="text-[44px] leading-[1.05] font-extrabold tracking-[-0.03em]">More games?</h2>
      <p className="max-w-[440px] text-[17px] leading-normal text-text-idle">New daily games are on the way. Check back soon.</p>
      <div
        aria-hidden="true"
        className="flex min-h-[120px] flex-1 items-center justify-center rounded-[10px] bg-[repeating-linear-gradient(135deg,rgb(0_0_0/0.04)_0_6px,transparent_6px_12px)] font-mono text-xs text-text-muted dark:bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.05)_0_6px,transparent_6px_12px)]"
      >
        Coming soon
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px] text-text-muted">Not out yet</span>
        <span className="btn pointer-events-none opacity-35" aria-hidden="true">
          Play <span>→</span>
        </span>
      </div>
    </article>
  );
}

type Item = { game: GameManifest; state: TodayState | null; puzzle: number };

/** One list row: a playable game, or a coming-soon placeholder. */
type Row = { kind: 'game'; item: Item } | { kind: 'soon' };

function rowName(row: Row): string {
  return row.kind === 'game' ? displayName(row.item.game.name) : 'More games';
}

function cardProps({ game, state, puzzle }: Item): GameCardProps {
  return {
    game,
    state,
    puzzle,
    action: state ? ACTION[state.status] : 'Open',
    statusLabel: statusLabel(state),
    href: game.href ?? `/${game.slug}`,
  };
}

function GamePreview({ item }: { item: Item }) {
  const Card = cards[item.game.id] ?? PlaceholderCard;
  return (
    <ErrorBoundary key={item.game.id} fallback={<PlaceholderCard {...cardProps(item)} />}>
      <Card {...cardProps(item)} />
    </ErrorBoundary>
  );
}

export function Hub({ games }: { games: GameManifest[] }) {
  const date = dateKey();
  const navigate = useNavigate();
  const items: Item[] = useMemo(
    () =>
      games
        .map((game) => ({ game, state: safeState(game, date), puzzle: puzzleNumber(game.launchDate, date) }))
        .sort((a, b) => ORDER[a.state?.status ?? 'not_started'] - ORDER[b.state?.status ?? 'not_started']),
    [games, date],
  );
  const rowsData: Row[] = useMemo(
    () => [...items.map((item): Row => ({ kind: 'game', item })), { kind: 'soon' }],
    [items],
  );
  const [sel, setSel] = useState(0);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedRow = rowsData[Math.min(sel, rowsData.length - 1)];

  const play = (item: Item) => {
    if (item.game.href) window.location.assign(item.game.href);
    else navigate(`/${item.game.slug}`);
  };

  // ↑/↓ move the selection; Enter (a click on the focused, selected row) plays.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = (sel + (e.key === 'ArrowDown' ? 1 : -1) + rowsData.length) % rowsData.length;
    setSel(next);
    rows.current[next]?.focus();
  };


  return (
    <div className="grid items-start gap-12 min-[1000px]:grid-cols-[1fr_2fr]">
      <section aria-labelledby="today-heading" className="flex flex-col gap-7">
        <div className="flex flex-col gap-1">
          <p className="text-[15px] text-text-muted">{todayLabel()}</p>
          <h1 id="today-heading" className="text-[48px] leading-[1.05] font-extrabold tracking-[-0.03em]">
            Today&apos;s games
          </h1>
          <Countdown label="New games in" onReset={() => window.location.reload()} />
        </div>

        <ul className="border-t border-border" onKeyDown={onKeyDown}>
          {rowsData.map((row, i) => {
            const active = i === sel;
            const soon = row.kind === 'soon';
            const id = soon ? 'soon' : row.item.game.id;
            const tag = soon ? 'Soon' : issue(row.item.puzzle);
            const label = soon
              ? 'More games coming soon'
              : `${rowName(row)} ${tag}, ${statusLabel(row.item.state)}${active ? '. Press Enter to play' : ''}`;
            return (
              <li key={id} className="border-b border-border">
                <button
                  ref={(el) => {
                    rows.current[i] = el;
                  }}
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  aria-controls="game-preview"
                  aria-label={label}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setSel(i)}
                  onFocus={() => setSel(i)}
                  // First tap selects (and shows the preview); a click on the selected row plays.
                  onClick={() => (active && row.kind === 'game' ? play(row.item) : setSel(i))}
                  className={`flex w-full cursor-pointer items-center gap-3 px-3 py-3.5 text-left transition-colors ${active ? 'bg-surface' : ''}`}
                >
                  <span className="w-10 shrink-0 font-mono text-[13px] font-medium text-text-soft">{tag}</span>
                  <span className={`text-[20px] font-bold tracking-[-0.01em] ${active ? 'text-text' : 'text-text-idle'}`}>
                    {rowName(row)}
                  </span>
                  <span aria-hidden="true" className="ml-auto text-base font-medium">
                    {active ? '→' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="game-preview" aria-label="Game preview" aria-live="polite" className="min-w-0">
        {selectedRow?.kind === 'soon' && <SoonCard />}
        {selectedRow?.kind === 'game' && <GamePreview item={selectedRow.item} />}
      </section>
    </div>
  );
}
