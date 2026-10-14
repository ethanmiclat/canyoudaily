import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

type LinkComponent = (props: { to: string; className?: string; children: ReactNode }) => ReactNode;

type Props = {
  children: ReactNode;
  /** Router link component, so the shell stays router-agnostic. */
  Link: LinkComponent;
  feedbackHref?: string;
  reportHref?: string;
};

export function Shell({ children, Link, feedbackHref, reportHref }: Props) {
  const footerLink = 'hover:text-text';
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-(--gutter) pt-10 text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <header className="mx-auto flex w-full max-w-(--max-width) items-center justify-between">
        <Link to="/" className="rounded-md text-[22px] font-extrabold tracking-[-0.02em]">
          Can You Daily<span className="text-text-soft">?</span>
        </Link>
        <ThemeToggle />
      </header>
      <main id="main" className="mx-auto mt-12 w-full max-w-(--max-width) flex-1 pb-16">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-(--max-width) border-t border-border">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 py-6 text-sm text-text-muted">
          <Link to="/about" className={footerLink}>
            About
          </Link>
          {feedbackHref && (
            <a href={feedbackHref} className={footerLink}>
              Feedback
            </a>
          )}
          {reportHref && (
            <a href={reportHref} className={footerLink}>
              Report a problem
            </a>
          )}
        </nav>
      </footer>
    </div>
  );
}
