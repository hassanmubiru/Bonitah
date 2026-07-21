import Link from 'next/link';

import { ThemeToggle } from '@/components/theme-toggle';

/**
 * App-wide header hosting the theme toggle so theme changes are reachable and
 * apply across every page without a reload (Req 19.2). The inner container is
 * width-constrained and horizontally padded to avoid overflow at the smallest
 * supported viewport (320px, Req 19.5).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="rounded-md text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Bonitah Financial Network
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
