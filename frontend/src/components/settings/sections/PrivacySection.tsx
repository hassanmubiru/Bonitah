'use client';

import { Shield, BarChart, Share, Eye, Activity } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettingsManager } from '@/hooks/useSettingsManager';

/**
 * Privacy and data control section
 * 
 * Features:
 * - Analytics and tracking controls
 * - Data sharing preferences
 * - Profile visibility settings
 * - Activity tracking options
 */
export function PrivacySection() {
  const { settings, updateSetting, isLoading } = useSettingsManager();

  if (isLoading) {
    return <PrivacySectionSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            Data & Analytics
          </CardTitle>
          <CardDescription>
            Control how your data is collected and used to improve the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="analytics-enabled" className="flex items-center gap-2">
                <BarChart className="h-4 w-4" />
                Analytics Collection
              </Label>
              <p className="text-sm text-muted-foreground">
                Allow anonymous usage analytics to help improve the platform
              </p>
            </div>
            <Switch
              id="analytics-enabled"
              checked={settings.analyticsEnabled}
              onCheckedChange={(checked) => updateSetting('analyticsEnabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="data-sharing" className="flex items-center gap-2">
                <Share className="h-4 w-4" />
                Data Sharing
              </Label>
              <p className="text-sm text-muted-foreground">
                Share anonymized data with research partners for financial inclusion studies
              </p>
            </div>
            <Switch
              id="data-sharing"
              checked={settings.dataSharing}
              onCheckedChange={(checked) => updateSetting('dataSharing', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="activity-tracking" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity Tracking
              </Label>
              <p className="text-sm text-muted-foreground">
                Track your app usage patterns for personalized recommendations
              </p>
            </div>
            <Switch
              id="activity-tracking"
              checked={settings.activityTracking}
              onCheckedChange={(checked) => updateSetting('activityTracking', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            Profile Visibility
          </CardTitle>
          <CardDescription>
            Control who can see your profile and activity on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="profile-visibility">Profile Visibility</Label>
              <p className="text-sm text-muted-foreground">
                Choose who can view your profile information and achievements
              </p>
            </div>
            <Select
              value={settings.profileVisibility}
              onValueChange={(value: 'public' | 'private' | 'friends') =>
                updateSetting('profileVisibility', value)
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="friends">Friends</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {settings.profileVisibility === 'public' && 'Public Profile'}
                {settings.profileVisibility === 'friends' && 'Friends Only'}
                {settings.profileVisibility === 'private' && 'Private Profile'}
              </p>
              <p className="text-xs text-muted-foreground">
                {settings.profileVisibility === 'public' &&
                  'Your profile and achievements are visible to all platform users.'}
                {settings.profileVisibility === 'friends' &&
                  'Only users in your network can see your profile information.'}
                {settings.profileVisibility === 'private' &&
                  'Your profile is only visible to you and platform administrators.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Privacy & Security Notice
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Your financial data is always private and secure. These settings only control
              non-financial information like profile details, achievements, and usage analytics.
              Transaction data is never shared and remains encrypted on the blockchain.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacySectionSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-muted rounded-md">
                <div className="h-4 w-4 bg-muted-foreground/20 rounded" />
              </div>
              <div className="h-5 w-32 bg-muted rounded" />
            </div>
            <div className="h-4 w-48 bg-muted rounded" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-56 bg-muted rounded" />
                  </div>
                  <div className="h-6 w-12 bg-muted rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}