import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/site-header';

import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bonitah Financial Network',
  description:
    'Financial education, decentralized savings, and community investing on Base Sepolia.',
};

/**
 * Root layout. `suppressHydrationWarning` on <html> is required by next-themes
 * because the theme class is applied on the client before hydration (Req 19).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
