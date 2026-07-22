import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/site-header';

import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bonitah Financial Network',
  description:
    'Financial education, decentralized savings, and community investing on Base Sepolia.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

/**
 * Root layout with enhanced theming and accessibility support.
 *
 * - `suppressHydrationWarning` on <html> is required by next-themes
 *   because the theme class is applied on the client before hydration (Req 19).
 * - Enhanced with proper viewport settings for responsive design (Req 19.5)
 * - Accessibility improvements with proper language and theme handling
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <div className="flex-1">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
