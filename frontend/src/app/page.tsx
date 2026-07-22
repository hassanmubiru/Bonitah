'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

import { Button } from '@/components/ui/button';

/**
 * Minimal landing page confirming the provider stack is wired end to end:
 * RainbowKit's ConnectButton (Base Sepolia only) and a shadcn/ui Button.
 * The full themed landing hero is implemented in later tasks (21.1).
 *
 * Enhanced with accessibility features:
 * - Main content landmark for screen readers (Req 19.7)
 * - Proper semantic HTML structure
 * - Skip-to-content target
 */
export default function HomePage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-4 py-16 text-center"
      role="main"
    >
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Bonitah Financial Network</h1>
        <p className="text-muted-foreground">
          Financial education, decentralized savings, and community investing on Base Sepolia.
        </p>
      </div>
      <div className="flex flex-col items-center gap-4">
        <ConnectButton />
        <Button variant="outline" aria-label="Get started with Bonitah Financial Network">
          Get started
        </Button>
      </div>
    </main>
  );
}
