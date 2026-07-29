'use client';

import { useState } from 'react';
import { Loader2, Users, Vote, PlusCircle } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits } from 'viem';

import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getContractAddress, BASE_SEPOLIA_CHAIN_ID } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const COMMUNITY_TREASURY_ABI = [
  { name: 'createCircle', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'maxMembers', type: 'uint256' }, { name: 'approvalThreshold', type: 'uint8' }], outputs: [{ name: 'poolId', type: 'uint256' }] },
  { name: 'joinCircle', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'poolId', type: 'uint256' }], outputs: [] },
  { name: 'contribute', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'poolId', type: 'uint256' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'proposeAction', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'poolId', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: 'actionId', type: 'uint256' }] },
  { name: 'vote', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'actionId', type: 'uint256' }], outputs: [] },
] as const;

const GOVERNANCE_ABI = [
  { name: 'propose', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'action', type: 'bytes' }, { name: 'votingPeriod', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'castVote', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'proposalId', type: 'uint256' }, { name: 'support', type: 'bool' }], outputs: [] },
] as const;


export default function CommunityPage() {
  const { isLoading: authLoading } = useAuthGuard();
  const { } = useAccount();

  if (authLoading) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <main id="main-content" className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community</h1>
          <p className="mt-2 text-muted-foreground">
            Create savings circles, contribute to pools, and participate in governance.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <CreateCircleCard />
          <JoinCircleCard />
          <ContributeCard />
          <VoteCard />
        </div>
      </div>
    </main>
  );
}

function CreateCircleCard() {
  const [maxMembers, setMaxMembers] = useState('5');
  const [threshold, setThreshold] = useState('3');
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  let treasuryAddress: `0x${string}`;
  try {
    treasuryAddress = getContractAddress('CommunityTreasury', BASE_SEPOLIA_CHAIN_ID) as `0x${string}`;
  } catch {
    treasuryAddress = '0x0000000000000000000000000000000000000000';
  }

  const handleCreate = () => {
    writeContract({
      address: treasuryAddress,
      abi: COMMUNITY_TREASURY_ABI,
      functionName: 'createCircle',
      args: [BigInt(maxMembers), parseInt(threshold)],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PlusCircle className="h-5 w-5 text-blue-600" />
          Create Savings Circle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Max Members</Label>
          <Input type="number" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} min="2" max="50" />
        </div>
        <div className="space-y-2">
          <Label>Approval Threshold (votes needed)</Label>
          <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} min="1" max={maxMembers} />
        </div>
        {isSuccess && (
          <Alert><AlertTitle>Circle Created!</AlertTitle><AlertDescription>Transaction: {hash?.slice(0, 14)}...</AlertDescription></Alert>
        )}
        {error && (
          <Alert variant="destructive"><AlertDescription>{error.message.slice(0, 100)}</AlertDescription></Alert>
        )}
        <Button onClick={handleCreate} disabled={isPending} className="w-full">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Create Circle
        </Button>
      </CardContent>
    </Card>
  );
}

function JoinCircleCard() {
  const [poolId, setPoolId] = useState('');
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  let treasuryAddress: `0x${string}`;
  try {
    treasuryAddress = getContractAddress('CommunityTreasury', BASE_SEPOLIA_CHAIN_ID) as `0x${string}`;
  } catch {
    treasuryAddress = '0x0000000000000000000000000000000000000000';
  }

  const handleJoin = () => {
    writeContract({
      address: treasuryAddress,
      abi: COMMUNITY_TREASURY_ABI,
      functionName: 'joinCircle',
      args: [BigInt(poolId)],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-emerald-600" />
          Join Circle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Circle ID</Label>
          <Input type="number" value={poolId} onChange={(e) => setPoolId(e.target.value)} placeholder="Enter circle ID" />
        </div>
        {isSuccess && (
          <Alert><AlertTitle>Joined!</AlertTitle><AlertDescription>You are now a member.</AlertDescription></Alert>
        )}
        {error && (
          <Alert variant="destructive"><AlertDescription>{error.message.slice(0, 100)}</AlertDescription></Alert>
        )}
        <Button onClick={handleJoin} disabled={isPending || !poolId} className="w-full">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Join Circle
        </Button>
      </CardContent>
    </Card>
  );
}

function ContributeCard() {
  const [poolId, setPoolId] = useState('');
  const [amount, setAmount] = useState('');
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  let treasuryAddress: `0x${string}`;
  try {
    treasuryAddress = getContractAddress('CommunityTreasury', BASE_SEPOLIA_CHAIN_ID) as `0x${string}`;
  } catch {
    treasuryAddress = '0x0000000000000000000000000000000000000000';
  }

  const handleContribute = () => {
    const amountUsdc = parseUnits(amount, 6);
    writeContract({
      address: treasuryAddress,
      abi: COMMUNITY_TREASURY_ABI,
      functionName: 'contribute',
      args: [BigInt(poolId), amountUsdc],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-lg">💰</span>
          Contribute to Pool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Circle/Pool ID</Label>
          <Input type="number" value={poolId} onChange={(e) => setPoolId(e.target.value)} placeholder="Circle ID" />
        </div>
        <div className="space-y-2">
          <Label>Amount (USDC)</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" />
        </div>
        {isSuccess && (
          <Alert><AlertTitle>Contributed!</AlertTitle><AlertDescription>Transaction: {hash?.slice(0, 14)}...</AlertDescription></Alert>
        )}
        {error && (
          <Alert variant="destructive"><AlertDescription>{error.message.slice(0, 100)}</AlertDescription></Alert>
        )}
        <Button onClick={handleContribute} disabled={isPending || !poolId || !amount} className="w-full">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Contribute
        </Button>
        <p className="text-xs text-muted-foreground">Requires USDC approval for CommunityTreasury first.</p>
      </CardContent>
    </Card>
  );
}

function VoteCard() {
  const [proposalId, setProposalId] = useState('');
  const [support, setSupport] = useState(true);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  let governanceAddress: `0x${string}`;
  try {
    governanceAddress = getContractAddress('Governance', BASE_SEPOLIA_CHAIN_ID) as `0x${string}`;
  } catch {
    governanceAddress = '0x0000000000000000000000000000000000000000';
  }

  const handleVote = () => {
    writeContract({
      address: governanceAddress,
      abi: GOVERNANCE_ABI,
      functionName: 'castVote',
      args: [BigInt(proposalId), support],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Vote className="h-5 w-5 text-purple-600" />
          Vote on Proposal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Proposal ID</Label>
          <Input type="number" value={proposalId} onChange={(e) => setProposalId(e.target.value)} placeholder="Enter proposal ID" />
        </div>
        <div className="flex gap-2">
          <Button variant={support ? 'default' : 'outline'} size="sm" onClick={() => setSupport(true)} className="flex-1">
            For ✓
          </Button>
          <Button variant={!support ? 'destructive' : 'outline'} size="sm" onClick={() => setSupport(false)} className="flex-1">
            Against ✗
          </Button>
        </div>
        {isSuccess && (
          <Alert><AlertTitle>Vote Cast!</AlertTitle><AlertDescription>Your vote has been recorded on-chain.</AlertDescription></Alert>
        )}
        {error && (
          <Alert variant="destructive"><AlertDescription>{error.message.slice(0, 100)}</AlertDescription></Alert>
        )}
        <Button onClick={handleVote} disabled={isPending || !proposalId} className="w-full">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Cast Vote
        </Button>
      </CardContent>
    </Card>
  );
}
