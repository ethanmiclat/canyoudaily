import { Suspense } from 'react';
import { Link, Route, Routes, useParams } from 'react-router';
import { Shell } from '@cyd/shared/ui';
import { findGame, games } from './games';
import { Hub } from './pages/Hub';
import { About } from './pages/About';
import { NotFound } from './pages/NotFound';
import { ErrorBoundary } from './ErrorBoundary';

function GameRoute() {
  const { slug = '' } = useParams();
  const game = findGame(slug);
  // Imported games are served as their own pages, so the hub only routes in-hub games.
  if (!game?.component) return <NotFound />;
  const Component = game.component;
  return (
    <ErrorBoundary fallback={<p className="py-10 text-text-muted">{game.name} didn&apos;t load. Try refreshing the page.</p>}>
      <Suspense fallback={<p className="animate-pulse py-10 text-text-muted">Loading {game.name}…</p>}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <Shell Link={Link}>
      <Routes>
        <Route path="/" element={<Hub games={games} />} />
        <Route path="/about" element={<About />} />
        <Route path="/:slug" element={<GameRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}
