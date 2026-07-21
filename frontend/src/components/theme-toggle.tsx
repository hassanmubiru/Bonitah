'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Accessible theme toggle (Req 19).
 *
 * - next-themes sets a class on <html>, so switching applies across every page
 *   without a reload and effectively instantly (well within the 1s budget, Req 19.2).
 * - The selection is persisted by next-themes and re-applied on navigation (Req 19.3, 19.4).
 * - Rendered as a shadcn/ui Button so it is keyboard-focusable with a visible
 *   focus ring (Req 19.6) and carries an `aria-label` (Req 19.7).
 *
 * `mounted` gates theme-dependent output until after hydration to avoid a
 * server/client mismatch (the server has no knowledge of the persisted theme).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';
  // Stable label before mount to keep the accessible name discernible at all times.
  const label = mounted ? `Switch to ${nextTheme} theme` : 'Toggle theme';

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setTheme(nextTheme)}
    >
      {isDark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
