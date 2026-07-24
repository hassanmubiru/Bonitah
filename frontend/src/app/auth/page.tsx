'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Loader2, Shield, Wallet } from 'lucide-react';

import { useSiweAuth } from '@/hooks/useSiweAuth';
import { NetworkGuard } from '@/components/NetworkGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Authentication page implementing SIWE (Sign-In With Ethereum) flow.
 *
 * Implements Requirements 2.1-2.10:
 * - Wallet connection via RainbowKit (Req 2.1, 2.2)
 * - Network enforcement for Base Sepolia (Req 2.3)
 * - SIWE message generation and signing (Req 2.4, 2.5)
 * - Backend verification and JWT issuance (Req 2.6-2.8)
 * - Session management (Req 2.9, 2.10)
 */
export default function AuthPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { isAuthenticated, isLoading, error, signIn } = useSiweAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isRedirecting) {
      setIsRedirecting(true);
      router.push('/dashboard');
    }
  }, [isAuthenticated, router, isRedirecting]);

  // Handle SIWE sign-in after wallet connection
  const handleSignIn = async () => {
    if (!isConnected) return;
    await signIn();
  };

  // Show loading state during redirect
  if (isAuthenticated && isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <NetworkGuard>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to BFN</CardTitle>
            <CardDescription>
              Connect your wallet and sign in securely to access Bonitah Financial Network
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Wallet Connection Step */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-sm font-medium">
                <div
                  className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}
                />
                <span>Step 1: Connect Your Wallet</span>
              </div>

              <div className="flex justify-center">
                <ConnectButton
                  showBalance={false}
                  chainStatus="icon"
                  accountStatus={{
                    smallScreen: 'avatar',
                    largeScreen: 'full',
                  }}
                />
              </div>

              {isConnected && address && (
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <div className="flex items-center justify-center space-x-2 text-green-700 dark:text-green-300">
                    <Wallet className="h-4 w-4" />
                    <span className="text-sm font-medium">Wallet Connected</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-mono">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </p>
                </div>
              )}
            </div>

            {/* Authentication Step */}
            {isConnected && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-sm font-medium">
                  <div
                    className={`h-2 w-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-gray-300'}`}
                  />
                  <span>Step 2: Sign Authentication Message</span>
                </div>

                <Button
                  onClick={handleSignIn}
                  disabled={isLoading || isAuthenticated}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : isAuthenticated ? (
                    'Authenticated ✓'
                  ) : (
                    'Sign In with Ethereum'
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  You&apos;ll be asked to sign a message to prove you own this wallet. No gas fees
                  required.
                </p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Help Text */}
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="text-center font-medium">Secure Wallet-Based Authentication</p>
              <ul className="space-y-1 pl-4">
                <li>• No passwords or personal information required</li>
                <li>• Your wallet signature proves ownership</li>
                <li>• All financial data comes from the blockchain</li>
                <li>• You maintain full control of your funds</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </NetworkGuard>
  );
}
