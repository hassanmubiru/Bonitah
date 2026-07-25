'use client';

import { type Address } from 'viem';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export interface VerificationStatusProps {
  isVerified: boolean;
  userAddress: Address;
}

/**
 * Displays user verification status from Registry contract.
 * Shows verification badges and status information.
 */
export function VerificationStatus({ isVerified }: VerificationStatusProps) {
  return (
    <Badge
      variant={isVerified ? "default" : "secondary"}
      className="flex items-center gap-1"
    >
      {isVerified ? (
        <>
          <CheckCircle className="h-3 w-3" />
          Verified
        </>
      ) : (
        <>
          <XCircle className="h-3 w-3" />
          Unverified
        </>
      )}
    </Badge>
  );
}

/**
 * Detailed verification status component for profile page.
 */
export function VerificationDetails({ isVerified, userAddress }: VerificationStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Verification Status
          <VerificationStatus isVerified={isVerified} userAddress={userAddress} />
        </CardTitle>
        <CardDescription>
          Identity verification through the Registry contract
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isVerified ? (
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  Account Verified
                </p>
                <p className="text-sm text-muted-foreground">
                  Your identity has been verified by a trusted verifier. This gives you
                  access to additional platform features and increased reputation.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  Verification Pending
                </p>
                <p className="text-sm text-muted-foreground">
                  Your account is not yet verified. Upload verification documents
                  and wait for a trusted verifier to approve your identity.
                </p>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Verification Benefits</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Access to premium platform features</li>
              <li>• Higher reputation score multiplier</li>
              <li>• Trusted member status in community</li>
              <li>• Enhanced investment opportunities</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}