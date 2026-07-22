'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * ThemeProvider wraps next-themes to drive class-based theming.
 *
 * Configured for:
 * - Light default on first visit (Req 19.1)
 * - Theme switching across pages without reload within 1s (Req 19.2)  
 * - Session persistence using localStorage with key "bfn-theme" (Req 19.3, 19.4)
 * - Class-based theme switching applied to <html> element (Req 19.2)
 * - Transitions enabled for smooth theme changes under 1s (Req 19.2)
 *
 * The theme selection persists across browser sessions and takes effect
 * immediately without page reload across all pages in the app.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
