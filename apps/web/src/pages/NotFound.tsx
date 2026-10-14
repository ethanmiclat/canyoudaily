import { Link } from 'react-router';

export function NotFound() {
  return (
    <section className="py-12">
      <h1 className="text-[48px] leading-[1.05] font-extrabold tracking-[-0.03em]">Page not found</h1>
      <p className="mt-2 text-text-muted">This page doesn&apos;t exist. Today&apos;s games are still waiting for you.</p>
      <Link to="/" className="btn mt-6">
        Back to today&apos;s games
      </Link>
    </section>
  );
}
