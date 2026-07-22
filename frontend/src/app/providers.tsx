'use client';

import { RainbowKitProvider, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { ThemeProvider } from '@/components/theme-provider';
import { wagmiConfig } from '@/lib/wagmi';

import '@rainbow-me/rainbowkit/styles.css';

/**
 * RainbowKit theming follows the active app theme so the connect modal matches
 * light/dark without a reload (Req 19). Kept as a child of ThemeProvider so
 * `useTheme` resolves the current selection.
 */
function RainbowKit({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <RainbowKitProvider theme={resolvedTheme === 'dark' ? darkTheme() : lightTheme()}>
      {children}
    </RainbowKitProvider>
  );
}

/**
 * Top-level client providers for the BFN frontend.
 *
 * Order (outer -> inner): Wagmi -> TanStack Query -> Theme -> RainbowKit.
 * - WagmiProvider + RainbowKitProvider are scoped to Base Sepolia only (Req 2.1, 2.3).
 * - A single TanStack QueryClient backs wagmi's async reads and app data fetching.
 * - ThemeProvider applies a light default and persists the selection (Req 19).
 */
export function Providers({ children }: { children: ReactNode }) {
  // Create the QueryClient once per browser session to avoid re-instantiation
  // on re-render (which would drop the cache).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Financial values are read on-chain with an explicit staleness policy;
            // conservative defaults here, per-hook policy is added in task 19.
            staleTime: 30_000,
            retry: 3,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="bfn-theme"
          disableTransitionOnChange={false}
        >
          <RainbowKit>{children}</RainbowKit>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
