'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, ExternalLink, TrendingUp, Target, Users, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Action types that the AI can recommend
 */
export type ActionType =
  | 'deposit_savings'
  | 'create_goal'
  | 'join_circle'
  | 'invest_pool'
  | 'withdraw_funds'
  | 'view_portfolio';

/**
 * Action data from AI recommendations
 */
export interface AIAction {
  type: ActionType;
  title: string;
  description: string;
  amount?: string;
  targetAddress?: string;
  requiresSignature: boolean;
  estimatedGas?: string;
}

/**
 * Props for ActionButton component
 */
interface ActionButtonProps {
  action: AIAction;
  onExecute?: (action: AIAction) => Promise<void>;
  className?: string;
}

/**
 * ActionButton component for AI-recommended financial actions.
 *
 * Implements Task 21.8 requirement for recommended actions requiring wallet signing.
 *
 * Features:
 * - Visual distinction for actions requiring wallet signatures
 * - Integration with wallet connection state
 * - Loading states during transaction execution
 * - Error handling for failed transactions
 * - Gas estimation display where available
 * - Clear visual indicators for action types
 */
export function ActionButton({ action, onExecute, className }: ActionButtonProps) {
  const { isConnected } = useAccount();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get icon for action type
   */
  const getActionIcon = (type: ActionType) => {
    switch (type) {
      case 'deposit_savings':
        return <Wallet className="h-4 w-4" />;
      case 'create_goal':
        return <Target className="h-4 w-4" />;
      case 'join_circle':
        return <Users className="h-4 w-4" />;
      case 'invest_pool':
        return <TrendingUp className="h-4 w-4" />;
      case 'withdraw_funds':
        return <Wallet className="h-4 w-4" />;
      case 'view_portfolio':
        return <ExternalLink className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  /**
   * Get button variant based on action type and requirements
   */
  const getVariant = () => {
    if (action.requiresSignature) {
      return 'default'; // Primary variant for signing actions
    }
    return 'outline'; // Secondary variant for read-only actions
  };

  /**
   * Handle action execution
   */
  const handleExecute = async () => {
    if (!isConnected && action.requiresSignature) {
      setError('Please connect your wallet to perform this action');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      if (onExecute) {
        await onExecute(action);
      } else {
        // Default behavior for navigation actions
        if (action.type === 'view_portfolio') {
          window.location.href = '/dashboard';
        }
      }
    } catch (err) {
      console.error('Action execution failed:', err);
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Button
        onClick={handleExecute}
        disabled={isExecuting || (!isConnected && action.requiresSignature)}
        variant={getVariant()}
        size="sm"
        className="w-full justify-start"
      >
        {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : getActionIcon(action.type)}
        <span className="ml-2">{action.title}</span>
        {action.requiresSignature && (
          <Badge variant="secondary" className="ml-auto">
            Signature Required
          </Badge>
        )}
      </Button>

      {/* Action details */}
      <div className="text-xs text-muted-foreground px-3">
        <p>{action.description}</p>
        {action.amount && (
          <p className="mt-1">
            <span className="font-medium">Amount:</span> {action.amount}
          </p>
        )}
        {action.estimatedGas && (
          <p className="mt-1">
            <span className="font-medium">Est. Gas:</span> {action.estimatedGas}
          </p>
        )}
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Connection warning for signature actions */}
      {!isConnected && action.requiresSignature && (
        <Alert className="mt-2">
          <AlertDescription>Connect your wallet to perform this action</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Container for multiple action buttons from AI recommendations
 */
interface ActionButtonsProps {
  actions: AIAction[];
  onExecuteAction?: (action: AIAction) => Promise<void>;
  className?: string;
}

export function ActionButtons({ actions, onExecuteAction, className }: ActionButtonsProps) {
  if (actions.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-sm font-medium text-muted-foreground">Recommended Actions</div>
      <div className="space-y-2">
        {actions.map((action, index) => (
          <ActionButton
            key={index}
            action={action}
            {...(onExecuteAction && { onExecute: onExecuteAction })}
          />
        ))}
      </div>
    </div>
  );
}
