'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

import { useSiweAuth } from '@/hooks/useSiweAuth';

export interface AuthFlowProps {
  onAuthSuccess?: () => void;
  onAuthError?: (error: string) => void;
  redirectPath?: string;
}

/**
 * AuthFlow component handles the complete authentication process
 * 
 * Features:
 * - Wallet connection via RainbowKit
 * - SIWE (Sign-In with Ethereum) authentication
 * - Loading states and error handling
 * - Success callbacks and redirects
 */
export function AuthFlow({ 
  onAuthSuccess, 
  onAuthError, 
  redirectPath = '/dashboard' 
}: AuthFlowProps) {
  const { address, isConnected } = useAccount();
  const { 
    isAuthenticated, 
    isLoading: authLoading, 
    error: authError,
    signIn,
    signOut 
  } = useSiweAuth();

  const [isSigningIn, setIsSigningIn] = useState(false);

  // Handle authentication success
  useEffect(() => {
    if (isAuthenticated && onAuthSuccess) {
      onAuthSuccess();
    }
  }, [isAuthenticated, onAuthSuccess]);

  // Handle authentication errors
  useEffect(() => {
    if (authError && onAuthError) {
      onAuthError(authError);
    }
  }, [authError, onAuthError]);

  const handleSignIn = async () => {
    if (!address) return;
    
    setIsSigningIn(true);
    try {
      await signIn();
    } catch (error) {
      console.error('Sign-in failed:', error);
      if (onAuthError) {
        onAuthError(error instanceof Error ? error.message : 'Sign-in failed');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  };

  // Already authenticated - show success state
  if (isAuthenticated) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="w-12 h-12 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-lg">Authentication Successful</CardTitle>
          <CardDescription>
            You are signed in as {address?.slice(0, 6)}...{address?.slice(-4)}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <Button 
            onClick={() => window.location.href = redirectPath} 
            className="w-full"
          >
            Continue to Dashboard
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSignOut}
            className="w-full"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="w-12 h-12 mx-auto mb-2 bg-primary/10 rounded-full flex items-center justify-center">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-lg">Connect Your Wallet</CardTitle>
        <CardDescription>
          Sign in securely with your Ethereum wallet to access BFN
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Step 1: Connect Wallet */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              isConnected 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {isConnected ? <CheckCircle2 className="h-3 w-3" /> : '1'}
            </div>
            Connect Wallet
          </div>
          
          <div className="pl-8">
            <ConnectButton />
          </div>
          
          {isConnected && (
            <div className="pl-8 text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Wallet connected: {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          )}
        </div>

        {/* Step 2: Sign Message */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              isAuthenticated 
                ? 'bg-green-100 text-green-700' 
                : isConnected 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700'
            }`}>
              {isAuthenticated ? <CheckCircle2 className="h-3 w-3" /> : '2'}
            </div>
            Sign Authentication Message
          </div>
          
          <div className="pl-8">
            <Button
              onClick={handleSignIn}
              disabled={!isConnected || isSigningIn || authLoading}
              className="w-full"
              size="sm"
            >
              {isSigningIn || authLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Signing...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Sign In with Ethereum
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {authError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {authError}
            </AlertDescription>
          </Alert>
        )}

        {/* Security Notice */}
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700">
              <div className="font-medium mb-1">Secure Authentication</div>
              <div>
                We use Sign-In with Ethereum (SIWE) to verify wallet ownership. 
                Your private keys never leave your wallet.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}