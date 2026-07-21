'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * ThemeProvider wraps next-themes to drive class-based theming.
 *
 * Configured for a light default on first visit and session persistence, with
 * the theme applied via a class on <html> so switches take effect without a
 * reload (Req 19). Full theming/persistence behavior is implemented in task 18.2.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
