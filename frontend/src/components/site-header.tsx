'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';

/**
 * App-wide header hosting the theme toggle so theme changes are reachable and
 * apply across every page without a reload (Req 19.2). The inner container is
 * width-constrained and horizontally padded to avoid overflow at the smallest
 * supported viewport (320px, Req 19.5).
 *
 * Enhanced accessibility features:
 * - Skip to main content link for screen readers (Req 19.7)
 * - Proper landmark roles and ARIA labels (Req 19.7)
 * - Keyboard-accessible navigation (Req 19.6)
 */
export function SiteHeader() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only showing navigation after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <header
        className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        role="banner"
      >
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Bonitah Financial Network - Go to homepage"
            >
              <img src="/logo.png" alt="BFN Logo" width={32} height={32} className="rounded-md" />
              <span className="hidden sm:inline">BFN</span>
            </Link>

            {/* Navigation links - only show when authenticated and mounted */}
            {mounted && isConnected && (
              <nav
                className="hidden sm:flex items-center gap-4"
                role="navigation"
                aria-label="Main navigation"
              >
                <Link
                  href="/dashboard"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm px-2 py-1"
                >
                  Dashboard
                </Link>
                <Link
                  href="/savings"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm px-2 py-1"
                >
                  Savings
                </Link>
                <Link
                  href="/community"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm px-2 py-1"
                >
                  Community
                </Link>
                <Link
                  href="/ai"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm px-2 py-1"
                >
                  AI Assistant
                </Link>
                <Link
                  href="/profile"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm px-2 py-1"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm px-2 py-1"
                >
                  Settings
                </Link>
              </nav>
            )}
          </div>

          <nav role="navigation" aria-label="Theme settings">
            <ThemeToggle />
          </nav>
        </div>
      </header>
    </>
  );
}
