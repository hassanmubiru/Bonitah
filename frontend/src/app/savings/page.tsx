'use client';

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract } from 'wagmi';

import { useAuthGuard } from '@/hooks/useAuthGuard';
import {
  useSavingsVaultBalances,
  useSavingsVaultDeposit,
  useSavingsVaultWithdraw,
  useTokenBalance,
  formatTokenAmount,
  validateAmount,
} from '@/hooks/useSavingsVault';
import { getContractAddress, BASE_SEPOLIA_CHAIN_ID } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Registry ABI for register()
const REGISTRY_ABI = [
  { name: 'register', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'isRegistered', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
] as const;

// USDC ABI for approve
const USDC_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;

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

        {/* Registration & Approval Steps - only show if needed */}
        <SetupCard />

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


function SetupCard() {
  const { address } = useAccount();

  let registryAddress: `0x${string}`;
  let savingsVaultAddress: `0x${string}`;
  try {
    registryAddress = getContractAddress('Registry', BASE_SEPOLIA_CHAIN_ID) as `0x${string}`;
    savingsVaultAddress = getContractAddress('SavingsVault', BASE_SEPOLIA_CHAIN_ID) as `0x${string}`;
  } catch {
    registryAddress = '0x0000000000000000000000000000000000000000';
    savingsVaultAddress = '0x0000000000000000000000000000000000000000';
  }

  const usdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;

  // Check if already registered
  const { data: isRegistered } = useReadContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Check USDC allowance
  const { data: allowance } = useReadContract({
    address: usdcAddress,
    abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const,
    functionName: 'allowance',
    args: address ? [address, savingsVaultAddress] : undefined,
    query: { enabled: !!address },
  });

  const registered = isRegistered === true;
  const approved = allowance !== undefined && (allowance as bigint) > BigInt(0);

  // Hide the card entirely if both steps are done
  if (registered && approved) return null;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg">Setup Required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Complete these steps before depositing:</p>
        <div className="space-y-3">
          {!registered && <RegistrationStep registryAddress={registryAddress} />}
          {registered && !approved && <ApprovalStep savingsVaultAddress={savingsVaultAddress} />}
        </div>
        <p className="text-xs text-muted-foreground">
          Need test USDC? Get from{' '}
          <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">
            Circle Faucet
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

function RegistrationStep({ registryAddress }: { registryAddress: `0x${string}` }) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleRegister = () => {
    writeContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: 'register',
    });
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <p className="text-sm font-medium">1. Register in BFN</p>
        <p className="text-xs text-muted-foreground">One-time registration to use platform features</p>
      </div>
      <Button size="sm" onClick={handleRegister} disabled={isPending || isSuccess}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isSuccess ? '✓ Done' : 'Register'}
      </Button>
    </div>
  );
}

function ApprovalStep({ savingsVaultAddress }: { savingsVaultAddress: `0x${string}` }) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const usdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
  const maxApproval = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');

  const handleApprove = () => {
    writeContract({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [savingsVaultAddress, maxApproval],
    });
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <p className="text-sm font-medium">2. Approve USDC</p>
        <p className="text-xs text-muted-foreground">Allow SavingsVault to use your USDC</p>
      </div>
      <Button size="sm" onClick={handleApprove} disabled={isPending || isSuccess}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isSuccess ? '✓ Done' : 'Approve'}
      </Button>
    </div>
  );
}
