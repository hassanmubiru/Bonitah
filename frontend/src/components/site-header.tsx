'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import { ThemeToggle } from '@/components/theme-toggle';

/**
 * App-wide sticky header with navigation, wallet connection, and theme toggle.
 * Always visible with blur backdrop on scroll.
 */
export function SiteHeader() {
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <header
        className={`sticky top-0 z-40 w-full border-b transition-all duration-200 ${
          scrolled
            ? 'border-border/60 bg-background/80 backdrop-blur-xl shadow-sm'
            : 'border-transparent bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'
        }`}
        role="banner"
      >
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Bonitah Financial Network - Go to homepage"
            >
              <div className="h-7 w-7 rounded bg-gradient-to-br from-blue-600 to-emerald-500" />
              <span className="hidden sm:inline font-semibold">BFN</span>
            </Link>

            <nav
              className="hidden md:flex items-center gap-1"
              role="navigation"
              aria-label="Main navigation"
            >
              {[
                { href: '/#features', label: 'Features' },
                { href: '/community', label: 'Community' },
                { href: '/ai', label: 'AI Assistant' },
                { href: '/dashboard', label: 'Dashboard' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground rounded-md px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {mounted && (
              <div className="hidden sm:block [&_button]:!rounded-full [&_button]:!text-xs [&_button]:!h-8 [&_button]:!px-3">
                <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
