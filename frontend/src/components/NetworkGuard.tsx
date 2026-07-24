'use client';

import { useEffect, type ReactNode } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { AlertCircle, Network } from 'lucide-react';

import { BASE_SEPOLIA_CHAIN_ID, NETWORKS } from '@bfn/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface NetworkGuardProps {
  children: ReactNode;
  /** Optional callback when network switch is successful */
  onNetworkSwitched?: () => void;
}

/**
 * Network Guard component that ensures users are connected to Base Sepolia.
 *
 * Implements Requirement 2.3: "IF a Connected_Wallet is on a network other than
 * Base_Sepolia, THEN THE Frontend SHALL prompt the user to switch to Base_Sepolia
 * before allowing on-chain actions."
 *
 * Displays a blocking UI when the user is on the wrong network and provides
 * a one-click switch to Base Sepolia.
 */
export function NetworkGuard({ children, onNetworkSwitched }: NetworkGuardProps) {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  const isOnCorrectNetwork = chainId === BASE_SEPOLIA_CHAIN_ID;
  const networkConfig = NETWORKS[BASE_SEPOLIA_CHAIN_ID];

  // Auto-switch to Base Sepolia when wallet connects on wrong network
  useEffect(() => {
    if (isConnected && chainId && chainId !== BASE_SEPOLIA_CHAIN_ID) {
      // Auto-switch silently on first connection
      switchChain({ chainId: BASE_SEPOLIA_CHAIN_ID });
    }
  }, [isConnected, chainId, switchChain]);

  // Call callback when successfully switched
  useEffect(() => {
    if (isConnected && isOnCorrectNetwork && onNetworkSwitched) {
      onNetworkSwitched();
    }
  }, [isConnected, isOnCorrectNetwork, onNetworkSwitched]);

  // If not connected or on correct network, render children
  if (!isConnected || isOnCorrectNetwork) {
    return <>{children}</>;
  }

  // Handle manual network switch
  const handleSwitchNetwork = () => {
    switchChain({ chainId: BASE_SEPOLIA_CHAIN_ID });
  };

  const getCurrentNetworkName = () => {
    if (!chainId) return 'Unknown Network';

    // Try to get a friendly name for common networks
    const networkNames: Record<number, string> = {
      1: 'Ethereum Mainnet',
      11155111: 'Ethereum Sepolia',
      8453: 'Base Mainnet',
      84531: 'Base Goerli', // Deprecated
      84532: 'Base Sepolia',
    };

    return networkNames[chainId] || `Chain ID ${chainId}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
            <Network className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle>Wrong Network</CardTitle>
          <CardDescription>
            Bonitah Financial Network requires Base Sepolia to function properly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Network Mismatch</AlertTitle>
            <AlertDescription>
              You&apos;re currently connected to{' '}
              <span className="font-medium">{getCurrentNetworkName()}</span>. Please switch to Base
              Sepolia to continue.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Button onClick={handleSwitchNetwork} disabled={isSwitching} className="w-full">
              {isSwitching ? 'Switching...' : `Switch to ${networkConfig.name}`}
            </Button>

            {switchError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to switch networks: {switchError.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="text-center text-sm text-muted-foreground">
              <p>Network Details:</p>
              <p className="font-mono text-xs">
                Chain ID: {BASE_SEPOLIA_CHAIN_ID}
                <br />
                Currency: {networkConfig.nativeCurrency.symbol}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
