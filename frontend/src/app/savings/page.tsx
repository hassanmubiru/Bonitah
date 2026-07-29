'use client';

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

import { useAuthGuard } from '@/hooks/useAuthGuard';
import {
  useSavingsVaultBalances,
  useSavingsVaultDeposit,
  useSavingsVaultWithdraw,
  useTokenBalance,
  formatTokenAmount,
  validateAmount,
} from '@/hooks/useSavingsVault';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Savings page implementing full SavingsVault integration.
 *
 * Implements Requirements:
 * - 4.2: Deposit flow with token amount input, validation, signed transactions
 * - 4.3: Withdraw flow with balance checking, validation, signed transactions  
 * - 11.7: Live balance reads from on-chain state
 * - Responsive design with accessibility support
 * - Loading/error states during blockchain operations
 * - Real-time balance updates after successful transactions
 */
export default function SavingsPage() {
  // Authentication guard - redirect to /auth if not authenticated
  const { isLoading: authLoading } = useAuthGuard();

  // State for deposit/withdraw forms
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  // Contract read hooks for live balance data
  const { availableBalance, portfolioValue, contractAddress } = useSavingsVaultBalances();

  // Token balance for deposit validation
  const tokenBalance = useTokenBalance();

  // Transaction hooks for deposit/withdraw operations
  const depositTx = useSavingsVaultDeposit();
  const withdrawTx = useSavingsVaultWithdraw();

  // Check if contracts are deployed
  const contractsDeployed = !!contractAddress;

  // Form validation
  const depositValidation = validateAmount(depositAmount, tokenBalance.data);
  const withdrawValidation = validateAmount(withdrawAmount, availableBalance.data);

  // Handle successful transactions - reset forms and refetch balances
  useEffect(() => {
    if (depositTx.isSuccess) {
      setDepositAmount('');
      // Balances will refresh automatically due to cache invalidation
      setTimeout(() => {
        availableBalance.refetch();
        portfolioValue.refetch();
        tokenBalance.refetch();
      }, 2000); // Small delay to allow blockchain state to update
    }
  }, [depositTx.isSuccess, availableBalance, portfolioValue, tokenBalance]);

  useEffect(() => {
    if (withdrawTx.isSuccess) {
      setWithdrawAmount('');
      // Balances will refresh automatically due to cache invalidation
      setTimeout(() => {
        availableBalance.refetch();
        portfolioValue.refetch();
        tokenBalance.refetch();
      }, 2000);
    }
  }, [withdrawTx.isSuccess, availableBalance, portfolioValue, tokenBalance]);

  // Handle deposit submission
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!depositValidation.isValid) return;

    try {
      await depositTx.deposit(depositAmount);
    } catch (error) {
      console.error('Deposit failed:', error);
    }
  };

  // Handle withdraw submission
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!withdrawValidation.isValid) return;

    try {
      await withdrawTx.withdraw(withdrawAmount);
    } catch (error) {
      console.error('Withdraw failed:', error);
    }
  };

  // Loading state during authentication
  if (authLoading) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-8">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <main id="main-content" className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Savings</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your deposits and withdrawals in the SavingsVault
          </p>
        </div>

        {/* Registration & Approval Info */}
        <Alert className="mb-8">
          <AlertDescription>
            <strong>Before depositing:</strong>
            <ol className="mt-2 list-decimal list-inside space-y-1 text-sm">
              <li>
                You must be <strong>registered</strong> in the BFN Registry contract
              </li>
              <li>
                You need <strong>USDC tokens</strong> on Base Sepolia (get from{' '}
                <a
                  href="https://faucet.circle.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-600"
                >
                  Circle Faucet
                </a>
                )
              </li>
              <li>
                You must <strong>approve</strong> the SavingsVault to spend your USDC
              </li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Contract Deployment Warning */}
        {!contractsDeployed && (
          <Alert className="mb-8">
            <AlertDescription>
              The SavingsVault contracts haven&apos;t been deployed to Base Sepolia yet.
            </AlertDescription>
          </Alert>
        )}

        {/* Balance Overview Cards */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          {/* Available Balance Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => availableBalance.refetch()}
                disabled={availableBalance.isLoading}
                aria-label="Refresh available balance"
              >
                <RefreshCw
                  className={`h-4 w-4 ${availableBalance.isLoading ? 'animate-spin' : ''}`}
                />
              </Button>
            </CardHeader>
            <CardContent>
              {availableBalance.isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : availableBalance.isError ? (
                <div>
                  <p className="text-2xl font-bold text-destructive">Error</p>
                  <p className="text-sm text-muted-foreground">Failed to load balance</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => availableBalance.refetch()}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold">
                    {formatTokenAmount(availableBalance.data)} USDC
                  </div>
                  <p className="text-sm text-muted-foreground">Available for withdrawal</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Portfolio Value Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Portfolio</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => portfolioValue.refetch()}
                disabled={portfolioValue.isLoading}
                aria-label="Refresh portfolio value"
              >
                <RefreshCw
                  className={`h-4 w-4 ${portfolioValue.isLoading ? 'animate-spin' : ''}`}
                />
              </Button>
            </CardHeader>
            <CardContent>
              {portfolioValue.isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : portfolioValue.isError ? (
                <div>
                  <p className="text-2xl font-bold text-destructive">Error</p>
                  <p className="text-sm text-muted-foreground">Failed to load portfolio value</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => portfolioValue.refetch()}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold">
                    {formatTokenAmount(portfolioValue.data)} USDC
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Including deposits, goals, and locks
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Wallet Balance Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {tokenBalance.isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading wallet balance...</span>
              </div>
            ) : tokenBalance.isError ? (
              <div>
                <p className="text-sm text-destructive">Failed to load wallet balance</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => tokenBalance.refetch()}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            ) : (
              <div className="text-lg font-semibold">{tokenBalance.formatted} USDC</div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Forms */}
        <Card>
          <CardHeader>
            <div className="flex space-x-1 rounded-lg bg-muted p-1">
              <Button
                variant={activeTab === 'deposit' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('deposit')}
                className="flex-1"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Deposit
              </Button>
              <Button
                variant={activeTab === 'withdraw' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('withdraw')}
                className="flex-1"
              >
                <TrendingDown className="mr-2 h-4 w-4" />
                Withdraw
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === 'deposit' ? (
              <form onSubmit={handleDeposit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deposit-amount">Amount to Deposit</Label>
                  <Input
                    id="deposit-amount"
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    disabled={depositTx.isLoading}
                    className={
                      !depositValidation.isValid && depositAmount ? 'border-destructive' : ''
                    }
                  />
                  {!depositValidation.isValid && depositAmount && (
                    <p className="text-sm text-destructive">{depositValidation.error}</p>
                  )}
                </div>

                {/* Success/Error Messages */}
                {depositTx.isSuccess && (
                  <Alert>
                    <AlertTitle>Deposit Successful!</AlertTitle>
                    <AlertDescription>
                      Your deposit has been processed. Your balance will update shortly.
                    </AlertDescription>
                  </Alert>
                )}

                {depositTx.error && (
                  <Alert variant="destructive">
                    <AlertTitle>Deposit Failed</AlertTitle>
                    <AlertDescription>
                      {depositTx.error.message || 'An error occurred during deposit'}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={
                    !depositValidation.isValid ||
                    depositTx.isLoading ||
                    !depositAmount ||
                    !contractsDeployed
                  }
                  className="w-full"
                >
                  {depositTx.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Deposit...
                    </>
                  ) : !contractsDeployed ? (
                    'Contracts Not Deployed'
                  ) : (
                    'Deposit'
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleWithdraw} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="withdraw-amount">Amount to Withdraw</Label>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    disabled={withdrawTx.isLoading}
                    className={
                      !withdrawValidation.isValid && withdrawAmount ? 'border-destructive' : ''
                    }
                  />
                  {!withdrawValidation.isValid && withdrawAmount && (
                    <p className="text-sm text-destructive">{withdrawValidation.error}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Available: {formatTokenAmount(availableBalance.data)} USDC
                  </p>
                </div>

                {/* Success/Error Messages */}
                {withdrawTx.isSuccess && (
                  <Alert>
                    <AlertTitle>Withdrawal Successful!</AlertTitle>
                    <AlertDescription>
                      Your withdrawal has been processed. Your balance will update shortly.
                    </AlertDescription>
                  </Alert>
                )}

                {withdrawTx.error && (
                  <Alert variant="destructive">
                    <AlertTitle>Withdrawal Failed</AlertTitle>
                    <AlertDescription>
                      {withdrawTx.error.message || 'An error occurred during withdrawal'}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={
                    !withdrawValidation.isValid ||
                    withdrawTx.isLoading ||
                    !withdrawAmount ||
                    !contractsDeployed
                  }
                  className="w-full"
                >
                  {withdrawTx.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Withdrawal...
                    </>
                  ) : !contractsDeployed ? (
                    'Contracts Not Deployed'
                  ) : (
                    'Withdraw'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Transaction Status */}
        {(depositTx.hash || withdrawTx.hash) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Transaction Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {depositTx.hash && (
                  <div>
                    <p className="text-sm font-medium">Deposit Transaction</p>
                    <p className="break-all text-sm text-muted-foreground">
                      Hash: {depositTx.hash}
                    </p>
                    <p className="text-sm">
                      Status:{' '}
                      {depositTx.isLoading
                        ? 'Confirming...'
                        : depositTx.isSuccess
                          ? 'Confirmed'
                          : 'Failed'}
                    </p>
                  </div>
                )}
                {withdrawTx.hash && (
                  <div>
                    <p className="text-sm font-medium">Withdrawal Transaction</p>
                    <p className="break-all text-sm text-muted-foreground">
                      Hash: {withdrawTx.hash}
                    </p>
                    <p className="text-sm">
                      Status:{' '}
                      {withdrawTx.isLoading
                        ? 'Confirming...'
                        : withdrawTx.isSuccess
                          ? 'Confirmed'
                          : 'Failed'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
